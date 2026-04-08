using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IRequestService
{
    Task<ServiceRequestDto>              CreateAsync(Guid customerId, CreateRequestDto dto);
    /// <param name="statusFilter">
    /// Optional provider-only view filter: "Pending" = available jobs only,
    /// "Active" = provider's own accepted/in-progress jobs only, null = both combined.
    /// Ignored for Customer and Admin roles.
    /// </param>
    Task<PagedResult<ServiceRequestDto>> GetAllAsync(Guid userId, UserRole role, int page, int pageSize, string? statusFilter = null);
    Task<PagedResult<ServiceRequestDto>> GetCompletedAsync(Guid providerId, int page, int pageSize);
    Task<ServiceRequestDto>              GetByIdAsync(Guid requestId, Guid userId, UserRole role);
    Task<List<ServiceRequestDto>>        GetNearbyAsync(double lat, double lng, double radiusKm);
    /// <summary>
    /// Returns a flat list of jobs scoped to the caller's role for map rendering.
    /// Admin = all jobs; Customer = own jobs; Provider = jobs accepted by the provider
    /// or any member of their organisation.
    /// </summary>
    Task<List<MapJobDto>>                GetForMapAsync(Guid userId, UserRole role);
    Task<ServiceRequestDto>              AcceptAsync(Guid requestId, Guid providerId);
    Task<ServiceRequestDto>              CompleteAsync(Guid requestId, Guid providerId);
    Task<ServiceRequestDto>              ConfirmAsync(Guid requestId, Guid customerId);
}
