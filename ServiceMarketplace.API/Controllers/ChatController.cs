using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Models.DTOs.Chat;
using ServiceMarketplace.API.Models.Enums;
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

    /// <summary>
    /// Get all conversations the current user participates in, with the last message preview.
    /// Not available to Admin.
    /// </summary>
    [HttpGet("conversations")]
    [ProducesResponseType(typeof(List<ConversationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetConversations()
    {
        if (CurrentUserRole == UserRole.Admin)
            return Forbid();

        var result = await _chatService.GetConversationsAsync(CurrentUserId, CurrentUserRole);
        return Ok(result);
    }

    /// <summary>
    /// Get message history for a request.
    /// Access is verified once here; <c>GetHistoryAsync</c> does not re-check.
    /// Only the customer or accepted provider can access.
    /// </summary>
    [HttpGet("{requestId:guid}")]
    [ProducesResponseType(typeof(List<ChatMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMessages(Guid requestId)
    {
        // Single DB query for access check.
        if (!await _chatService.CanAccessChatAsync(requestId, CurrentUserId))
            return Forbid();

        // Access verified — fetch history directly (no second access check inside).
        var messages = await _chatService.GetHistoryAsync(requestId);
        return Ok(messages);
    }
}
