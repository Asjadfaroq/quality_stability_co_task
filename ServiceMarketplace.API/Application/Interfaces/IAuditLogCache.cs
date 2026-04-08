using ServiceMarketplace.API.Logging;

namespace ServiceMarketplace.API.Services.Interfaces;

/// <summary>
/// Redis-backed 10-minute sliding window for audit log entries.
/// No-ops silently when Redis is unavailable.
/// </summary>
public interface IAuditLogCache
{
    Task WriteAsync(LogEntry entry);
    Task<IReadOnlyList<LogEntry>> GetUserLogsAsync(string userId, int count = 50);
    Task<IReadOnlyList<LogEntry>> GetAllAuditLogsAsync(int count = 200);
}
