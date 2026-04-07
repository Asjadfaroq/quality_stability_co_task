using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/admin")]
[Authorize]
[RequirePermission("admin.manage_users")]
public class AdminController : BaseController
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize     = 200;

    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    // ── User management ───────────────────────────────────────────────────────

    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<UserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllUsers(
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _adminService.GetAllUsersAsync(page, pageSize);
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
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Cannot modify your own account." });

        try
        {
            await _adminService.UpdateSubscriptionAsync(id, request.SubTier);
            return Ok(new { message = "Subscription updated." });
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
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Cannot modify your own permissions." });

        try
        {
            await _adminService.UpdateUserPermissionAsync(id, request.PermissionName, request.Granted);
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
