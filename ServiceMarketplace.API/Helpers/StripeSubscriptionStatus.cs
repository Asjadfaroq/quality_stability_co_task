namespace ServiceMarketplace.API.Helpers;

/// <summary>
/// Stripe subscription status string constants. Stripe sends these as lowercase
/// string values in webhook payloads and API responses.
/// </summary>
public static class StripeSubscriptionStatus
{
    public const string Active   = "active";
    public const string Trialing = "trialing";
    public const string PastDue  = "past_due";
    public const string Canceled = "canceled";
    public const string Unpaid   = "unpaid";
    public const string Incomplete = "incomplete";
}
