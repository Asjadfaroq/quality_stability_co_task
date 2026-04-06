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
}
