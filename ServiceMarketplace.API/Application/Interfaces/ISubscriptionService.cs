namespace ServiceMarketplace.API.Services.Interfaces;

public interface ISubscriptionService
{
    Task EnforceCreateLimitAsync(Guid customerId);
}
