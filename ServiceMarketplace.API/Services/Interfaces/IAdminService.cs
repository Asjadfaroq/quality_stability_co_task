using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAdminService
{
    Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize);
    Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier);
    Task UpdatePermissionsAsync(Guid userId, List<PermissionOverride> overrides);
}
