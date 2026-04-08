namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>Body for PATCH /api/admin/roles/{role}/permissions.</summary>
public class UpdateRolePermissionRequest
{
    public string PermissionName { get; set; } = string.Empty;
    public bool   Granted        { get; set; }
}
