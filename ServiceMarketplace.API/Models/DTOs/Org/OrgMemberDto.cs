namespace ServiceMarketplace.API.Models.DTOs.Org;

public class OrgMemberDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = [];
}
