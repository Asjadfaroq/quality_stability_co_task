using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>Body for PATCH /api/admin/users/{id}/role.</summary>
public class UpdateUserRoleRequest
{
    public UserRole Role { get; set; }
}
