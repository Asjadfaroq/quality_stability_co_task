using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class RequestService : IRequestService
{
    private readonly AppDbContext _db;
    private readonly ISubscriptionService _subscriptionService;

    public RequestService(AppDbContext db, ISubscriptionService subscriptionService)
    {
        _db = db;
        _subscriptionService = subscriptionService;
    }

    public async Task<ServiceRequestDto> CreateAsync(Guid customerId, CreateRequestDto dto)
    {
        await _subscriptionService.EnforceCreateLimitAsync(customerId);

        var request = new ServiceRequest
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            Title = dto.Title,
            Description = dto.Description,
            Category = dto.Category,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.ServiceRequests.Add(request);
        await _db.SaveChangesAsync();

        return MapToDto(request);
    }

    public async Task<List<ServiceRequestDto>> GetAllAsync(Guid userId, UserRole role)
    {
        var query = _db.ServiceRequests.AsNoTracking();

        query = role switch
        {
            UserRole.Customer => query.Where(r => r.CustomerId == userId),
            UserRole.Admin    => query,
            _                 => query.Where(r => r.Status == RequestStatus.Pending ||
                                              (r.Status == RequestStatus.Accepted && r.AcceptedByProviderId == userId))
        };

        var requests = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return requests.Select(MapToDto).ToList();
    }

    public async Task<ServiceRequestDto> GetByIdAsync(Guid requestId, Guid userId, UserRole role)
    {
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        // Customers can only see their own requests
        if (role == UserRole.Customer && request.CustomerId != userId)
            throw new UnauthorizedAccessException("You do not have access to this request.");

        return MapToDto(request);
    }

    public async Task<List<ServiceRequestDto>> GetNearbyAsync(double lat, double lng, double radiusKm)
    {
        // Step 1: bounding box pre-filter in SQL
        var delta = radiusKm / 111.0;
        var candidates = await _db.ServiceRequests
            .AsNoTracking()
            .Where(r =>
                r.Status == RequestStatus.Pending &&
                (double)r.Latitude  >= lat - delta && (double)r.Latitude  <= lat + delta &&
                (double)r.Longitude >= lng - delta && (double)r.Longitude <= lng + delta)
            .ToListAsync();

        // Step 2: exact Haversine filter in memory
        return candidates
            .Where(r => GeoHelper.CalculateDistance(
                lat, lng, (double)r.Latitude, (double)r.Longitude) <= radiusKm)
            .Select(MapToDto)
            .ToList();
    }

    public async Task<ServiceRequestDto> AcceptAsync(Guid requestId, Guid providerId)
    {
        var request = await _db.ServiceRequests
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (request.Status != RequestStatus.Pending)
            throw new ConflictException("Request has already been accepted.");

        request.Status = RequestStatus.Accepted;
        request.AcceptedByProviderId = providerId;
        request.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapToDto(request);
    }

    public async Task<ServiceRequestDto> CompleteAsync(Guid requestId, Guid providerId)
    {
        var request = await _db.ServiceRequests
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (request.Status == RequestStatus.Completed)
            throw new InvalidOperationException("Request is already completed.");

        if (request.Status != RequestStatus.Accepted)
            throw new InvalidOperationException("Request must be accepted before it can be completed.");

        if (request.AcceptedByProviderId != providerId)
            throw new UnauthorizedAccessException("Only the provider who accepted this request can complete it.");

        request.Status = RequestStatus.Completed;
        request.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapToDto(request);
    }

    private static ServiceRequestDto MapToDto(ServiceRequest r) => new()
    {
        Id = r.Id,
        CustomerId = r.CustomerId,
        Title = r.Title,
        Description = r.Description,
        Category = r.Category,
        Latitude = r.Latitude,
        Longitude = r.Longitude,
        Status = r.Status.ToString(),
        AcceptedByProviderId = r.AcceptedByProviderId,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}
