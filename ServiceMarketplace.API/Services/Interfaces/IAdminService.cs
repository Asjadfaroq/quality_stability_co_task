using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAdminService
{
    Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize);
    Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier);

    /// <summary>Returns all platform permissions and the current role → permission matrix.</summary>
    Task<RolePermissionsDto> GetRolePermissionsAsync();

    /// <summary>
    /// Grants or revokes a permission for a role and invalidates the role-permission cache.
    /// Throws <see cref="KeyNotFoundException"/> if the permission name is unknown.
    /// </summary>
    Task UpdateRolePermissionAsync(UserRole role, string permissionName, bool granted);

    /// <summary>Returns all explicit per-user permission overrides for a given user.</summary>
    Task<List<UserPermissionOverrideDto>> GetUserPermissionsAsync(Guid userId);

    /// <summary>
    /// Sets or removes an explicit permission override for a user.
    /// <paramref name="granted"/> = true → force-grant; false → force-revoke; null → remove override (inherit from role).
    /// Invalidates the per-user permission cache immediately.
    /// Throws <see cref="KeyNotFoundException"/> if the permission name is unknown.
    /// </summary>
    Task UpdateUserPermissionAsync(Guid userId, string permissionName, bool? granted);
}
