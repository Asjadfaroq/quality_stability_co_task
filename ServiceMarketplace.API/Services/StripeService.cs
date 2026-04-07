using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Config;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class StripeService : IStripeService
{
    private readonly AppDbContext _db;
    private readonly StripeSettings _settings;
    private readonly ILogger<StripeService> _logger;

    public StripeService(
        AppDbContext db,
        IOptions<StripeSettings> settings,
        ILogger<StripeService> logger)
    {
        _db       = db;
        _settings = settings.Value;
        _logger   = logger;
        StripeConfiguration.ApiKey = _settings.SecretKey;
    }

    // ── Checkout ─────────────────────────────────────────────────────────────

    public async Task<string> CreateCheckoutSessionAsync(
        Guid userId, string userEmail, string successUrl, string cancelUrl)
    {
        var stripeCustomerId = await EnsureStripeCustomerAsync(userId, userEmail);

        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(new SessionCreateOptions
        {
            Customer           = stripeCustomerId,
            PaymentMethodTypes = ["card"],
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Price    = _settings.PriceId,
                    Quantity = 1
                }
            ],
            Mode       = "subscription",
            SuccessUrl = successUrl,
            CancelUrl  = cancelUrl,
            Metadata   = new Dictionary<string, string> { { "userId", userId.ToString() } }
        });

        return session.Url;
    }

    // ── Billing portal (manage / cancel) ─────────────────────────────────────

    public async Task<string> CreateCustomerPortalSessionAsync(Guid userId, string returnUrl)
    {
        var stripeInfo = await _db.UserStripeInfos
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId)
            ?? throw new InvalidOperationException(
                "No Stripe customer found. Subscribe first before managing billing.");

        var portalService = new Stripe.BillingPortal.SessionService();
        var session = await portalService.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer  = stripeInfo.StripeCustomerId,
            ReturnUrl = returnUrl
        });

        return session.Url;
    }

    // ── Webhook ───────────────────────────────────────────────────────────────

    public async Task HandleWebhookAsync(string payload, string stripeSignature)
    {
        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                payload, stripeSignature, _settings.WebhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning("Stripe webhook signature validation failed: {Message}", ex.Message);
            throw;
        }

        _logger.LogInformation("Stripe webhook received: {Type}", stripeEvent.Type);

        switch (stripeEvent.Type)
        {
            case "customer.subscription.created":
            case "customer.subscription.updated":
                if (stripeEvent.Data.Object is Subscription sub)
                    await HandleSubscriptionChangedAsync(sub);
                break;

            case "customer.subscription.deleted":
                if (stripeEvent.Data.Object is Subscription canceledSub)
                    await HandleSubscriptionCanceledAsync(canceledSub);
                break;

            case "invoice.payment_failed":
                if (stripeEvent.Data.Object is Invoice failedInvoice)
                    await HandlePaymentFailedAsync(failedInvoice);
                break;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task<string> EnsureStripeCustomerAsync(Guid userId, string userEmail)
    {
        var existing = await _db.UserStripeInfos
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (existing != null)
            return existing.StripeCustomerId;

        var customerService = new CustomerService();
        var customer = await customerService.CreateAsync(new CustomerCreateOptions
        {
            Email    = userEmail,
            Metadata = new Dictionary<string, string> { { "userId", userId.ToString() } }
        });

        _db.UserStripeInfos.Add(new UserStripeInfo
        {
            UserId           = userId,
            StripeCustomerId = customer.Id
        });
        await _db.SaveChangesAsync();

        return customer.Id;
    }

    private async Task HandleSubscriptionChangedAsync(Subscription subscription)
    {
        var stripeInfo = await _db.UserStripeInfos
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.StripeCustomerId == subscription.CustomerId);

        if (stripeInfo == null)
        {
            _logger.LogWarning(
                "Webhook: no user found for Stripe customer {CustomerId}", subscription.CustomerId);
            return;
        }

        stripeInfo.StripeSubscriptionId = subscription.Id;
        stripeInfo.SubscriptionStatus   = subscription.Status;
        // In Stripe.net v47+, CurrentPeriodEnd lives on the first SubscriptionItem
        stripeInfo.CurrentPeriodEnd     = subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        stripeInfo.UpdatedAt            = DateTime.UtcNow;

        // "active" and "trialing" count as Paid; everything else reverts to Free
        stripeInfo.User.SubTier = subscription.Status is "active" or "trialing"
            ? SubscriptionTier.Paid
            : SubscriptionTier.Free;

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Subscription updated for user {UserId}: status={Status}, tier={Tier}",
            stripeInfo.UserId, subscription.Status, stripeInfo.User.SubTier);
    }

    private async Task HandleSubscriptionCanceledAsync(Subscription subscription)
    {
        var stripeInfo = await _db.UserStripeInfos
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.StripeCustomerId == subscription.CustomerId);

        if (stripeInfo == null) return;

        stripeInfo.SubscriptionStatus = "canceled";
        stripeInfo.UpdatedAt          = DateTime.UtcNow;
        stripeInfo.User.SubTier       = SubscriptionTier.Free;

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Subscription canceled for user {UserId}", stripeInfo.UserId);
    }

    private async Task HandlePaymentFailedAsync(Invoice invoice)
    {
        var stripeInfo = await _db.UserStripeInfos
            .FirstOrDefaultAsync(s => s.StripeCustomerId == invoice.CustomerId);

        if (stripeInfo == null) return;

        stripeInfo.SubscriptionStatus = "past_due";
        stripeInfo.UpdatedAt          = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogWarning(
            "Payment failed for Stripe customer {CustomerId}", invoice.CustomerId);
    }
}
