using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Logging;

namespace ServiceMarketplace.API.Hubs;

/// <summary>
/// SignalR hub that streams the authenticated user's own audit activity in real-time.
/// Any authenticated user may connect — they only ever receive their own events.
/// </summary>
[Authorize]
public sealed class ActivityHub : Hub
{
    /// <summary>Prefix for per-user SignalR groups: <c>activity_{userId}</c>.</summary>
    public const string GroupPrefix = "activity_";

    private readonly LogBuffer           _buffer;
    private readonly ILogger<ActivityHub> _logger;

    public ActivityHub(LogBuffer buffer, ILogger<ActivityHub> logger)
    {
        _buffer = buffer;
        _logger = logger;
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

        // Replay the user's recent audit history so they see context immediately
        var recent = _buffer.GetRecentAudit(userId, 50);
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
