using Microsoft.AspNetCore.SignalR;
using ServiceMarketplace.API.Helpers;

namespace ServiceMarketplace.API.Hubs;

// SignalR by default reads ClaimTypes.NameIdentifier for the user ID.
// Our JWT uses a custom "userId" claim, so we provide this resolver.
public class UserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
        => connection.User?.FindFirst(ClaimConstants.UserId)?.Value;
}
