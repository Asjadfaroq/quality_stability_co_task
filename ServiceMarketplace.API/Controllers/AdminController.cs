using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Admin;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/admin")]
[Authorize]
public class AdminController : BaseController
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize     = 200;

    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    /// <summary>
    /// Returns all registered users with their permissions, paginated.
    /// Use <c>page</c> and <c>pageSize</c> query params (max 200 per page).
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAllUsers(
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        if (!IsInRole(UserRole.Admin)) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page     = Math.Max(1, page);

        var result = await _adminService.GetAllUsersAsync(page, pageSize);
        return Ok(result);
    }

    [HttpPatch("users/{id:guid}/subscription")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSubscription(Guid id, [FromBody] UpdateSubscriptionRequest request)
    {
        if (!IsInRole(UserRole.Admin)) return Forbid();

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

    [HttpPatch("users/{id:guid}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePermissions(Guid id, [FromBody] UpdatePermissionsRequest request)
    {
        if (!IsInRole(UserRole.Admin)) return Forbid();

        try
        {
            await _adminService.UpdatePermissionsAsync(id, request.Overrides);
            return Ok(new { message = "Permissions updated." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
