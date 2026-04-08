namespace ServiceMarketplace.API.Models.DTOs.Ai;

/// <summary>A single turn in the conversation history sent from the client.</summary>
public class ChatHistoryMessage
{
    /// <summary>"user" or "assistant"</summary>
    public string Role    { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}
