using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Hubs;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Logging;

public sealed class LogBroadcastService : BackgroundService
{
    private readonly LogBuffer                    _buffer;
    private readonly IHubContext<AdminLogsHub>    _adminHub;
    private readonly IHubContext<ActivityHub>     _activityHub;
    private readonly IAuditLogCache               _auditCache;
    private readonly ILogger<LogBroadcastService> _logger;

    public LogBroadcastService(
        LogBuffer                     buffer,
        IHubContext<AdminLogsHub>     adminHub,
        IHubContext<ActivityHub>      activityHub,
        IAuditLogCache                auditCache,
        ILogger<LogBroadcastService>  logger)
    {
        _buffer      = buffer;
        _adminHub    = adminHub;
        _activityHub = activityHub;
        _auditCache  = auditCache;
        _logger      = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Log broadcast service started.");

        try
        {
            await foreach (var entry in _buffer.Reader.ReadAllAsync(stoppingToken))
            {
                await _adminHub.Clients
                    .Group(AdminLogsHub.AdminGroup)
                    .SendAsync("LogEntry", entry, stoppingToken);

                if (entry.Category == LogCategory.Audit && entry.ActorUserId is not null)
                {
                    await _activityHub.Clients
                        .Group(ActivityHub.GroupPrefix + entry.ActorUserId)
                        .SendAsync("ActivityEntry", entry, stoppingToken);

                    await _auditCache.WriteAsync(entry);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }

        _logger.LogInformation("Log broadcast service stopped.");
    }
}
