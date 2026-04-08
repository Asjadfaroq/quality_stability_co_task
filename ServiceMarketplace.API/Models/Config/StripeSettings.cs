using System.ComponentModel.DataAnnotations;

namespace ServiceMarketplace.API.Models.Config;

public class StripeSettings
{
    public string PublishableKey { get; set; } = string.Empty;
    [Required]
    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    [Required]
    public string PriceId { get; set; } = string.Empty;
}
