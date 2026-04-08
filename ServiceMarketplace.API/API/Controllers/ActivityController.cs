using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Logging;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Controllers;

// REST seed for the activity tab while SignalR is connecting.
// Primary delivery is /hubs/activity; this endpoint is the fallback.
[Route("api/activity")]
[Authorize]
[ApiController]
public sealed class ActivityController : BaseController
{
    private const int MaxCount = 50;

    private readonly IAuditLogCache _auditCache;
    private readonly LogBuffer      _buffer;

    public ActivityController(IAuditLogCache auditCache, LogBuffer buffer)
    {
        _auditCache = auditCache;
        _buffer     = buffer;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<LogEntry>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyActivity([FromQuery] int count = MaxCount)
    {
        count = Math.Clamp(count, 1, MaxCount);
        var userId = CurrentUserId.ToString();

        var entries = await _auditCache.GetUserLogsAsync(userId, count);
        if (entries.Count == 0)
            entries = _buffer.GetRecentAudit(userId, count);

        return Ok(entries);
    }
}
