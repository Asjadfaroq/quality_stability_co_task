using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAdminService
{
    Task<List<UserDto>> GetAllUsersAsync();
    Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier);
    Task UpdatePermissionsAsync(Guid userId, List<PermissionOverride> overrides);
}
