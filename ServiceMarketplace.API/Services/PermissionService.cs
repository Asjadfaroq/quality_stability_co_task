using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class PermissionService : IPermissionService
{
    // Per-user cache: short TTL because a role change takes effect on the next request after expiry.
    private static readonly TimeSpan UserPermissionCacheTtl = TimeSpan.FromMinutes(5);

    // Role-permission cache: long TTL because mappings only change via the admin UI,
    // which explicitly invalidates this key on every write.
    private static readonly TimeSpan RolePermissionCacheTtl = TimeSpan.FromHours(24);

    private readonly AppDbContext _db;
    private readonly ICacheService _cache;

    public PermissionService(AppDbContext db, ICacheService cache)
    {
        _db    = db;
        _cache = cache;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, string permissionName)
    {
        // Admin has unrestricted access — short-circuit before any DB or cache call.
        // This is the single authoritative place for that rule.
        var role = await GetUserRoleAsync(userId);
        if (role is null)           return false;
        if (role == UserRole.Admin) return true;

        var permissions = await GetRolePermissionsAsync(role.Value, userId);
        return permissions.Contains(permissionName);
    }

    public async Task<HashSet<string>> GetEffectivePermissionsAsync(Guid userId)
    {
        var role = await GetUserRoleAsync(userId);
        if (role is null) return [];

        if (role == UserRole.Admin)
        {
            // Admin always has every defined permission — return the full catalogue.
            var allNames = await _db.Permissions
                .AsNoTracking()
                .Select(p => p.Name)
                .ToListAsync();
            return [..allNames];
        }

        return await GetRolePermissionsAsync(role.Value, userId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Returns the user's role from cache, falling back to the database.
    /// Null means the userId does not exist.
    /// </summary>
    private async Task<UserRole?> GetUserRoleAsync(Guid userId)
    {
        var key    = $"user_role:{userId}";
        var cached = await _cache.GetAsync<UserRole?>(key);
        if (cached is not null)
            return cached;

        var role = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (UserRole?)u.Role)
            .FirstOrDefaultAsync();

        if (role is not null)
            await _cache.SetAsync(key, role, UserPermissionCacheTtl);

        return role;
    }

    /// <summary>
    /// Returns the set of permission names currently assigned to <paramref name="role"/>.
    /// Results are cached per role for 24 hours and invalidated whenever the admin
    /// changes a role's permissions via <c>PATCH /api/admin/roles/{role}/permissions</c>.
    /// </summary>
    private async Task<HashSet<string>> GetRolePermissionsAsync(UserRole role, Guid userId)
    {
        // User-level cache prevents redundant role-permission lookups within the same
        // 5-minute window (e.g. multiple permission checks in one request pipeline).
        var userKey    = $"permissions:{userId}";
        var userCached = await _cache.GetAsync<HashSet<string>>(userKey);
        if (userCached is not null)
            return userCached;

        var roleKey    = $"role_permissions:{role}";
        var roleCached = await _cache.GetAsync<List<string>>(roleKey);

        List<string> names;
        if (roleCached is not null)
        {
            names = roleCached;
        }
        else
        {
            names = await _db.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.Role == role)
                .Select(rp => rp.Permission!.Name)
                .ToListAsync();

            await _cache.SetAsync(roleKey, names, RolePermissionCacheTtl);
        }

        var effective = new HashSet<string>(names);

        // Apply explicit user-level overrides on top of the role baseline.
        // Granted=true  → force-add even if the role doesn't have it.
        // Granted=false → force-remove even if the role has it.
        var overrides = await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.UserId == userId)
            .Select(up => new { up.Permission!.Name, up.Granted })
            .ToListAsync();

        foreach (var o in overrides)
        {
            if (o.Granted) effective.Add(o.Name);
            else           effective.Remove(o.Name);
        }

        await _cache.SetAsync(userKey, effective, UserPermissionCacheTtl);
        return effective;
    }
}
