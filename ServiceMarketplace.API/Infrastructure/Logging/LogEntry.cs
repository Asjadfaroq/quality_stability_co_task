namespace ServiceMarketplace.API.Logging;

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
