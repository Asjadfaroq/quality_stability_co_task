using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Models.Entities;

public class RolePermission
{
    public UserRole Role { get; set; }
    public int PermissionId { get; set; }

    public Permission? Permission { get; set; }
}
