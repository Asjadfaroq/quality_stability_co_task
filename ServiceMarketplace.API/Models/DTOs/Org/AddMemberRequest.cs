using System.ComponentModel.DataAnnotations;

namespace ServiceMarketplace.API.Models.DTOs.Org;

public class AddMemberRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}
