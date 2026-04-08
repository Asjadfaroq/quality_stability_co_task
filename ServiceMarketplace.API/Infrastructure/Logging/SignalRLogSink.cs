using Serilog.Core;
using Serilog.Events;

namespace ServiceMarketplace.API.Logging;

public sealed class SignalRLogSink : ILogEventSink
{
    private readonly LogBuffer        _buffer;
    private readonly IFormatProvider? _formatProvider;
    private readonly LogEventLevel    _minimumLevel;

    public SignalRLogSink(
        LogBuffer        buffer,
        IFormatProvider? formatProvider,
        LogEventLevel    minimumLevel)
    {
        _buffer         = buffer;
        _formatProvider = formatProvider;
        _minimumLevel   = minimumLevel;
    }

    public void Emit(LogEvent logEvent)
    {
        if (logEvent.Level < _minimumLevel)
            return;

        var categoryStr = TryGetString(logEvent, "LogCategory");
        var category    = categoryStr == nameof(LogCategory.Audit)
            ? LogCategory.Audit
            : LogCategory.System;

        var entry = new LogEntry(
            Level:         logEvent.Level.ToString(),
            Message:       logEvent.RenderMessage(_formatProvider),
            Exception:     logEvent.Exception?.ToString(),
            SourceContext: TryGetString(logEvent, "SourceContext"),
            Timestamp:     logEvent.Timestamp.UtcDateTime,
            TraceId:       TryGetString(logEvent, "TraceId"),
            Category:      category,
            ActorUserId:   TryGetString(logEvent, "ActorUserId"),
            Action:        TryGetString(logEvent, "Action")
        );

        _buffer.Write(entry);
    }

    private static string? TryGetString(LogEvent logEvent, string property)
        => logEvent.Properties.TryGetValue(property, out var v)
            ? v.ToString().Trim('"')  // scalar values include surrounding quotes
            : null;
}
