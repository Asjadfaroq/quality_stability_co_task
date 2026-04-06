using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class PermissionService : IPermissionService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    public PermissionService(AppDbContext db, IMemoryCache cache)
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
        var cacheKey = $"permissions:{userId}";

        if (_cache.TryGetValue(cacheKey, out HashSet<string>? cached) && cached is not null)
            return cached;

        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null) return [];

        var rolePermissionNames = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.Role == user.Role)
            .Select(rp => rp.Permission!.Name)
            .ToListAsync();

        var effective = new HashSet<string>(rolePermissionNames);

        var userOverrides = await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.UserId == userId)
            .Select(up => new { up.Permission!.Name, up.Granted })
            .ToListAsync();

        foreach (var o in userOverrides)
        {
            if (o.Granted) effective.Add(o.Name);
            else           effective.Remove(o.Name);
        }

        _cache.Set(cacheKey, effective, CacheTtl);
        return effective;
    }
}
