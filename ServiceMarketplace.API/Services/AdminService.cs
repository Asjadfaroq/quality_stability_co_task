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
    private static readonly TimeSpan RolePermissionCacheTtl = TimeSpan.FromHours(24);

    private readonly AppDbContext _db;
    private readonly ICacheService _cache;

    public AdminService(AppDbContext db, ICacheService cache)
    {
        _db    = db;
        _cache = cache;
    }

    public async Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize)
    {
        var query      = _db.Users.AsNoTracking();
        var totalCount = await query.CountAsync();

        if (totalCount == 0)
            return PagedResult<UserDto>.Empty(page, pageSize);

        var users = await query
            .OrderBy(u => u.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto
            {
                Id             = u.Id,
                Email          = u.Email ?? string.Empty,
                Role           = u.Role.ToString(),
                SubTier        = u.SubTier.ToString(),
                OrganizationId = u.OrganizationId,
                CreatedAt      = u.CreatedAt,
            })
            .ToListAsync();

        return new PagedResult<UserDto>
        {
            Items      = users,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount,
        };
    }

    public async Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier)
    {
        var user = await _db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        user.SubTier = subTier;
        await _db.SaveChangesAsync();
    }

    public async Task<RolePermissionsDto> GetRolePermissionsAsync()
    {
        var permissions = await _db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new PermissionDto { Id = p.Id, Name = p.Name })
            .ToListAsync();

        // Admin is always unrestricted — no DB rows exist for it and none are shown.
        var rows = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.Role != UserRole.Admin)
            .Select(rp => new { Role = rp.Role.ToString(), rp.Permission!.Name })
            .ToListAsync();

        var assignments = rows
            .GroupBy(r => r.Role)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Name).ToList());

        // Ensure every editable role appears as a key even when it has no permissions.
        foreach (var role in Enum.GetValues<UserRole>().Where(r => r != UserRole.Admin))
            assignments.TryAdd(role.ToString(), []);

        return new RolePermissionsDto
        {
            Permissions     = permissions,
            RoleAssignments = assignments,
        };
    }

    public async Task UpdateRolePermissionAsync(UserRole role, string permissionName, bool granted)
    {
        var permission = await _db.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name == permissionName)
            ?? throw new KeyNotFoundException($"Permission '{permissionName}' not found.");

        var existing = await _db.RolePermissions
            .FirstOrDefaultAsync(rp => rp.Role == role && rp.PermissionId == permission.Id);

        if (granted && existing is null)
        {
            _db.RolePermissions.Add(new RolePermission { Role = role, PermissionId = permission.Id });
        }
        else if (!granted && existing is not null)
        {
            _db.RolePermissions.Remove(existing);
        }
        else
        {
            // State already matches — nothing to do (idempotent).
            return;
        }

        await _db.SaveChangesAsync();

        // Invalidate role-permission cache so the next permission check reloads from DB.
        await _cache.RemoveAsync($"role_permissions:{role}");

        // Also immediately invalidate every per-user effective-permissions cache for users
        // in this role.  Without this, a revoked permission remains usable for up to the
        // per-user TTL (5 min) — a security gap.  This write only happens on admin actions
        // so the DB scan is acceptable.
        var affectedUserIds = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == role)
            .Select(u => u.Id)
            .ToListAsync();

        await Task.WhenAll(affectedUserIds.Select(uid =>
            _cache.RemoveAsync($"permissions:{uid}")));
    }

    // ── User-level permission overrides ───────────────────────────────────────

    public async Task<List<UserPermissionOverrideDto>> GetUserPermissionsAsync(Guid userId)
    {
        return await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.UserId == userId)
            .Select(up => new UserPermissionOverrideDto
            {
                PermissionName = up.Permission!.Name,
                Granted        = up.Granted,
            })
            .ToListAsync();
    }

    public async Task UpdateUserPermissionAsync(Guid userId, string permissionName, bool? granted)
    {
        var permission = await _db.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name == permissionName)
            ?? throw new KeyNotFoundException($"Permission '{permissionName}' not found.");

        var existing = await _db.UserPermissions
            .FirstOrDefaultAsync(up => up.UserId == userId && up.PermissionId == permission.Id);

        if (granted is null)
        {
            // Remove override — user falls back to role default.
            if (existing is null) return; // Already no override — idempotent.
            _db.UserPermissions.Remove(existing);
        }
        else if (existing is null)
        {
            _db.UserPermissions.Add(new UserPermission
            {
                UserId       = userId,
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

        // Invalidate the per-user effective-permissions cache immediately so the
        // change takes effect on the very next API call from this user.
        await _cache.RemoveAsync($"permissions:{userId}");
    }
}
