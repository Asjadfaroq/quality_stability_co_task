using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;

namespace ServiceMarketplace.API.BackgroundJobs;

/// <summary>
/// Deletes audit log rows older than the configured retention window, bounding the table's
/// size permanently so it can never consume the database quota.
///
/// Retention defaults to 1 hour and is configurable via <c>AuditLog:RetentionMinutes</c>;
/// the sweep interval is <c>AuditLog:CleanupIntervalMinutes</c> (default 10). Because the
/// job only ever deletes below a cutoff, storage reaches a steady state proportional to the
/// audit volume produced within one retention window rather than growing without bound.
///
/// Deletion uses ExecuteDeleteAsync, which emits a single
/// <c>DELETE FROM "AuditLogs" WHERE "Timestamp" &lt; @cutoff</c> — no rows are materialised,
/// and the descending index on Timestamp serves the range scan.
///
/// A sweep also runs once at startup: on platforms that idle the container, the process may
/// have been stopped for far longer than the retention window, so the first tick would
/// otherwise leave stale rows visible until the interval elapsed.
/// </summary>
public sealed class AuditLogCleanupJob : BackgroundService
{
    private readonly IServiceScopeFactory          _scopeFactory;
    private readonly ILogger<AuditLogCleanupJob>   _logger;
    private readonly TimeSpan                      _retention;
    private readonly TimeSpan                      _interval;

    public AuditLogCleanupJob(
        IServiceScopeFactory        scopeFactory,
        IConfiguration              configuration,
        ILogger<AuditLogCleanupJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;

        _retention = TimeSpan.FromMinutes(
            Math.Max(1, configuration.GetValue("AuditLog:RetentionMinutes", 60)));
        _interval = TimeSpan.FromMinutes(
            Math.Max(1, configuration.GetValue("AuditLog:CleanupIntervalMinutes", 10)));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "AuditLogCleanupJob started — runs every {Interval} and deletes audit logs older than {Retention}.",
            _interval,
            _retention);

        // Immediate sweep so a restart after a long idle period does not surface stale rows.
        await SweepSafelyAsync(stoppingToken);

        using var timer = new PeriodicTimer(_interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
            await SweepSafelyAsync(stoppingToken);

        _logger.LogInformation("AuditLogCleanupJob stopping.");
    }

    private async Task SweepSafelyAsync(CancellationToken ct)
    {
        try
        {
            await PurgeAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "AuditLogCleanupJob failed during purge. Will retry on next tick.");
        }
    }

    private async Task PurgeAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - _retention;

        var deleted = await db.AuditLogs
            .Where(a => a.Timestamp < cutoff)
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            _logger.LogInformation(
                "AuditLogCleanupJob deleted {Count} audit log(s) older than {Retention}.",
                deleted,
                _retention);
        else
            _logger.LogDebug("AuditLogCleanupJob: no audit logs eligible for deletion.");
    }
}
