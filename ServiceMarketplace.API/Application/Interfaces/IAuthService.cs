using ServiceMarketplace.API.Models.DTOs.Auth;

namespace ServiceMarketplace.API.Services.Interfaces;

public interface IAuthService
{
    Task<LoginResponse> RegisterAsync(RegisterRequest request);
    Task<LoginResponse> LoginAsync(LoginRequest request);
}
