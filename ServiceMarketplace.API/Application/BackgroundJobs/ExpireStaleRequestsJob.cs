using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.BackgroundJobs;

/// <summary>
/// Runs every 6 hours and hard-deletes <see cref="RequestStatus.Pending"/> requests
/// that have not been accepted within 7 days of creation.
///
/// Why deletion instead of an "Expired" status:
///   Adding a new status value requires a migration, frontend badge handling, and
///   filtering changes in RequestService.GetAllAsync for the provider feed.  For an
///   MVP marketplace, a stale Pending request has zero operational value — no provider
///   wants it and no customer is waiting on it — so deletion is the simplest correct
///   behaviour and keeps the ServiceRequests table small.
///
/// Why 7 days / 6-hour polling:
///   7 days gives customers a reasonable window before their request disappears.
///   6-hour polling means a request is cleaned up at most 6 hours after it expires —
///   precise-to-the-minute accuracy is unnecessary for a hygiene job.
/// </summary>
public sealed class ExpireStaleRequestsJob : BackgroundService
{
    private static readonly TimeSpan Interval   = TimeSpan.FromHours(6);
    private static readonly TimeSpan StaleCutoff = TimeSpan.FromDays(7);

    private readonly IServiceScopeFactory         _scopeFactory;
    private readonly ILogger<ExpireStaleRequestsJob> _logger;

    public ExpireStaleRequestsJob(IServiceScopeFactory scopeFactory, ILogger<ExpireStaleRequestsJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "ExpireStaleRequestsJob started — polling every {Interval} for Pending requests older than {Days} days.",
            Interval,
            StaleCutoff.TotalDays);

        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "ExpireStaleRequestsJob failed during batch processing. Will retry on next tick.");
            }
        }

        _logger.LogInformation("ExpireStaleRequestsJob stopping.");
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - StaleCutoff;

        // ExecuteDeleteAsync issues a single DELETE ... WHERE statement directly in SQL.
        // No entities are loaded into memory — this is efficient even at large row counts.
        // EF Core cascades are NOT fired for ExecuteDeleteAsync, but ServiceRequests has no
        // owned child rows that need cascading (ChatMessages belong to accepted requests,
        // not Pending ones, so there is nothing to cascade here).
        var deleted = await db.ServiceRequests
            .Where(r => r.Status == RequestStatus.Pending && r.CreatedAt < cutoff)
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            _logger.LogInformation(
                "ExpireStaleRequestsJob deleted {Count} Pending request(s) older than {Days} days.",
                deleted,
                StaleCutoff.TotalDays);
        else
            _logger.LogDebug("ExpireStaleRequestsJob: no stale Pending requests found.");
    }
}
