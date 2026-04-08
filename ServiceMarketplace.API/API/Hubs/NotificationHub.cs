using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly IChatService _chatService;
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(IChatService chatService, ILogger<NotificationHub> logger)
    {
        _chatService = chatService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);

        if (IsProvider(Context.User?.FindFirst(ClaimConstants.Role)?.Value))
            await Groups.AddToGroupAsync(Context.ConnectionId, "providers");

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);

        if (IsProvider(Context.User?.FindFirst(ClaimConstants.Role)?.Value))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "providers");

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinRequestChat(string requestId)
    {
        var userId = GetUserId();
        if (userId == null) return;

        var canAccess = await _chatService.CanAccessChatAsync(Guid.Parse(requestId), userId.Value);
        if (!canAccess) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{requestId}");
    }

    public async Task LeaveRequestChat(string requestId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{requestId}");
    }

    // 2 DB round-trips total: participant+email in SaveMessageAsync, then INSERT.
    // OtherPartyId is returned directly — no extra query needed.
    public async Task SendMessage(string requestId, string content)
    {
        var userId = GetUserId();
        if (userId == null) return;

        try
        {
            var result = await _chatService.SaveMessageAsync(
                Guid.Parse(requestId), userId.Value, content);

            var payload = new
            {
                id          = result.Message.Id,
                requestId   = result.Message.RequestId,
                senderId    = result.Message.SenderId,
                senderEmail = result.Message.SenderEmail,
                content     = result.Message.Content,
                sentAt      = result.Message.SentAt
            };

            await Clients.Group($"chat_{requestId}").SendAsync("ReceiveMessage", payload);

            if (result.OtherPartyId.HasValue)
                await Clients
                    .Group(result.OtherPartyId.Value.ToString())
                    .SendAsync("NewMessageNotification", payload);
        }
        catch (ArgumentException ex)
        {
            await Clients.Caller.SendAsync("ChatError", ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            await Clients.Caller.SendAsync("ChatError", "You are not authorized to send messages in this chat.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error saving chat message for request {RequestId}", requestId);
            await Clients.Caller.SendAsync("ChatError", "Failed to send message. Please try again.");
        }
    }

    private Guid? GetUserId()
    {
        var raw = Context.UserIdentifier;
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private static bool IsProvider(string? roleValue) =>
        roleValue is not null &&
        (roleValue == nameof(UserRole.ProviderEmployee) ||
         roleValue == nameof(UserRole.ProviderAdmin));
}
