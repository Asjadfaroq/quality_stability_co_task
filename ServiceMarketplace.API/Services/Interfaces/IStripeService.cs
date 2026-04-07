namespace ServiceMarketplace.API.Services.Interfaces;

public interface IStripeService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string userEmail, string successUrl, string cancelUrl);
    Task<string> CreateCustomerPortalSessionAsync(Guid userId, string returnUrl);
    Task HandleWebhookAsync(string payload, string stripeSignature);
}
