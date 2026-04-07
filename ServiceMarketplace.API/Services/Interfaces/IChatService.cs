using ServiceMarketplace.API.Models.DTOs.Chat;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IChatService
{
    /// <summary>
    /// Returns true if <paramref name="userId"/> is the customer or accepted provider
    /// of <paramref name="requestId"/>. Used by controllers/hubs to gate access before
    /// calling other methods.
    /// </summary>
    Task<bool> CanAccessChatAsync(Guid requestId, Guid userId);

    /// <summary>
    /// Persists the message in one DB round-trip (participant check + sender email are
    /// fetched in a single query). Returns the saved DTO together with the other
    /// participant's ID so callers can push a real-time notification without an extra query.
    /// Throws if the sender is not a participant or the request does not exist.
    /// </summary>
    Task<SaveMessageResult> SaveMessageAsync(Guid requestId, Guid senderId, string content);

    /// <summary>
    /// Returns ordered message history for a request.
    /// Access must be verified by the caller before invoking this method.
    /// </summary>
    Task<List<ChatMessageDto>> GetHistoryAsync(Guid requestId);

    /// <summary>Returns all conversations the user participates in, ordered by most recent message.</summary>
    Task<List<ConversationDto>> GetConversationsAsync(Guid userId, UserRole role);
}
