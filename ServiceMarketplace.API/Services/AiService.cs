using OpenAI.Chat;
using ServiceMarketplace.API.Models.DTOs.Ai;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class AiService : IAiService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AiService> _logger;

    public AiService(IConfiguration configuration, ILogger<AiService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<EnhanceDescriptionResponse> EnhanceDescriptionAsync(EnhanceDescriptionRequest request)
    {
        try
        {
            var apiKey = _configuration["OpenAI:ApiKey"];

            if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("sk-placeholder"))
                return Mock(request);

            var client = new ChatClient("gpt-4o-mini", apiKey);

            var prompt =
                "You are a professional service marketplace assistant.\n" +
                "Enhance the following service request description to be clear and professional.\n" +
                "Also suggest the most appropriate category from: Plumbing, Electrical, Cleaning, Carpentry, Painting, Moving, Gardening, IT Support, Other.\n\n" +
                $"Title: {request.Title}\n" +
                $"Description: {request.RawDescription}\n\n" +
                "Respond in JSON with exactly two fields:\n" +
                "{ \"enhancedDescription\": \"...\", \"suggestedCategory\": \"...\" }";

            var completion = await client.CompleteChatAsync(
                new UserChatMessage(prompt));

            var content = completion.Value.Content[0].Text;

            // Parse JSON response
            var json = System.Text.Json.JsonDocument.Parse(
                ExtractJson(content));

            return new EnhanceDescriptionResponse
            {
                EnhancedDescription = json.RootElement.GetProperty("enhancedDescription").GetString() ?? string.Empty,
                SuggestedCategory   = json.RootElement.GetProperty("suggestedCategory").GetString()   ?? string.Empty
            };
        }
        catch (Exception ex)
        {
            // AI failure must never break the flow — fall back to mock
            _logger.LogWarning(ex, "OpenAI call failed, falling back to mock enhancement.");
            return Mock(request);
        }
    }

    // Mock fallback: prepend "Professional service: " and categorise by keywords
    private static EnhanceDescriptionResponse Mock(EnhanceDescriptionRequest request)
    {
        var enhanced = $"Professional service: {request.RawDescription}";

        var lower = $"{request.Title} {request.RawDescription}".ToLowerInvariant();

        var category = lower switch
        {
            var s when s.Contains("pipe") || s.Contains("leak") || s.Contains("plumb") => "Plumbing",
            var s when s.Contains("electric") || s.Contains("wire") || s.Contains("socket") => "Electrical",
            var s when s.Contains("clean") || s.Contains("wash") || s.Contains("dust") => "Cleaning",
            var s when s.Contains("wood") || s.Contains("furniture") || s.Contains("carpen") => "Carpentry",
            var s when s.Contains("paint") || s.Contains("wall") || s.Contains("colour") => "Painting",
            var s when s.Contains("mov") || s.Contains("transport") || s.Contains("haul") => "Moving",
            var s when s.Contains("garden") || s.Contains("lawn") || s.Contains("tree") => "Gardening",
            var s when s.Contains("computer") || s.Contains("laptop") || s.Contains("it ") || s.Contains("software") => "IT Support",
            _ => "Other"
        };

        return new EnhanceDescriptionResponse
        {
            EnhancedDescription = enhanced,
            SuggestedCategory   = category
        };
    }

    // Extract JSON object from a string that may contain markdown code fences
    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end   = text.LastIndexOf('}');
        return start >= 0 && end > start
            ? text[start..(end + 1)]
            : text;
    }
}
