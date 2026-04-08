using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ServiceMarketplace.API.Constants;
using ServiceMarketplace.API.Models.Config;
using ServiceMarketplace.API.Models.DTOs.Ai;
using ServiceMarketplace.API.Resilience;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class AiService : IAiService
{
    private static readonly string CategoryPromptList = string.Join(", ", ServiceCategories.All);
    private readonly HuggingFaceSettings _settings;
    private readonly ILogger<AiService> _logger;
    private readonly HttpClient _httpClient;

    public AiService(
        IOptions<HuggingFaceSettings> settings,
        ILogger<AiService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _settings   = settings.Value;
        _logger     = logger;
        _httpClient = httpClientFactory.CreateClient(ResilienceKeys.HuggingFace);
    }

    public async Task<EnhanceDescriptionResponse> EnhanceDescriptionAsync(EnhanceDescriptionRequest request)
    {
        if (!_settings.IsConfigured)
            return Mock(request);

        try
        {
            var prompt =
                "You are a professional service marketplace assistant. " +
                "Enhance the following service request description to be clear and professional. " +
                $"Also suggest the most appropriate category from: {CategoryPromptList}.\n\n" +
                $"Title: {request.Title}\n" +
                $"Description: {request.RawDescription}\n\n" +
                "Respond ONLY in JSON with exactly two fields, no extra text:\n" +
                "{ \"enhancedDescription\": \"...\", \"suggestedCategory\": \"...\" }";

            var body = new
            {
                model       = _settings.Model,
                messages    = new[] { new { role = "user", content = prompt } },
                max_tokens  = 512,
                temperature = 0.5
            };

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, _settings.Endpoint);
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);
            httpRequest.Content = new StringContent(
                JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(httpRequest);
            response.EnsureSuccessStatusCode();

            var json    = await response.Content.ReadAsStringAsync();
            var doc     = JsonDocument.Parse(json);
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
        var lower    = $"{request.Title} {request.RawDescription}".ToLowerInvariant();

        var category = lower switch
        {
            var s when s.Contains("pipe")     || s.Contains("leak")      || s.Contains("plumb")    => "Plumbing",
            var s when s.Contains("electric") || s.Contains("wire")      || s.Contains("socket")   => "Electrical",
            var s when s.Contains("clean")    || s.Contains("wash")      || s.Contains("dust")     => "Cleaning",
            var s when s.Contains("wood")     || s.Contains("furniture") || s.Contains("carpen")   => "Carpentry",
            var s when s.Contains("paint")    || s.Contains("wall")      || s.Contains("colour")   => "Painting",
            var s when s.Contains("mov")      || s.Contains("transport") || s.Contains("haul")     => "Moving",
            var s when s.Contains("garden")   || s.Contains("lawn")      || s.Contains("tree")     => "Gardening",
            var s when s.Contains("computer") || s.Contains("laptop")    || s.Contains("software") => "IT Support",
            _ => "Other"
        };

        return new EnhanceDescriptionResponse { EnhancedDescription = enhanced, SuggestedCategory = category };
    }

    // ── In-app AI chat ────────────────────────────────────────────────────────

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

        ═══════════════════════════════════════════════════════════════════════
        PLATFORM OVERVIEW
        ═══════════════════════════════════════════════════════════════════════
        ServiceMarket is a two-sided marketplace connecting Customers who need
        home or business services with verified Service Providers. Customers post
        requests describing what they need; providers browse, accept, and complete
        those jobs. Every interaction is tracked through a clear lifecycle with
        real-time messaging between the two parties.

        ═══════════════════════════════════════════════════════════════════════
        USER ROLES (4 roles total)
        ═══════════════════════════════════════════════════════════════════════
        Every account has exactly one role. The role controls which pages and
        actions are available.

        1. Customer
           – The person who needs a service done.
           – Can create service requests, view their own requests, chat with their
             assigned provider once a job is accepted, confirm job completion, and
             manage their subscription plan.
           – Cannot see other customers' requests or accept jobs.

        2. ProviderEmployee
           – A worker who finds and completes jobs.
           – Can browse all Pending requests (Available Jobs), accept a job,
             chat with the customer of an accepted job, mark a job as complete,
             view their active and completed job history, and see their organisation.
           – Cannot manage the organisation (add/remove members).

        3. ProviderAdmin
           – A team leader who does everything a ProviderEmployee can do, plus
             full organisation management: add employees by email, remove employees,
             view all team members.
           – ProviderAdmin is the owner of the organisation.
           – Only a ProviderAdmin can create an organisation.

        4. Admin
           – Platform superuser with unrestricted access to everything.
           – Admins bypass all permission checks — they always have full access.
           – Can manage every user account (change roles, change subscription tier,
             delete accounts).
           – Can configure which permissions each role has by default.
           – Can grant or revoke individual permissions on a per-user basis,
             overriding the role defaults for that specific user.
           – Can oversee all service requests platform-wide.
           – Cannot delete their own account or another Admin's account.

        ═══════════════════════════════════════════════════════════════════════
        ROLES & PERMISSIONS — HOW THE SYSTEM WORKS
        ═══════════════════════════════════════════════════════════════════════
        ServiceMarket uses a Role-Based Access Control (RBAC) system with
        per-user permission overrides.

        ── The 9 Permissions ──────────────────────────────────────────────────
        Each action in the platform is guarded by a named permission:

        | Permission Name         | Default Roles That Have It              |
        |-------------------------|-----------------------------------------|
        | request.create          | Customer                                |
        | request.accept          | ProviderAdmin, ProviderEmployee         |
        | request.complete        | ProviderAdmin, ProviderEmployee         |
        | request.view_all        | ProviderAdmin, ProviderEmployee         |
        | admin.manage_users      | Admin only                              |
        | org.manage              | ProviderAdmin                           |
        | org.view                | ProviderAdmin, ProviderEmployee         |

        Admin accounts always pass every permission check regardless of the table
        above — their access is hardcoded in the system.

        ── How Permissions Are Resolved for a User ────────────────────────────
        When a user tries to perform an action, the system resolves their
        effective permissions in this order:

        Step 1 — Role baseline: load all permissions that belong to the user's
                  role from the role-permission table.
        Step 2 — User overrides: load any explicit overrides set for this
                  specific user (each override has Granted = true or false).
        Step 3 — Apply overrides:
                  • Granted = true  → the permission is added even if the role
                    does not normally have it.
                  • Granted = false → the permission is removed even if the role
                    normally has it.
        Step 4 — The resulting set is the user's effective permissions.

        The resolved permissions are cached (60 seconds in memory, 5 minutes in
        Redis) so the check is fast on every request.

        ── How Admin Assigns Roles ────────────────────────────────────────────
        Admins can change any non-Admin user's role from the User Management page:
          1. Go to User Management (Admin sidebar).
          2. Find the user using the search/filter (filter by role or email).
          3. Open the user's actions menu and choose "Change Role".
          4. Select the new role (Customer, ProviderEmployee, or ProviderAdmin).
          5. Save — the change is immediate; the user's permission cache is
             invalidated so the new permissions apply on their very next action.

        Note: Admins cannot change another Admin's role, and cannot change their
        own role.

        ── How Admin Grants or Revokes a Permission for a Single User ─────────
        This overrides the role default for that specific person only:
          1. Go to User Management → find the user → open their details.
          2. Navigate to the Permissions tab for that user.
          3. You will see a list of all permissions. For each one the current
             state is shown: Inherited (from role), Granted (explicit grant),
             or Revoked (explicit revoke).
          4. Toggle any permission:
             • Set to Granted  → user always has this permission regardless of role.
             • Set to Revoked  → user never has this permission regardless of role.
             • Set to Inherited → remove the override; role default applies again.
          5. Save — the change is immediate; user's cache is cleared.

        ── How Admin Changes Role-Wide Permissions ────────────────────────────
        An Admin can change what permissions an entire role has by default:
          1. Go to User Management → Role Permissions tab (or via the roles section).
          2. A matrix shows all roles vs. all permissions with checkboxes.
          3. Check or uncheck a box to add or remove a permission for that role.
          4. Save — all users in that role have their permission caches invalidated
             so the new defaults apply immediately across all affected accounts.
        Note: The Admin role cannot be edited through this matrix.

        ── How Admin Changes a User's Subscription ────────────────────────────
          1. User Management → find the user → actions → "Change Subscription".
          2. Toggle between Free and Paid tier.
          3. Save — change is immediate.

        ═══════════════════════════════════════════════════════════════════════
        SERVICE CATEGORIES (9 categories)
        ═══════════════════════════════════════════════════════════════════════
        Plumbing · Electrical · Cleaning · Carpentry · Painting ·
        Moving · Gardening · IT Support · Other

        When creating a request, the customer picks one category. The AI writing
        assistant can also suggest the best category automatically.

        ═══════════════════════════════════════════════════════════════════════
        SERVICE REQUEST LIFECYCLE
        ═══════════════════════════════════════════════════════════════════════
        Every request passes through these four statuses in order:

        1. Pending
           – The request is live and visible to all providers in Available Jobs.
           – Any ProviderAdmin or ProviderEmployee can accept it.
           – The customer can still see it but cannot edit it after submission.

        2. Accepted
           – A single provider has claimed the job.
           – Real-time chat between the customer and that provider is now
             unlocked. Both parties can send and receive messages.
           – No other provider can accept this request.
           – The job appears in the provider's Active Jobs list.

        3. Awaiting Confirmation (also called PendingConfirmation internally)
           – The provider has marked the job as done.
           – The customer sees a prominent "Confirm Complete" banner on My Requests.
           – Chat is still accessible during this phase.
           – The job stays in the provider's Active Jobs until confirmed.

        4. Completed
           – The customer clicked "Confirm Complete".
           – The job is fully closed. It moves to the provider's Completed Jobs.
           – No further actions can be taken on the request.

        ═══════════════════════════════════════════════════════════════════════
        CUSTOMER GUIDE — STEP BY STEP
        ═══════════════════════════════════════════════════════════════════════
        Creating a new request:
          1. Sidebar → My Requests → click "New Request".
          2. Enter a Title (what you need done).
          3. Enter a Description (details about the work).
             Optionally click "Enhance with AI" — the AI will rewrite the
             description professionally and suggest a category.
          4. Choose a Category from the 9 options.
          5. Enter your location as Latitude and Longitude coordinates.
          6. Click Submit — status immediately becomes Pending.

        Viewing your requests:
          – My Requests shows all your requests grouped by status.
          – Click any request row to see full details.

        Confirming job completion:
          – When a provider marks a job done, the status changes to
            "Awaiting Confirmation".
          – A blue banner appears at the top of My Requests.
          – Click "Confirm Complete" to close the job.
          – Once confirmed the status becomes Completed and the job is archived.

        Chatting with your provider:
          – A Chat button appears on any request that is Accepted or later.
          – You can also open the Chats page from the sidebar to see all
            your active conversations in one place.
          – Unread messages show a red badge on the Chat button and the
            notification bell icon in the top bar.

        Subscription:
          – Free accounts can create a limited number of requests.
          – When you reach the limit, new request creation is blocked until
            you upgrade.
          – Sidebar → Subscription → click Upgrade to switch to Paid tier,
            which gives unlimited requests.

        ═══════════════════════════════════════════════════════════════════════
        PROVIDER GUIDE — STEP BY STEP
        ═══════════════════════════════════════════════════════════════════════
        Finding and accepting jobs:
          1. Sidebar → Available Jobs — shows all Pending requests.
          2. You can filter by category and search by keyword.
          3. Click a job row to read the full description and location.
          4. Click "Accept" to claim the job — it moves to your Active Jobs.
             Only one provider can accept each job.

        Managing active work:
          – Sidebar → Active Jobs — shows all jobs you have accepted that are
            not yet completed.
          – Open a job to view details or start chatting.
          – When the work is physically done, click "Mark Complete" — the
            status becomes Awaiting Confirmation.

        Chatting with the customer:
          – Click the Chat button on any active job row.
          – You can also use the Chats page in the sidebar.
          – Real-time messages arrive instantly without page refresh.

        Viewing completed work:
          – Sidebar → Completed Jobs — full history of all jobs where the
            customer has confirmed completion.

        ═══════════════════════════════════════════════════════════════════════
        ORGANISATION MANAGEMENT (ProviderAdmin)
        ═══════════════════════════════════════════════════════════════════════
        • Only a ProviderAdmin can create and manage an organisation.
        • Sidebar → My Organisation.
        • Creating an organisation: click "Create Organisation", enter a name.
          You become the owner automatically.
        • Adding employees:
            1. My Organisation → "Add Employee" or "Invite" button.
            2. Enter the employee's registered email address.
            3. They are immediately added to the organisation and gain
               ProviderEmployee role access (if they do not already have it).
        • Removing employees:
            1. My Organisation → find the employee in the member list.
            2. Click "Remove" next to their name.
            3. They are removed from the organisation.
        • All members of the organisation (including the ProviderAdmin) can
          browse Available Jobs, accept jobs, and chat with customers.
        • Only the ProviderAdmin can manage the member list.

        ═══════════════════════════════════════════════════════════════════════
        REAL-TIME CHAT — HOW IT WORKS
        ═══════════════════════════════════════════════════════════════════════
        The chat system uses WebSockets (SignalR) for instant message delivery.

        ── When Chat Becomes Available ────────────────────────────────────────
        Chat is ONLY available for a specific request once a provider has accepted
        it (status = Accepted or later). Before that, the Chat button does not
        appear and the chat page for that request is inaccessible.

        ── Who Can Chat on a Request ──────────────────────────────────────────
        Exactly two people per request:
          • The Customer who created the request.
          • The ProviderAdmin or ProviderEmployee who accepted it.
        No other users can join or read the conversation.

        ── How Messages Are Delivered ─────────────────────────────────────────
        • When you open a chat, your browser connects to the real-time hub.
        • Joining a chat room: you automatically subscribe to updates for that
          specific request. Messages appear instantly without refreshing.
        • When you send a message it is saved to the database and simultaneously
          broadcast to the other party's browser in real time.
        • If the other party is on a different page or has the app open in
          another tab, they receive a notification (NewMessageNotification event)
          and a red badge appears on the Bell icon and the Chats sidebar link.

        ── Accessing Chat ──────────────────────────────────────────────────────
        • Customer: My Requests → Chat button (visible on Accepted/later requests).
        • Provider: Active Jobs → Chat button on the relevant job.
        • Both: Chats page in the sidebar shows all conversations with the last
          message preview, sorted by most recent activity.

        ── Chat History ───────────────────────────────────────────────────────
        All messages are stored permanently. When you open a conversation the
        full message history is loaded from the server so you can scroll back
        to see everything that was said.

        ── Unread Indicators ──────────────────────────────────────────────────
        • A red badge on the Chat button of a specific request.
        • A red badge on the Bell (notification) icon in the top navigation bar.
        • A red badge on the "Chats" link in the sidebar.

        ═══════════════════════════════════════════════════════════════════════
        ADMIN PANEL — FULL FEATURE LIST
        ═══════════════════════════════════════════════════════════════════════
        The Admin panel is only accessible to users with the Admin role.
        Sidebar → User Management (the only Admin-specific page).

        ── User List ──────────────────────────────────────────────────────────
        • Shows all registered users with email, role, and subscription tier.
        • Filter by role (Customer / ProviderEmployee / ProviderAdmin / Admin).
        • Search by email address.
        • Paginated — loads in pages for performance.

        ── Actions Per User ───────────────────────────────────────────────────
        • Change Role: assign any of the four roles (cannot edit own or another Admin).
        • Change Subscription: toggle between Free and Paid.
        • View/Edit Permissions: see and override individual permissions.
        • Delete Account: permanently deletes the user including all their
          requests, chat messages, and their organisation (if ProviderAdmin).
          Cannot delete own account or another Admin's account.

        ── Role Permissions Matrix ────────────────────────────────────────────
        • A grid showing every role against every permission with checkboxes.
        • Check a box to add a permission to that role for all its members.
        • Uncheck a box to remove a permission from that role for all its members.
        • Changes invalidate the permission cache for all affected users instantly.
        • The Admin role row is read-only (always full access, cannot be edited).

        ── Per-User Permission Overrides ──────────────────────────────────────
        • View a specific user's permission panel from their row in User Management.
        • Three states for each permission:
            Inherited — uses the role's default (no override stored).
            Granted   — explicitly given to this user even if role doesn't have it.
            Revoked   — explicitly taken from this user even if role normally has it.
        • Setting to "Inherited" removes the override entirely; role default applies.

        ── Organisation Overview ──────────────────────────────────────────────
        • Admins can see a list of all organisations on the platform.
        • Each entry shows the organisation name, owner email, and member count.
        • Searchable by name or owner email.

        ── Job Oversight ──────────────────────────────────────────────────────
        • Admins can see all service requests across the entire platform.
        • Filter by status (Pending, Accepted, Awaiting Confirmation, Completed).
        • Search by title, category, or customer email.
        • Read-only view — Admins observe but do not accept or modify requests
          (those actions belong to provider roles).

        ═══════════════════════════════════════════════════════════════════════
        SUBSCRIPTIONS
        ═══════════════════════════════════════════════════════════════════════
        • Two tiers: Free and Paid.
        • Free: limited number of service requests allowed (enforced at creation).
        • Paid: unlimited service requests.
        • Only Customers are subject to subscription limits.
        • Provider and Admin accounts are not affected by subscription tier.
        • To upgrade: Sidebar → Subscription → Upgrade button.
        • Admins can also change any user's subscription tier from User Management.

        ═══════════════════════════════════════════════════════════════════════
        AI WRITING ASSISTANT
        ═══════════════════════════════════════════════════════════════════════
        • Accessible from every page via the ✨ floating button in the bottom-right.
        • Two tabs:
            Enhance tab: paste any text and click Enhance. The AI rewrites it
              professionally and, for Customers, also suggests the best category.
            Help tab: ask any question about ServiceMarket (this chat — that's me!).
        • Rate limited: Enhance — 20 uses per hour; Help chat — 5 questions per
          20 minutes per user.
        • Works even if the user is mid-way through filling in a form — the
          assistant overlay does not disrupt the page behind it.

        ═══════════════════════════════════════════════════════════════════════
        NAVIGATION REFERENCE
        ═══════════════════════════════════════════════════════════════════════
        Customer:
          Dashboard · My Requests · Chats · Subscription

        ProviderEmployee:
          Dashboard · Available Jobs · Active Jobs · Completed Jobs ·
          Chats · My Organisation (view only)

        ProviderAdmin:
          Dashboard · Available Jobs · Active Jobs · Completed Jobs ·
          Chats · My Organisation (full management)

        Admin:
          User Management (includes users, organisations, jobs, and role permissions)

        ═══════════════════════════════════════════════════════════════════════
        ACCOUNT & AUTHENTICATION
        ═══════════════════════════════════════════════════════════════════════
        • Register: open the Register page, choose email/password, pick a role
          (Customer, ProviderEmployee, or ProviderAdmin — Admin accounts are
          created by existing Admins only).
        • Login: email + password. On success you receive a JWT token that is
          used automatically for all subsequent requests.
        • Your role is embedded in your JWT token and enforced on every API call.
        • Changing your role (by an Admin) takes effect on your next action;
          you may need to log out and back in to see updated navigation.

        ═══════════════════════════════════════════════════════════════════════
        LOCATION & GEO-FILTERING
        ═══════════════════════════════════════════════════════════════════════
        • When a Customer creates a request they enter Latitude and Longitude.
        • Providers can filter Available Jobs by distance — the platform calculates
          the distance from the provider's location to each request using the
          Haversine formula and filters out requests beyond the chosen radius.
        • Location is stored with up to 6 decimal places of precision.

        ═══════════════════════════════════════════════════════════════════════
        RATE LIMITS (what users might encounter)
        ═══════════════════════════════════════════════════════════════════════
        • Login / Register: max 10 attempts per 15 minutes per IP address.
        • AI Description Enhancement: max 20 uses per hour per user.
        • AI Help Chat (this assistant): max 5 questions per 20 minutes per user.
        • Nearby / geo search: max 60 requests per minute per user.
        • Creating/editing requests and other write actions: burst of 20 then
          5 allowed per 30 seconds per user.
        If you hit a rate limit you will see a "Too Many Requests" error. Wait
        the stated period and try again.

        ═══════════════════════════════════════════════════════════════════════
        RESPONSE STYLE GUIDELINES
        ═══════════════════════════════════════════════════════════════════════
        • Be helpful and concise — 2–5 sentences unless a step-by-step list is
          genuinely clearer.
        • Use plain language; avoid technical jargon.
        • Guide the user to the specific page or button they need.
        • When describing steps, use numbered lists.
        • Never fabricate features not described in this prompt.
        • If something is role-restricted, explain which role is needed.
        """;

    public async Task<AiChatResponse> ChatAsync(AiChatRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return new AiChatResponse { Reply = "Please enter a message." };

        if (!_settings.IsConfigured)
            return MockChat(request.Message);

        try
        {
            var messages = new List<object>
            {
                new { role = "system", content = ChatSystemPrompt },
            };

            const int maxHistoryTurns = 10;
            foreach (var turn in request.History.TakeLast(maxHistoryTurns))
                messages.Add(new { role = turn.Role, content = turn.Content });

            messages.Add(new { role = "user", content = request.Message });

            var body = new
            {
                model       = _settings.Model,
                messages,
                max_tokens  = 512,
                temperature = 0.4
            };

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, _settings.Endpoint);
            httpRequest.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _settings.ApiKey);
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
        var lower = message.ToLowerInvariant();

        var reply = lower switch
        {
            var s when s.Contains("permission") && (s.Contains("grant") || s.Contains("give") || s.Contains("assign") || s.Contains("set")) =>
                "Admins can grant or revoke a specific permission for a single user via User Management → find the user → Permissions tab. " +
                "Set the state to Granted (user always has it), Revoked (user never has it), or Inherited (follows the role default). " +
                "Changes take effect immediately — the user's permission cache is cleared right away.",

            var s when s.Contains("permission") && (s.Contains("role") || s.Contains("matrix") || s.Contains("default")) =>
                "Admins can change which permissions an entire role has by default via the Role Permissions matrix in User Management. " +
                "Check or uncheck a permission for a role and all users in that role are updated instantly. " +
                "The Admin role itself cannot be edited — it always has full unrestricted access.",

            var s when s.Contains("permission") =>
                "ServiceMarket uses role-based permissions with optional per-user overrides. " +
                "Each role has a default set of permissions (e.g. Customers can create requests; Providers can accept them). " +
                "Admins can additionally grant or revoke individual permissions for a specific user, overriding the role default just for that person.",

            var s when s.Contains("role") && (s.Contains("change") || s.Contains("assign") || s.Contains("update") || s.Contains("set")) =>
                "Admins can change a user's role from User Management: find the user, choose 'Change Role', select the new role, and save. " +
                "The change is immediate — the user's permission cache is cleared and the new role's permissions apply on their very next action. " +
                "Admins cannot change their own role or another Admin's role.",

            var s when s.Contains("role") =>
                "There are 4 roles: Customer (posts service requests), ProviderEmployee (accepts and completes jobs), " +
                "ProviderAdmin (same as ProviderEmployee plus manages the team organisation), and Admin (full platform access). " +
                "Your role controls which pages and actions are available to you.",

            var s when s.Contains("admin") && (s.Contains("user") || s.Contains("manage") || s.Contains("panel") || s.Contains("dashboard")) =>
                "The Admin panel is under User Management in the sidebar — only Admins can access it. " +
                "From there you can list all users (filter by role/email), change roles, change subscription tiers, " +
                "set per-user permission overrides, view all organisations, oversee all platform requests, and delete accounts.",

            var s when s.Contains("delete") && s.Contains("user") =>
                "Admins can delete a user account from User Management. " +
                "Deleting an account permanently removes the user, all their service requests, chat messages, and their organisation if they were a ProviderAdmin. " +
                "An Admin cannot delete their own account or another Admin's account.",

            var s when s.Contains("subscription") && (s.Contains("admin") || s.Contains("change") || s.Contains("tier")) =>
                "Admins can change any user's subscription tier from User Management — find the user and choose 'Change Subscription'. " +
                "This toggles between Free (limited requests) and Paid (unlimited requests). The change is immediate.",

            var s when s.Contains("request") || s.Contains("job") =>
                "To create a service request, go to My Requests and click 'New Request'. " +
                "Fill in the title, description, category, and your GPS coordinates, then submit. " +
                "The request starts as Pending so providers can see and accept it.",

            var s when s.Contains("status") || s.Contains("pending") || s.Contains("accepted") || s.Contains("confirm") || s.Contains("complete") =>
                "Requests move through four statuses: Pending (waiting for a provider to accept), " +
                "Accepted (a provider has claimed the job — chat is now available), " +
                "Awaiting Confirmation (provider marked it done — you need to click 'Confirm Complete'), " +
                "and Completed (job is fully closed).",

            var s when s.Contains("chat") || s.Contains("message") || s.Contains("real-time") || s.Contains("realtime") =>
                "Real-time chat opens once a provider accepts a request. " +
                "Only the Customer and the assigned Provider can chat on a request. " +
                "Messages are delivered instantly via WebSockets — no page refresh needed. " +
                "Access chat from My Requests or Active Jobs via the Chat button, or from the Chats page in the sidebar.",

            var s when s.Contains("notif") || s.Contains("badge") || s.Contains("unread") =>
                "Unread messages show as a red badge on the Chat button of the relevant request, " +
                "the Bell icon in the top navigation bar, and the Chats link in the sidebar. " +
                "Notifications are delivered in real time — you'll see them even if you're on a different page.",

            var s when s.Contains("subscri") || s.Contains("plan") || s.Contains("upgrade") || s.Contains("free") || s.Contains("paid") =>
                "Free accounts can create a limited number of service requests. " +
                "Once you reach the limit, new request creation is blocked until you upgrade. " +
                "Go to Sidebar → Subscription → Upgrade to switch to the Paid tier for unlimited requests.",

            var s when s.Contains("organisation") || s.Contains("organization") || s.Contains("team") || s.Contains("employee") =>
                "ProviderAdmins manage their organisation via Sidebar → My Organisation. " +
                "Add employees by entering their registered email address — they immediately gain ProviderEmployee access. " +
                "Remove an employee by finding them in the member list and clicking Remove. " +
                "Only the ProviderAdmin (owner) can manage the member list.",

            var s when s.Contains("ai") || s.Contains("enhance") || s.Contains("assist") || s.Contains("writing") =>
                "The AI Writing Assistant (✨ button, bottom-right) is available on every page when logged in. " +
                "Use the Enhance tab to rewrite any text professionally — it also suggests a category for service requests. " +
                "Use the Help tab to ask questions about ServiceMarket (that's this chat!). " +
                "Rate limits apply: 20 enhancements per hour and 5 chat questions per 20 minutes.",

            var s when s.Contains("location") || s.Contains("geo") || s.Contains("latitude") || s.Contains("longitude") || s.Contains("distance") || s.Contains("nearby") =>
                "When creating a request, Customers enter their location as Latitude and Longitude coordinates. " +
                "Providers can filter Available Jobs by distance — the platform calculates the distance from the provider's location to each request. " +
                "Jobs outside the chosen radius are hidden from the Available Jobs list.",

            var s when s.Contains("rate limit") || s.Contains("too many") || s.Contains("blocked") =>
                "Rate limits protect the platform: login/register is capped at 10 attempts per 15 minutes per IP, " +
                "AI enhancement at 20 per hour, this chat at 5 questions per 20 minutes, and general write actions " +
                "at 20 burst then 5 per 30 seconds. If you hit a limit, wait the stated period and try again.",

            var s when s.Contains("login") || s.Contains("sign") || s.Contains("register") || s.Contains("account") || s.Contains("password") =>
                "Register a new account from the Register page by entering your email, password, and choosing your role. " +
                "After registering, log in with your email and password. " +
                "Your role (Customer, ProviderEmployee, ProviderAdmin, or Admin) determines which features and pages you can access.",

            var s when s.Contains("category") || s.Contains("categories") || s.Contains("service type") =>
                "ServiceMarket supports 9 service categories: Plumbing, Electrical, Cleaning, Carpentry, Painting, " +
                "Moving, Gardening, IT Support, and Other. " +
                "When creating a request, select the category that best fits your need. " +
                "The AI writing assistant can also suggest the most appropriate category automatically.",

            _ =>
                "I can only help with questions about ServiceMarket. " +
                "Feel free to ask me about roles, permissions, admin features, creating requests, " +
                "job statuses, real-time chat, subscriptions, organisations, or any other platform feature!"
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
