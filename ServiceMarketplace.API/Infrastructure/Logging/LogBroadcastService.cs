using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Hubs;

namespace ServiceMarketplace.API.Logging;

/// <summary>
/// Background service that drains <see cref="LogBuffer"/> and routes entries
/// to the correct SignalR audience:
/// <list type="bullet">
///   <item>All entries → <see cref="AdminLogsHub"/> admin group.</item>
///   <item>Audit entries → <see cref="ActivityHub"/> per-user group (actor only).</item>
/// </list>
/// </summary>
public sealed class LogBroadcastService : BackgroundService
{
    private readonly LogBuffer                   _buffer;
    private readonly IHubContext<AdminLogsHub>   _adminHub;
    private readonly IHubContext<ActivityHub>    _activityHub;
    private readonly ILogger<LogBroadcastService> _logger;

    public LogBroadcastService(
        LogBuffer                     buffer,
        IHubContext<AdminLogsHub>     adminHub,
        IHubContext<ActivityHub>      activityHub,
        ILogger<LogBroadcastService>  logger)
    {
        _buffer      = buffer;
        _adminHub    = adminHub;
        _activityHub = activityHub;
        _logger      = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Log broadcast service started.");

        try
        {
            await foreach (var entry in _buffer.Reader.ReadAllAsync(stoppingToken))
            {
                // Admins receive every entry (system + audit), filterable on the client
                await _adminHub.Clients
                    .Group(AdminLogsHub.AdminGroup)
                    .SendAsync("LogEntry", entry, stoppingToken);

                // Normal users receive only their own audit events
                if (entry.Category == LogCategory.Audit && entry.ActorUserId is not null)
                {
                    await _activityHub.Clients
                        .Group(ActivityHub.GroupPrefix + entry.ActorUserId)
                        .SendAsync("ActivityEntry", entry, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown — not an error
        }

        _logger.LogInformation("Log broadcast service stopped.");
    }
}
