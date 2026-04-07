using System.ComponentModel.DataAnnotations;

namespace ServiceMarketplace.API.Models.DTOs.Org;

public class CreateOrgRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
}
