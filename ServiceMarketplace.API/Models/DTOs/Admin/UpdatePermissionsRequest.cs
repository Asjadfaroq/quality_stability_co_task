namespace ServiceMarketplace.API.Models.DTOs.Admin;

public class UpdatePermissionsRequest
{
    /// <summary>
    /// List of permission names to grant or revoke.
    /// </summary>
    public List<PermissionOverride> Overrides { get; set; } = [];
}

public class PermissionOverride
{
    public string PermissionName { get; set; } = string.Empty;
    public bool Granted { get; set; }
}
