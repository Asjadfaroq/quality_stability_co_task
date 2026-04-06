namespace ServiceMarketplace.API.Models.Entities;

public class UserPermission
{
    public Guid UserId { get; set; }
    public int PermissionId { get; set; }
    public bool Granted { get; set; }

    public User? User { get; set; }
    public Permission? Permission { get; set; }
}
