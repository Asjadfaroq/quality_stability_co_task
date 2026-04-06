using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Models.DTOs.Admin;

public class UpdateSubscriptionRequest
{
    public SubscriptionTier SubTier { get; set; }
}
