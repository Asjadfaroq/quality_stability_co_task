namespace ServiceMarketplace.API.Helpers;

/// <summary>
/// Centralised permission name constants — single source of truth used by
/// seeds, RequirePermissionAttribute, and all service/controller checks.
/// </summary>
public static class PermissionNames
{
    // Service-request lifecycle
    public const string RequestCreate   = "request.create";
    public const string RequestAccept   = "request.accept";
    public const string RequestComplete = "request.complete";
    public const string RequestViewAll  = "request.view_all";

    // Platform administration
    public const string AdminManageUsers = "admin.manage_users";

    // Organisation management
    public const string OrgManage = "org.manage";
    public const string OrgView   = "org.view";
}
