using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs.Ai;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

/// <summary>AI-powered description enhancement.</summary>
[Route("api/ai")]
[Authorize]
public class AiController : BaseController
{
    private readonly IAiService _aiService;

    public AiController(IAiService aiService)
    {
        _aiService = aiService;
    }

    /// <summary>
    /// Enhance a service request description and suggest a category.
    /// Falls back to a mock response if the AI provider is unavailable.
    /// </summary>
    [HttpPost("enhance-description")]
    [EnableRateLimiting(RateLimitPolicies.Ai)]
    [ProducesResponseType(typeof(EnhanceDescriptionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EnhanceDescription([FromBody] EnhanceDescriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.RawDescription))
            return BadRequest(new { message = "Title and RawDescription are required." });

        var result = await _aiService.EnhanceDescriptionAsync(request);
        return Ok(result);
    }
}
