using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/admin")]
[Authorize]
[RequirePermission(PermissionNames.AdminManageUsers)]
public class AdminController : BaseController
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize     = 200;

    private readonly IAdminService       _adminService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(IAdminService adminService, ILogger<AdminController> logger)
    {
        _adminService = adminService;
        _logger       = logger;
    }

    // ── Organisations overview ────────────────────────────────────────────────

    /// <summary>
    /// Returns all organisations on the platform.
    /// Each row includes only the owner's email and a member COUNT — no heavy payloads.
    /// Optional <c>search</c> matches against organisation name or owner email.
    /// </summary>
    [HttpGet("orgs")]
    [ProducesResponseType(typeof(PagedResult<AdminOrgDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllOrgs(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = DefaultPageSize,
        [FromQuery] string? search   = null)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _adminService.GetAllOrgsAsync(page, pageSize, search);
        return Ok(result);
    }

    // ── Jobs overview ─────────────────────────────────────────────────────────

    /// <summary>
    /// Returns all service requests across the platform.
    /// Supports optional <c>status</c> (Pending | Accepted | PendingConfirmation | Completed)
    /// and free-text <c>search</c> (matches title, category, or customer email) filters.
    /// Results are paginated — use <c>page</c> and <c>pageSize</c> (max 200).
    /// </summary>
    [HttpGet("jobs")]
    [ProducesResponseType(typeof(PagedResult<AdminJobDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllJobs(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = DefaultPageSize,
        [FromQuery] string? status   = null,
        [FromQuery] string? search   = null)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _adminService.GetAllJobsAsync(page, pageSize, status, search);
        return Ok(result);
    }

    // ── User management ───────────────────────────────────────────────────────

    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<UserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllUsers(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = DefaultPageSize,
        [FromQuery] string? role     = null,
        [FromQuery] string? search   = null)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _adminService.GetAllUsersAsync(page, pageSize, role, search);
        return Ok(result);
    }

    /// <summary>
    /// Permanently deletes a user account and all associated data.
    /// Cascades: service requests (+ chat messages), owned organization (members are detached),
    /// permission overrides, stripe info, and all ASP.NET Identity satellite rows.
    /// Guards: an admin cannot delete their own account or another Admin account.
    /// </summary>
    [HttpDelete("users/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        // Controller-level guard: self-deletion is caught here before hitting the service,
        // consistent with how UpdateSubscription handles it.
        if (id == CurrentUserId)
            return Forbidden("You cannot delete your own account.");

        try
        {
            await _adminService.DeleteUserAsync(id);
            _logger.LogAudit(
                CurrentUserId.ToString(), "AdminUserDeleted",
                "Admin {AdminId} deleted user {TargetUserId}",
                CurrentUserId, id);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbidden(ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("users/{id:guid}/subscription")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSubscription(Guid id, [FromBody] UpdateSubscriptionRequest request)
    {
        if (id == CurrentUserId)
            return Forbidden("Cannot modify your own account.");

        try
        {
            await _adminService.UpdateSubscriptionAsync(id, request.SubTier);
            _logger.LogAudit(
                CurrentUserId.ToString(), "AdminSubscriptionUpdated",
                "Admin {AdminId} changed subscription of user {TargetUserId} to {Tier}",
                CurrentUserId, id, request.SubTier);
            return Ok(new { message = "Subscription updated." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("users/{id:guid}/role")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUserRole(Guid id, [FromBody] UpdateUserRoleRequest request)
    {
        if (id == CurrentUserId)
            return Forbidden("Cannot modify your own role.");

        try
        {
            await _adminService.UpdateUserRoleAsync(id, request.Role);
            _logger.LogAudit(
                CurrentUserId.ToString(), "AdminRoleUpdated",
                "Admin {AdminId} changed role of user {TargetUserId} to {Role}",
                CurrentUserId, id, request.Role);
            return Ok(new { message = "User role updated." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── User permission overrides ─────────────────────────────────────────────

    /// <summary>
    /// Returns all explicit per-user permission overrides for the given user.
    /// Does not include role-inherited permissions — only explicit overrides.
    /// </summary>
    [HttpGet("users/{id:guid}/permissions")]
    [ProducesResponseType(typeof(List<UserPermissionOverrideDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUserPermissions(Guid id)
    {
        var result = await _adminService.GetUserPermissionsAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// Sets or removes an explicit permission override for a user.
    /// granted=true → force-grant; false → force-revoke; null → remove override (inherit from role).
    /// </summary>
    [HttpPatch("users/{id:guid}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUserPermission(Guid id, [FromBody] UpdateUserPermissionRequest request)
    {
        if (id == CurrentUserId)
            return Forbidden("Cannot modify your own permissions.");

        try
        {
            await _adminService.UpdateUserPermissionAsync(id, request.PermissionName, request.Granted);
            _logger.LogAudit(
                CurrentUserId.ToString(), "AdminPermissionUpdated",
                "Admin {AdminId} set permission {Permission} = {Granted} for user {TargetUserId}",
                CurrentUserId, request.PermissionName, request.Granted, id);
            return Ok(new { message = "User permission updated." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Role permission management ────────────────────────────────────────────

    /// <summary>
    /// Returns all platform permissions and the current role → permission matrix.
    /// The Admin role is excluded — it always has unrestricted access.
    /// </summary>
    [HttpGet("roles/permissions")]
    [ProducesResponseType(typeof(RolePermissionsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRolePermissions()
    {
        var result = await _adminService.GetRolePermissionsAsync();
        return Ok(result);
    }

    // ── Admin logs ────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the most-recent in-memory log entries (up to 500).
    /// Use <c>count</c> to control page size (default 100) and <c>category</c> to filter
    /// by <c>System</c> or <c>Audit</c>. Omit <c>category</c> to return all entries.
    /// For a live stream connect to <c>/hubs/admin-logs</c> via SignalR.
    /// </summary>
    [HttpGet("logs")]
    [ProducesResponseType(typeof(IReadOnlyList<LogEntry>), StatusCodes.Status200OK)]
    public IActionResult GetLogs(
        [FromServices] LogBuffer  buffer,
        [FromQuery]    int        count    = 100,
        [FromQuery]    string?    category = null)
    {
        var entries = buffer.GetRecent(count);

        if (!string.IsNullOrWhiteSpace(category) &&
            Enum.TryParse<LogCategory>(category, ignoreCase: true, out var cat))
        {
            entries = entries.Where(e => e.Category == cat).ToList();
        }

        return Ok(entries);
    }

    // ── Role permission management ────────────────────────────────────────────

    /// <summary>
    /// Grants or revokes a permission for an entire role.
    /// Invalidates the Redis cache so changes propagate within 5 minutes.
    /// The Admin role cannot be edited — it always has unrestricted access.
    /// </summary>
    [HttpPatch("roles/{role}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRolePermission(
        string role,
        [FromBody] UpdateRolePermissionRequest request)
    {
        if (!Enum.TryParse<UserRole>(role, ignoreCase: true, out var userRole)
            || userRole == UserRole.Admin)
        {
            return BadRequest(new { message = "Invalid or non-editable role." });
        }

        try
        {
            await _adminService.UpdateRolePermissionAsync(userRole, request.PermissionName, request.Granted);
            return Ok(new { message = "Role permission updated." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
