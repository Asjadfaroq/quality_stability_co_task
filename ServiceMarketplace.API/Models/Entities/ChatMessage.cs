namespace ServiceMarketplace.API.Models.Entities;

public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderEmail { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
}
