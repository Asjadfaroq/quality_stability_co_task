using ServiceMarketplace.API.Models.DTOs.Billing;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IStripeService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string userEmail, string successUrl, string cancelUrl);
    Task<string> CreateCustomerPortalSessionAsync(Guid userId, string returnUrl);
    Task HandleWebhookAsync(string payload, string stripeSignature);

    /// <summary>
    /// Returns the current subscription status for the given user.
    /// Returns a default Free-tier record when no Stripe info exists yet.
    /// </summary>
    Task<SubscriptionStatusDto> GetSubscriptionStatusAsync(Guid userId);

    /// <summary>
    /// Returns true when the user already has an active Stripe subscription.
    /// Used to prevent double-subscribing.
    /// </summary>
    Task<bool> HasActiveSubscriptionAsync(Guid userId);
}
