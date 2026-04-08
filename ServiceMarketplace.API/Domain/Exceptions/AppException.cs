namespace ServiceMarketplace.API.Domain.Exceptions;

/// <summary>
/// Base class for all domain-level exceptions that should map to a specific HTTP status code.
/// </summary>
public abstract class AppException : Exception
{
    /// <summary>HTTP status code to return to the client.</summary>
    public int StatusCode { get; }

    /// <summary>Machine-readable error code included in the ProblemDetails response.</summary>
    public string ErrorCode { get; }

    protected AppException(int statusCode, string errorCode, string message)
        : base(message)
    {
        StatusCode = statusCode;
        ErrorCode  = errorCode;
    }
}
