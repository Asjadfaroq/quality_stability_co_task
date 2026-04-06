using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IRequestService
{
    Task<ServiceRequestDto> CreateAsync(Guid customerId, CreateRequestDto dto);
    Task<List<ServiceRequestDto>> GetAllAsync(Guid userId, UserRole role);
    Task<ServiceRequestDto> GetByIdAsync(Guid requestId, Guid userId, UserRole role);
    Task<List<ServiceRequestDto>> GetNearbyAsync(double lat, double lng, double radiusKm);
    Task<ServiceRequestDto> AcceptAsync(Guid requestId, Guid providerId);
    Task<ServiceRequestDto> CompleteAsync(Guid requestId, Guid providerId);
}
