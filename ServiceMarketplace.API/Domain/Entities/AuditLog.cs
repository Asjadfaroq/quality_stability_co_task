namespace ServiceMarketplace.API.Models.Entities;

/// <summary>
/// Durable record of a single audit event (a meaningful user action such as creating,
/// accepting or completing a request, or changing permissions).
///
/// Why this exists:
///   <c>LogBuffer</c> is an in-process ring buffer and <c>AuditLogCache</c> is a Redis
///   cache with a short TTL — both are lost when the process restarts. On platforms that
///   idle and restart the container frequently, that leaves the admin log view empty.
///   This table is the durable source of truth; the buffer and cache remain the fast paths.
///
/// Only audit events are persisted. High-volume System/diagnostic logs stay in memory and
/// on stdout, so table growth stays proportional to real user activity rather than traffic.
/// <c>AuditLogCleanupJob</c> then deletes rows past the configured retention window, which
/// bounds storage permanently.
/// </summary>
public class AuditLog
{
    public long Id { get; set; }

    /// <summary>When the event occurred (UTC).</summary>
    public DateTime Timestamp { get; set; }

    /// <summary>Id of the user who performed the action.</summary>
    public string ActorUserId { get; set; } = string.Empty;

    /// <summary>Short machine-readable action name, e.g. "RequestAccepted".</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Rendered human-readable description of the event.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Serilog level of the originating call ("Information", "Warning", ...).</summary>
    public string Level { get; set; } = string.Empty;

    /// <summary>Correlation id for tying the event back to a request trace, when available.</summary>
    public string? TraceId { get; set; }
}
