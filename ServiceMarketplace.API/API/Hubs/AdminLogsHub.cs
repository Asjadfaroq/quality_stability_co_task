using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Hubs;

[Authorize]
public sealed class AdminLogsHub : Hub
{
    /// <summary>SignalR group that receives every broadcast log entry.</summary>
    public const string AdminGroup = "admin_logs";

    private readonly LogBuffer            _buffer;
    private readonly ILogger<AdminLogsHub> _logger;

    public AdminLogsHub(LogBuffer buffer, ILogger<AdminLogsHub> logger)
    {
        _buffer = buffer;
        _logger = logger;
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

        // Replay recent history so the admin sees context immediately.
        var recent = _buffer.GetRecent(200);
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
