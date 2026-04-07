namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>Returned by GET /api/admin/roles/permissions.</summary>
public class RolePermissionsDto
{
    /// <summary>All platform permissions, ordered by name.</summary>
    public List<PermissionDto> Permissions { get; set; } = [];

    /// <summary>
    /// Maps each non-Admin role name to its currently assigned permission names.
    /// Every editable role is always present as a key, even if its list is empty.
    /// </summary>
    public Dictionary<string, List<string>> RoleAssignments { get; set; } = [];
}

public class PermissionDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}
