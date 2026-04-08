namespace ServiceMarketplace.API.Models.DTOs.Billing;

public class SubscriptionStatusDto
{
    public string Tier { get; set; } = "Free";
    public string? Status { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
}
