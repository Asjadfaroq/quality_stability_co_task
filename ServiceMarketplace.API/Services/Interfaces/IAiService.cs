using ServiceMarketplace.API.Models.DTOs.Ai;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAiService
{
    Task<EnhanceDescriptionResponse> EnhanceDescriptionAsync(EnhanceDescriptionRequest request);
}
