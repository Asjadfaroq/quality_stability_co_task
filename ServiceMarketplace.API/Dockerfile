# ── Stage 1: Restore ─────────────────────────────────────────────────────────
# Copy only the project file first so Docker can cache the restore layer.
# dotnet restore only re-runs when ServiceMarketplace.API.csproj changes.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS restore
WORKDIR /src
COPY ServiceMarketplace.API.csproj .
RUN dotnet restore --locked-mode

# ── Stage 2: Publish ─────────────────────────────────────────────────────────
# Copy source after restore so code changes don't bust the package cache.
FROM restore AS publish
COPY . .
RUN dotnet publish ServiceMarketplace.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
# Use the minimal ASP.NET runtime image — no SDK, no build tools.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Non-root user for security. The Microsoft runtime images already ship a dedicated
# "app" user (uid 1654) exposed as $APP_UID — use it instead of creating one. The base
# image is Ubuntu 24.04 and does not include adduser/addgroup, so creating a user here
# fails the build outright.
COPY --from=publish /app/publish .
USER $APP_UID

# Honour the PORT injected by container platforms (Render, Cloud Run, Heroku) and fall
# back to 8080 locally. ENV cannot expand variables at runtime, so bind in the entrypoint.
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec dotnet ServiceMarketplace.API.dll --urls http://+:${PORT:-8080}"]
