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

    // Cascades: service requests + chat messages, owned org (members detached),
    // permission overrides, stripe info, and ASP.NET Identity rows.
    [HttpDelete("users/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
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

    [HttpGet("users/{id:guid}/permissions")]
    [ProducesResponseType(typeof(List<UserPermissionOverrideDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUserPermissions(Guid id)
    {
        var result = await _adminService.GetUserPermissionsAsync(id);
        return Ok(result);
    }

    // granted=true → force-grant; false → force-revoke; null → remove override.
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

    [HttpGet("roles/permissions")]
    [ProducesResponseType(typeof(RolePermissionsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRolePermissions()
    {
        var result = await _adminService.GetRolePermissionsAsync();
        return Ok(result);
    }

    // REST seed for the admin logs tab. System entries come from the in-memory buffer;
    // audit entries are merged from Redis (10-min window) to survive restarts.
    [HttpGet("logs")]
    [ProducesResponseType(typeof(IReadOnlyList<LogEntry>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLogs(
        [FromServices] LogBuffer       buffer,
        [FromServices] IAuditLogCache  auditCache,
        [FromQuery]    int             count    = 100,
        [FromQuery]    string?         category = null)
    {
        count = Math.Clamp(count, 1, 500);

        var wantAudit  = category is null || string.Equals(category, "Audit",  StringComparison.OrdinalIgnoreCase);
        var wantSystem = category is null || string.Equals(category, "System", StringComparison.OrdinalIgnoreCase);

        var bufferEntries = buffer.GetRecent(count)
            .Where(e => wantSystem && e.Category == LogCategory.System ||
                        wantAudit  && e.Category == LogCategory.Audit)
            .ToList();

        IReadOnlyList<LogEntry> redisAudit = wantAudit
            ? await auditCache.GetAllAuditLogsAsync(count)
            : [];

        // Union by (Timestamp, Action, ActorUserId) to dedupe entries present in both sources.
        var merged = bufferEntries
            .UnionBy(redisAudit, e => (e.Timestamp, e.Action, e.ActorUserId))
            .OrderByDescending(e => e.Timestamp)
            .Take(count)
            .ToList();

        return Ok(merged);
    }

    // The Admin role cannot be edited — it always has unrestricted access.
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
