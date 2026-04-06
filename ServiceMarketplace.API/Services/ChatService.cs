using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.DTOs.Chat;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class ChatService : IChatService
{
    private const int MaxMessageLength = 2000;

    private readonly AppDbContext _db;
    private readonly ILogger<ChatService> _logger;

    public ChatService(AppDbContext db, ILogger<ChatService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> CanAccessChatAsync(Guid requestId, Guid userId)
    {
        var p = await GetParticipantsAsync(requestId);
        return p is not null && (p.CustomerId == userId || p.ProviderId == userId);
    }

    public async Task<ChatMessageDto> SaveMessageAsync(Guid requestId, Guid senderId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new ArgumentException("Message content cannot be empty.");

        if (content.Length > MaxMessageLength)
            throw new ArgumentException($"Message exceeds maximum length of {MaxMessageLength} characters.");

        // DbContext is not thread-safe — queries must be sequential on the same instance
        var participants = await GetParticipantsAsync(requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (participants.CustomerId != senderId && participants.ProviderId != senderId)
            throw new UnauthorizedAccessException("You are not a participant in this chat.");

        var senderEmail = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == senderId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Sender not found.");

        var message = new ChatMessage
        {
            Id          = Guid.NewGuid(),
            RequestId   = requestId,
            SenderId    = senderId,
            SenderEmail = senderEmail,
            Content     = content.Trim(),
            SentAt      = DateTime.UtcNow
        };

        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Chat message {MessageId} saved for request {RequestId} by user {SenderId}",
            message.Id, requestId, senderId);

        return ToDto(message);
    }

    public async Task<List<ChatMessageDto>> GetHistoryAsync(Guid requestId, Guid userId)
    {
        var canAccess = await CanAccessChatAsync(requestId, userId);
        if (!canAccess)
            throw new UnauthorizedAccessException("You do not have access to this chat.");

        return await _db.ChatMessages
            .AsNoTracking()
            .Where(m => m.RequestId == requestId)
            .OrderBy(m => m.SentAt)
            .Select(m => ToDto(m))
            .ToListAsync();
    }

    public async Task<Guid?> GetOtherPartyIdAsync(Guid requestId, Guid userId)
    {
        var p = await GetParticipantsAsync(requestId);
        if (p is null) return null;
        if (p.CustomerId == userId) return p.ProviderId;
        if (p.ProviderId == userId) return p.CustomerId;
        return null;
    }

    // Projects only the two participant IDs rather than the full ServiceRequest row
    private async Task<RequestParticipants?> GetParticipantsAsync(Guid requestId) =>
        await _db.ServiceRequests
            .AsNoTracking()
            .Where(r => r.Id == requestId)
            .Select(r => new RequestParticipants(r.CustomerId, r.AcceptedByProviderId))
            .FirstOrDefaultAsync();

    private sealed record RequestParticipants(Guid CustomerId, Guid? ProviderId);

    private static ChatMessageDto ToDto(ChatMessage m) => new()
    {
        Id          = m.Id,
        RequestId   = m.RequestId,
        SenderId    = m.SenderId,
        SenderEmail = m.SenderEmail,
        Content     = m.Content,
        SentAt      = m.SentAt
    };
}
