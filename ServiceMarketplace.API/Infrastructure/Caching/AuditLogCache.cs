using System.Text.Json;
using System.Text.Json.Serialization;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Services.Interfaces;
using StackExchange.Redis;

namespace ServiceMarketplace.API.Services;

/// <summary>
/// Stores audit entries in Redis sorted sets scored by Unix timestamp (seconds).
/// Keys: sm:audit:user:{userId} (per-user) and sm:audit:all (global admin view).
/// On every write: ZADD + ZREMRANGEBYSCORE (prune >10 min old) + EXPIRE 600s.
/// </summary>
public sealed class AuditLogCache : IAuditLogCache
{
    private const int    TtlSeconds    = 600;
    private const string UserKeyPrefix = "sm:audit:user:";
    private const string AllKey        = "sm:audit:all";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters             = { new JsonStringEnumConverter() }
    };

    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<AuditLogCache>  _logger;

    public AuditLogCache(IConnectionMultiplexer? redis, ILogger<AuditLogCache> logger)
    {
        _redis  = redis;
        _logger = logger;
    }

    public async Task WriteAsync(LogEntry entry)
    {
        if (_redis is null || entry.ActorUserId is null) return;

        try
        {
            var db      = _redis.GetDatabase();
            var score   = ToScore(entry.Timestamp);
            var cutoff  = score - TtlSeconds;
            var member  = JsonSerializer.Serialize(entry, JsonOpts);
            var userKey = UserKeyPrefix + entry.ActorUserId;

            var batch = db.CreateBatch();

            var t1 = batch.SortedSetAddAsync(userKey, member, score);
            var t2 = batch.SortedSetRemoveRangeByScoreAsync(userKey, double.NegativeInfinity, cutoff);
            var t3 = batch.KeyExpireAsync(userKey, TimeSpan.FromSeconds(TtlSeconds));

            var t4 = batch.SortedSetAddAsync(AllKey, member, score);
            var t5 = batch.SortedSetRemoveRangeByScoreAsync(AllKey, double.NegativeInfinity, cutoff);
            var t6 = batch.KeyExpireAsync(AllKey, TimeSpan.FromSeconds(TtlSeconds));

            batch.Execute();

            await Task.WhenAll(t1, t2, t3, t4, t5, t6);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AuditLogCache: write failed for user {UserId}", entry.ActorUserId);
        }
    }

    public async Task<IReadOnlyList<LogEntry>> GetUserLogsAsync(string userId, int count = 50)
    {
        if (_redis is null) return [];

        try
        {
            var db      = _redis.GetDatabase();
            var userKey = UserKeyPrefix + userId;
            var cutoff  = ToScore(DateTime.UtcNow) - TtlSeconds;

            var values = await db.SortedSetRangeByScoreAsync(
                userKey, start: cutoff, stop: double.PositiveInfinity,
                order: Order.Ascending, take: count);

            return Deserialize(values);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AuditLogCache: read failed for user {UserId}", userId);
            return [];
        }
    }

    public async Task<IReadOnlyList<LogEntry>> GetAllAuditLogsAsync(int count = 200)
    {
        if (_redis is null) return [];

        try
        {
            var db     = _redis.GetDatabase();
            var cutoff = ToScore(DateTime.UtcNow) - TtlSeconds;

            var values = await db.SortedSetRangeByScoreAsync(
                AllKey, start: cutoff, stop: double.PositiveInfinity,
                order: Order.Ascending, take: count);

            return Deserialize(values);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AuditLogCache: global read failed");
            return [];
        }
    }

    private static double ToScore(DateTime utc) =>
        new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeSeconds();

    private static IReadOnlyList<LogEntry> Deserialize(RedisValue[] values)
    {
        var result = new List<LogEntry>(values.Length);
        foreach (var v in values)
        {
            if (v.IsNullOrEmpty) continue;
            try
            {
                var entry = JsonSerializer.Deserialize<LogEntry>((string)v!, JsonOpts);
                if (entry is not null) result.Add(entry);
            }
            catch { /* skip malformed members */ }
        }
        return result;
    }
}
