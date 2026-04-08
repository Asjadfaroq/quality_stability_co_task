#!/bin/bash
# run.sh — local development launcher
#
# What this script does:
#   1. Kills anything already bound to the API / frontend ports
#   2. Ensures the sql-marketplace SQL Server container is running (port 1433)
#   3. Ensures the Redis container is running
#   4. Applies any pending EF Core migrations
#   5. Starts the Vite dev server and the .NET API in parallel
#   6. Shuts everything down cleanly on Ctrl+C
#
# Prerequisites:
#   • Docker Desktop running
#   • dotnet SDK ≥ 10 installed
#   • npm installed (for the frontend)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$REPO_ROOT/ServiceMarketplace.API"
CLIENT_DIR="$REPO_ROOT/ServiceMarketplace.Client"

# ── 1. Free the ports ─────────────────────────────────────────────────────────

for PORT in 5132 7132 5173; do
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null) || true
  if [ -n "$PID" ]; then
    echo "==> Killing process on port $PORT (PID $PID)..."
    kill -9 "$PID" 2>/dev/null || true
  fi
done

# ── 2. Ensure SQL Server is running (sql-marketplace on port 1433) ─────────────
# Start the container if it is stopped; do nothing if already running.

SQL_CONTAINER="sql-marketplace"
SQL_STATE=$(docker inspect -f '{{.State.Status}}' "$SQL_CONTAINER" 2>/dev/null || echo "missing")

if [ "$SQL_STATE" = "running" ]; then
  echo "==> SQL Server ($SQL_CONTAINER) is already running."
else
  echo "==> Starting SQL Server container ($SQL_CONTAINER)..."
  docker start "$SQL_CONTAINER"

  echo "==> Waiting for SQL Server to accept connections..."
  ELAPSED=0
  until docker exec "$SQL_CONTAINER" /opt/mssql-tools/bin/sqlcmd \
        -S localhost -U sa -P 'Marketplace2026!' \
        -Q "SELECT 1" -h -1 &>/dev/null; do
    if [ "$ELAPSED" -ge 60 ]; then
      echo "ERROR: SQL Server did not become ready within 60 seconds." >&2
      exit 1
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
  done
  echo "==> SQL Server is ready."
fi

# ── 3. Ensure Redis is running ────────────────────────────────────────────────
# Using the cloud Redis instance configured in appsettings — no local container needed.
# If you want a local Redis instead, uncomment the block below.
#
# REDIS_CONTAINER="quality_stability_co_task-redis-1"
# REDIS_STATE=$(docker inspect -f '{{.State.Status}}' "$REDIS_CONTAINER" 2>/dev/null || echo "missing")
# if [ "$REDIS_STATE" != "running" ]; then
#   echo "==> Starting Redis..."
#   docker compose -f "$REPO_ROOT/docker-compose.yml" up -d redis
# else
#   echo "==> Redis is already running."
# fi

# ── 4. Apply EF Core migrations ───────────────────────────────────────────────
# ASPNETCORE_ENVIRONMENT=Development loads appsettings.Development.json which
# points to the sql-marketplace container on localhost:1433.

echo "==> Applying EF migrations..."
ASPNETCORE_ENVIRONMENT=Development \
  dotnet ef database update --project "$PROJECT_DIR"

# EF Core tools on macOS sometimes create a literal "bin\Debug" folder due to a
# Windows-style path bug in older tool versions. Clean it up.
rm -rf "$PROJECT_DIR/bin\\Debug" "$PROJECT_DIR/bin\\Release" 2>/dev/null || true

# ── 5. Start frontend + API ───────────────────────────────────────────────────

echo "==> Starting frontend (Vite)..."
cd "$CLIENT_DIR" && npm run dev &
FRONTEND_PID=$!

echo "==> Starting API (.NET)..."
ASPNETCORE_ENVIRONMENT=Development dotnet run --project "$PROJECT_DIR" &
API_PID=$!

echo ""
echo "  Frontend : http://localhost:5173"
echo "  API      : http://localhost:5132"
echo "  Swagger  : http://localhost:5132/swagger"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# ── 6. Graceful shutdown ──────────────────────────────────────────────────────

cleanup() {
  echo ""
  echo "==> Shutting down API and frontend..."
  kill "$FRONTEND_PID" "$API_PID" 2>/dev/null || true
  echo "==> Done. SQL Server and Redis containers are still running."
}

trap cleanup EXIT INT TERM
wait "$FRONTEND_PID" "$API_PID"
