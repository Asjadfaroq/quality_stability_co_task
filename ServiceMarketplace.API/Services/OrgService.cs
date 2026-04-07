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
        return await _db.Organizations
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

        if (target.OrganizationId == orgId)
            return; // already a member — idempotent

        if (target.OrganizationId.HasValue)
            throw new InvalidOperationException("This user already belongs to another organization.");

        target.OrganizationId = orgId;
        await _db.SaveChangesAsync();

        var orgName = await _db.Organizations
            .AsNoTracking()
            .Where(o => o.Id == orgId)
            .Select(o => o.Name)
            .FirstOrDefaultAsync() ?? string.Empty;

        await _hub.Clients
            .Group(target.Id.ToString())
            .SendAsync("OrgMemberAdded", new { organizationId = orgId, organizationName = orgName });
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

        var orgName = await _db.Organizations
            .AsNoTracking()
            .Where(o => o.Id == orgId)
            .Select(o => o.Name)
            .FirstOrDefaultAsync() ?? string.Empty;

        member.OrganizationId = null;
        await _db.SaveChangesAsync();

        await _hub.Clients
            .Group(memberId.ToString())
            .SendAsync("OrgMemberRemoved", new { organizationId = orgId, organizationName = orgName });
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

        var orgId     = adminInfo.OrganizationId.Value;
        var baseQuery = _db.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == orgId && u.Id != providerAdminId);

        var totalCount = await baseQuery.CountAsync();
        if (totalCount == 0)
            return PagedResult<OrgMemberDto>.Empty(page, pageSize);

        var items = await baseQuery
            .OrderBy(u => u.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new OrgMemberDto
            {
                Id    = u.Id,
                Email = u.Email ?? string.Empty,
                Role  = u.Role.ToString(),
            })
            .ToListAsync();

        return new PagedResult<OrgMemberDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount,
        };
    }

    // ── Member permission overrides ───────────────────────────────────────────

    public async Task<List<PermissionDto>> GetAllPermissionsAsync()
    {
        return await _db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new PermissionDto { Id = p.Id, Name = p.Name })
            .ToListAsync();
    }

    public async Task<List<UserPermissionOverrideDto>> GetMemberPermissionsAsync(Guid providerAdminId, Guid memberId)
    {
        await EnsureMemberInOrgAsync(providerAdminId, memberId);

        return await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.UserId == memberId)
            .Select(up => new UserPermissionOverrideDto
            {
                PermissionName = up.Permission!.Name,
                Granted        = up.Granted,
            })
            .ToListAsync();
    }

    public async Task UpdateMemberPermissionAsync(
        Guid providerAdminId, Guid memberId, string permissionName, bool? granted)
    {
        await EnsureMemberInOrgAsync(providerAdminId, memberId);

        var permission = await _db.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name == permissionName)
            ?? throw new KeyNotFoundException($"Permission '{permissionName}' not found.");

        var existing = await _db.UserPermissions
            .FirstOrDefaultAsync(up => up.UserId == memberId && up.PermissionId == permission.Id);

        if (granted is null)
        {
            if (existing is null) return;
            _db.UserPermissions.Remove(existing);
        }
        else if (existing is null)
        {
            _db.UserPermissions.Add(new UserPermission
            {
                UserId       = memberId,
                PermissionId = permission.Id,
                Granted      = granted.Value,
            });
        }
        else if (existing.Granted != granted.Value)
        {
            existing.Granted = granted.Value;
        }
        else
        {
            return; // Idempotent.
        }

        await _db.SaveChangesAsync();

        // Invalidate per-user effective-permissions cache immediately.
        await _cache.RemoveAsync($"permissions:{memberId}");
    }

    /// <summary>Validates that <paramref name="memberId"/> belongs to the ProviderAdmin's org.</summary>
    private async Task EnsureMemberInOrgAsync(Guid providerAdminId, Guid memberId)
    {
        var adminOrg = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == providerAdminId && u.Role == UserRole.ProviderAdmin)
            .Select(u => new { u.OrganizationId })
            .FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("User is not a ProviderAdmin.");

        if (adminOrg.OrganizationId is null)
            throw new InvalidOperationException("You don't have an organization.");

        var isMember = await _db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == memberId && u.OrganizationId == adminOrg.OrganizationId);

        if (!isMember)
            throw new KeyNotFoundException("Member not found in your organization.");
    }
}
