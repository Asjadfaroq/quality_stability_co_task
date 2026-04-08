using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.DTOs.Ai;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

/// <summary>AI-powered features: description enhancement and in-app help chat.</summary>
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

    /// <summary>
    /// Answer a question about ServiceMarket.
    /// The model is constrained by a system prompt so it only responds within app context.
    /// Conversation history is accepted from the client so follow-up questions work correctly.
    /// </summary>
    [HttpPost("chat")]
    [EnableRateLimiting(RateLimitPolicies.AiChat)]
    [ProducesResponseType(typeof(AiChatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Message is required." });

        var result = await _aiService.ChatAsync(request, ct);
        return Ok(result);
    }
}
