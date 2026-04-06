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
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null) return false;

        return request.CustomerId == userId || request.AcceptedByProviderId == userId;
    }

    public async Task<ChatMessageDto> SaveMessageAsync(Guid requestId, Guid senderId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new ArgumentException("Message content cannot be empty.");

        if (content.Length > MaxMessageLength)
            throw new ArgumentException($"Message exceeds maximum length of {MaxMessageLength} characters.");

        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        var isParticipant = request.CustomerId == senderId || request.AcceptedByProviderId == senderId;
        if (!isParticipant)
            throw new UnauthorizedAccessException("You are not a participant in this chat.");

        var sender = await _db.Users.FindAsync(senderId)
            ?? throw new KeyNotFoundException("Sender not found.");

        var message = new ChatMessage
        {
            Id          = Guid.NewGuid(),
            RequestId   = requestId,
            SenderId    = senderId,
            SenderEmail = sender.Email!,
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
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null) return null;

        if (request.CustomerId == userId)
            return request.AcceptedByProviderId;

        if (request.AcceptedByProviderId == userId)
            return request.CustomerId;

        return null;
    }

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
