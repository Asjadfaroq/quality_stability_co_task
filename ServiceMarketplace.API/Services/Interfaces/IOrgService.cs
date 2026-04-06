using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.DTOs.Org;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IOrgService
{
    Task<List<OrgMemberDto>> GetOrgMembersAsync(Guid providerAdminId);
    Task UpdateMemberPermissionsAsync(Guid providerAdminId, Guid memberId, List<PermissionOverride> overrides);
}
