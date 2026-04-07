using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Hubs;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.DTOs.Org;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class OrgService : IOrgService
{
    private readonly AppDbContext _db;
    private readonly ICacheService _cache;
    private readonly IHubContext<NotificationHub> _hub;

    public OrgService(AppDbContext db, ICacheService cache, IHubContext<NotificationHub> hub)
    {
        _db    = db;
        _cache = cache;
        _hub   = hub;
    }

    public async Task<OrgDto?> GetOrgForUserAsync(Guid userId)
    {
        // Looks up the org any user (ProviderAdmin or ProviderEmployee) belongs to
        // via their User.OrganizationId foreign key.
        return await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.OrganizationId != null)
            .Select(u => new OrgDto
            {
                Id        = u.Organization!.Id,
                Name      = u.Organization!.Name,
                OwnerId   = u.Organization!.OwnerId,
                CreatedAt = u.Organization!.CreatedAt,
            })
            .FirstOrDefaultAsync();
    }

    public async Task<OrgDto?> GetOrgByOwnerAsync(Guid providerAdminId)
    {
        var org = await _db.Organizations
            .AsNoTracking()
            .Where(o => o.OwnerId == providerAdminId)
            .Select(o => new OrgDto
            {
                Id        = o.Id,
                Name      = o.Name,
                OwnerId   = o.OwnerId,
                CreatedAt = o.CreatedAt,
            })
            .FirstOrDefaultAsync();

        return org;
    }

    public async Task<OrgDto> CreateOrgAsync(Guid providerAdminId, string name)
    {
        var ownerExists = await _db.Users
            .AnyAsync(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin);

        if (!ownerExists)
            throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        var alreadyOwns = await _db.Organizations
            .AnyAsync(o => o.OwnerId == providerAdminId);

        if (alreadyOwns)
            throw new InvalidOperationException("You already have an organization.");

        var org = new Organization
        {
            Id        = Guid.NewGuid(),
            Name      = name.Trim(),
            OwnerId   = providerAdminId,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Organizations.Add(org);

        // Link the owner into their own org so they appear in the member list.
        var owner = await _db.Users.FindAsync(providerAdminId);
        owner!.OrganizationId = org.Id;

        await _db.SaveChangesAsync();

        return new OrgDto
        {
            Id        = org.Id,
            Name      = org.Name,
            OwnerId   = org.OwnerId,
            CreatedAt = org.CreatedAt,
        };
    }

    public async Task AddMemberAsync(Guid providerAdminId, string email)
    {
        var adminOrg = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminOrg.OrganizationId is null)
            throw new InvalidOperationException("You don't have an organization yet. Create one first.");

        var orgId = adminOrg.OrganizationId.Value;

        var target = await _db.Users
            .FirstOrDefaultAsync(u => u.NormalizedEmail == email.Trim().ToUpperInvariant())
            ?? throw new KeyNotFoundException("No user found with that email address.");

        if (target.Role != UserRole.ProviderEmployee)
            throw new InvalidOperationException("Only ProviderEmployee accounts can be added as members.");

        // Already a member of THIS org — idempotent, no error.
        if (target.OrganizationId == orgId)
            return;

        // Blocked: member of a DIFFERENT org.
        if (target.OrganizationId.HasValue)
            throw new InvalidOperationException("This user already belongs to another organization.");

        target.OrganizationId = orgId;
        await _db.SaveChangesAsync();

        // Notify the added user in real-time.
        await _hub.Clients
            .Group(target.Id.ToString())
            .SendAsync("OrgMemberAdded", new
            {
                organizationId   = orgId,
                organizationName = (await _db.Organizations.AsNoTracking()
                                       .Where(o => o.Id == orgId)
                                       .Select(o => o.Name)
                                       .FirstOrDefaultAsync()) ?? string.Empty,
            });
    }

    public async Task RemoveMemberAsync(Guid providerAdminId, Guid memberId)
    {
        if (memberId == providerAdminId)
            throw new InvalidOperationException("You cannot remove yourself. Delete the organization instead.");

        var adminOrg = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminOrg.OrganizationId is null)
            throw new InvalidOperationException("You don't have an organization.");

        var orgId = adminOrg.OrganizationId.Value;

        var member = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == memberId && u.OrganizationId == orgId)
            ?? throw new KeyNotFoundException("Member not found in your organization.");

        var orgName = await _db.Organizations.AsNoTracking()
            .Where(o => o.Id == orgId)
            .Select(o => o.Name)
            .FirstOrDefaultAsync() ?? string.Empty;

        member.OrganizationId = null;
        await _db.SaveChangesAsync();

        // Notify the removed user in real-time.
        await _hub.Clients
            .Group(memberId.ToString())
            .SendAsync("OrgMemberRemoved", new
            {
                organizationId   = orgId,
                organizationName = orgName,
            });
    }

    public async Task<PagedResult<OrgMemberDto>> GetOrgMembersAsync(Guid providerAdminId, int page, int pageSize)
    {
        var adminInfo = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminInfo.OrganizationId is null)
            return PagedResult<OrgMemberDto>.Empty(page, pageSize);

        var adminOrgId = adminInfo.OrganizationId.Value;

        var baseQuery = _db.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == adminOrgId && u.Id != providerAdminId);

        var totalCount = await baseQuery.CountAsync();

        if (totalCount == 0)
            return PagedResult<OrgMemberDto>.Empty(page, pageSize);

        // Query 1: scalar member fields only — no permission JOIN fan-out.
        var members = await baseQuery
            .OrderBy(u => u.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                Email = u.Email ?? string.Empty,
                u.Role
            })
            .ToListAsync();

        if (members.Count == 0)
            return PagedResult<OrgMemberDto>.Empty(page, pageSize);

        var memberIds = members.Select(u => u.Id).ToList();

        // Query 2: granted permissions only for this page's members.
        var permissionsFlat = await _db.UserPermissions
            .AsNoTracking()
            .Where(up => memberIds.Contains(up.UserId) && up.Granted)
            .Select(up => new { up.UserId, up.Permission!.Name })
            .ToListAsync();

        var permsByMember = permissionsFlat
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.Name).ToList());

        var items = members.Select(m => new OrgMemberDto
        {
            Id          = m.Id,
            Email       = m.Email,
            Role        = m.Role.ToString(),
            Permissions = permsByMember.TryGetValue(m.Id, out var perms) ? perms : []
        }).ToList();

        return new PagedResult<OrgMemberDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task UpdateMemberPermissionsAsync(Guid providerAdminId, Guid memberId, List<PermissionOverride> overrides)
    {
        var adminInfo = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminInfo.OrganizationId is null)
            throw new UnauthorizedAccessException("ProviderAdmin has no organization.");

        var adminOrgId = adminInfo.OrganizationId.Value;

        var memberRole = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == memberId && u.OrganizationId == adminOrgId)
            .Select(u => (UserRole?)u.Role)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Member not found in your organization.");

        if (memberRole != UserRole.ProviderEmployee)
            throw new InvalidOperationException("Can only manage permissions for ProviderEmployee members.");

        var permissionNames = overrides.Select(o => o.PermissionName).ToHashSet();

        var permissions = await _db.Permissions
            .AsNoTracking()
            .Where(p => permissionNames.Contains(p.Name))
            .ToDictionaryAsync(p => p.Name);

        var missingName = permissionNames.FirstOrDefault(n => !permissions.ContainsKey(n));
        if (missingName is not null)
            throw new KeyNotFoundException($"Permission '{missingName}' not found.");

        var permissionIds = permissions.Values.Select(p => p.Id).ToList();

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

        await _cache.RemoveAsync($"permissions:{memberId}");
    }
}
