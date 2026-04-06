using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class PermissionService : IPermissionService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

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
        var cacheKey = $"permissions:{userId}";

        var cached = await _cache.GetAsync<HashSet<string>>(cacheKey);
        if (cached is not null)
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

        await _cache.SetAsync(cacheKey, effective, CacheTtl);
        return effective;
    }
}
