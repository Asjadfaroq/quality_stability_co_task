using ServiceMarketplace.API.Models.DTOs.Chat;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IChatService
{
    /// <summary>Validates that userId is the customer or accepted provider of requestId.</summary>
    Task<bool> CanAccessChatAsync(Guid requestId, Guid userId);

    /// <summary>Persists a message and returns it. Throws if access is denied or request not found.</summary>
    Task<ChatMessageDto> SaveMessageAsync(Guid requestId, Guid senderId, string content);

    /// <summary>Returns ordered message history for a request.</summary>
    Task<List<ChatMessageDto>> GetHistoryAsync(Guid requestId, Guid userId);

    /// <summary>Returns the other participant's userId in the chat (customer or provider), or null if not found.</summary>
    Task<Guid?> GetOtherPartyIdAsync(Guid requestId, Guid userId);
}
