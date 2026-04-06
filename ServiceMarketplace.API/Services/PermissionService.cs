using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class PermissionService : IPermissionService
{
    private readonly AppDbContext _db;

    public PermissionService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, string permissionName)
    {
        // 1. Get user's role
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null) return false;

        // 2. Load role default permissions
        var rolePermissionNames = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.Role == user.Role)
            .Select(rp => rp.Permission!.Name)
            .ToListAsync();

        var effectivePermissions = new HashSet<string>(rolePermissionNames);

        // 3. Load user-level overrides
        var userOverrides = await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.UserId == userId)
            .Select(up => new { up.Permission!.Name, up.Granted })
            .ToListAsync();

        // 4. Apply overrides: granted=true adds, granted=false removes
        foreach (var override_ in userOverrides)
        {
            if (override_.Granted)
                effectivePermissions.Add(override_.Name);
            else
                effectivePermissions.Remove(override_.Name);
        }

        // 5. Check
        return effectivePermissions.Contains(permissionName);
    }
}
