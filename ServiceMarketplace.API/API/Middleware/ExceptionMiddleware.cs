using System.Net;
using System.Text.Json;
using ServiceMarketplace.API.Helpers;

namespace ServiceMarketplace.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        context.Response.ContentType = "application/problem+json";

        var (statusCode, title) = ex switch
        {
            KeyNotFoundException        => (HttpStatusCode.NotFound,             "Not Found"),
            ConflictException           => (HttpStatusCode.Conflict,             "Conflict"),
            UnauthorizedAccessException => (HttpStatusCode.Forbidden,            "Forbidden"),
            InvalidOperationException   => (HttpStatusCode.UnprocessableEntity,  "Unprocessable Entity"),
            ArgumentException           => (HttpStatusCode.BadRequest,           "Bad Request"),
            _                           => (HttpStatusCode.InternalServerError,  "Internal Server Error")
        };

        context.Response.StatusCode = (int)statusCode;

        var problem = new
        {
            type    = $"https://httpstatuses.com/{(int)statusCode}",
            title,
            status  = (int)statusCode,
            detail  = statusCode == HttpStatusCode.InternalServerError
                        ? "An unexpected error occurred."
                        : ex.Message,
            traceId = context.TraceIdentifier
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}

public static class ExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseExceptionMiddleware(this IApplicationBuilder app)
        => app.UseMiddleware<ExceptionMiddleware>();
}
