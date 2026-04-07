using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class AdminService : IAdminService
{
    private readonly AppDbContext _db;
    private readonly ICacheService _cache;

    public AdminService(AppDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize)
    {
        var query = _db.Users.AsNoTracking();

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
            return PagedResult<UserDto>.Empty(page, pageSize);

        // Query 1: Scalar user fields only — no collection navigation, no JOIN fan-out.
        var users = await query
            .OrderBy(u => u.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                Email          = u.Email ?? string.Empty,
                u.Role,
                u.SubTier,
                u.OrganizationId,
                u.CreatedAt
            })
            .ToListAsync();

        if (users.Count == 0)
            return PagedResult<UserDto>.Empty(page, pageSize);

        var userIds = users.Select(u => u.Id).ToList();

        // Query 2: Permissions for the current page's users only.
        // Splitting into a separate query avoids the Cartesian product that a single
        // LEFT JOIN on UserPermissions would generate (one user row × N permission rows).
        var permissionsFlat = await _db.UserPermissions
            .AsNoTracking()
            .Where(up => userIds.Contains(up.UserId) && up.Granted)
            .Select(up => new { up.UserId, up.Permission!.Name })
            .ToListAsync();

        var permsByUser = permissionsFlat
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.Name).ToList());

        var items = users.Select(u => new UserDto
        {
            Id             = u.Id,
            Email          = u.Email,
            Role           = u.Role.ToString(),
            SubTier        = u.SubTier.ToString(),
            OrganizationId = u.OrganizationId,
            CreatedAt      = u.CreatedAt,
            Permissions    = permsByUser.TryGetValue(u.Id, out var perms) ? perms : []
        }).ToList();

        return new PagedResult<UserDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier)
    {
        var user = await _db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        user.SubTier = subTier;
        await _db.SaveChangesAsync();
    }

    public async Task UpdatePermissionsAsync(Guid userId, List<PermissionOverride> overrides)
    {
        var user = await _db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

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
            .Where(up => up.UserId == userId && permissionIds.Contains(up.PermissionId))
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
                    UserId       = userId,
                    PermissionId = permission.Id,
                    Granted      = o.Granted
                });
            }
        }

        await _db.SaveChangesAsync();

        // Invalidate the per-user effective permissions cache so the next request
        // recomputes from the new overrides. The role_permissions cache is intentionally
        // left intact because role-level grants are not changed here.
        await _cache.RemoveAsync($"permissions:{userId}");
    }
}
