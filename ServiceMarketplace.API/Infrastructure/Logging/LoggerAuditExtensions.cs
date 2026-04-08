using Serilog.Context;

namespace ServiceMarketplace.API.Logging;

/// <summary>
/// Stamps a logger call with the three Serilog context properties that classify it
/// as an audit event (LogCategory, ActorUserId, Action) via <see cref="LogContext"/>.
/// </summary>
public static class LoggerAuditExtensions
{
    public static void LogAudit(
        this ILogger     logger,
        string           actorUserId,
        string           action,
        string           messageTemplate,
        params object?[] args)
    {
        using (LogContext.PushProperty("LogCategory", nameof(LogCategory.Audit)))
        using (LogContext.PushProperty("ActorUserId", actorUserId))
        using (LogContext.PushProperty("Action",      action))
        {
            logger.LogInformation(messageTemplate, args);
        }
    }
}
