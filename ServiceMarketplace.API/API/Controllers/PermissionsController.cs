using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

[Route("api/permissions")]
[Authorize]
public class PermissionsController : BaseController
{
    private readonly IPermissionService _permissionService;

    public PermissionsController(IPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    /// <summary>
    /// Returns the full set of permission names currently effective for the calling user.
    /// Incorporates role defaults and any per-user overrides.  Admin users receive every
    /// defined permission.  The response is safe to cache on the client for 5 minutes
    /// (matching the backend cache TTL).
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyPermissions()
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(CurrentUserId);
        return Ok(permissions);
    }
}
