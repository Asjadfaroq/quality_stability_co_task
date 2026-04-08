using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using ServiceMarketplace.API.Domain.Exceptions;

namespace ServiceMarketplace.API.Middleware;

/// <summary>
/// Global exception handler using the ASP.NET Core IExceptionHandler interface.
/// Maps both domain exceptions and common BCL exceptions to RFC 9457 ProblemDetails responses.
/// Logs client errors (4xx) as Warning and server errors (5xx) as Error with structured properties.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IProblemDetailsService _problemDetailsService;
    private readonly IHostEnvironment _environment;

    public GlobalExceptionHandler(
        ILogger<GlobalExceptionHandler> logger,
        IProblemDetailsService problemDetailsService,
        IHostEnvironment environment)
    {
        _logger               = logger;
        _problemDetailsService = problemDetailsService;
        _environment          = environment;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // Client disconnected — no response is meaningful
        if (exception is OperationCanceledException)
        {
            _logger.LogInformation(
                "Request cancelled by client — {Method} {Path}",
                httpContext.Request.Method,
                httpContext.Request.Path);

            httpContext.Response.StatusCode = 499;
            return true;
        }

        var (statusCode, title, errorCode) = MapException(exception);

        Log(exception, statusCode, httpContext);

        var problem = new ProblemDetails
        {
            Status   = statusCode,
            Title    = title,
            Detail   = IsServerError(statusCode) && !_environment.IsDevelopment()
                           ? "An unexpected error occurred. Please try again later."
                           : exception.Message,
            Instance = httpContext.Request.Path,
        };

        problem.Extensions["errorCode"] = errorCode;
        problem.Extensions["traceId"]   = httpContext.TraceIdentifier;

        // Expose stack trace only in Development for fast local debugging
        if (_environment.IsDevelopment() && IsServerError(statusCode))
            problem.Extensions["stackTrace"] = exception.StackTrace;

        httpContext.Response.StatusCode = statusCode;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext    = httpContext,
            ProblemDetails = problem,
            Exception      = exception,
        });
    }

    private void Log(Exception exception, int statusCode, HttpContext context)
    {
        if (IsServerError(statusCode))
        {
            _logger.LogError(
                exception,
                "Unhandled exception — {Method} {Path} responded {StatusCode} | TraceId: {TraceId}",
                context.Request.Method,
                context.Request.Path,
                statusCode,
                context.TraceIdentifier);
        }
        else
        {
            _logger.LogWarning(
                "Client error {StatusCode} — {Method} {Path}: {ExceptionMessage} | TraceId: {TraceId}",
                statusCode,
                context.Request.Method,
                context.Request.Path,
                exception.Message,
                context.TraceIdentifier);
        }
    }

    private static (int StatusCode, string Title, string ErrorCode) MapException(Exception exception)
        => exception switch
        {
            // Domain exceptions carry their own status code — always prefer these
            AppException app                        => (app.StatusCode, TitleForStatus(app.StatusCode), app.ErrorCode),

            // BCL fallbacks — kept for backward compatibility with existing service throws
            KeyNotFoundException                    => (404, "Not Found",             "NOT_FOUND"),
            UnauthorizedAccessException             => (403, "Forbidden",             "FORBIDDEN"),
            InvalidOperationException               => (422, "Unprocessable Entity",  "UNPROCESSABLE_ENTITY"),
            ArgumentNullException                   => (400, "Bad Request",           "BAD_REQUEST"),
            ArgumentOutOfRangeException             => (400, "Bad Request",           "BAD_REQUEST"),
            ArgumentException                       => (400, "Bad Request",           "BAD_REQUEST"),

            _                                       => (500, "Internal Server Error", "INTERNAL_ERROR"),
        };

    private static string TitleForStatus(int statusCode) => statusCode switch
    {
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        409 => "Conflict",
        422 => "Unprocessable Entity",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        _   => "An Error Occurred",
    };

    private static bool IsServerError(int statusCode) => statusCode >= 500;
}
