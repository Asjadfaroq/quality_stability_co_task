using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
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

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);

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

    public async Task SendMessage(string requestId, string content)
    {
        var userId = GetUserId();
        if (userId == null) return;

        try
        {
            var message = await _chatService.SaveMessageAsync(
                Guid.Parse(requestId), userId.Value, content);

            var payload = new
            {
                id          = message.Id,
                requestId   = message.RequestId,
                senderId    = message.SenderId,
                senderEmail = message.SenderEmail,
                content     = message.Content,
                sentAt      = message.SentAt
            };

            await Clients.Group($"chat_{requestId}").SendAsync("ReceiveMessage", payload);

            // Push to the other party's personal group so their unread badge updates
            // even if they don't have the chat panel open
            var otherPartyId = await _chatService.GetOtherPartyIdAsync(message.RequestId, userId.Value);
            if (otherPartyId.HasValue)
                await Clients.Group(otherPartyId.Value.ToString())
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
}
