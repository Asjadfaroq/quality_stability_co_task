namespace ServiceMarketplace.API.Models.DTOs.Chat;

/// <summary>
/// Returned by <c>IChatService.SaveMessageAsync</c>.
/// Carries the persisted message DTO together with the other participant's ID so callers
/// (e.g. NotificationHub) do not need a second round-trip to determine who to notify.
/// </summary>
public sealed record SaveMessageResult(ChatMessageDto Message, Guid? OtherPartyId);
