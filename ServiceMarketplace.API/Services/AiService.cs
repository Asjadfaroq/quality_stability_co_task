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

    // ── In-app AI chat ────────────────────────────────────────────────────────

    /// <summary>
    /// System prompt that hard-constrains the model to only answer questions
    /// about ServiceMarket.  The prompt is authoritative knowledge the model
    /// uses for every reply; it is never sent to or visible by the user.
    /// </summary>
    private const string ChatSystemPrompt = """
        You are ServiceMarket Assistant — a friendly, concise help assistant embedded
        inside the ServiceMarket platform. Your sole purpose is to help users understand
        and navigate ServiceMarket features.

        STRICT SCOPE RULE: If the user asks anything unrelated to ServiceMarket
        (e.g. general coding, weather, news, other apps, personal advice, mathematics,
        or any topic not described below), reply with exactly:
        "I can only help with questions about ServiceMarket. Feel free to ask me
        anything about the platform, your account, or how features work!"
        Never apologise excessively. Never break this rule.

        ── PLATFORM OVERVIEW ───────────────────────────────────────────────────
        ServiceMarket is a two-sided marketplace that connects Customers who need
        home or business services with verified Service Providers.

        ── USER ROLES ──────────────────────────────────────────────────────────
        • Customer
          – Posts service requests, chats with their assigned provider,
            confirms job completion, manages their subscription.
        • ProviderEmployee
          – Browses available jobs, accepts jobs, completes work, chats with
            customers, views active and completed job history.
        • ProviderAdmin
          – Everything a ProviderEmployee can do, plus managing their
            organisation (add / remove team members).
        • Admin
          – Platform administration: user management, role changes, oversight.

        ── SERVICE CATEGORIES ──────────────────────────────────────────────────
        Plumbing · Electrical · Cleaning · Carpentry · Painting ·
        Moving · Gardening · IT Support · Other

        ── REQUEST LIFECYCLE ───────────────────────────────────────────────────
        Pending → Accepted → Awaiting Confirmation → Completed

        • Pending           : Request is live; providers can see and accept it.
        • Accepted          : A provider has taken the job; chat becomes available.
        • Awaiting Confirmation : Provider marked the job done; customer must confirm.
        • Completed         : Customer confirmed; job is closed.

        ── CUSTOMER GUIDE ──────────────────────────────────────────────────────
        Creating a request:
          1. My Requests → "New Request" button.
          2. Fill in Title, Description, Category, and your GPS coordinates
             (Latitude / Longitude).
          3. Optionally use "Enhance with AI" on the description field to make
             it clearer and get a category suggestion.
          4. Submit — status becomes Pending.

        Confirming a completed job:
          When status is "Awaiting Confirmation", a banner appears in My Requests.
          Click "Confirm Complete" to close the job.

        Subscription:
          Free tier allows a limited number of requests.
          Upgrade in the Subscription section for unlimited requests.

        ── PROVIDER GUIDE ──────────────────────────────────────────────────────
        1. Available Jobs — browse all Pending requests.
        2. Accept a job — it moves to your Active Jobs list.
        3. Chat with the customer via the Chat button on the job.
        4. Complete the work, then mark it done from Active Jobs.
        5. Wait for customer confirmation → job appears in Completed Jobs.

        ── ORGANISATION (ProviderAdmin) ────────────────────────────────────────
        • Go to the Organisation page to manage your team.
        • Add employees by email; they gain ProviderEmployee access.
        • Remove employees when they leave your team.

        ── CHAT ────────────────────────────────────────────────────────────────
        Real-time messaging between a Customer and their assigned Provider.
        Available once a job is Accepted. Accessible from:
          – Customer: My Requests → Chat button on the accepted/active request.
          – Provider: Active Jobs → Chat button on the job.
          – Both roles: the Chats page in the sidebar.
        Unread messages show a red badge on the Chat button and the Bell icon.

        ── AI WRITING ASSISTANT ────────────────────────────────────────────────
        Available to every logged-in user via the floating button (✨) in the
        bottom-right corner of every page.
        • Enhance tab : paste any text; AI rewrites it professionally.
        • Help tab    : ask questions about ServiceMarket (that's me!).
        Customers also get a suggested service category after enhancement.

        ── NAVIGATION ──────────────────────────────────────────────────────────
        Customer       : Dashboard · My Requests · Chats · Subscription
        ProviderEmployee: Dashboard · Available Jobs · Active Jobs ·
                          Completed Jobs · Chats · My Organisation
        ProviderAdmin  : same as above + Organisation management
        Admin          : User Management

        ── RESPONSE STYLE ──────────────────────────────────────────────────────
        • Be helpful and concise — 2–5 sentences unless a step-by-step list
          is genuinely clearer.
        • Use plain language; avoid jargon.
        • If the user seems confused, guide them to the specific page or button.
        • Never fabricate features that are not described above.
        """;

    public async Task<AiChatResponse> ChatAsync(AiChatRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return new AiChatResponse { Reply = "Please enter a message." };

        try
        {
            var apiKey   = _configuration["HuggingFace:ApiKey"];
            var model    = _configuration["HuggingFace:Model"]    ?? "Qwen/Qwen2.5-7B-Instruct-Turbo";
            var endpoint = _configuration["HuggingFace:Endpoint"] ?? "https://router.huggingface.co/together/v1/chat/completions";

            if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "YOUR-HUGGINGFACE-KEY-HERE")
                return MockChat(request.Message);

            // Build the messages array: system prompt → history → current user message
            var messages = new List<object>
            {
                new { role = "system", content = ChatSystemPrompt },
            };

            // Include the last 10 turns of history to keep the context window manageable
            const int maxHistoryTurns = 10;
            var history = request.History.TakeLast(maxHistoryTurns);
            foreach (var turn in history)
                messages.Add(new { role = turn.Role, content = turn.Content });

            messages.Add(new { role = "user", content = request.Message });

            var body = new
            {
                model,
                messages,
                max_tokens  = 512,
                temperature = 0.4   // lower = more deterministic / factual
            };

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint);
            httpRequest.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            httpRequest.Content =
                new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(httpRequest, ct);
            response.EnsureSuccessStatusCode();

            var json    = await response.Content.ReadAsStringAsync(ct);
            var doc     = JsonDocument.Parse(json);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? string.Empty;

            return new AiChatResponse { Reply = content.Trim() };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "HuggingFace chat call failed, falling back to mock.");
            return MockChat(request.Message);
        }
    }

    private static AiChatResponse MockChat(string message)
    {
        // Minimal keyword-based fallback so the feature works without an API key
        var lower = message.ToLowerInvariant();

        var reply = lower switch
        {
            var s when s.Contains("request") || s.Contains("job") =>
                "To create a service request, go to My Requests and click 'New Request'. " +
                "Fill in the title, description, category, and your location, then submit. " +
                "Providers will be able to see and accept your request.",

            var s when s.Contains("status") || s.Contains("pending") || s.Contains("accepted") || s.Contains("complete") =>
                "A request moves through four statuses: Pending (waiting for a provider), " +
                "Accepted (a provider has taken the job), Awaiting Confirmation (provider marked it done — " +
                "you need to confirm), and Completed (job is closed).",

            var s when s.Contains("chat") || s.Contains("message") =>
                "Chat becomes available once a provider accepts your request. " +
                "You can open it via the Chat button on the request row, or from the Chats page in the sidebar.",

            var s when s.Contains("subscri") || s.Contains("plan") || s.Contains("upgrade") =>
                "Free accounts can create a limited number of requests. " +
                "Go to the Subscription page to upgrade and unlock unlimited requests.",

            var s when s.Contains("provider") || s.Contains("organisation") || s.Contains("organization") || s.Contains("team") =>
                "ProviderAdmins manage their organisation on the Organisation page. " +
                "You can add employees by email so they can browse and accept jobs on behalf of your team.",

            var s when s.Contains("ai") || s.Contains("enhance") || s.Contains("assist") =>
                "The AI Writing Assistant (✨ button, bottom-right) is available on every page. " +
                "Use the Enhance tab to improve any text, or the Help tab to ask questions like this one.",

            var s when s.Contains("login") || s.Contains("sign") || s.Contains("register") || s.Contains("account") =>
                "You can register a new account from the Register page. " +
                "Once logged in, your role (Customer, Provider, or Admin) determines which features you can access.",

            _ =>
                "I can only help with questions about ServiceMarket. " +
                "Feel free to ask me about creating requests, job statuses, chat, subscriptions, or any other platform feature!"
        };

        return new AiChatResponse { Reply = reply };
    }

    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end   = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : text;
    }
}
