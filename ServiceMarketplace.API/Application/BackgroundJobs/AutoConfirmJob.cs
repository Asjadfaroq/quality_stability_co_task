using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Hubs;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.BackgroundJobs;

/// <summary>
/// Runs every 30 minutes and auto-completes any request that has been sitting in
/// <see cref="RequestStatus.PendingConfirmation"/> for longer than 24 hours without
/// the customer explicitly confirming it.
///
/// Why this exists:
///   When a provider marks a job complete, the status moves to PendingConfirmation
///   and a SignalR event is sent to the customer.  If the customer never responds
///   (offline, forgot, etc.) the job would remain stuck in that state forever.
///   This worker closes that gap automatically.
///
/// SignalR events fired (mirrors what RequestService.ConfirmAsync sends):
///   → provider group : "RequestConfirmed"
///   → customer group : "RequestStatusUpdated"
/// </summary>
public sealed class AutoConfirmJob : BackgroundService
{
    // How often the worker wakes up to check for stale requests.
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    // How long a request must be in PendingConfirmation before it is auto-confirmed.
    private static readonly TimeSpan ConfirmationWindow = TimeSpan.FromHours(24);

    private readonly IServiceScopeFactory    _scopeFactory;
    private readonly ILogger<AutoConfirmJob> _logger;

    public AutoConfirmJob(IServiceScopeFactory scopeFactory, ILogger<AutoConfirmJob> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "AutoConfirmJob started — polling every {Interval} for requests stuck in PendingConfirmation.",
            Interval);

        using var timer = new PeriodicTimer(Interval);

        // WaitForNextTickAsync returns false when the host is shutting down.
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Log the error but keep the worker alive — a transient DB blip should not
                // kill the background service for the lifetime of the process.
                _logger.LogError(ex, "AutoConfirmJob failed during batch processing. Will retry on next tick.");
            }
        }

        _logger.LogInformation("AutoConfirmJob stopping.");
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        // BackgroundService is a singleton, but AppDbContext and IHubContext<T> are scoped.
        // Always create a fresh scope per tick so we never share a DbContext across ticks.
        await using var scope = _scopeFactory.CreateAsyncScope();

        var db  = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();

        var cutoff = DateTime.UtcNow - ConfirmationWindow;

        // Materialise only the rows we are going to change so EF can track them.
        // UpdatedAt on a PendingConfirmation request is set at the moment the provider
        // clicked "complete" — it does not change again until a transition occurs — so
        // it is a reliable timestamp for the 24-hour window.
        var staleRequests = await db.ServiceRequests
            .Where(r => r.Status == RequestStatus.PendingConfirmation && r.UpdatedAt < cutoff)
            .ToListAsync(ct);

        if (staleRequests.Count == 0)
        {
            _logger.LogDebug("AutoConfirmJob: no stale PendingConfirmation requests found.");
            return;
        }

        var now = DateTime.UtcNow;

        foreach (var request in staleRequests)
        {
            request.Status    = RequestStatus.Completed;
            request.UpdatedAt = now;
        }

        // Single SaveChanges for the whole batch — one round-trip regardless of count.
        await db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "AutoConfirmJob auto-confirmed {Count} request(s) that received no customer response within {Hours}h.",
            staleRequests.Count,
            ConfirmationWindow.TotalHours);

        // Notify all affected parties over SignalR.
        // This runs after SaveChanges so the DB is always consistent even if hub calls fail.
        // Each notification is fire-and-forget at the hub level — connected clients may or may
        // not be online, which is fine.
        foreach (var request in staleRequests)
        {
            var payload = new { requestId = request.Id, title = request.Title };

            // Tell the provider their job has been confirmed (same event as RequestService.ConfirmAsync).
            if (request.AcceptedByProviderId.HasValue)
            {
                await hub.Clients
                    .Group(request.AcceptedByProviderId.Value.ToString())
                    .SendAsync("RequestConfirmed", payload, ct);
            }

            // Tell the customer the status changed so their UI refreshes.
            await hub.Clients
                .Group(request.CustomerId.ToString())
                .SendAsync("RequestStatusUpdated", payload, ct);
        }
    }
}
