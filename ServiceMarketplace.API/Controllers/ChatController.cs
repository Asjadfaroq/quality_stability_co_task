using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiceMarketplace.API.Data;

namespace ServiceMarketplace.API.Controllers;

/// <summary>Chat history for accepted service requests.</summary>
[Route("api/chat")]
[Authorize]
public class ChatController : BaseController
{
    private readonly AppDbContext _db;

    public ChatController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>Get message history for a request. Only the customer or accepted provider can access.</summary>
    [HttpGet("{requestId:guid}")]
    public async Task<IActionResult> GetMessages(Guid requestId)
    {
        var request = await _db.ServiceRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null) return NotFound();

        var isCustomer = request.CustomerId == CurrentUserId;
        var isProvider = request.AcceptedByProviderId == CurrentUserId;

        if (!isCustomer && !isProvider)
            return Forbid();

        var messages = await _db.ChatMessages
            .AsNoTracking()
            .Where(m => m.RequestId == requestId)
            .OrderBy(m => m.SentAt)
            .Select(m => new
            {
                m.Id,
                m.SenderId,
                m.SenderEmail,
                m.Content,
                m.SentAt
            })
            .ToListAsync();

        return Ok(messages);
    }
}
