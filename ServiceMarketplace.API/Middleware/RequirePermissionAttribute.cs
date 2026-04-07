using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Middleware;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string _permissionName;

    public RequirePermissionAttribute(string permissionName)
    {
        _permissionName = permissionName;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.Identity is null || !user.Identity.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var userIdValue = user.FindFirst(ClaimConstants.UserId)?.Value;

        if (!Guid.TryParse(userIdValue, out var userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var permissionService = context.HttpContext.RequestServices
            .GetRequiredService<IPermissionService>();

        var hasPermission = await permissionService.HasPermissionAsync(userId, _permissionName);

        if (!hasPermission)
        {
            context.Result = new ObjectResult(new
            {
                // errorCode is a stable machine-readable discriminator so clients can
                // distinguish a permission denial from other 403s (e.g. subscription limits).
                errorCode = "permission_denied",
                message   = $"Access denied. The '{_permissionName}' permission is required to perform " +
                            "this action. Contact your administrator if you believe this is a mistake.",
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
