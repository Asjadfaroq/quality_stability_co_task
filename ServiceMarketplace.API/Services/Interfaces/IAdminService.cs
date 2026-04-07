using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAdminService
{
    Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize);
    Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier);

    /// <summary>
    /// Returns a paginated list of every service request on the platform.
    /// Optional <paramref name="status"/> narrows by RequestStatus name (case-insensitive).
    /// Optional <paramref name="search"/> applies a case-insensitive substring match against
    /// the request title, category, and customer email.
    /// </summary>
    Task<PagedResult<AdminJobDto>> GetAllJobsAsync(int page, int pageSize, string? status, string? search);

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

    /// <summary>
    /// Permanently deletes a user account and all associated data in a single transaction.
    /// Handles all edge cases:
    ///   • Chat messages belonging to the user's service requests are deleted first.
    ///   • Service requests where the user is the customer are deleted.
    ///   • If the user owns an organization the org is deleted; SQL SET NULL propagates
    ///     to every member's <c>OrganizationId</c> automatically.
    ///   • ASP.NET Identity satellite rows and custom cascade-configured rows
    ///     (UserPermission, UserStripeInfo) are removed by the database cascade.
    ///   • The user's permission cache entry is evicted after the commit.
    /// Throws <see cref="KeyNotFoundException"/> if the target user does not exist.
    /// Throws <see cref="UnauthorizedAccessException"/> if an attempt is made to delete an Admin account.
    /// </summary>
    Task DeleteUserAsync(Guid targetUserId);
}
