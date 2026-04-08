namespace ServiceMarketplace.API.Domain.Exceptions;

/// <summary>
/// Thrown when a Free-tier customer has reached the configured request cap.
/// Maps to 403 with <c>free_tier_limit</c> so clients can distinguish from permission denials.
/// </summary>
public sealed class FreeTierLimitExceededException : AppException
{
    public FreeTierLimitExceededException(int limit)
        : base(
            403,
            "free_tier_limit",
            $"You've reached the Free plan limit of {limit} service requests. Upgrade to Pro for unlimited requests.")
    {
    }
}
