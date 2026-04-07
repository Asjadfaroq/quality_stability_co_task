using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.DTOs.Chat;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
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

    public async Task<List<ConversationDto>> GetConversationsAsync(Guid userId, UserRole role)
    {
        // 1. Fetch all requests the user participates in, projecting only what we need
        var requestQuery = _db.ServiceRequests.AsNoTracking();

        var requests = role == UserRole.Customer
            ? await requestQuery
                .Where(r => r.CustomerId == userId && r.AcceptedByProviderId.HasValue)
                .Select(r => new
                {
                    r.Id,
                    r.Title,
                    Status         = r.Status.ToString(),
                    OtherPartyEmail= r.AcceptedByProvider!.Email ?? string.Empty,
                })
                .ToListAsync()
            : await requestQuery
                .Where(r => r.AcceptedByProviderId.HasValue && r.AcceptedByProviderId.Value == userId)
                .Select(r => new
                {
                    r.Id,
                    r.Title,
                    Status         = r.Status.ToString(),
                    OtherPartyEmail= r.Customer!.Email ?? string.Empty,
                })
                .ToListAsync();

        if (requests.Count == 0)
            return [];

        // 2. Fetch the latest message per request in one query
        var requestIds = requests.Select(r => r.Id).ToList();

        var lastMessages = await _db.ChatMessages
            .AsNoTracking()
            .Where(m => requestIds.Contains(m.RequestId))
            .GroupBy(m => m.RequestId)
            .Select(g => new
            {
                RequestId   = g.Key,
                Content     = g.OrderByDescending(m => m.SentAt).Select(m => m.Content).First(),
                SentAt      = g.Max(m => m.SentAt),
                SenderEmail = g.OrderByDescending(m => m.SentAt).Select(m => m.SenderEmail).First(),
            })
            .ToListAsync();

        var lastMsgMap = lastMessages.ToDictionary(x => x.RequestId);

        // 3. Merge — only include conversations that have at least one message
        return requests
            .Where(r => lastMsgMap.ContainsKey(r.Id))
            .Select(r =>
            {
                var last = lastMsgMap[r.Id];
                return new ConversationDto
                {
                    RequestId              = r.Id,
                    RequestTitle           = r.Title,
                    RequestStatus          = r.Status,
                    OtherPartyEmail        = r.OtherPartyEmail,
                    LastMessage            = last.Content,
                    LastMessageAt          = last.SentAt,
                    LastMessageSenderEmail = last.SenderEmail,
                };
            })
            .OrderByDescending(c => c.LastMessageAt)
            .ToList();
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
