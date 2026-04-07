using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IRequestService
{
    Task<ServiceRequestDto>              CreateAsync(Guid customerId, CreateRequestDto dto);
    Task<PagedResult<ServiceRequestDto>> GetAllAsync(Guid userId, UserRole role, int page, int pageSize);
    Task<PagedResult<ServiceRequestDto>> GetCompletedAsync(Guid providerId, int page, int pageSize);
    Task<ServiceRequestDto>              GetByIdAsync(Guid requestId, Guid userId, UserRole role);
    Task<List<ServiceRequestDto>>        GetNearbyAsync(double lat, double lng, double radiusKm);
    Task<ServiceRequestDto>              AcceptAsync(Guid requestId, Guid providerId);
    Task<ServiceRequestDto>              CompleteAsync(Guid requestId, Guid providerId);
    Task<ServiceRequestDto>              ConfirmAsync(Guid requestId, Guid customerId);
}
