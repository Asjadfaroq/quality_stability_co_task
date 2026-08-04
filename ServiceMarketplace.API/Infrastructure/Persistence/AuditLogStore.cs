using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Data;

/// <summary>
/// EF Core backed <see cref="IAuditLogStore"/>.
///
/// Every method swallows exceptions and logs them instead of propagating: audit persistence
/// is observability, and a database hiccup must never fail the user action that triggered it
/// nor tear down the background broadcast loop.
/// </summary>
public sealed class AuditLogStore : IAuditLogStore
{
    private readonly AppDbContext            _db;
    private readonly ILogger<AuditLogStore>  _logger;

    public AuditLogStore(AppDbContext db, ILogger<AuditLogStore> logger)
    {
        _db     = db;
        _logger = logger;
    }

    public async Task WriteAsync(LogEntry entry, CancellationToken ct = default)
    {
        if (entry.ActorUserId is null) return;

        try
        {
            _db.AuditLogs.Add(new AuditLog
            {
                Timestamp   = entry.Timestamp,
                ActorUserId = Truncate(entry.ActorUserId, 64),
                Action      = Truncate(entry.Action ?? "Unknown", 100),
                Message     = Truncate(entry.Message, 2000),
                Level       = Truncate(entry.Level, 20),
                TraceId     = entry.TraceId is null ? null : Truncate(entry.TraceId, 64)
            });

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to persist audit log entry for action {Action}.", entry.Action);
        }
    }

    public async Task<IReadOnlyList<LogEntry>> GetRecentAsync(int count, CancellationToken ct = default)
    {
        try
        {
            var rows = await _db.AuditLogs
                .AsNoTracking()
                .OrderByDescending(a => a.Timestamp)
                .Take(count)
                .ToListAsync(ct);

            return rows.Select(ToLogEntry).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to read audit logs.");
            return [];
        }
    }

    public async Task<IReadOnlyList<LogEntry>> GetForUserAsync(
        string userId, int count, CancellationToken ct = default)
    {
        try
        {
            var rows = await _db.AuditLogs
                .AsNoTracking()
                .Where(a => a.ActorUserId == userId)
                .OrderByDescending(a => a.Timestamp)
                .Take(count)
                .ToListAsync(ct);

            return rows.Select(ToLogEntry).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to read audit logs for user {UserId}.", userId);
            return [];
        }
    }

    private static LogEntry ToLogEntry(AuditLog a) => new(
        Level:         a.Level,
        Message:       a.Message,
        Exception:     null,
        SourceContext: null,
        Timestamp:     a.Timestamp,
        TraceId:       a.TraceId,
        Category:      LogCategory.Audit,
        ActorUserId:   a.ActorUserId,
        Action:        a.Action);

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
