namespace ServiceMarketplace.API.Services.Interfaces;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(Guid userId, string permissionName);
}
