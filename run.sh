#!/bin/bash
# run.sh — local development launcher
#
# What this script does:
#   1. Kills anything already bound to the API / frontend ports
#   2. Ensures the pg-marketplace PostgreSQL container is running (port 5433)
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
  # -sTCP:LISTEN matters: without it lsof also reports processes that merely hold a
  # *client* connection to the port (VS Code, browsers). Those extra PIDs turned the
  # result into a multi-line string, which `kill` rejects as an illegal pid — so the
  # real listener survived and the port stayed busy.
  PIDS=$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null) || true
  if [ -n "$PIDS" ]; then
    echo "==> Killing listener(s) on port $PORT: $(echo "$PIDS" | tr '\n' ' ')"
    # Kill the parent shell/npm wrapper too, otherwise `npm run dev` respawns Vite.
    for PID in $PIDS; do
      PPID_OF=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
      kill -9 "$PID" 2>/dev/null || true
      if [ -n "${PPID_OF:-}" ] && ps -p "$PPID_OF" -o command= 2>/dev/null | grep -q "npm run dev"; then
        kill -9 "$PPID_OF" 2>/dev/null || true
      fi
    done

    # The port is not free the instant kill returns; wait for it to actually release
    # so the dev server does not race the teardown and fail on strictPort.
    ELAPSED=0
    while lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
      if [ "$ELAPSED" -ge 10 ]; then
        echo "ERROR: port $PORT is still in use after 10s." >&2
        exit 1
      fi
      sleep 1
      ELAPSED=$((ELAPSED + 1))
    done
  fi
done

# ── 2. Ensure PostgreSQL is running (pg-marketplace on port 5433) ──────────────
# Create the container on first run, start it if stopped, do nothing if running.

PG_CONTAINER="pg-marketplace"
PG_PASSWORD="Marketplace2026!"
PG_STATE=$(docker inspect -f '{{.State.Status}}' "$PG_CONTAINER" 2>/dev/null || echo "missing")

if [ "$PG_STATE" = "running" ]; then
  echo "==> PostgreSQL ($PG_CONTAINER) is already running."
else
  if [ "$PG_STATE" = "missing" ]; then
    echo "==> Creating PostgreSQL container ($PG_CONTAINER)..."
    docker run -d --name "$PG_CONTAINER" \
      -e POSTGRES_PASSWORD="$PG_PASSWORD" \
      -e POSTGRES_DB=ServiceMarketplaceDb \
      -p 5433:5432 \
      postgres:16
  else
    echo "==> Starting PostgreSQL container ($PG_CONTAINER)..."
    docker start "$PG_CONTAINER"
  fi

  echo "==> Waiting for PostgreSQL to accept connections..."
  ELAPSED=0
  until docker exec "$PG_CONTAINER" pg_isready -U postgres -d ServiceMarketplaceDb &>/dev/null; do
    if [ "$ELAPSED" -ge 60 ]; then
      echo "ERROR: PostgreSQL did not become ready within 60 seconds." >&2
      exit 1
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
  done
  echo "==> PostgreSQL is ready."
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
# points to the pg-marketplace container on localhost:5433.

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
  echo "==> Done. PostgreSQL and Redis containers are still running."
}

trap cleanup EXIT INT TERM
wait "$FRONTEND_PID" "$API_PID"
