namespace ServiceMarketplace.API.Models.DTOs.Admin;

public class UserDto
{
    public Guid     Id             { get; set; }
    public string   Email          { get; set; } = string.Empty;
    public string   Role           { get; set; } = string.Empty;
    public string   SubTier        { get; set; } = string.Empty;
    public Guid?    OrganizationId { get; set; }
    public DateTime CreatedAt      { get; set; }
}
