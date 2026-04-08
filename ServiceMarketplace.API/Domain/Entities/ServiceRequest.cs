using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Models.Entities;

public class ServiceRequest
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Pending;
    public Guid? AcceptedByProviderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? Customer { get; set; }
    public User? AcceptedByProvider { get; set; }

    // Optimistic concurrency — EF throws DbUpdateConcurrencyException on double-accept
    public byte[]? RowVersion { get; set; }
}
