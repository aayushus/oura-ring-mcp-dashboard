#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🚀 Starting Oura MCP server..."
docker compose -f compose.yaml up -d --build

echo ""
echo "✅ Server is up. MCP endpoint: http://localhost:${PORT:-3000}/mcp"
echo "   Health check:               http://localhost:${PORT:-3000}/health"
echo "   Dashboard:                  http://localhost:${PORT:-3000}/dashboard"
echo ""
echo "   Logs: ./logs.sh  |  Stop: ./stop.sh  |  Restart: ./restart.sh"
