namespace ServiceMarketplace.API.Models.Entities;

public class UserStripeInfo
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string StripeCustomerId { get; set; } = string.Empty;
    public string? StripeSubscriptionId { get; set; }

    /// <summary>
    /// Stripe subscription status: "active", "trialing", "past_due", "canceled", "unpaid", etc.
    /// </summary>
    public string? SubscriptionStatus { get; set; }

    public DateTime? CurrentPeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
