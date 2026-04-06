#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/ServiceMarketplace.API" && pwd)"

# Kill any process already on the API ports
for PORT in 5132 7132; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null) && \
    echo "==> Killing process on port $PORT (PID $PID)..." && \
    kill -9 $PID 2>/dev/null || true
done

echo "==> Applying EF migrations..."
dotnet ef database update --project "$PROJECT_DIR"

echo "==> Starting API..."
dotnet run --project "$PROJECT_DIR"
