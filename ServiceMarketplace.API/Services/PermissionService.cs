using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class PermissionService : IPermissionService
{
    // Per-user effective permissions: short TTL because admin can update them at any time.
    private static readonly TimeSpan UserPermissionCacheTtl = TimeSpan.FromMinutes(5);

    // Role-permission mappings: seeded at startup and never change at runtime.
    // Cache for 24 h — they are shared across all users with the same role, so this
    // eliminates one DB query per permission check for every user after the first hit.
    private static readonly TimeSpan RolePermissionCacheTtl = TimeSpan.FromHours(24);

    private readonly AppDbContext _db;
    private readonly ICacheService _cache;

    public PermissionService(AppDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, string permissionName)
    {
        var permissions = await GetEffectivePermissionsAsync(userId);
        return permissions.Contains(permissionName);
    }

    private async Task<HashSet<string>> GetEffectivePermissionsAsync(Guid userId)
    {
        var userCacheKey = $"permissions:{userId}";

        var cached = await _cache.GetAsync<HashSet<string>>(userCacheKey);
        if (cached is not null)
            return cached;

        // Query 1: project only the Role column — avoids loading the full IdentityUser row
        // (PasswordHash, SecurityStamp, ConcurrencyStamp, etc.) which is never needed here.
        var role = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (UserRole?)u.Role)
            .FirstOrDefaultAsync();

        if (role is null)
            return [];

        // Query 2 (often cached): role → permission names.
        // RolePermissions are seeded and static; the same set is reused for every user
        // with the same role, so caching it long-term removes this query on warm paths.
        var rolePermissions = await GetRolePermissionNamesAsync(role.Value);

        // Query 3: user-specific overrides (grants / revocations).
        var userOverrides = await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.UserId == userId)
            .Select(up => new { up.Permission!.Name, up.Granted })
            .ToListAsync();

        var effective = new HashSet<string>(rolePermissions);

        foreach (var o in userOverrides)
        {
            if (o.Granted) effective.Add(o.Name);
            else           effective.Remove(o.Name);
        }

        await _cache.SetAsync(userCacheKey, effective, UserPermissionCacheTtl);
        return effective;
    }

    /// <summary>
    /// Returns the permission names granted to <paramref name="role"/> by default.
    /// Results are cached for 24 hours because role-permission mappings are seeded and
    /// never change at runtime. On a warm cache this method hits Redis only (no SQL).
    /// </summary>
    private async Task<List<string>> GetRolePermissionNamesAsync(UserRole role)
    {
        var roleCacheKey = $"role_permissions:{role}";

        var cached = await _cache.GetAsync<List<string>>(roleCacheKey);
        if (cached is not null)
            return cached;

        var names = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.Role == role)
            .Select(rp => rp.Permission!.Name)
            .ToListAsync();

        await _cache.SetAsync(roleCacheKey, names, RolePermissionCacheTtl);
        return names;
    }
}
