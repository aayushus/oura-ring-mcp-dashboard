#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🔄 Restarting Oura MCP server..."
docker compose -f compose.yaml down
docker compose -f compose.yaml up -d --build

echo ""
echo "✅ Server restarted. MCP endpoint: http://localhost:${PORT:-3000}/mcp"
echo "                  Dashboard:    http://localhost:${PORT:-3000}/dashboard"
