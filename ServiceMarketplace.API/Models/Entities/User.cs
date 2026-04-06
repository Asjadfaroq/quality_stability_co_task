using Microsoft.AspNetCore.Identity;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Models.Entities;

public class User : IdentityUser<Guid>
{
    public UserRole Role { get; set; } = UserRole.Customer;
    public SubscriptionTier SubTier { get; set; } = SubscriptionTier.Free;
    public Guid? OrganizationId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Organization? Organization { get; set; }
    public ICollection<ServiceRequest> ServiceRequests { get; set; } = [];
    public ICollection<UserPermission> UserPermissions { get; set; } = [];
}
