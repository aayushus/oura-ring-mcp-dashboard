# Oura MCP Server

[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![CI](https://github.com/mitchhankins01/oura-ring-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/mitchhankins01/oura-ring-mcp/actions/workflows/ci.yml)

An MCP server that connects your Oura Ring to Claude and other AI assistants. Get human-readable insights about your sleep, readiness, and activity — not just raw JSON.

> **Fork of [mitchhankins01/oura-ring-mcp](https://github.com/mitchhankins01/oura-ring-mcp)** — updated for self-hosted Docker deployments and the latest Oura API (v1.35).

---

## Features

- **Smart formatting** — Durations in hours/minutes, scores with context ("85 - Optimal")
- **Sleep analysis** — Sleep stages, efficiency, HRV, and biometrics
- **Readiness tracking** — Recovery scores and contributor breakdown
- **Activity data** — Steps, calories, and intensity breakdown
- **Health metrics** — Heart rate, SpO2, stress, cardiovascular age
- **Smart analysis** — Anomaly detection, correlations, trend analysis
- **Tags support** — Compare metrics with/without conditions

[See example outputs](docs/outputs/EXAMPLES.md)

---

## Quick Start (Docker)

Choose one of the following two deployment methods:

### Method 1: Run Pre-built Image (Fastest, No Source Code Needed)

You do not need to clone the repository. Simply create a directory, write a `.env` file, and run the container directly from the GitHub Container Registry:

1. Create a directory and step into it:
   ```bash
   mkdir oura-dashboard && cd oura-dashboard
   ```
2. Create a `.env` file:
   ```env
   OURA_CLIENT_ID=your_client_id_here
   OURA_CLIENT_SECRET=your_client_secret_here
   PORT=3000
   ```
3. Create a `compose.yaml` file:
   ```yaml
   services:
     db:
       image: postgres:16-alpine
       container_name: oura-db
       restart: unless-stopped
       environment:
         - POSTGRES_USER=postgres
         - POSTGRES_PASSWORD=postgres
         - POSTGRES_DB=oura_health
       volumes:
         - ./db:/var/lib/postgresql/data
       ports:
         - "5432:5432"
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U postgres -d oura_health"]
         interval: 10s
         timeout: 5s
         retries: 5

     oura-mcp:
       image: ghcr.io/aayushus/oura-ring-mcp-dashboard:latest
       container_name: oura-mcp
       restart: unless-stopped
       ports:
         - "3000:3000"
       depends_on:
         db:
           condition: service_healthy
       environment:
         - NODE_ENV=production
         - OURA_CLIENT_ID=${OURA_CLIENT_ID}
         - OURA_CLIENT_SECRET=${OURA_CLIENT_SECRET}
         - PORT=3000
         - DATABASE_URL=postgresql://postgres:postgres@db:5432/oura_health
       volumes:
         - ./oura_credentials:/root/.oura-mcp
   ```
4. Start the stack:
   ```bash
   docker compose up -d
   ```

---

### Method 2: Build & Run from Source Code (Local Development)

Use this method if you want to modify the source code or build the image locally:

1. Clone the repository and navigate into it:
   ```bash
   git clone https://github.com/aayushus/oura-ring-mcp-dashboard.git
   cd oura-ring-mcp-dashboard
   ```
2. Copy the example configuration:
   ```bash
   cp .env.example .env
   ```
   Fill in your OAuth credentials (see [Authentication](#authentication) below).
3. Start the dashboard stack:
   ```bash
   ./start.sh
   ```

You can control the local stack using these helper scripts:
```bash
./stop.sh      # Stop the containers
./restart.sh   # Rebuild and restart the stack
```

---

### Accessing the Dashboard & API
Once running, the stack is available at:
- **Dashboard UI**: `http://localhost:3000/dashboard`
- **MCP Endpoint**: `http://localhost:3000/mcp`
- **Health Check**: `http://localhost:3000/health`

---

## Authentication

> ⚠️ **Personal Access Tokens (PATs) were deprecated by Oura in December 2025 and are no longer available.** OAuth2 is now the only supported authentication method.

### Setting up OAuth2

**Step 1 — Create an Oura OAuth application**

1. Go to **[developer.ouraring.com/applications](https://developer.ouraring.com/applications)**
2. Click **"Create New Application"**
3. Fill in the following:
   - **Name**: anything you like (e.g. `My MCP Server`)
   - **Redirect URI**: `http://localhost:3000/oauth/callback`
4. Hit save — you'll receive a **Client ID** and **Client Secret**

**Step 2 — Add credentials to your `.env`**

```env
OURA_CLIENT_ID=your_client_id_here
OURA_CLIENT_SECRET=your_client_secret_here
```

**Step 3 — Run the auth flow (first time only)**

Start the server, then run the one-time OAuth authorization:

```bash
./start.sh
docker compose run --rm oura-mcp node dist/index.js auth
```

This opens a browser window where you authorize access to your Oura data. Credentials are saved to a persistent Docker volume and automatically refreshed — you only need to do this once.

---

## Connecting to Claude

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oura": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

On macOS, the config file is at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

Restart Claude Desktop after saving.

### Claude.ai (remote deployment)

If you've deployed remotely (e.g. Railway), use the public URL:

```json
{
  "mcpServers": {
    "oura": {
      "url": "https://your-app.railway.app/mcp"
    }
  }
}
```

---

## What Can I Ask?

**Daily check-ins:**
- "How did I sleep last night?"
- "Am I recovered enough to work out today?"
- "What's my body telling me right now?"

**Patterns & trends:**
- "Do I sleep better on weekends?"
- "What time should I go to bed for optimal sleep?"
- "Is my HRV improving or declining?"

**Correlations & insights:**
- "Does alcohol affect my sleep quality?"
- "What predicts my best sleep nights?"
- "How does exercise timing affect my recovery?"

**Comparisons:**
- "Compare my sleep this week vs last week"
- "How do I sleep after meditation vs without?"
- "What changed when I started taking magnesium?"

**Anomalies:**
- "Are there any unusual readings in my data?"
- "Why was my readiness so low yesterday?"
- "Find days where my metrics were off"

---

## Available Tools

### Data Retrieval

| Tool | Description |
|------|-------------|
| `get_sleep` | Sleep data with stages, efficiency, HR, HRV |
| `get_daily_sleep` | Daily sleep scores with contributors |
| `get_readiness` | Readiness scores and recovery metrics |
| `get_activity` | Steps, calories, intensity breakdown |
| `get_workouts` | Workout sessions with type and intensity |
| `get_sessions` | Meditation and relaxation sessions |
| `get_heart_rate` | HR readings throughout the day |
| `get_stress` | Stress levels and recovery time |
| `get_spo2` | Blood oxygen and breathing disturbance |
| `get_tags` | User-created tags and notes |

### Smart Analysis

| Tool | Description |
|------|-------------|
| `detect_anomalies` | Find unusual readings using outlier detection |
| `analyze_sleep_quality` | Sleep analysis with trends, patterns, debt |
| `correlate_metrics` | Find correlations between health metrics |
| `compare_periods` | Compare this week vs last week |
| `compare_conditions` | Compare metrics with/without a tag |
| `best_sleep_conditions` | What predicts your good vs poor sleep |
| `analyze_hrv_trend` | HRV trend with rolling averages |

## Resources

| Resource | Description |
|----------|-------------|
| `oura://today` | Today's health summary |
| `oura://weekly-summary` | Last 7 days with averages |
| `oura://baseline` | Your 30-day averages and normal ranges |
| `oura://monthly-insights` | 30-day analysis with trends and anomalies |
| `oura://tag-summary` | Your tags and usage frequency |

## Prompts

| Prompt | Description |
|--------|-------------|
| `weekly-review` | Comprehensive weekly health review |
| `sleep-optimization` | Identify what leads to your best sleep |
| `recovery-check` | Should you train hard or rest today? |
| `compare-weeks` | This week vs last week comparison |
| `tag-analysis` | How a specific tag affects your health |

---

## Remote Deployment (Railway)

Deploy for remote access. Users authenticate directly with their own Oura account via OAuth.

**1. Create an Oura OAuth app** at [developer.ouraring.com/applications](https://developer.ouraring.com/applications) with redirect URI: `https://your-app.railway.app/oauth/callback`

**2. Deploy:**

```bash
npm install -g @railway/cli
railway login && railway init && railway up
```

**3. Set environment variables in Railway dashboard:**

| Variable | Description |
|----------|-------------|
| `OURA_CLIENT_ID` | From your Oura OAuth app |
| `OURA_CLIENT_SECRET` | From your Oura OAuth app |
| `NODE_ENV` | `production` |
| `MCP_SECRET` | *(Optional)* Static bearer token — `openssl rand -base64 32` |

Railway automatically sets `PORT` and `RAILWAY_PUBLIC_DOMAIN`.

**4. Connect from Claude.ai:**

1. Go to Settings → MCP Connectors → Add
2. Enter your server URL: `https://your-app.railway.app`
3. Authorize via Oura when prompted

---

## Contributing

See [CLAUDE.md](CLAUDE.md) for architecture details and development guidelines.

## Credits

Based on the excellent work of [mitchhankins01/oura-ring-mcp](https://github.com/mitchhankins01/oura-ring-mcp).

## License

MIT
