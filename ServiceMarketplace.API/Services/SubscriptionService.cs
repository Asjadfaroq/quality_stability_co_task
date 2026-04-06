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
        var subTier = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == customerId)
            .Select(u => (SubscriptionTier?)u.SubTier)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("User not found.");

        if (subTier == SubscriptionTier.Paid)
            return;

        var freeLimit = _configuration.GetValue<int>("Subscription:FreeRequestLimit", 3);

        var count = await _db.ServiceRequests
            .CountAsync(r => r.CustomerId == customerId);

        if (count >= freeLimit)
            throw new UnauthorizedAccessException(
                "Free tier limit reached. Upgrade to create more requests.");
    }
}
