namespace ServiceMarketplace.API.Models.DTOs.Chat;

public class ChatMessageDto
{
    public Guid Id { get; init; }
    public Guid RequestId { get; init; }
    public Guid SenderId { get; init; }
    public string SenderEmail { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public DateTime SentAt { get; init; }
}
