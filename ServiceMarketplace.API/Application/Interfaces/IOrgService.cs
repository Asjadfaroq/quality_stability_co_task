using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.DTOs.Org;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IOrgService
{
    Task<OrgDto?> GetOrgByOwnerAsync(Guid providerAdminId);
    Task<OrgDto?> GetOrgForUserAsync(Guid userId);
    Task<OrgDto> CreateOrgAsync(Guid providerAdminId, string name);
    Task AddMemberAsync(Guid providerAdminId, string email);
    Task RemoveMemberAsync(Guid providerAdminId, Guid memberId);
    Task<PagedResult<OrgMemberDto>> GetOrgMembersAsync(Guid providerAdminId, int page, int pageSize);

    /// <summary>Returns all platform permissions (names only — no role assignments).</summary>
    Task<List<PermissionDto>> GetAllPermissionsAsync();

    /// <summary>
    /// Returns explicit permission overrides for a member of the ProviderAdmin's org.
    /// Throws <see cref="KeyNotFoundException"/> if the member is not in the admin's org.
    /// </summary>
    Task<List<UserPermissionOverrideDto>> GetMemberPermissionsAsync(Guid providerAdminId, Guid memberId);

    /// <summary>
    /// Sets or removes an explicit permission override for an org member.
    /// <paramref name="granted"/> null → remove override (inherit from role).
    /// Throws <see cref="KeyNotFoundException"/> if the member is not in the admin's org.
    /// Throws <see cref="KeyNotFoundException"/> if the permission name is unknown.
    /// </summary>
    Task UpdateMemberPermissionAsync(Guid providerAdminId, Guid memberId, string permissionName, bool? granted);
}
