Stripe Integration Roadmap
What you have today
User.SubTier (Free/Paid enum) — toggled manually by Admin
SubscriptionService.EnforceCreateLimitAsync() — enforces request limits
No billing model, no payment gateway
What we're adding
Stripe Checkout for customers to self-subscribe
Webhook handler to sync payment events → User.SubTier
Admin flow stays exactly as-is (manual toggle still works)
New UserStripeInfo entity to store Stripe customer/subscription IDs
Phase 1 — Backend: Stripe Package & Config
Install NuGet package:


cd ServiceMarketplace.API
dotnet add package Stripe.net
Add to appsettings.json (alongside your existing sections):


"Stripe": {
  "PublishableKey": "pk_test_51TJH8C...",
  "SecretKey": "sk_test_51TJH8C...",
  "WebhookSecret": "whsec_...",
  "PriceId": "price_..."
}
You'll get WebhookSecret from Stripe Dashboard → Developers → Webhooks after creating a webhook endpoint. PriceId comes from Stripe Dashboard → Products → create a product with a recurring price.

Add config class — create /Models/Config/StripeSettings.cs:


namespace ServiceMarketplace.API.Models.Config;

public class StripeSettings
{
    public string PublishableKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string PriceId { get; set; } = string.Empty;
}
Phase 2 — Database: New Entity & Migration
Create /Models/Entities/UserStripeInfo.cs:


namespace ServiceMarketplace.API.Models.Entities;

public class UserStripeInfo
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string StripeCustomerId { get; set; } = string.Empty;
    public string? StripeSubscriptionId { get; set; }
    public string? SubscriptionStatus { get; set; }   // "active", "past_due", "canceled", etc.
    public DateTime? CurrentPeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
Add to AppDbContext.cs (in the DbSet declarations area):


public DbSet<UserStripeInfo> UserStripeInfos => Set<UserStripeInfo>();
Add configuration in OnModelCreating:


modelBuilder.Entity<UserStripeInfo>(entity =>
{
    entity.HasKey(e => e.UserId);
    entity.HasOne(e => e.User)
          .WithOne()
          .HasForeignKey<UserStripeInfo>(e => e.UserId)
          .OnDelete(DeleteBehavior.Cascade);
    entity.HasIndex(e => e.StripeCustomerId).IsUnique();
    entity.HasIndex(e => e.StripeSubscriptionId);
});
Generate migration:


dotnet ef migrations add AddStripeIntegration
dotnet ef database update
Phase 3 — Backend: StripeService
Create /Services/IStripeService.cs:


namespace ServiceMarketplace.API.Services;

public interface IStripeService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string userEmail, string successUrl, string cancelUrl);
    Task<string> CreateCustomerPortalSessionAsync(Guid userId, string returnUrl);
    Task HandleWebhookAsync(string payload, string stripeSignature);
}
Create /Services/StripeService.cs:


using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Config;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services;

public class StripeService : IStripeService
{
    private readonly AppDbContext _db;
    private readonly StripeSettings _settings;
    private readonly ILogger<StripeService> _logger;

    public StripeService(AppDbContext db, IOptions<StripeSettings> settings, ILogger<StripeService> logger)
    {
        _db = db;
        _settings = settings.Value;
        _logger = logger;
        StripeConfiguration.ApiKey = _settings.SecretKey;
    }

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string userEmail, string successUrl, string cancelUrl)
    {
        // Get or create Stripe customer
        var stripeInfo = await _db.UserStripeInfos.FirstOrDefaultAsync(s => s.UserId == userId);
        string stripeCustomerId;

        if (stripeInfo == null)
        {
            var customerService = new CustomerService();
            var customer = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = userEmail,
                Metadata = new Dictionary<string, string> { { "userId", userId.ToString() } }
            });
            stripeCustomerId = customer.Id;

            _db.UserStripeInfos.Add(new UserStripeInfo
            {
                UserId = userId,
                StripeCustomerId = stripeCustomerId
            });
            await _db.SaveChangesAsync();
        }
        else
        {
            stripeCustomerId = stripeInfo.StripeCustomerId;
        }

        // Create checkout session
        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(new SessionCreateOptions
        {
            Customer = stripeCustomerId,
            PaymentMethodTypes = ["card"],
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Price = _settings.PriceId,
                    Quantity = 1
                }
            ],
            Mode = "subscription",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string> { { "userId", userId.ToString() } }
        });

        return session.Url;
    }

    public async Task<string> CreateCustomerPortalSessionAsync(Guid userId, string returnUrl)
    {
        var stripeInfo = await _db.UserStripeInfos.FirstOrDefaultAsync(s => s.UserId == userId)
            ?? throw new InvalidOperationException("No Stripe customer found for this user.");

        var portalService = new Stripe.BillingPortal.SessionService();
        var session = await portalService.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = stripeInfo.StripeCustomerId,
            ReturnUrl = returnUrl
        });

        return session.Url;
    }

    public async Task HandleWebhookAsync(string payload, string stripeSignature)
    {
        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, stripeSignature, _settings.WebhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning("Stripe webhook signature validation failed: {Message}", ex.Message);
            throw;
        }

        _logger.LogInformation("Stripe webhook received: {Type}", stripeEvent.Type);

        switch (stripeEvent.Type)
        {
            case Events.CustomerSubscriptionCreated:
            case Events.CustomerSubscriptionUpdated:
                await HandleSubscriptionChangedAsync((Subscription)stripeEvent.Data.Object);
                break;

            case Events.CustomerSubscriptionDeleted:
                await HandleSubscriptionCanceledAsync((Subscription)stripeEvent.Data.Object);
                break;

            case Events.InvoicePaymentFailed:
                await HandlePaymentFailedAsync((Invoice)stripeEvent.Data.Object);
                break;
        }
    }

    private async Task HandleSubscriptionChangedAsync(Subscription subscription)
    {
        var stripeInfo = await _db.UserStripeInfos
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.StripeCustomerId == subscription.CustomerId);

        if (stripeInfo == null)
        {
            _logger.LogWarning("No user found for Stripe customer {CustomerId}", subscription.CustomerId);
            return;
        }

        stripeInfo.StripeSubscriptionId = subscription.Id;
        stripeInfo.SubscriptionStatus = subscription.Status;
        stripeInfo.CurrentPeriodEnd = subscription.CurrentPeriodEnd;
        stripeInfo.UpdatedAt = DateTime.UtcNow;

        // Sync SubTier: "active" or "trialing" → Paid, everything else → Free
        stripeInfo.User.SubTier = subscription.Status is "active" or "trialing"
            ? SubscriptionTier.Paid
            : SubscriptionTier.Free;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Updated subscription for user {UserId}: {Status}", stripeInfo.UserId, subscription.Status);
    }

    private async Task HandleSubscriptionCanceledAsync(Subscription subscription)
    {
        var stripeInfo = await _db.UserStripeInfos
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.StripeCustomerId == subscription.CustomerId);

        if (stripeInfo == null) return;

        stripeInfo.SubscriptionStatus = "canceled";
        stripeInfo.UpdatedAt = DateTime.UtcNow;
        stripeInfo.User.SubTier = SubscriptionTier.Free;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Subscription canceled for user {UserId}", stripeInfo.UserId);
    }

    private async Task HandlePaymentFailedAsync(Invoice invoice)
    {
        var stripeInfo = await _db.UserStripeInfos
            .FirstOrDefaultAsync(s => s.StripeCustomerId == invoice.CustomerId);

        if (stripeInfo != null)
        {
            stripeInfo.SubscriptionStatus = "past_due";
            stripeInfo.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        _logger.LogWarning("Payment failed for Stripe customer {CustomerId}", invoice.CustomerId);
    }
}
Phase 4 — Backend: BillingController
Create /Controllers/BillingController.cs:


using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Services;

namespace ServiceMarketplace.API.Controllers;

[ApiController]
[Route("api/billing")]
public class BillingController : ControllerBase
{
    private readonly IStripeService _stripeService;
    private readonly AppDbContext _db;
    private readonly ILogger<BillingController> _logger;

    public BillingController(IStripeService stripeService, AppDbContext db, ILogger<BillingController> logger)
    {
        _stripeService = stripeService;
        _db = db;
        _logger = logger;
    }

    // Customer creates a checkout session to subscribe
    [HttpPost("checkout")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> CreateCheckoutSession()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimConstants.UserId)!);
        var email = User.FindFirstValue(ClaimTypes.Email)!;

        // Prevent double-subscribing
        var existing = await _db.UserStripeInfos
            .FirstOrDefaultAsync(s => s.UserId == userId && s.SubscriptionStatus == "active");
        if (existing != null)
            return BadRequest(new { message = "You already have an active subscription." });

        var frontendUrl = Request.Headers.Origin.ToString();
        var successUrl = $"{frontendUrl}/subscription/success";
        var cancelUrl = $"{frontendUrl}/subscription";

        var checkoutUrl = await _stripeService.CreateCheckoutSessionAsync(userId, email, successUrl, cancelUrl);
        return Ok(new { url = checkoutUrl });
    }

    // Customer opens Stripe billing portal (manage/cancel subscription)
    [HttpPost("portal")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> CreatePortalSession()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimConstants.UserId)!);
        var frontendUrl = Request.Headers.Origin.ToString();
        var returnUrl = $"{frontendUrl}/subscription";

        var portalUrl = await _stripeService.CreateCustomerPortalSessionAsync(userId, returnUrl);
        return Ok(new { url = portalUrl });
    }

    // Customer views their current subscription status
    [HttpGet("status")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> GetSubscriptionStatus()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimConstants.UserId)!);
        var info = await _db.UserStripeInfos
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (info == null)
            return Ok(new { tier = "Free", status = (string?)null, currentPeriodEnd = (DateTime?)null });

        return Ok(new
        {
            tier = info.User.SubTier.ToString(),
            status = info.SubscriptionStatus,
            currentPeriodEnd = info.CurrentPeriodEnd
        });
    }

    // Stripe webhook — NO auth, raw body required
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var payload = await new StreamReader(Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await _stripeService.HandleWebhookAsync(payload, signature);
            return Ok();
        }
        catch (Stripe.StripeException ex)
        {
            _logger.LogWarning("Webhook validation failed: {Message}", ex.Message);
            return BadRequest(new { message = "Invalid webhook signature." });
        }
    }
}
Critical webhook fix in Program.cs — add this before app.UseRouting() or equivalent. Stripe webhooks need the raw body, which ASP.NET normally buffers/parses:


// Add BEFORE app.UseHttpsRedirection() or middleware stack
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/billing/webhook"))
    {
        context.Request.EnableBuffering();
    }
    await next();
});
Register StripeService in Program.cs (alongside your existing AddScoped calls):


builder.Services.Configure<StripeSettings>(builder.Configuration.GetSection("Stripe"));
builder.Services.AddScoped<IStripeService, StripeService>();
Phase 5 — Frontend: Subscription Page
Create /src/pages/customer/SubscriptionPage.tsx:


import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../api/axios'
import toast from 'react-hot-toast'

interface SubscriptionStatus {
  tier: 'Free' | 'Paid'
  status: string | null
  currentPeriodEnd: string | null
}

export default function SubscriptionPage() {
  const { data, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/billing/status').then(r => r.data),
  })

  const checkoutMutation = useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/checkout').then(r => r.data),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Something went wrong'),
  })

  const portalMutation = useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal').then(r => r.data),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: () => toast.error('Could not open billing portal'),
  })

  if (isLoading) return <div className="p-8 text-center">Loading...</div>

  const isPaid = data?.tier === 'Paid'
  const periodEnd = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString()
    : null

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 bg-white rounded-2xl shadow-md">
      <h1 className="text-2xl font-bold mb-2">Subscription</h1>
      <p className="text-gray-500 mb-6">Manage your plan</p>

      <div className={`rounded-xl p-6 mb-6 ${isPaid ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
        <p className="text-sm text-gray-500 mb-1">Current Plan</p>
        <p className="text-2xl font-semibold">{isPaid ? 'Paid' : 'Free'}</p>
        {isPaid && data?.status && (
          <p className="text-sm text-gray-500 mt-1 capitalize">Status: {data.status}</p>
        )}
        {isPaid && periodEnd && (
          <p className="text-sm text-gray-500 mt-1">Renews: {periodEnd}</p>
        )}
        {!isPaid && (
          <p className="text-sm text-gray-400 mt-2">Limited to 3 service requests</p>
        )}
      </div>

      {!isPaid ? (
        <button
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition disabled:opacity-50"
        >
          {checkoutMutation.isPending ? 'Redirecting...' : 'Upgrade to Paid — Unlimited Requests'}
        </button>
      ) : (
        <button
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition disabled:opacity-50"
        >
          {portalMutation.isPending ? 'Opening...' : 'Manage Billing / Cancel'}
        </button>
      )}
    </div>
  )
}
Create /src/pages/customer/SubscriptionSuccess.tsx:


import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

export default function SubscriptionSuccess() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] })
    const t = setTimeout(() => navigate('/dashboard'), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="max-w-md mx-auto mt-24 text-center p-8">
      <div className="text-5xl mb-4">✓</div>
      <h1 className="text-2xl font-bold text-green-600 mb-2">Subscription Active!</h1>
      <p className="text-gray-500">Redirecting to your dashboard...</p>
    </div>
  )
}
Add routes in your router file (wherever CustomerDashboard is routed):


import SubscriptionPage from './pages/customer/SubscriptionPage'
import SubscriptionSuccess from './pages/customer/SubscriptionSuccess'

// Inside your Customer routes:
<Route path="/subscription" element={<ProtectedRoute roles={['Customer']}><SubscriptionPage /></ProtectedRoute>} />
<Route path="/subscription/success" element={<ProtectedRoute roles={['Customer']}><SubscriptionSuccess /></ProtectedRoute>} />
Add link to nav in your customer layout/sidebar:


<Link to="/subscription" className="...">Subscription</Link>
Phase 6 — Stripe Dashboard Setup (one-time)
Create a Product:

Stripe Dashboard → Products → Add Product
Name: "Premium Plan", Pricing: Recurring, Monthly, set your price
Copy the price_... ID → paste into appsettings.json
Create a Webhook Endpoint:

Stripe Dashboard → Developers → Webhooks → Add Endpoint
For local dev, use Stripe CLI: stripe listen --forward-to localhost:5132/api/billing/webhook
For production: point to your live URL https://yourapp.com/api/billing/webhook
Listen for events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
Copy the whsec_... secret → paste into appsettings.json
Enable Billing Portal:

Stripe Dashboard → Settings → Billing → Customer Portal → Activate
Phase 7 — Testing in Test Mode
Use these test card numbers in Stripe Checkout:

Scenario	Card Number
Successful payment	4242 4242 4242 4242
Payment declined	4000 0000 0000 0002
Requires authentication	4000 0025 0000 3155
Any future expiry date, any CVC.

Local webhook testing with Stripe CLI:


stripe login
stripe listen --forward-to localhost:5132/api/billing/webhook
# In another terminal, trigger test events:
stripe trigger customer.subscription.created
Summary: What Changes vs What Stays the Same
Admin Flow	Customer Flow
Manual toggle	PATCH /api/admin/users/{id}/subscription — unchanged	N/A
Stripe checkout	N/A (admins don't pay)	New: POST /api/billing/checkout
Billing portal	N/A	New: POST /api/billing/portal
SubTier sync	Admin sets directly	Stripe webhook syncs automatically
Request limits	Enforced by existing SubscriptionService — unchanged	Same enforcement, tier updated via webhook
Permissions	Unchanged	Unchanged
JWT/auth	Unchanged	Unchanged
The admin can still manually upgrade any user — that sets User.SubTier directly and still works exactly as before, independent of Stripe.

Want me to start implementing any of these phases directly in your codebase?