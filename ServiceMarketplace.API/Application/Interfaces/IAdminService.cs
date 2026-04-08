using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAdminService
{
    /// <summary>
    /// Returns paginated users with optional role/email filters.
    /// </summary>
    Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize, string? role, string? search);
    Task UpdateUserRoleAsync(Guid userId, UserRole role);
    Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier);

    /// <summary>
    /// Returns paginated jobs with optional status/search filters.
    /// </summary>
    Task<PagedResult<AdminJobDto>> GetAllJobsAsync(int page, int pageSize, string? status, string? search);

    /// <summary>
    /// Returns paginated organizations with optional search.
    /// </summary>
    Task<PagedResult<AdminOrgDto>> GetAllOrgsAsync(int page, int pageSize, string? search);

    /// <summary>Returns platform permissions and role assignments.</summary>
    Task<RolePermissionsDto> GetRolePermissionsAsync();

    /// <summary>
    /// Grants or revokes a role permission.
    /// </summary>
    Task UpdateRolePermissionAsync(UserRole role, string permissionName, bool granted);

    /// <summary>Returns explicit per-user permission overrides.</summary>
    Task<List<UserPermissionOverrideDto>> GetUserPermissionsAsync(Guid userId);

    /// <summary>
    /// Sets or removes a user-level permission override.
    /// </summary>
    Task UpdateUserPermissionAsync(Guid userId, string permissionName, bool? granted);

    /// <summary>
    /// Deletes a user and related data in one transaction.
    /// </summary>
    Task DeleteUserAsync(Guid targetUserId);
}
