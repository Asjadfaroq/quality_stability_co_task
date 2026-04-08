namespace ServiceMarketplace.API.Models.DTOs.Ai;

/// <summary>Payload sent by the client when asking the in-app AI assistant a question.</summary>
public class AiChatRequest
{
    /// <summary>The user's current message.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Prior turns in this session (oldest first).
    /// The client sends the last N turns so the AI can answer follow-up questions coherently.
    /// </summary>
    public IReadOnlyList<ChatHistoryMessage> History { get; set; } = [];
}
