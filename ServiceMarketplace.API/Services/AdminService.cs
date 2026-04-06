using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
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

    public async Task<List<UserDto>> GetAllUsersAsync()
    {
        var raw = await _db.Users
            .AsNoTracking()
            .Select(u => new
            {
                u.Id,
                Email        = u.Email ?? string.Empty,
                u.Role,
                u.SubTier,
                u.OrganizationId,
                u.CreatedAt,
                GrantedPermissions = u.UserPermissions
                    .Where(up => up.Granted)
                    .Select(up => up.Permission!.Name)
                    .ToList()
            })
            .ToListAsync();

        return raw.Select(u => new UserDto
        {
            Id             = u.Id,
            Email          = u.Email,
            Role           = u.Role.ToString(),
            SubTier        = u.SubTier.ToString(),
            OrganizationId = u.OrganizationId,
            CreatedAt      = u.CreatedAt,
            Permissions    = u.GrantedPermissions
        }).ToList();
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

        await _cache.RemoveAsync($"permissions:{userId}");
    }
}
