namespace ServiceMarketplace.API.Middleware;

public static class RateLimitPolicies
{
    public const string Auth   = "auth";
    public const string Ai     = "ai";
    public const string Nearby = "nearby";
    public const string Writes = "writes";
}
