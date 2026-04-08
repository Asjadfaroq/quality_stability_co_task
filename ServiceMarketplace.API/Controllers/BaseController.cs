using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Controllers;

[ApiController]
public abstract class BaseController : ControllerBase
{
    protected Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(ClaimConstants.UserId)?.Value
            ?? throw new InvalidOperationException("UserId claim missing."));

    protected UserRole CurrentUserRole =>
        Enum.Parse<UserRole>(User.FindFirst(ClaimConstants.Role)?.Value
            ?? throw new InvalidOperationException("Role claim missing."));

    protected bool IsInRole(UserRole role) => CurrentUserRole == role;

    // ── Typed error helpers ───────────────────────────────────────────────────

    /// <summary>
    /// Returns a 403 Forbidden with a human-readable <c>{ "message": "..." }</c> body.
    /// Use this instead of <c>Forbid()</c>, which produces an empty 403 response.
    /// </summary>
    protected IActionResult Forbidden(string message) =>
        new ObjectResult(new { message }) { StatusCode = StatusCodes.Status403Forbidden };

    /// <summary>
    /// Returns a 401 Unauthorized with a human-readable <c>{ "message": "..." }</c> body.
    /// Use this instead of <c>Unauthorized()</c>, which produces an empty 401 response.
    /// </summary>
    protected IActionResult Unauthorized(string message) =>
        new ObjectResult(new { message }) { StatusCode = StatusCodes.Status401Unauthorized };
}
