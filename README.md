# Oura Ring MCP Server & Health Dashboard

[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![Docker Build & Publish to GHCR](https://github.com/aayushus/oura-ring-mcp-dashboard/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/aayushus/oura-ring-mcp-dashboard/actions/workflows/docker-publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org)

An all-in-one personal health dashboard and Model Context Protocol (MCP) server that connects your Oura Ring data to local web charts and AI assistants like Claude and Cursor. Get interactive visual tracking, self-experiments, weekly narrative reports, and automated lifetime historical syncing — stored locally in PostgreSQL forever.

> **Fork of [mitchhankins01/oura-ring-mcp](https://github.com/mitchhankins01/oura-ring-mcp)** — extended with a multi-tenant React dashboard UI, local PostgreSQL persistence, automated lifetime historical syncing, and pre-built GHCR Docker images.

---

## ✨ Key Features

### 📊 Health Dashboard UI
- **Interactive Web Interface** — Responsive charts, dark/light theme, and contributor score breakdowns for Sleep, Readiness, and Activity.
- **Unified Day-Strip** — Stack sleep stages, overnight heart rate (HR/HRV), daytime movement, workouts, and tags on a shared 24h timeline.
- **Year-View Heatmaps** — GitHub-contribution-style calendar grids showing sleep and recovery seasonality across the entire year.
- **Fuzzy Command Palette (`⌘K`)** — Navigate tabs, jump to dates (e.g. `yesterday`, `last monday`), export data, and execute actions instantly.
- **Tabbed Settings Hub** — Dedicated management for User Profile, Oura Connection, MCP & AI Keys, Administration, and Data Export.

### 🤖 AI-Powered Health Assistance
- **Claude & Cursor Integration** — 27 specialized MCP tools spanning Sleep, Readiness, Activity, Vitals, Tags, and Smart Correlation Analysis.
- **Self-Experiments (N-of-1 Lab)** — Pre-register hypotheses (e.g., *"Magnesium before bed"*) and track statistical performance with Cohen's $d$ effect sizes.
- **Weekly Narrative Reports** — Auto-generated health review summaries with print-optimized A4 stylesheets (`?report=weekly`).
- **Anomaly Detection** — Automatically flags anomalies ($z$-score $|z| \geq 2$) and period min/max peaks on trend charts.

### 💾 Local Database & Sync
- **PostgreSQL Persistence** — Persists raw API responses and history records locally forever.
- **Lifetime Historical Backfill (From Day 1)** — Auto-paginated cursor streams pull your complete data history since ring activation.
- **Background Cron Scheduler** — Automatically syncs new ring data every 4 hours.
- **Multi-Tenant User Scoping** — Secure password authentication, role-based access, and per-user MCP API key tokens.

---

## 🚀 Quick Start (Docker)

You can launch the entire stack with Docker in under 60 seconds without manually writing tokens to config files:

### 1. Clone or Download Docker Compose

```bash
git clone https://github.com/aayushus/oura-ring-mcp-dashboard.git
cd oura-ring-mcp-dashboard
```

### 2. Start the Stack

```bash
docker compose up -d
```

### 3. Open the Dashboard

Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser:
1. **Create your account** (first user is automatically assigned Admin role).
2. Go to **Settings → 💍 Oura Connection**.
3. Link your Oura Ring using either:
   - **Personal Access Token (1-Click)**: Generate a token from [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens) and paste it.
   - **OAuth 2.0 App**: Connect via official Oura Cloud OAuth popup.
4. Click **"⚡ Sync All Biometrics (From Day 1)"** to download your complete history.

---

## 🤖 Connecting to Claude Desktop & Cursor

Once your Oura Ring is connected in the dashboard, create an MCP API key to connect your AI assistant:

### Step 1: Generate an MCP Key
1. Go to **Settings → 🤖 MCP & AI Keys** in the web dashboard.
2. Click **Generate New Key** and copy your token (e.g. `halo_...`).

### Step 2: Configure Claude Desktop
Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oura": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_GENERATED_HALO_KEY"
      }
    }
  }
}
```

*File Locations:*
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop, and all 27 Oura tools will be available directly in your chat!

---

## 🛠️ MCP Tool Suite (27 Tools)

The server exposes 27 modular tools organized into domain areas:

### 🌙 Sleep Domain
| Tool | Description |
|------|-------------|
| `get_sleep` | Detailed sleep sessions with hypnogram stages, efficiency, HR, and HRV |
| `get_daily_sleep` | Daily sleep scores and contributor breakdowns |
| `get_sleep_time` | Recommended bedtime and optimal sleep window recommendations |
| `analyze_sleep_quality` | Multi-day sleep quality analysis with trend metrics and sleep debt |
| `analyze_hrv_trend` | Rolling HRV trends, baseline deviations, and recovery trajectory |
| `best_sleep_conditions` | Statistical correlation identifying your optimal sleep conditions |

### ⚡ Readiness & Recovery
| Tool | Description |
|------|-------------|
| `get_readiness` | Daily readiness score and overnight recovery metrics |
| `get_resilience` | Long-term stress resilience score and recovery capacity |

### 🏃 Activity & Workouts
| Tool | Description |
|------|-------------|
| `get_activity` | Daily activity scores, step counts, active calories, and inactive alerts |
| `get_workouts` | Logged workout sessions with calorie burn, heart rate, and intensity |
| `get_sessions` | Guided and unguided meditation, relaxation, and rest sessions |
| `analyze_adherence` | Consistency tracking against daily step and activity goals |

### ❤️ Health & Vitals
| Tool | Description |
|------|-------------|
| `get_heart_rate` | Continuous 5-minute daytime and overnight heart rate readings |
| `get_stress` | Daily daytime stress, high stress duration, and recovery periods |
| `get_spo2` | Blood oxygen saturation averages and breathing disturbance index |
| `get_vo2_max` | Cardio fitness level estimate ($VO_2$ max) |
| `get_cardiovascular_age` | Vascular age assessment compared to biological age |
| `analyze_temperature` | Skin temperature trend analysis and illness onset detection |

### 🔬 Smart Analysis & Experiments
| Tool | Description |
|------|-------------|
| `detect_anomalies` | Statistical outlier detection across biometrics ($|z| \geq 2$) |
| `correlate_metrics` | Pearson correlation between any two physiological metrics |
| `compare_periods` | Side-by-side comparative analysis between two date ranges |
| `compare_conditions` | Difference analysis comparing days with vs without a specific tag |

### 🏷️ Tags & Annotations
| Tool | Description |
|------|-------------|
| `get_tags` | User-created tags and contextual event annotations |
| `get_enhanced_tags` | Rich tags with custom start/end timestamps and comments |

### 💍 Device & Profile
| Tool | Description |
|------|-------------|
| `get_ring_info` | Ring hardware generation, firmware version, and battery status |
| `get_rest_mode` | Active and historical Rest Mode recovery periods |
| `get_personal_info` | Oura account profile demographics (age, weight, height) |

---

## ⚙️ Environment Variables (Optional)

Configure runtime options in `.env` if needed (see [.env.example](.env.example)):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port for dashboard and MCP endpoint |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string (falls back to SQLite) |
| `JWT_SECRET` | *(Random)* | Secret key used to sign session cookies |
| `OURA_CLIENT_ID` | *(None)* | Global OAuth Client ID (or set in UI Settings) |
| `OURA_CLIENT_SECRET` | *(None)* | Global OAuth Client Secret (or set in UI Settings) |
| `SMTP_HOST` | *(None)* | SMTP server for morning email digest |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | *(None)* | SMTP username |
| `SMTP_PASS` | *(None)* | SMTP password |

---

## 💻 Development & Testing

```bash
# Install dependencies
pnpm install

# Run unit & integration test suite (383 tests)
npm test

# Build frontend and backend
npm run build

# Start in development mode
npm run dev
```

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

Based on the original MCP server by [mitchhankins01](https://github.com/mitchhankins01/oura-ring-mcp).
