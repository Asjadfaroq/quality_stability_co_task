using System.Collections.Concurrent;
using System.Threading.Channels;

namespace ServiceMarketplace.API.Logging;

/// <summary>
/// Thread-safe circular buffer that holds the most recent log entries
/// and exposes a <see cref="ChannelReader{T}"/> for streaming to SignalR.
/// </summary>
public sealed class LogBuffer
{
    private const int HistoryCapacity = 500;
    private const int ChannelCapacity = 1_000;

    private readonly ConcurrentQueue<LogEntry> _history = new();

    private readonly Channel<LogEntry> _channel = Channel.CreateBounded<LogEntry>(
        new BoundedChannelOptions(ChannelCapacity)
        {
            FullMode                      = BoundedChannelFullMode.DropOldest,
            SingleReader                  = true,
            AllowSynchronousContinuations = false
        });

    /// <summary>Reader consumed by <see cref="LogBroadcastService"/>.</summary>
    public ChannelReader<LogEntry> Reader => _channel.Reader;

    /// <summary>
    /// Appends an entry to the circular history and enqueues it for broadcast.
    /// Safe to call from multiple threads (Serilog emits on background threads).
    /// </summary>
    public void Write(LogEntry entry)
    {
        _history.Enqueue(entry);

        while (_history.Count > HistoryCapacity)
            _history.TryDequeue(out _);

        _channel.Writer.TryWrite(entry);
    }

    /// <summary>Returns the <paramref name="count"/> most-recent entries (all categories). Used by the admin tab.</summary>
    public IReadOnlyList<LogEntry> GetRecent(int count = 100)
    {
        var clamped = Math.Clamp(count, 1, HistoryCapacity);
        return _history.TakeLast(clamped).ToList();
    }

    /// <summary>
    /// Returns the <paramref name="count"/> most-recent <see cref="LogCategory.Audit"/> entries
    /// for a specific actor. Used by the user activity tab on connection.
    /// </summary>
    public IReadOnlyList<LogEntry> GetRecentAudit(string userId, int count = 50)
    {
        var clamped = Math.Clamp(count, 1, HistoryCapacity);
        return _history
            .Where(e => e.Category == LogCategory.Audit && e.ActorUserId == userId)
            .TakeLast(clamped)
            .ToList();
    }
}
