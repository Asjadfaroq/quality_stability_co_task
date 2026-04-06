using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

/// <summary>Chat history for accepted service requests.</summary>
[Route("api/chat")]
[Authorize]
public class ChatController : BaseController
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    /// <summary>Get message history for a request. Only the customer or accepted provider can access.</summary>
    [HttpGet("{requestId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMessages(Guid requestId)
    {
        var canAccess = await _chatService.CanAccessChatAsync(requestId, CurrentUserId);
        if (!canAccess) return Forbid();

        var messages = await _chatService.GetHistoryAsync(requestId, CurrentUserId);
        return Ok(messages);
    }
}
