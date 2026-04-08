namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>
/// A service-request row surfaced on the admin jobs view.
/// Includes denormalised customer and provider emails so the admin
/// can identify parties without additional round-trips.
/// </summary>
public class AdminJobDto
{
    public Guid     Id                   { get; set; }
    public string   Title                { get; set; } = string.Empty;
    public string?  Category             { get; set; }
    public string   Status               { get; set; } = string.Empty;
    public Guid     CustomerId           { get; set; }
    public string   CustomerEmail        { get; set; } = string.Empty;
    public Guid?    AcceptedByProviderId { get; set; }
    public string?  ProviderEmail        { get; set; }
    public DateTime CreatedAt            { get; set; }
    public DateTime UpdatedAt            { get; set; }
}
