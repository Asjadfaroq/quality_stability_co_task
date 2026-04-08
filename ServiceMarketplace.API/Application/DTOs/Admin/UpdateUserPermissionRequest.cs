namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>Body for PATCH /api/admin/users/{id}/permissions.</summary>
public class UpdateUserPermissionRequest
{
    public string PermissionName { get; set; } = string.Empty;

    /// <summary>
    /// true  = explicitly grant this permission (overrides role).
    /// false = explicitly revoke this permission (overrides role).
    /// null  = remove the override entirely; the user inherits from their role.
    /// </summary>
    public bool? Granted { get; set; }
}
