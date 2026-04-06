#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/ServiceMarketplace.API" && pwd)"
CLIENT_DIR="$(cd "$(dirname "$0")/service-marketplace-client" && pwd)"

# Kill any process already on the API or frontend ports
for PORT in 5132 7132 5173; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null) && \
    echo "==> Killing process on port $PORT (PID $PID)..." && \
    kill -9 $PID 2>/dev/null || true
done

echo "==> Applying EF migrations..."
dotnet ef database update --project "$PROJECT_DIR"

# EF Core tools on macOS create a literal "bin\Debug" folder (Windows-style path bug)
# Clean it up so it never appears in git status
rm -rf "$PROJECT_DIR/bin\\Debug" "$PROJECT_DIR/bin\\Release" 2>/dev/null || true

echo "==> Starting frontend..."
cd "$CLIENT_DIR" && npm run dev &
FRONTEND_PID=$!

echo "==> Starting API..."
dotnet run --project "$PROJECT_DIR" &
API_PID=$!

# Wait for both and forward Ctrl+C to both processes
trap "echo '==> Shutting down...'; kill $FRONTEND_PID $API_PID 2>/dev/null" EXIT INT TERM
wait $FRONTEND_PID $API_PID
