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
        var admin = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (admin.OrganizationId is null)
            return [];

        var members = await _db.Users
            .AsNoTracking()
            .Include(u => u.UserPermissions)
                .ThenInclude(up => up.Permission)
            .Where(u => u.OrganizationId == admin.OrganizationId && u.Id != providerAdminId)
            .ToListAsync();

        return members.Select(m => new OrgMemberDto
        {
            Id = m.Id,
            Email = m.Email ?? string.Empty,
            Role = m.Role.ToString(),
            Permissions = m.UserPermissions
                .Where(up => up.Granted)
                .Select(up => up.Permission?.Name ?? string.Empty)
                .ToList()
        }).ToList();
    }

    public async Task UpdateMemberPermissionsAsync(Guid providerAdminId, Guid memberId, List<PermissionOverride> overrides)
    {
        // Verify providerAdmin exists and has an org
        var admin = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (admin.OrganizationId is null)
            throw new UnauthorizedAccessException("ProviderAdmin has no organization.");

        // Verify target member belongs to the same org
        var member = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == memberId && u.OrganizationId == admin.OrganizationId)
            ?? throw new KeyNotFoundException("Member not found in your organization.");

        // Only allow managing ProviderEmployee permissions
        if (member.Role != UserRole.ProviderEmployee)
            throw new InvalidOperationException("Can only manage permissions for ProviderEmployee members.");

        foreach (var o in overrides)
        {
            var permission = await _db.Permissions
                .FirstOrDefaultAsync(p => p.Name == o.PermissionName)
                ?? throw new KeyNotFoundException($"Permission '{o.PermissionName}' not found.");

            var existing = await _db.UserPermissions
                .FirstOrDefaultAsync(up => up.UserId == memberId && up.PermissionId == permission.Id);

            if (existing is null)
            {
                _db.UserPermissions.Add(new UserPermission
                {
                    UserId = memberId,
                    PermissionId = permission.Id,
                    Granted = o.Granted
                });
            }
            else
            {
                existing.Granted = o.Granted;
            }
        }

        await _db.SaveChangesAsync();
    }
}
