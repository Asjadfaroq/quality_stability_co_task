namespace ServiceMarketplace.API.Models.DTOs.Requests;

public class CreateRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}
