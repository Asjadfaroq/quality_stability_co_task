using Serilog.Context;

namespace ServiceMarketplace.API.Logging;

/// <summary>
/// Extension methods that stamp an <see cref="ILogger"/> call with the three
/// Serilog context properties that classify it as an audit event.
/// The properties are pushed via <see cref="LogContext"/> so they enrich the
/// underlying Serilog event even though the call site uses the Microsoft abstraction.
/// </summary>
public static class LoggerAuditExtensions
{
    /// <summary>
    /// Emits an <see cref="LogCategory.Audit"/> Information log enriched with
    /// <paramref name="actorUserId"/> and a machine-readable <paramref name="action"/> key.
    /// </summary>
    /// <param name="logger">The logger instance.</param>
    /// <param name="actorUserId">ID of the user performing the action.</param>
    /// <param name="action">
    ///   Machine-readable action key used for client-side filtering,
    ///   e.g. <c>"RequestCreated"</c>, <c>"UserRoleUpdated"</c>.
    /// </param>
    /// <param name="messageTemplate">Serilog message template.</param>
    /// <param name="args">Template arguments.</param>
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
