namespace ServiceMarketplace.API.Resilience;

public static class ResilienceKeys
{
    // Named HttpClient for the HuggingFace AI endpoint
    public const string HuggingFace = "HuggingFace";

    // Resilience pipeline for Redis cache operations
    public const string Redis = "Redis";
}
