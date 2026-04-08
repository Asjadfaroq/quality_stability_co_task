using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.BackgroundJobs;

/// <summary>
/// Runs once every 24 hours and hard-deletes chat messages that belong to
/// <see cref="RequestStatus.Completed"/> requests whose <c>UpdatedAt</c> is older
/// than 90 days.
///
/// Why 90 days:
///   Once a job is completed and confirmed, the customer-provider chat has no
///   operational purpose.  Retaining it for 90 days gives either party time to
///   retrieve any information they need (e.g. address, price agreed) before the
///   messages are purged.
///
/// Why UpdatedAt (not CreatedAt) on the ServiceRequest:
///   UpdatedAt is set at the moment the request transitions to Completed, so it
///   measures how long ago the job was finished — which is what matters for
///   retention, not when the request was originally created.
///
/// Join strategy:
///   ChatMessage has no EF navigation / FK relationship to ServiceRequest in
///   OnModelCreating — only a composite index on (RequestId, SentAt).  EF Core
///   therefore cannot use cascade deletes here.  Instead the query uses a subquery:
///
///     DELETE FROM ChatMessages
///     WHERE RequestId IN (
///         SELECT Id FROM ServiceRequests
///         WHERE Status = Completed AND UpdatedAt &lt; @cutoff
///     )
///
///   ExecuteDeleteAsync translates the LINQ to exactly that SQL — one round-trip,
///   no rows loaded into memory.
/// </summary>
public sealed class ChatCleanupJob : BackgroundService
{
    private static readonly TimeSpan Interval        = TimeSpan.FromHours(24);
    private static readonly TimeSpan RetentionPeriod = TimeSpan.FromDays(90);

    private readonly IServiceScopeFactory      _scopeFactory;
    private readonly ILogger<ChatCleanupJob>   _logger;

    public ChatCleanupJob(IServiceScopeFactory scopeFactory, ILogger<ChatCleanupJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "ChatCleanupJob started — runs every {Interval} and deletes messages older than {Days} days.",
            Interval,
            RetentionPeriod.TotalDays);

        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "ChatCleanupJob failed during batch processing. Will retry on next tick.");
            }
        }

        _logger.LogInformation("ChatCleanupJob stopping.");
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - RetentionPeriod;

        // Build the subquery for completed requests older than the retention window.
        // EF Core translates this IQueryable to an IN (SELECT ...) — not evaluated in memory.
        var staleRequestIds = db.ServiceRequests
            .Where(r => r.Status == RequestStatus.Completed && r.UpdatedAt < cutoff)
            .Select(r => r.Id);

        // Single DELETE ... WHERE RequestId IN (SELECT ...) round-trip.
        var deleted = await db.ChatMessages
            .Where(m => staleRequestIds.Contains(m.RequestId))
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            _logger.LogInformation(
                "ChatCleanupJob deleted {Count} message(s) from completed requests older than {Days} days.",
                deleted,
                RetentionPeriod.TotalDays);
        else
            _logger.LogDebug("ChatCleanupJob: no messages eligible for deletion.");
    }
}
