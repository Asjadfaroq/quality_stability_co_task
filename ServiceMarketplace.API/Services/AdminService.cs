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

    public AdminService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<UserDto>> GetAllUsersAsync()
    {
        var users = await _db.Users
            .AsNoTracking()
            .Include(u => u.UserPermissions)
                .ThenInclude(up => up.Permission)
            .ToListAsync();

        return users.Select(u => MapToDto(u)).ToList();
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

        foreach (var o in overrides)
        {
            var permission = await _db.Permissions
                .FirstOrDefaultAsync(p => p.Name == o.PermissionName)
                ?? throw new KeyNotFoundException($"Permission '{o.PermissionName}' not found.");

            var existing = await _db.UserPermissions
                .FirstOrDefaultAsync(up => up.UserId == userId && up.PermissionId == permission.Id);

            if (existing is null)
            {
                _db.UserPermissions.Add(new UserPermission
                {
                    UserId = userId,
                    PermissionId = permission.Id,
                    Granted = o.Granted
                });
            }
            else
            {
                existing.Granted = o.Granted;
            }
        }

        await _db.SaveChangesAsync();
    }

    private static UserDto MapToDto(Models.Entities.User u) => new()
    {
        Id = u.Id,
        Email = u.Email ?? string.Empty,
        Role = u.Role.ToString(),
        SubTier = u.SubTier.ToString(),
        OrganizationId = u.OrganizationId,
        CreatedAt = u.CreatedAt,
        Permissions = u.UserPermissions
            .Where(up => up.Granted)
            .Select(up => up.Permission?.Name ?? string.Empty)
            .ToList()
    };
}
