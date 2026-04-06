using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Polly;
using Polly.Registry;
using ServiceMarketplace.API.Resilience;
using ServiceMarketplace.API.Services.Interfaces;

namespace ServiceMarketplace.API.Services;

public class CacheService : ICacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IDistributedCache _cache;
    private readonly ILogger<CacheService> _logger;
    private readonly ResiliencePipeline _pipeline;

    public CacheService(
        IDistributedCache cache,
        ILogger<CacheService> logger,
        ResiliencePipelineProvider<string> pipelineProvider)
    {
        _cache    = cache;
        _logger   = logger;
        _pipeline = pipelineProvider.GetPipeline(ResilienceKeys.Redis);
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            var bytes = await _pipeline.ExecuteAsync(
                async ct => await _cache.GetAsync(key, ct));

            if (bytes is null || bytes.Length == 0) return default;
            return JsonSerializer.Deserialize<T>(bytes, JsonOptions);
        }
        catch (Exception ex)
        {
            // Redis unavailability is non-fatal — treat as a cache miss and hit the DB
            _logger.LogWarning(ex, "Cache read failed for key {Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl)
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
            await _pipeline.ExecuteAsync(
                async ct => await _cache.SetAsync(key, bytes, new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = ttl
                }, ct));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache write failed for key {Key}", key);
        }
    }

    public async Task RemoveAsync(string key)
    {
        try
        {
            await _pipeline.ExecuteAsync(
                async ct => await _cache.RemoveAsync(key, ct));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache remove failed for key {Key}", key);
        }
    }
}
