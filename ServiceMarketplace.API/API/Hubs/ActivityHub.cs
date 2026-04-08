using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Hubs;

[Authorize]
public sealed class ActivityHub : Hub
{
    /// <summary>Prefix for per-user SignalR groups: activity_{userId}</summary>
    public const string GroupPrefix = "activity_";

    private readonly IAuditLogCache       _auditCache;
    private readonly LogBuffer            _buffer;
    private readonly ILogger<ActivityHub> _logger;

    public ActivityHub(IAuditLogCache auditCache, LogBuffer buffer, ILogger<ActivityHub> logger)
    {
        _auditCache = auditCache;
        _buffer     = buffer;
        _logger     = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (userId is null)
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupPrefix + userId);

        // Redis preferred (survives restarts, 10-min window); fall back to in-memory buffer.
        var recent = await _auditCache.GetUserLogsAsync(userId, 50);
        if (recent.Count == 0)
            recent = _buffer.GetRecentAudit(userId, 50);

        await Clients.Caller.SendAsync("RecentActivity", recent);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (userId is not null)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupPrefix + userId);

        await base.OnDisconnectedAsync(exception);
    }

    private string? GetUserId() =>
        Context.User?.FindFirst(ClaimConstants.UserId)?.Value;
}
