namespace ServiceMarketplace.API.Models.DTOs.Admin;

/// <summary>
/// Lightweight organization row for the admin overview.
/// Member count is a SQL COUNT — no member rows are loaded.
/// Owner is represented by email only — no full user object is fetched.
/// </summary>
public class AdminOrgDto
{
    public Guid     Id          { get; set; }
    public string   Name        { get; set; } = string.Empty;
    public Guid     OwnerId     { get; set; }
    public string   OwnerEmail  { get; set; } = string.Empty;
    public int      MemberCount { get; set; }
    public DateTime CreatedAt   { get; set; }
}
