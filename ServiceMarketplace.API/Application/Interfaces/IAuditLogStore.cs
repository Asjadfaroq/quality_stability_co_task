using ServiceMarketplace.API.Logging;

namespace ServiceMarketplace.API.Services.Interfaces;

/// <summary>
/// Durable persistence for audit events. Complements <see cref="IAuditLogCache"/>, which is
/// a short-lived Redis cache: the cache serves the live view, this store survives restarts.
/// </summary>
public interface IAuditLogStore
{
    /// <summary>Persists a single audit entry. Never throws — logging must not break callers.</summary>
    Task WriteAsync(LogEntry entry, CancellationToken ct = default);

    /// <summary>Most-recent audit entries, newest first.</summary>
    Task<IReadOnlyList<LogEntry>> GetRecentAsync(int count, CancellationToken ct = default);

    /// <summary>Most-recent audit entries for one actor, newest first.</summary>
    Task<IReadOnlyList<LogEntry>> GetForUserAsync(string userId, int count, CancellationToken ct = default);
}
