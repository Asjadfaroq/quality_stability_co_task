using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using ServiceMarketplace.API.Helpers;
using ServiceMarketplace.API.Models.DTOs.Auth;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _configuration;

    public AuthService(UserManager<User> userManager, IConfiguration configuration)
    {
        _userManager = userManager;
        _configuration = configuration;
    }

    public async Task<LoginResponse> RegisterAsync(RegisterRequest request)
    {
        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
            throw new InvalidOperationException("Email is already registered.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            UserName = request.Email,
            Email = request.Email,
            Role = request.Role,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        return new LoginResponse
        {
            Token = GenerateJwt(user),
            Role = user.Role.ToString(),
            UserId = user.Id
        };
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email)
            ?? throw new UnauthorizedAccessException("Invalid credentials.");

        var valid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!valid)
            throw new UnauthorizedAccessException("Invalid credentials.");

        return new LoginResponse
        {
            Token = GenerateJwt(user),
            Role = user.Role.ToString(),
            UserId = user.Id
        };
    }

    private string GenerateJwt(User user)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimConstants.UserId, user.Id.ToString()),
            new Claim(ClaimConstants.Email, user.Email!),
            new Claim(ClaimConstants.Role, user.Role.ToString())
        };

        var expiry = int.Parse(jwtSection["ExpiryMinutes"] ?? "1440");
        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiry),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
