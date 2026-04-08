namespace ServiceMarketplace.API.Logging;

/// <summary>
/// A single structured log entry streamed to the logs/activity tab.
/// </summary>
/// <param name="Level">Serilog level string: Verbose, Debug, Information, Warning, Error, Fatal.</param>
/// <param name="Message">Rendered log message.</param>
/// <param name="Exception">Full exception string, null when no exception was thrown.</param>
/// <param name="SourceContext">Class that emitted the log (e.g. RequestService).</param>
/// <param name="Timestamp">UTC time the event was emitted.</param>
/// <param name="TraceId">ASP.NET Core trace correlation ID, if enriched.</param>
/// <param name="Category">System (infrastructure) or Audit (user action).</param>
/// <param name="ActorUserId">ID of the user who performed the action — Audit events only.</param>
/// <param name="Action">Machine-readable action key (e.g. "RequestCreated") — Audit events only.</param>
public sealed record LogEntry(
    string      Level,
    string      Message,
    string?     Exception,
    string?     SourceContext,
    DateTime    Timestamp,
    string?     TraceId,
    LogCategory Category,
    string?     ActorUserId,
    string?     Action
);
