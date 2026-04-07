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
    Task UpdateMemberPermissionsAsync(Guid providerAdminId, Guid memberId, List<PermissionOverride> overrides);
}
