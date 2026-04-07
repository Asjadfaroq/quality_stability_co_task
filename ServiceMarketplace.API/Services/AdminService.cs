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

    // ── User deletion ─────────────────────────────────────────────────────────

    public async Task DeleteUserAsync(Guid targetUserId)
    {
        var target = await _db.Users.FindAsync(targetUserId)
            ?? throw new KeyNotFoundException("User not found.");

        // Admin accounts are protected — deleting one could lock the platform out.
        if (target.Role == UserRole.Admin)
            throw new UnauthorizedAccessException("Admin accounts cannot be deleted.");

        // SqlServerRetryingExecutionStrategy does not support user-initiated transactions
        // directly.  The correct pattern is to hand the transaction body to the strategy
        // so it can retry the entire unit — including the BEGIN/COMMIT — on transient
        // failures (network blips, deadlocks, etc.).
        var strategy = _db.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            // ── Step 1: Service requests where this user is the customer ──────
            //
            // ServiceRequest.CustomerId has DeleteBehavior.Restrict, so the DB will
            // refuse to delete the user row while any request still references them.
            // We must remove these rows explicitly.
            //
            // ChatMessage.RequestId has no EF-configured cascade (AppDbContext only
            // adds a composite index).  Delete messages first to avoid an FK violation
            // when the request rows are removed.
            var customerRequestIds = await _db.ServiceRequests
                .Where(r => r.CustomerId == targetUserId)
                .Select(r => r.Id)
                .ToListAsync();

            if (customerRequestIds.Count > 0)
            {
                // ExecuteDeleteAsync issues a single DELETE … WHERE … IN (…) without
                // loading entities into memory — efficient for potentially large sets.
                await _db.ChatMessages
                    .Where(m => customerRequestIds.Contains(m.RequestId))
                    .ExecuteDeleteAsync();

                await _db.ServiceRequests
                    .Where(r => r.CustomerId == targetUserId)
                    .ExecuteDeleteAsync();
            }

            // ── Step 2: Organization owned by this user ───────────────────────
            //
            // Organization.OwnerId has DeleteBehavior.Restrict, so the org row must
            // be deleted before the user row.
            //
            // Deleting the org triggers the SQL CASCADE configured by
            // DeleteBehavior.SetNull on User.OrganizationId: every member's
            // OrganizationId column is automatically set to NULL by the database
            // engine — no need to iterate members manually.
            var ownedOrg = await _db.Organizations
                .FirstOrDefaultAsync(o => o.OwnerId == targetUserId);

            if (ownedOrg is not null)
            {
                _db.Organizations.Remove(ownedOrg);
                await _db.SaveChangesAsync();
            }

            // ── Step 3: Delete the user row ───────────────────────────────────
            //
            // The following are cleaned up automatically via database cascades:
            //   • UserPermission rows           (DeleteBehavior.Cascade)
            //   • UserStripeInfo row            (DeleteBehavior.Cascade)
            //   • AspNetUserClaims              (Identity Cascade)
            //   • AspNetUserLogins              (Identity Cascade)
            //   • AspNetUserTokens              (Identity Cascade)
            //   • AspNetUserRoles               (Identity Cascade)
            //   • ServiceRequest.AcceptedByProviderId (DeleteBehavior.SetNull — nulled)
            //
            // Note: if the user is merely a *member* (not owner) of an org, no extra
            // work is needed.  User.OrganizationId is an FK on the user's own row and
            // is simply removed when the user row is deleted.
            _db.Users.Remove(target);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
        });

        // ── Step 4: Evict permission cache ────────────────────────────────────
        //
        // Done after the commit so we never evict a valid cache entry for a user
        // that still exists (edge case: commit fails after eviction).
        await _cache.RemoveAsync($"permissions:{targetUserId}");
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
