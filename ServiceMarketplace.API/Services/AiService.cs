using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using ServiceMarketplace.API.Models.DTOs.Ai;
using ServiceMarketplace.API.Resilience;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class AiService : IAiService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AiService> _logger;
    private readonly HttpClient _httpClient;

    public AiService(IConfiguration configuration, ILogger<AiService> logger, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _logger = logger;
        // Named client carries the Polly resilience pipeline (retry + timeouts)
        _httpClient = httpClientFactory.CreateClient(ResilienceKeys.HuggingFace);
    }

    public async Task<EnhanceDescriptionResponse> EnhanceDescriptionAsync(EnhanceDescriptionRequest request)
    {
        try
        {
            var apiKey  = _configuration["HuggingFace:ApiKey"];
            var model    = _configuration["HuggingFace:Model"]    ?? "Qwen/Qwen2.5-7B-Instruct-Turbo";
            var endpoint = _configuration["HuggingFace:Endpoint"] ?? "https://router.huggingface.co/together/v1/chat/completions";

            if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "YOUR-HUGGINGFACE-KEY-HERE")
                return Mock(request);

            var prompt =
                "You are a professional service marketplace assistant. " +
                "Enhance the following service request description to be clear and professional. " +
                "Also suggest the most appropriate category from: Plumbing, Electrical, Cleaning, Carpentry, Painting, Moving, Gardening, IT Support, Other.\n\n" +
                $"Title: {request.Title}\n" +
                $"Description: {request.RawDescription}\n\n" +
                "Respond ONLY in JSON with exactly two fields, no extra text:\n" +
                "{ \"enhancedDescription\": \"...\", \"suggestedCategory\": \"...\" }";

            var body = new
            {
                model,
                messages = new[] { new { role = "user", content = prompt } },
                max_tokens = 512,
                temperature = 0.5
            };

            var requestMessage = new HttpRequestMessage(HttpMethod.Post, endpoint);
            requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            requestMessage.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(requestMessage);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? string.Empty;

            var resultDoc = JsonDocument.Parse(ExtractJson(content));
            return new EnhanceDescriptionResponse
            {
                EnhancedDescription = resultDoc.RootElement.GetProperty("enhancedDescription").GetString() ?? string.Empty,
                SuggestedCategory   = resultDoc.RootElement.GetProperty("suggestedCategory").GetString()   ?? string.Empty
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "HuggingFace call failed, falling back to mock enhancement.");
            return Mock(request);
        }
    }

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

        return new EnhanceDescriptionResponse { EnhancedDescription = enhanced, SuggestedCategory = category };
    }

    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end   = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : text;
    }
}
