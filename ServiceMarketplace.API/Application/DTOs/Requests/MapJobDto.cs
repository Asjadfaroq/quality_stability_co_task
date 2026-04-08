namespace ServiceMarketplace.API.Models.DTOs.Requests;

/// <summary>
/// Lightweight projection returned by GET /requests/map.
/// Contains only the fields required to render a map marker and popup.
/// Role-scoping is applied in RequestService.GetForMapAsync.
/// </summary>
public class MapJobDto
{
    public Guid     Id            { get; set; }
    public string   Title         { get; set; } = string.Empty;
    public string?  Category      { get; set; }
    public string   Status        { get; set; } = string.Empty;
    public decimal  Latitude      { get; set; }
    public decimal  Longitude     { get; set; }
    /// <summary>Populated for Admin role only.</summary>
    public string?  CustomerEmail { get; set; }
    /// <summary>Populated for Admin role only.</summary>
    public string?  ProviderEmail { get; set; }
    public DateTime CreatedAt     { get; set; }
}
