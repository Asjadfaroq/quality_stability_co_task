using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public SubscriptionService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    public async Task EnforceCreateLimitAsync(Guid customerId)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == customerId)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.SubTier == SubscriptionTier.Paid)
            return;

        var freeLimit = _configuration.GetValue<int>("Subscription:FreeRequestLimit", 3);

        var count = await _db.ServiceRequests
            .CountAsync(r => r.CustomerId == customerId);

        if (count >= freeLimit)
            throw new UnauthorizedAccessException(
                "Free tier limit reached. Upgrade to create more requests.");
    }
}
