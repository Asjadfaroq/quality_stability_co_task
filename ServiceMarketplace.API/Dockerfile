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

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

COPY --from=publish /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ServiceMarketplace.API.dll"]
