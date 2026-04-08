using ServiceMarketplace.API.Models.Enums;

namespace ServiceMarketplace.API.Models.DTOs.Auth;

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Customer;
}
