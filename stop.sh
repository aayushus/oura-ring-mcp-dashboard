#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Stopping Oura MCP server..."
docker compose -f compose.yaml down

echo "✅ Server stopped."
