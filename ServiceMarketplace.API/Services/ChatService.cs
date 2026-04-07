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

    /// <summary>
    /// Combines the participant check and sender-email lookup into a single SQL query
    /// (correlated subquery), then returns the saved message with OtherPartyId so
    /// callers (NotificationHub) don't need a second round-trip to find who to notify.
    ///
    /// DB round-trips: 1 (down from 3 in the previous implementation).
    /// </summary>
    public async Task<SaveMessageResult> SaveMessageAsync(Guid requestId, Guid senderId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new ArgumentException("Message content cannot be empty.");

        if (content.Length > MaxMessageLength)
            throw new ArgumentException($"Message exceeds maximum length of {MaxMessageLength} characters.");

        // Single query: fetch participant IDs + sender email via a correlated subquery.
        // EF Core translates the nested Select/FirstOrDefault into a SQL scalar subquery.
        var info = await _db.ServiceRequests
            .AsNoTracking()
            .Where(r => r.Id == requestId)
            .Select(r => new
            {
                r.CustomerId,
                r.AcceptedByProviderId,
                SenderEmail = _db.Users
                    .Where(u => u.Id == senderId)
                    .Select(u => u.Email)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Request not found.");

        if (info.CustomerId != senderId && info.AcceptedByProviderId != senderId)
            throw new UnauthorizedAccessException("You are not a participant in this chat.");

        var senderEmail = info.SenderEmail
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

        // Derive OtherPartyId from the info already in memory — no extra query.
        var otherPartyId = senderId == info.CustomerId
            ? info.AcceptedByProviderId
            : (Guid?)info.CustomerId;

        return new SaveMessageResult(ToDto(message), otherPartyId);
    }

    /// <summary>
    /// Returns ordered message history.
    /// Access MUST be verified by the caller before invoking this method
    /// (see <see cref="CanAccessChatAsync"/>).
    /// </summary>
    public async Task<List<ChatMessageDto>> GetHistoryAsync(Guid requestId)
    {
        return await _db.ChatMessages
            .AsNoTracking()
            .Where(m => m.RequestId == requestId)
            .OrderBy(m => m.SentAt)
            .Select(m => new ChatMessageDto
            {
                Id          = m.Id,
                RequestId   = m.RequestId,
                SenderId    = m.SenderId,
                SenderEmail = m.SenderEmail,
                Content     = m.Content,
                SentAt      = m.SentAt
            })
            .ToListAsync();
    }

    public async Task<List<ConversationDto>> GetConversationsAsync(Guid userId, UserRole role)
    {
        var requestQuery = _db.ServiceRequests.AsNoTracking();

        var requests = role == UserRole.Customer
            ? await requestQuery
                .Where(r => r.CustomerId == userId && r.AcceptedByProviderId.HasValue)
                .Select(r => new
                {
                    r.Id,
                    r.Title,
                    Status          = r.Status.ToString(),
                    OtherPartyEmail = r.AcceptedByProvider!.Email ?? string.Empty,
                })
                .ToListAsync()
            : await requestQuery
                .Where(r => r.AcceptedByProviderId.HasValue && r.AcceptedByProviderId.Value == userId)
                .Select(r => new
                {
                    r.Id,
                    r.Title,
                    Status          = r.Status.ToString(),
                    OtherPartyEmail = r.Customer!.Email ?? string.Empty,
                })
                .ToListAsync();

        if (requests.Count == 0)
            return [];

        var requestIds = requests.Select(r => r.Id).ToList();

        // Fetch the most recent message per request — covered by IX_ChatMessages_RequestId_SentAt.
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

    // Shared helper: projects only the two participant IDs — no full entity load.
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
