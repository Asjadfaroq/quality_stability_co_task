using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using RedisRateLimiting;
using ServiceMarketplace.API.Data;
using ServiceMarketplace.API.Hubs;
using ServiceMarketplace.API.Middleware;
using ServiceMarketplace.API.Models.Config;
using ServiceMarketplace.API.Models.DTOs.Requests;
using ServiceMarketplace.API.Models.Entities;
using ServiceMarketplace.API.Resilience;
using ServiceMarketplace.API.Services;
using ServiceMarketplace.API.Services.Interfaces;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// 1. DbContext — SQL Server execution strategy retries transient failures (deadlocks,
//    connection drops, timeouts) automatically before surfacing an exception.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null)));

// 2. Identity
builder.Services.AddIdentity<User, IdentityRole<Guid>>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// 3. JWT Authentication
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"]!;

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSection["Issuer"],
        ValidAudience = jwtSection["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        NameClaimType = "userId",
        RoleClaimType = "role"
    };
    // Browsers can't set WebSocket headers, so SignalR passes the JWT as ?access_token=
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(token) &&
                context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                context.Token = token;
            return Task.CompletedTask;
        }
    };
});

// 4. Authorization
builder.Services.AddAuthorization();

// 5. Controllers + FluentValidation
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddScoped<IValidator<CreateRequestDto>, CreateRequestValidator>();

// 6. Swagger with JWT Bearer button
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Service Marketplace API",
        Version = "v1"
    });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        options.IncludeXmlComments(xmlPath);

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token. Example: Bearer eyJhbGci..."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// 7. CORS — must allow credentials for SignalR WebSocket
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// 8. SignalR
builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserIdProvider, UserIdProvider>();

// 9. Named HttpClient for HuggingFace AI with a resilience pipeline:
//    - Retries up to 3 times on 5xx / network failures with exponential backoff + jitter.
//    - 429 (HuggingFace rate limit) is NOT retried — the service falls back to mock instead.
//    - Per-attempt timeout: 20 s.  Overall timeout across all attempts: 45 s.
builder.Services.AddHttpClient(ResilienceKeys.HuggingFace)
    .AddResilienceHandler(ResilienceKeys.HuggingFace, pipeline =>
    {
        pipeline.AddTimeout(TimeSpan.FromSeconds(45));

        pipeline.AddRetry(new HttpRetryStrategyOptions
        {
            MaxRetryAttempts = 3,
            Delay            = TimeSpan.FromSeconds(2),
            BackoffType      = DelayBackoffType.Exponential,
            UseJitter        = true,
            ShouldHandle     = args => ValueTask.FromResult(
                args.Outcome.Exception is HttpRequestException ||
                (args.Outcome.Result is { } r && (int)r.StatusCode >= 500 && (int)r.StatusCode != 429))
        });

        pipeline.AddTimeout(TimeSpan.FromSeconds(20));
    });

// 10. Redis — one shared IConnectionMultiplexer for both distributed cache and rate limiting.
//     AbortOnConnectFail=false lets the app start even when Redis is temporarily unavailable;
//     the multiplexer retries in the background.
var redisConnection = builder.Configuration.GetConnectionString("Redis");
var redisAvailable  = !string.IsNullOrEmpty(redisConnection);

if (redisAvailable)
{
    var configOptions = ConfigurationOptions.Parse(redisConnection!);
    configOptions.AbortOnConnectFail = false;
    var multiplexer = ConnectionMultiplexer.Connect(configOptions);

    builder.Services.AddSingleton<IConnectionMultiplexer>(multiplexer);

    // Share the same connection for distributed cache (used by CacheService / PermissionService)
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.ConnectionMultiplexerFactory = () => Task.FromResult((IConnectionMultiplexer)multiplexer);
        options.InstanceName = "sm:cache:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

// 11. Redis resilience pipeline used by CacheService:
//     - Retries up to 2 times on transient Redis connection/timeout errors with
//       exponential backoff + jitter (100 ms → 200 ms).
//     - Circuit breaker opens after 50 % failures over 30 s (min 5 calls) and
//       stays open for 15 s, preventing a Redis outage from hammering every request.
//     - After all retries fail the existing CacheService try/catch treats it as a
//       cache miss — the app keeps running without cache.
builder.Services.AddResiliencePipeline(ResilienceKeys.Redis, pipeline =>
{
    pipeline.AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 2,
        Delay            = TimeSpan.FromMilliseconds(100),
        BackoffType      = DelayBackoffType.Exponential,
        UseJitter        = true,
        ShouldHandle     = new PredicateBuilder()
            .Handle<RedisConnectionException>()
            .Handle<RedisTimeoutException>()
            .Handle<TimeoutException>()
    });

    pipeline.AddCircuitBreaker(new CircuitBreakerStrategyOptions
    {
        SamplingDuration  = TimeSpan.FromSeconds(30),
        FailureRatio      = 0.5,
        MinimumThroughput = 5,
        BreakDuration     = TimeSpan.FromSeconds(15),
        ShouldHandle      = new PredicateBuilder()
            .Handle<RedisConnectionException>()
            .Handle<RedisTimeoutException>()
    });
});

// 13. Rate limiting
//     Redis policies use keys prefixed "sm:rl:{policy}:{partitionKey}" — kept separate from cache keys.
//     In-memory policies are the fallback when Redis is not configured.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";

        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfterValue)
            ? (int)retryAfterValue.TotalSeconds
            : 60;

        context.HttpContext.Response.Headers["Retry-After"] = retryAfter.ToString();

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type             = "https://httpstatuses.com/429",
            title            = "Too Many Requests",
            status           = 429,
            detail           = "You have exceeded the rate limit. Please try again later.",
            retryAfterSeconds = retryAfter
        }, token);
    };

    if (redisAvailable)
    {
        // Login & Register — fixed window per IP, 10 requests per 15 minutes
        options.AddPolicy(RateLimitPolicies.Auth, httpContext =>
        {
            var mux = httpContext.RequestServices.GetRequiredService<IConnectionMultiplexer>();
            var ip  = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return RedisRateLimitPartition.GetFixedWindowRateLimiter(
                partitionKey: $"sm:rl:auth:{ip}",
                factory: _ => new RedisFixedWindowRateLimiterOptions
                {
                    PermitLimit               = 10,
                    Window                    = TimeSpan.FromMinutes(15),
                    ConnectionMultiplexerFactory = () => mux
                });
        });

        // AI enhancement — fixed window per user, 20 requests per hour
        options.AddPolicy(RateLimitPolicies.Ai, httpContext =>
        {
            var mux = httpContext.RequestServices.GetRequiredService<IConnectionMultiplexer>();
            var key = httpContext.User.FindFirst("userId")?.Value
                      ?? httpContext.Connection.RemoteIpAddress?.ToString()
                      ?? "unknown";
            return RedisRateLimitPartition.GetFixedWindowRateLimiter(
                partitionKey: $"sm:rl:ai:{key}",
                factory: _ => new RedisFixedWindowRateLimiterOptions
                {
                    PermitLimit               = 20,
                    Window                    = TimeSpan.FromHours(1),
                    ConnectionMultiplexerFactory = () => mux
                });
        });

        // Geo search — sliding window per user, 60 requests per minute
        options.AddPolicy(RateLimitPolicies.Nearby, httpContext =>
        {
            var mux = httpContext.RequestServices.GetRequiredService<IConnectionMultiplexer>();
            var key = httpContext.User.FindFirst("userId")?.Value
                      ?? httpContext.Connection.RemoteIpAddress?.ToString()
                      ?? "unknown";
            return RedisRateLimitPartition.GetSlidingWindowRateLimiter(
                partitionKey: $"sm:rl:nearby:{key}",
                factory: _ => new RedisSlidingWindowRateLimiterOptions
                {
                    PermitLimit               = 60,
                    Window                    = TimeSpan.FromMinutes(1),
                    ConnectionMultiplexerFactory = () => mux
                });
        });

        // Mutation endpoints — token bucket per user, allows short bursts
        options.AddPolicy(RateLimitPolicies.Writes, httpContext =>
        {
            var mux = httpContext.RequestServices.GetRequiredService<IConnectionMultiplexer>();
            var key = httpContext.User.FindFirst("userId")?.Value
                      ?? httpContext.Connection.RemoteIpAddress?.ToString()
                      ?? "unknown";
            return RedisRateLimitPartition.GetTokenBucketRateLimiter(
                partitionKey: $"sm:rl:writes:{key}",
                factory: _ => new RedisTokenBucketRateLimiterOptions
                {
                    TokenLimit               = 20,
                    ReplenishmentPeriod      = TimeSpan.FromSeconds(30),
                    TokensPerPeriod          = 5,
                    ConnectionMultiplexerFactory = () => mux
                });
        });
    }
    else
    {
        // In-memory fallback — single instance only, used when Redis is not configured
        options.AddPolicy(RateLimitPolicies.Auth, httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit           = 10,
                    Window                = TimeSpan.FromMinutes(15),
                    QueueProcessingOrder  = QueueProcessingOrder.OldestFirst,
                    QueueLimit            = 0
                }));

        options.AddPolicy(RateLimitPolicies.Ai, httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.User.FindFirst("userId")?.Value
                              ?? httpContext.Connection.RemoteIpAddress?.ToString()
                              ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit           = 20,
                    Window                = TimeSpan.FromHours(1),
                    QueueProcessingOrder  = QueueProcessingOrder.OldestFirst,
                    QueueLimit            = 0
                }));

        options.AddPolicy(RateLimitPolicies.Nearby, httpContext =>
            RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: httpContext.User.FindFirst("userId")?.Value
                              ?? httpContext.Connection.RemoteIpAddress?.ToString()
                              ?? "unknown",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit           = 60,
                    Window                = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow     = 6,
                    QueueProcessingOrder  = QueueProcessingOrder.OldestFirst,
                    QueueLimit            = 0
                }));

        options.AddPolicy(RateLimitPolicies.Writes, httpContext =>
            RateLimitPartition.GetTokenBucketLimiter(
                partitionKey: httpContext.User.FindFirst("userId")?.Value
                              ?? httpContext.Connection.RemoteIpAddress?.ToString()
                              ?? "unknown",
                factory: _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit            = 20,
                    ReplenishmentPeriod   = TimeSpan.FromSeconds(30),
                    TokensPerPeriod       = 5,
                    AutoReplenishment     = true,
                    QueueProcessingOrder  = QueueProcessingOrder.OldestFirst,
                    QueueLimit            = 0
                }));
    }
});

// Register services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IOrgService, OrgService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IRequestService, RequestService>();
builder.Services.AddScoped<IAiService, AiService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddSingleton<ICacheService, CacheService>();

// Stripe
builder.Services.Configure<StripeSettings>(builder.Configuration.GetSection("Stripe"));
builder.Services.AddScoped<IStripeService, StripeService>();

var app = builder.Build();

// Auto-apply migrations on startup (used in Docker)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Enable request body buffering for the Stripe webhook endpoint.
// Stripe signature verification requires the raw unmodified body, which ASP.NET Core
// normally consumes before it reaches the controller. EnableBuffering() allows re-reading.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/billing/webhook"))
        context.Request.EnableBuffering();
    await next();
});

// Exception middleware — must be first
app.UseExceptionMiddleware();

app.UseSwagger();
app.UseSwaggerUI();

if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.MapControllers();

app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
