using System.Collections.Concurrent;
using System.Threading.Channels;

namespace ServiceMarketplace.API.Logging;

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

    public void Write(LogEntry entry)
    {
        _history.Enqueue(entry);

        while (_history.Count > HistoryCapacity)
            _history.TryDequeue(out _);

        _channel.Writer.TryWrite(entry);
    }

    /// <summary>Returns the most-recent entries across all categories. Used by the admin tab.</summary>
    public IReadOnlyList<LogEntry> GetRecent(int count = 100)
    {
        var clamped = Math.Clamp(count, 1, HistoryCapacity);
        return _history.TakeLast(clamped).ToList();
    }

    /// <summary>Returns recent audit entries for a specific actor. Used by ActivityHub on connect.</summary>
    public IReadOnlyList<LogEntry> GetRecentAudit(string userId, int count = 50)
    {
        var clamped = Math.Clamp(count, 1, HistoryCapacity);
        return _history
            .Where(e => e.Category == LogCategory.Audit && e.ActorUserId == userId)
            .TakeLast(clamped)
            .ToList();
    }
}
