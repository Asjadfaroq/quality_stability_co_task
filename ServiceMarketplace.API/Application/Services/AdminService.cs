using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Hubs;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;
using System.Linq.Expressions;

namespace ServiceMarketplace.API.Services;

public class AdminService : IAdminService
{
    private static readonly TimeSpan RolePermissionCacheTtl = TimeSpan.FromHours(24);

    private readonly AppDbContext              _db;
    private readonly ICacheService             _cache;
    private readonly IMemoryCache              _memory;
    private readonly IHubContext<NotificationHub> _hub;

    public AdminService(AppDbContext db, ICacheService cache, IMemoryCache memory, IHubContext<NotificationHub> hub)
    {
        _db     = db;
        _cache  = cache;
        _memory = memory;
        _hub    = hub;
    }

    public async Task<PagedResult<AdminJobDto>> GetAllJobsAsync(
        int     page,
        int     pageSize,
        string? status,
        string? search)
    {
        // Join customer and optional provider.
        var query =
            from r  in _db.ServiceRequests.AsNoTracking()
            join cu in _db.Users.AsNoTracking() on r.CustomerId equals cu.Id
            join pr in _db.Users.AsNoTracking() on r.AcceptedByProviderId equals pr.Id
                into providerGroup
            from pr in providerGroup.DefaultIfEmpty()
            select new
            {
                r.Id,
                r.Title,
                r.Category,
                r.Status,
                r.CustomerId,
                CustomerEmail        = cu.Email,
                r.AcceptedByProviderId,
                ProviderEmail        = (string?)pr.Email,
                r.CreatedAt,
                r.UpdatedAt,
            };

        // Status filter.
        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<RequestStatus>(status, ignoreCase: true, out var parsedStatus))
        {
            query = query.Where(x => x.Status == parsedStatus);
        }

        // Text search.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.Title.Contains(term) ||
                (x.Category != null && x.Category.Contains(term)) ||
                (x.CustomerEmail != null && x.CustomerEmail.Contains(term)));
        }

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
            return PagedResult<AdminJobDto>.Empty(page, pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AdminJobDto
            {
                Id                   = x.Id,
                Title                = x.Title,
                Category             = x.Category,
                Status               = x.Status.ToString(),
                CustomerId           = x.CustomerId,
                CustomerEmail        = x.CustomerEmail ?? string.Empty,
                AcceptedByProviderId = x.AcceptedByProviderId,
                ProviderEmail        = x.ProviderEmail,
                CreatedAt            = x.CreatedAt,
                UpdatedAt            = x.UpdatedAt,
            })
            .ToListAsync();

        return new PagedResult<AdminJobDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount,
        };
    }

    public async Task<PagedResult<AdminOrgDto>> GetAllOrgsAsync(int page, int pageSize, string? search)
    {
        // Join organization owner and compute member count.
        var query =
            from org   in _db.Organizations.AsNoTracking()
            join owner in _db.Users.AsNoTracking() on org.OwnerId equals owner.Id
            select new
            {
                org.Id,
                org.Name,
                org.OwnerId,
                OwnerEmail  = owner.Email,
                MemberCount = _db.Users.Count(u => u.OrganizationId == org.Id),
                org.CreatedAt,
            };

        // Optional text search.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.Name.Contains(term) ||
                (x.OwnerEmail != null && x.OwnerEmail.Contains(term)));
        }

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
            return PagedResult<AdminOrgDto>.Empty(page, pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AdminOrgDto
            {
                Id          = x.Id,
                Name        = x.Name,
                OwnerId     = x.OwnerId,
                OwnerEmail  = x.OwnerEmail ?? string.Empty,
                MemberCount = x.MemberCount,
                CreatedAt   = x.CreatedAt,
            })
            .ToListAsync();

        return new PagedResult<AdminOrgDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount,
        };
    }

    public async Task<PagedResult<UserDto>> GetAllUsersAsync(int page, int pageSize, string? role, string? search)
    {
        var query = _db.Users.AsNoTracking();

        // Role filter.
        if (!string.IsNullOrWhiteSpace(role) &&
            Enum.TryParse<UserRole>(role, ignoreCase: true, out var parsedRole))
        {
            query = query.Where(u => u.Role == parsedRole);
        }

        // Email search.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u => u.Email != null && u.Email.Contains(term));
        }

        // DbContext is not thread-safe; run sequentially.
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

    public async Task UpdateUserRoleAsync(Guid userId, UserRole role)
    {
        var user = await _db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.Role == role)
            return; // Idempotent.

        user.Role = role;
        await _db.SaveChangesAsync();

        // Invalidate role and permission caches.
        await _cache.RemoveAsync($"user_role:{userId}");
        await _cache.RemoveAsync($"permissions:{userId}");
        _memory.Remove($"l1:user_role:{userId}");
        _memory.Remove($"l1:permissions:{userId}");
    }

    public async Task UpdateSubscriptionAsync(Guid userId, SubscriptionTier subTier)
    {
        var user = await _db.Users.FindAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        user.SubTier = subTier;
        await _db.SaveChangesAsync();

        await _hub.Clients
            .Group(userId.ToString())
            .SendAsync("SubscriptionChanged", new { tier = subTier.ToString() });
    }

    public async Task<RolePermissionsDto> GetRolePermissionsAsync()
    {
        var permissions = await _db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new PermissionDto { Id = p.Id, Name = p.Name })
            .ToListAsync();

        // Admin has no role-permission rows.
        var rows = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.Role != UserRole.Admin)
            .Select(rp => new { Role = rp.Role.ToString(), rp.Permission!.Name })
            .ToListAsync();

        var assignments = rows
            .GroupBy(r => r.Role)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Name).ToList());

        // Ensure all non-admin roles are present.
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
            // Already in desired state.
            return;
        }

        await _db.SaveChangesAsync();

        // Invalidate role-permission cache.
        await _cache.RemoveAsync($"role_permissions:{role}");

        // Invalidate per-user permissions for users in this role.
        var affectedUserIds = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == role)
            .Select(u => u.Id)
            .ToListAsync();

        await Task.WhenAll(affectedUserIds.Select(uid =>
            _cache.RemoveAsync($"permissions:{uid}")));

        // Evict L1 permission cache for affected users.
        foreach (var uid in affectedUserIds)
            _memory.Remove($"l1:permissions:{uid}");
    }

    public async Task DeleteUserAsync(Guid targetUserId)
    {
        var target = await _db.Users.FindAsync(targetUserId)
            ?? throw new KeyNotFoundException("User not found.");

        // Admin accounts are protected.
        if (target.Role == UserRole.Admin)
            throw new UnauthorizedAccessException("Admin accounts cannot be deleted.");

        // Run transaction under execution strategy for transient retries.
        var strategy = _db.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            // Step 1: remove customer requests and related messages.
            var customerRequestIds = await _db.ServiceRequests
                .Where(r => r.CustomerId == targetUserId)
                .Select(r => r.Id)
                .ToListAsync();

            if (customerRequestIds.Count > 0)
            {
                // Bulk delete without loading entities.
                await _db.ChatMessages
                    .Where(m => customerRequestIds.Contains(m.RequestId))
                    .ExecuteDeleteAsync();

                await _db.ServiceRequests
                    .Where(r => r.CustomerId == targetUserId)
                    .ExecuteDeleteAsync();
            }

            // Step 2: remove organization owned by this user.
            var ownedOrg = await _db.Organizations
                .FirstOrDefaultAsync(o => o.OwnerId == targetUserId);

            if (ownedOrg is not null)
            {
                _db.Organizations.Remove(ownedOrg);
                await _db.SaveChangesAsync();
            }

            // Step 3: remove user row (remaining dependencies are cascaded).
            _db.Users.Remove(target);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
        });

        // Step 4: evict permission cache after commit.
        await _cache.RemoveAsync($"permissions:{targetUserId}");
        _memory.Remove($"l1:permissions:{targetUserId}");
        _memory.Remove($"l1:user_role:{targetUserId}");
    }

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
            // Remove override (fallback to role default).
            if (existing is null) return;
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
            return;
        }

        await _db.SaveChangesAsync();

        // Invalidate per-user effective permission cache.
        await _cache.RemoveAsync($"permissions:{userId}");
        _memory.Remove($"l1:permissions:{userId}");
    }
}
