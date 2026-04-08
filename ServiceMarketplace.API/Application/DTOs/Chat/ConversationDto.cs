namespace ServiceMarketplace.API.Models.DTOs.Chat;

public class ConversationDto
{
    public Guid   RequestId              { get; init; }
    public string RequestTitle           { get; init; } = string.Empty;
    public string RequestStatus          { get; init; } = string.Empty;
    public string OtherPartyEmail        { get; init; } = string.Empty;
    public string? LastMessage           { get; init; }
    public DateTime? LastMessageAt       { get; init; }
    public string? LastMessageSenderEmail{ get; init; }
}
