using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Entities;

namespace ServiceMarketplace.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly AppDbContext _db;

    public NotificationHub(AppDbContext db)
    {
        _db = db;
    }

    // Each user joins a group named after their userId for targeted notifications
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

    // ── Chat Methods ──────────────────────────────────────────────────────────

    public async Task JoinRequestChat(string requestId)
    {
        var userId = Guid.Parse(Context.UserIdentifier!);

        // Validate: caller must be the customer or accepted provider of this request
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == Guid.Parse(requestId));

        if (request == null) return;

        var isCustomer  = request.CustomerId == userId;
        var isProvider  = request.AcceptedByProviderId == userId;

        if (!isCustomer && !isProvider) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{requestId}");
    }

    public async Task LeaveRequestChat(string requestId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{requestId}");
    }

    public async Task SendMessage(string requestId, string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return;

        var userId = Guid.Parse(Context.UserIdentifier!);

        // Validate: caller must be part of this request's chat
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == Guid.Parse(requestId));

        if (request == null) return;
        if (request.CustomerId != userId && request.AcceptedByProviderId != userId) return;

        var user = await _db.Users.FindAsync(userId);

        var message = new ChatMessage
        {
            Id          = Guid.NewGuid(),
            RequestId   = Guid.Parse(requestId),
            SenderId    = userId,
            SenderEmail = user!.Email!,
            Content     = content.Trim(),
            SentAt      = DateTime.UtcNow
        };

        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();

        await Clients.Group($"chat_{requestId}").SendAsync("ReceiveMessage", new
        {
            id          = message.Id,
            senderId    = message.SenderId,
            senderEmail = message.SenderEmail,
            content     = message.Content,
            sentAt      = message.SentAt
        });
    }
}
