using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Hubs;
using ServiceMarketplace.API.Models.DTOs;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Models.Enums;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class RequestService : IRequestService
{
    private readonly AppDbContext _db;
    private readonly ISubscriptionService _subscriptionService;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<RequestService> _logger;

    public RequestService(
        AppDbContext db,
        ISubscriptionService subscriptionService,
        IHubContext<NotificationHub> hub,
        ILogger<RequestService> logger)
    {
        _db = db;
        _subscriptionService = subscriptionService;
        _hub = hub;
        _logger = logger;
    }

    public async Task<ServiceRequestDto> CreateAsync(Guid customerId, CreateRequestDto dto)
    {
        await _subscriptionService.EnforceCreateLimitAsync(customerId);

        var request = new ServiceRequest
        {
            Id          = Guid.NewGuid(),
            CustomerId  = customerId,
            Title       = dto.Title,
            Description = dto.Description,
            Category    = dto.Category,
            Latitude    = dto.Latitude,
            Longitude   = dto.Longitude,
            Status      = RequestStatus.Pending,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow
        };

        _db.ServiceRequests.Add(request);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Request {RequestId} created by customer {CustomerId}", request.Id, customerId);

        await _hub.Clients
            .Group("providers")
            .SendAsync("NewRequestAvailable", new
            {
                requestId = request.Id,
                title     = request.Title,
                category  = request.Category
            });

        return ProjectToDto(request);
    }

    public async Task<PagedResult<ServiceRequestDto>> GetAllAsync(Guid userId, UserRole role, int page, int pageSize)
    {
        var query = _db.ServiceRequests.AsNoTracking();

        query = role switch
        {
            UserRole.Customer => query.Where(r => r.CustomerId == userId),
            UserRole.Admin    => query,
            _                 => query.Where(r =>
                                     r.Status == RequestStatus.Pending ||
                                     ((r.Status == RequestStatus.Accepted || r.Status == RequestStatus.PendingConfirmation)
                                      && r.AcceptedByProviderId == userId))
        };

        var totalCount = await query.CountAsync();

        // Project directly to DTO in SQL — avoids loading the full entity (including
        // Description nvarchar(2000)) just to re-map it in memory afterwards.
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ServiceRequestDto
            {
                Id                   = r.Id,
                CustomerId           = r.CustomerId,
                Title                = r.Title,
                Description          = r.Description,
                Category             = r.Category,
                Latitude             = r.Latitude,
                Longitude            = r.Longitude,
                Status               = r.Status.ToString(),
                AcceptedByProviderId = r.AcceptedByProviderId,
                CreatedAt            = r.CreatedAt,
                UpdatedAt            = r.UpdatedAt
            })
            .ToListAsync();

        return new PagedResult<ServiceRequestDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<PagedResult<ServiceRequestDto>> GetCompletedAsync(Guid providerId, int page, int pageSize)
    {
        var query = _db.ServiceRequests
            .AsNoTracking()
            .Where(r => r.Status == RequestStatus.Completed
                     && r.AcceptedByProviderId.HasValue
                     && r.AcceptedByProviderId.Value == providerId);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ServiceRequestDto
            {
                Id                   = r.Id,
                CustomerId           = r.CustomerId,
                Title                = r.Title,
                Description          = r.Description,
                Category             = r.Category,
                Latitude             = r.Latitude,
                Longitude            = r.Longitude,
                Status               = r.Status.ToString(),
                AcceptedByProviderId = r.AcceptedByProviderId,
                CreatedAt            = r.CreatedAt,
                UpdatedAt            = r.UpdatedAt
            })
            .ToListAsync();

        return new PagedResult<ServiceRequestDto>
        {
            Items      = items,
            Page       = page,
            PageSize   = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<ServiceRequestDto> GetByIdAsync(Guid requestId, Guid userId, UserRole role)
    {
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .Select(r => new ServiceRequestDto
            {
                Id                   = r.Id,
                CustomerId           = r.CustomerId,
                Title                = r.Title,
                Description          = r.Description,
                Category             = r.Category,
                Latitude             = r.Latitude,
                Longitude            = r.Longitude,
                Status               = r.Status.ToString(),
                AcceptedByProviderId = r.AcceptedByProviderId,
                CreatedAt            = r.CreatedAt,
                UpdatedAt            = r.UpdatedAt
            })
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (role == UserRole.Customer && request.CustomerId != userId)
            throw new UnauthorizedAccessException("You do not have access to this request.");

        return request;
    }

    public async Task<List<ServiceRequestDto>> GetNearbyAsync(double lat, double lng, double radiusKm)
    {
        // Pre-cast bounding box to decimal so EF generates a direct column comparison
        // rather than CAST(Latitude AS float) per row, allowing index usage.
        var delta  = radiusKm / 111.0;
        var latMin = (decimal)(lat - delta);
        var latMax = (decimal)(lat + delta);
        var lngMin = (decimal)(lng - delta);
        var lngMax = (decimal)(lng + delta);

        // Bounding-box pre-filter is covered by IX_ServiceRequests_Status_Latitude_Longitude.
        // Project to DTO inside SQL to avoid loading unnecessary columns.
        var candidates = await _db.ServiceRequests
            .AsNoTracking()
            .Where(r =>
                r.Status    == RequestStatus.Pending &&
                r.Latitude  >= latMin && r.Latitude  <= latMax &&
                r.Longitude >= lngMin && r.Longitude <= lngMax)
            .Select(r => new ServiceRequestDto
            {
                Id                   = r.Id,
                CustomerId           = r.CustomerId,
                Title                = r.Title,
                Description          = r.Description,
                Category             = r.Category,
                Latitude             = r.Latitude,
                Longitude            = r.Longitude,
                Status               = r.Status.ToString(),
                AcceptedByProviderId = r.AcceptedByProviderId,
                CreatedAt            = r.CreatedAt,
                UpdatedAt            = r.UpdatedAt
            })
            .ToListAsync();

        // Haversine exact filter runs in-process after the cheap bounding-box pre-filter.
        return candidates
            .Where(r => GeoHelper.CalculateDistance(lat, lng, (double)r.Latitude, (double)r.Longitude) <= radiusKm)
            .ToList();
    }

    public async Task<ServiceRequestDto> AcceptAsync(Guid requestId, Guid providerId)
    {
        var request = await _db.ServiceRequests
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (request.Status != RequestStatus.Pending)
            throw new ConflictException("Request has already been accepted.");

        request.Status               = RequestStatus.Accepted;
        request.AcceptedByProviderId = providerId;
        request.UpdatedAt            = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Request was accepted by another provider. Please refresh.");
        }

        _logger.LogInformation("Request {RequestId} accepted by provider {ProviderId}", requestId, providerId);

        await _hub.Clients
            .Group("providers")
            .SendAsync("RequestTaken", new { requestId = request.Id });

        await _hub.Clients
            .Group(request.CustomerId.ToString())
            .SendAsync("RequestAccepted", new { requestId = request.Id });

        return ProjectToDto(request);
    }

    public async Task<ServiceRequestDto> CompleteAsync(Guid requestId, Guid providerId)
    {
        var request = await _db.ServiceRequests
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (request.Status == RequestStatus.Completed)
            throw new InvalidOperationException("Request is already completed.");

        if (request.Status == RequestStatus.PendingConfirmation)
            throw new InvalidOperationException("Request is awaiting customer confirmation.");

        if (request.Status != RequestStatus.Accepted)
            throw new InvalidOperationException("Request must be accepted before it can be completed.");

        if (request.AcceptedByProviderId != providerId)
            throw new UnauthorizedAccessException("Only the provider who accepted this request can complete it.");

        request.Status    = RequestStatus.PendingConfirmation;
        request.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Request {RequestId} marked PendingConfirmation by provider {ProviderId}", requestId, providerId);

        await _hub.Clients
            .Group(request.CustomerId.ToString())
            .SendAsync("RequestNeedsConfirmation", new { requestId = request.Id, title = request.Title });

        await _hub.Clients
            .Group(providerId.ToString())
            .SendAsync("RequestStatusUpdated", new { requestId = request.Id });

        return ProjectToDto(request);
    }

    public async Task<ServiceRequestDto> ConfirmAsync(Guid requestId, Guid customerId)
    {
        var request = await _db.ServiceRequests
            .FirstOrDefaultAsync(r => r.Id == requestId)
            ?? throw new KeyNotFoundException("Request not found.");

        if (request.CustomerId != customerId)
            throw new UnauthorizedAccessException("Only the customer who created this request can confirm completion.");

        if (request.Status != RequestStatus.PendingConfirmation)
            throw new InvalidOperationException("Request is not awaiting confirmation.");

        request.Status    = RequestStatus.Completed;
        request.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Request {RequestId} confirmed completed by customer {CustomerId}", requestId, customerId);

        if (request.AcceptedByProviderId.HasValue)
            await _hub.Clients
                .Group(request.AcceptedByProviderId.Value.ToString())
                .SendAsync("RequestConfirmed", new { requestId = request.Id, title = request.Title });

        await _hub.Clients
            .Group(customerId.ToString())
            .SendAsync("RequestStatusUpdated", new { requestId = request.Id });

        return ProjectToDto(request);
    }

    // Used only for tracked entities returned after write operations (Accept, Complete, Confirm, Create)
    // where the entity is already materialised and we cannot project in SQL.
    private static ServiceRequestDto ProjectToDto(ServiceRequest r) => new()
    {
        Id                   = r.Id,
        CustomerId           = r.CustomerId,
        Title                = r.Title,
        Description          = r.Description,
        Category             = r.Category,
        Latitude             = r.Latitude,
        Longitude            = r.Longitude,
        Status               = r.Status.ToString(),
        AcceptedByProviderId = r.AcceptedByProviderId,
        CreatedAt            = r.CreatedAt,
        UpdatedAt            = r.UpdatedAt
    };
}
