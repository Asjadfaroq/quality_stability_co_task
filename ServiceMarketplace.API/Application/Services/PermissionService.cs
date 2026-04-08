using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class PermissionService : IPermissionService
{
    // L1 (in-process IMemoryCache) TTLs — short enough that a permission change
    // propagates within one minute without any explicit invalidation.
    // Redis (L2) still holds the authoritative copy; L1 just avoids the ~270 ms
    // network round-trip on every authenticated request.
    private static readonly TimeSpan L1UserTtl = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan L1RoleTtl = TimeSpan.FromSeconds(60);

    // L2 (Redis) TTLs — unchanged from before.
    private static readonly TimeSpan UserPermissionCacheTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan RolePermissionCacheTtl = TimeSpan.FromHours(24);

    private readonly AppDbContext    _db;
    private readonly ICacheService   _cache;   // L2 — Redis
    private readonly IMemoryCache    _memory;  // L1 — in-process

    public PermissionService(AppDbContext db, ICacheService cache, IMemoryCache memory)
    {
        _db     = db;
        _cache  = cache;
        _memory = memory;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, string permissionName)
    {
        // Admin has unrestricted access — short-circuit before any cache call.
        var role = await GetUserRoleAsync(userId);
        if (role is null)           return false;
        if (role == UserRole.Admin) return true;

        var permissions = await GetEffectivePermissionsInternalAsync(role.Value, userId);
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

        return await GetEffectivePermissionsInternalAsync(role.Value, userId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Returns the user's role. Read order: L1 memory → L2 Redis → DB.
    /// </summary>
    private async Task<UserRole?> GetUserRoleAsync(Guid userId)
    {
        var l1Key = $"l1:user_role:{userId}";

        // L1 hit — microseconds, zero network
        if (_memory.TryGetValue(l1Key, out UserRole? l1Role))
            return l1Role;

        // L2 hit — single Redis round-trip
        var redisKey = $"user_role:{userId}";
        var cached   = await _cache.GetAsync<UserRole?>(redisKey);
        if (cached is not null)
        {
            _memory.Set(l1Key, cached, L1UserTtl);
            return cached;
        }

        // DB fallback
        var role = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (UserRole?)u.Role)
            .FirstOrDefaultAsync();

        if (role is not null)
        {
            _memory.Set(l1Key, role, L1UserTtl);
            await _cache.SetAsync(redisKey, role, UserPermissionCacheTtl);
        }

        return role;
    }

    /// <summary>
    /// Returns effective permissions for <paramref name="userId"/> under <paramref name="role"/>.
    /// Read order: L1 memory → L2 Redis → DB (role baseline + user overrides).
    /// </summary>
    private async Task<HashSet<string>> GetEffectivePermissionsInternalAsync(UserRole role, Guid userId)
    {
        var l1Key = $"l1:permissions:{userId}";

        // L1 hit
        if (_memory.TryGetValue(l1Key, out HashSet<string>? l1Perms) && l1Perms is not null)
            return l1Perms;

        // L2 hit — full effective-permission set already computed and cached
        var userKey    = $"permissions:{userId}";
        var userCached = await _cache.GetAsync<HashSet<string>>(userKey);
        if (userCached is not null)
        {
            _memory.Set(l1Key, userCached, L1UserTtl);
            return userCached;
        }

        // DB path — build effective set from role baseline + user overrides

        // Role permissions: try L2, else hit DB
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

        // Apply explicit user-level overrides
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

        // Populate both layers
        _memory.Set(l1Key, effective, L1UserTtl);
        await _cache.SetAsync(userKey, effective, UserPermissionCacheTtl);

        return effective;
    }
}
