using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.DTOs;
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
    /// Saves a chat message and returns recipient context.
    /// </summary>
    public async Task<SaveMessageResult> SaveMessageAsync(Guid requestId, Guid senderId, string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new ArgumentException("Message content cannot be empty.");

        if (content.Length > MaxMessageLength)
            throw new ArgumentException($"Message exceeds maximum length of {MaxMessageLength} characters.");

        // Fetch participants and sender email in one query.
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

        // Derive recipient from loaded participant info.
        var otherPartyId = senderId == info.CustomerId
            ? info.AcceptedByProviderId
            : (Guid?)info.CustomerId;

        return new SaveMessageResult(ToDto(message), otherPartyId);
    }

    /// <summary>
    /// Returns ordered message history.
    /// Caller must verify access first.
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

    /// <summary>
    /// Returns paginated conversations ordered by most-recent message.
    /// </summary>
    public async Task<PagedResult<ConversationDto>> GetConversationsAsync(Guid userId, UserRole role, int page, int pageSize)
    {
        // User request IDs subquery.
        IQueryable<Guid> userRequestIds = role == UserRole.Customer
            ? _db.ServiceRequests.AsNoTracking()
                .Where(r => r.CustomerId == userId && r.AcceptedByProviderId.HasValue)
                .Select(r => r.Id)
            : _db.ServiceRequests.AsNoTracking()
                .Where(r => r.AcceptedByProviderId.HasValue && r.AcceptedByProviderId.Value == userId)
                .Select(r => r.Id);

        // Count distinct conversations.
        var totalCount = await _db.ChatMessages
            .AsNoTracking()
            .Where(m => userRequestIds.Contains(m.RequestId))
            .Select(m => m.RequestId)
            .Distinct()
            .CountAsync();

        if (totalCount == 0)
            return PagedResult<ConversationDto>.Empty(page, pageSize);

        // Fetch paginated last-message aggregate.
        var lastMessages = await _db.ChatMessages
            .AsNoTracking()
            .Where(m => userRequestIds.Contains(m.RequestId))
            .GroupBy(m => m.RequestId)
            .Select(g => new
            {
                RequestId   = g.Key,
                Content     = g.OrderByDescending(m => m.SentAt).Select(m => m.Content).First(),
                SentAt      = g.Max(m => m.SentAt),
                SenderEmail = g.OrderByDescending(m => m.SentAt).Select(m => m.SenderEmail).First(),
            })
            .OrderByDescending(lm => lm.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        if (lastMessages.Count == 0)
            return PagedResult<ConversationDto>.Empty(page, pageSize);

        var pageIds = lastMessages.Select(lm => lm.RequestId).ToList();

        // Fetch request details for current page.
        var requestDetails = role == UserRole.Customer
            ? await _db.ServiceRequests.AsNoTracking()
                .Where(r => pageIds.Contains(r.Id))
                .Select(r => new { r.Id, r.Title, Status = r.Status.ToString(), OtherPartyEmail = r.AcceptedByProvider!.Email ?? string.Empty })
                .ToListAsync()
            : await _db.ServiceRequests.AsNoTracking()
                .Where(r => pageIds.Contains(r.Id))
                .Select(r => new { r.Id, r.Title, Status = r.Status.ToString(), OtherPartyEmail = r.Customer!.Email ?? string.Empty })
                .ToListAsync();

        var reqMap = requestDetails.ToDictionary(r => r.Id);
        var msgMap = lastMessages.ToDictionary(lm => lm.RequestId);

        // Preserve last-message ordering.
        var items = pageIds
            .Where(id => reqMap.ContainsKey(id))
            .Select(id =>
            {
                var req  = reqMap[id];
                var last = msgMap[id];
                return new ConversationDto
                {
                    RequestId              = req.Id,
                    RequestTitle           = req.Title,
                    RequestStatus          = req.Status,
                    OtherPartyEmail        = req.OtherPartyEmail,
                    LastMessage            = last.Content,
                    LastMessageAt          = last.SentAt,
                    LastMessageSenderEmail = last.SenderEmail,
                };
            })
            .ToList();

        return new PagedResult<ConversationDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount,
        };
    }

    // Fetch participant IDs only.
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
