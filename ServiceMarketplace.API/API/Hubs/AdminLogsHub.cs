using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Hubs;

[Authorize]
public sealed class AdminLogsHub : Hub
{
    /// <summary>SignalR group that receives every broadcast log entry.</summary>
    public const string AdminGroup = "admin_logs";

    private readonly LogBuffer             _buffer;
    private readonly IAuditLogCache        _logCache;
    private readonly ILogger<AdminLogsHub> _logger;

    public AdminLogsHub(LogBuffer buffer, IAuditLogCache logCache, ILogger<AdminLogsHub> logger)
    {
        _buffer   = buffer;
        _logCache = logCache;
        _logger   = logger;
    }

    public override async Task OnConnectedAsync()
    {
        if (!IsAdmin())
        {
            _logger.LogWarning(
                "Rejected AdminLogsHub connection from non-admin user {UserId}.",
                GetUserId() ?? "unknown");
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup);

        // Redis has the last 10 minutes; in-memory buffer has since last-restart.
        // Union both so the admin sees history even after a cold start.
        var redisLogs    = await _logCache.GetAllLogsAsync(200);
        var bufferLogs   = _buffer.GetRecent(200);
        var recent = bufferLogs
            .UnionBy(redisLogs, e => (e.Timestamp, e.Action, e.ActorUserId))
            .OrderByDescending(e => e.Timestamp)
            .Take(200)
            .ToList();

        await Clients.Caller.SendAsync("RecentLogs", recent);

        _logger.LogInformation(
            "Admin {UserId} connected to AdminLogsHub (connection {ConnectionId}).",
            GetUserId(), Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AdminGroup);
        await base.OnDisconnectedAsync(exception);
    }

    private bool IsAdmin()
    {
        var roleValue = Context.User?.FindFirst(ClaimConstants.Role)?.Value;
        return Enum.TryParse<UserRole>(roleValue, ignoreCase: true, out var role)
               && role == UserRole.Admin;
    }

    private string? GetUserId() =>
        Context.User?.FindFirst(ClaimConstants.UserId)?.Value;
}
