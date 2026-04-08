namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>
/// Represents an explicit per-user permission override.
/// Returned by GET /api/admin/users/{id}/permissions.
/// </summary>
public class UserPermissionOverrideDto
{
    public string PermissionName { get; set; } = string.Empty;

    /// <summary>
    /// true  = explicitly granted (overrides role default, even if role does not have it).
    /// false = explicitly revoked (overrides role default, even if role has it).
    /// </summary>
    public bool Granted { get; set; }
}
