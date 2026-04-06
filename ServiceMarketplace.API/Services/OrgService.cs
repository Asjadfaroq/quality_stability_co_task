using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.DTOs.Org;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class OrgService : IOrgService
{
    private readonly AppDbContext _db;

    public OrgService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<OrgMemberDto>> GetOrgMembersAsync(Guid providerAdminId)
    {
        // Project only OrganizationId — avoids loading all IdentityUser columns.
        // Use anonymous type so we can distinguish "user not found" from "org is null".
        var adminInfo = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminInfo.OrganizationId is null)
            return [];

        var adminOrgId = adminInfo.OrganizationId.Value;

        // Single query with SQL projection — no full entity load, no ThenInclude overhead
        var raw = await _db.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == adminOrgId && u.Id != providerAdminId)
            .Select(u => new
            {
                u.Id,
                Email = u.Email ?? string.Empty,
                u.Role,
                GrantedPermissions = u.UserPermissions
                    .Where(up => up.Granted)
                    .Select(up => up.Permission!.Name)
                    .ToList()
            })
            .ToListAsync();

        return raw.Select(m => new OrgMemberDto
        {
            Id          = m.Id,
            Email       = m.Email,
            Role        = m.Role.ToString(),
            Permissions = m.GrantedPermissions
        }).ToList();
    }

    public async Task UpdateMemberPermissionsAsync(Guid providerAdminId, Guid memberId, List<PermissionOverride> overrides)
    {
        // Project only what we need — avoids loading all IdentityUser columns
        var adminInfo = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminInfo.OrganizationId is null)
            throw new UnauthorizedAccessException("ProviderAdmin has no organization.");

        var adminOrgId = adminInfo.OrganizationId.Value;

        // Verify target member belongs to the same org — AsNoTracking because we only read
        var memberRole = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == memberId && u.OrganizationId == adminOrgId)
            .Select(u => (UserRole?)u.Role)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Member not found in your organization.");

        if (memberRole != UserRole.ProviderEmployee)
            throw new InvalidOperationException("Can only manage permissions for ProviderEmployee members.");

        // Batch load all referenced permissions in one query
        var permissionNames = overrides.Select(o => o.PermissionName).ToHashSet();
        var permissions = await _db.Permissions
            .AsNoTracking()
            .Where(p => permissionNames.Contains(p.Name))
            .ToDictionaryAsync(p => p.Name);

        var missingName = permissionNames.FirstOrDefault(n => !permissions.ContainsKey(n));
        if (missingName is not null)
            throw new KeyNotFoundException($"Permission '{missingName}' not found.");

        var permissionIds = permissions.Values.Select(p => p.Id).ToList();

        // Batch load existing overrides in one query
        var existingOverrides = await _db.UserPermissions
            .Where(up => up.UserId == memberId && permissionIds.Contains(up.PermissionId))
            .ToDictionaryAsync(up => up.PermissionId);

        foreach (var o in overrides)
        {
            var permission = permissions[o.PermissionName];

            if (existingOverrides.TryGetValue(permission.Id, out var existing))
            {
                existing.Granted = o.Granted;
            }
            else
            {
                _db.UserPermissions.Add(new UserPermission
                {
                    UserId       = memberId,
                    PermissionId = permission.Id,
                    Granted      = o.Granted
                });
            }
        }

        await _db.SaveChangesAsync();
    }
}
