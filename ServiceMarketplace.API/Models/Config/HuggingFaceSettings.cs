namespace ServiceMarketplace.API.Models.Config;

public class HuggingFaceSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "Qwen/Qwen2.5-7B-Instruct-Turbo";
    public string Endpoint { get; set; } = "https://router.huggingface.co/together/v1/chat/completions";

    /// <summary>Returns true when a real API key has been configured.</summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiKey) && ApiKey != "YOUR-HUGGINGFACE-KEY-HERE";
}
