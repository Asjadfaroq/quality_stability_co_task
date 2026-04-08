namespace ServiceMarketplace.API.Services.Interfaces;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(Guid userId, string permissionName);

    /// <summary>
    /// Returns the full set of permission names currently effective for the user,
    /// after applying role defaults and any per-user overrides.
    /// Admin users receive every defined permission.
    /// </summary>
    Task<HashSet<string>> GetEffectivePermissionsAsync(Guid userId);
}
