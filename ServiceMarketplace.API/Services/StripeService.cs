using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Models.Config;
using ServiceMarketplace.API.Models.DTOs.Billing;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class StripeService : IStripeService
{
    private readonly AppDbContext _db;
    private readonly IOptionsMonitor<StripeSettings> _stripeSettings;
    private readonly ILogger<StripeService> _logger;

    public StripeService(
        AppDbContext db,
        IOptionsMonitor<StripeSettings> stripeSettings,
        ILogger<StripeService> logger)
    {
        _db             = db;
        _stripeSettings = stripeSettings;
        _logger         = logger;
    }

    // ── Checkout ─────────────────────────────────────────────────────────────

    public async Task<string> CreateCheckoutSessionAsync(
        Guid userId, string userEmail, string successUrl, string cancelUrl)
    {
        var settings = GetStripeSettingsOrThrow();
        var stripeCustomerId = await EnsureStripeCustomerAsync(userId, userEmail);

        var sessionService = new SessionService(new StripeClient(settings.SecretKey));
        var session = await sessionService.CreateAsync(new SessionCreateOptions
        {
            Customer           = stripeCustomerId,
            PaymentMethodTypes = ["card"],
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Price    = settings.PriceId,
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
        var settings = GetStripeSettingsOrThrow();
        var stripeInfo = await _db.UserStripeInfos
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId)
            ?? throw new InvalidOperationException(
                "No Stripe customer found. Subscribe first before managing billing.");

        var portalService = new Stripe.BillingPortal.SessionService(new StripeClient(settings.SecretKey));
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
        var settings = GetStripeSettingsOrThrow();
        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                payload, stripeSignature, settings.WebhookSecret);
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

    // ── Subscription status ───────────────────────────────────────────────────

    public async Task<SubscriptionStatusDto> GetSubscriptionStatusAsync(Guid userId)
    {
        var info = await _db.UserStripeInfos
            .Include(s => s.User)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (info is null)
            return new SubscriptionStatusDto(); // Free tier, no Stripe record

        return new SubscriptionStatusDto
        {
            Tier             = info.User.SubTier.ToString(),
            Status           = info.SubscriptionStatus,
            CurrentPeriodEnd = info.CurrentPeriodEnd
        };
    }

    public async Task<bool> HasActiveSubscriptionAsync(Guid userId) =>
        await _db.UserStripeInfos
            .AnyAsync(s => s.UserId == userId &&
                           s.SubscriptionStatus == StripeSubscriptionStatus.Active);

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task<string> EnsureStripeCustomerAsync(Guid userId, string userEmail)
    {
        var settings = GetStripeSettingsOrThrow();
        var existing = await _db.UserStripeInfos
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (existing != null)
            return existing.StripeCustomerId;

        var customerService = new CustomerService(new StripeClient(settings.SecretKey));
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

    private StripeSettings GetStripeSettingsOrThrow()
    {
        var settings = _stripeSettings.CurrentValue;
        if (string.IsNullOrWhiteSpace(settings.SecretKey) || string.IsNullOrWhiteSpace(settings.PriceId))
            throw new InvalidOperationException(
                "Stripe billing is not configured for this environment. Set Stripe:SecretKey and Stripe:PriceId.");

        return settings;
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
        stripeInfo.User.SubTier =
            subscription.Status is StripeSubscriptionStatus.Active or StripeSubscriptionStatus.Trialing
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

        stripeInfo.SubscriptionStatus = StripeSubscriptionStatus.Canceled;
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

        stripeInfo.SubscriptionStatus = StripeSubscriptionStatus.PastDue;
        stripeInfo.UpdatedAt          = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogWarning(
            "Payment failed for Stripe customer {CustomerId}", invoice.CustomerId);
    }
}
