# enduraw-MCP

MCP server for [Enduraw](https://app.enduraw.co). Access your physiological Runner Matrix, Critical Speed, cardio efficiency, climbing/downhill biomechanics, race pacing simulations, and training load (CTL/ATL/TSB) from Claude Code, Claude Desktop, Cursor, Windsurf, Antigravity, or any MCP client.

**25 tools across 7 categories**:
- 📊 **Profile & Runner Matrix** (5 tools)
- 🔬 **Athlete Lab & Modeling** (3 tools)
- 🧪 **Physiological Tests & Evaluations** (5 tools)
- 🏃 **Activities & Deep In-Session Analysis** (5 tools)
- ⏱️ **Pacing Plans, Race Database & Custom Simulations** (5 tools)
- 📈 **Fitness & Fatigue / Coggan Modeling** (1 tool)
- 🔔 **Notifications & Daily Alerts** (1 tool)

---

## Requirements

- **Node.js 20+**
- An **Enduraw account** ([app.enduraw.co](https://app.enduraw.co)) with your session access token.

---

## Installation

### Claude Code

```bash
claude mcp add enduraw -e ENDURAW_ACCESS_TOKEN=your_jwt_token -- npx -y github:ploa33/enduraw-MCP
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "enduraw": {
      "command": "npx",
      "args": ["-y", "github:ploa33/enduraw-MCP"],
      "env": {
        "ENDURAW_ACCESS_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root or Cursor MCP settings:

```json
{
  "mcpServers": {
    "enduraw": {
      "command": "npx",
      "args": ["-y", "github:ploa33/enduraw-MCP"],
      "env": {
        "ENDURAW_ACCESS_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "enduraw": {
      "command": "npx",
      "args": ["-y", "github:ploa33/enduraw-MCP"],
      "env": {
        "ENDURAW_ACCESS_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

### Antigravity

Add to `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "enduraw": {
      "command": "npx",
      "args": ["-y", "github:ploa33/enduraw-MCP"],
      "env": {
        "ENDURAW_ACCESS_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

### Any MCP Client

Run the server directly with your environment variable:

```bash
ENDURAW_ACCESS_TOKEN=your_jwt_token npx -y github:ploa33/enduraw-MCP
```

The server communicates over `stdio` using the [Model Context Protocol](https://modelcontextprotocol.io/).

---

## Authentication

To connect to Enduraw, you need your `ENDURAW_ACCESS_TOKEN` (JWT session token):

1. Log into your account on [app.enduraw.co](https://app.enduraw.co).
2. Open your browser Developer Tools (**F12** or right-click > **Inspect**).
3. Go to the **Application** (Chrome/Brave/Edge) or **Storage** (Firefox) tab.
4. Under **Cookies**, select `https://app.enduraw.co`.
5. Find the cookie named **`access_token`** and copy its full value.
6. Paste it as the `ENDURAW_ACCESS_TOKEN` environment variable in your configuration.

---

## Available Tools (25 Tools)

### 📊 1. Profile & Runner Matrix (5 tools)

| Tool | Description |
|---|---|
| `get_enduraw_athlete_profile` | Athlete biometrics (weight, height, age), Strava connection status, and plan entitlements |
| `get_enduraw_matrix` | Complete Runner Matrix (global volume, key sessions, cohort percentiles, terrain stats) |
| `get_enduraw_matrix_summary` | Compact summary of Runner Matrix scores and key indicators |
| `get_enduraw_matrix_history` | Historical progression and chronological evolution of Runner Matrix scores |
| `get_enduraw_archive_status` | Status of the activity/FIT archive processing pipeline |

### 🔬 2. Athlete Lab & Modeling (3 tools)

| Tool | Description |
|---|---|
| `get_enduraw_athlete_lab` | Complete synthesis of the 5 performance pillars, critical speed model, and cohort percentiles |
| `get_enduraw_pillar_deep_dive` | Granular deep dive into physiological pillars: `endurance`, `resilience`, `uphill`, `downhill`, or `physiology` |
| `get_enduraw_performance_profile` | Critical Speed ($V_c$, $D'$, benchmark times), radar scores (0-100 on 6 dimensions), and race format ratings |

### 🧪 3. Physiological Tests & Evaluations (5 tools)

| Tool | Description |
|---|---|
| `get_enduraw_physio_tests` | Physiological evaluation hub: lab test catalogue (Flat, Incline, Lactate) and athlete's real computed benchmarks |
| `get_enduraw_cardio_efficiency` | Cardiac cost of pace ("Que coûte votre allure en battements ?") across 66 speed bands with median HR, $Q_{25}/Q_{75}$ dispersion, and post-effort recovery kinetics |
| `get_enduraw_slope_and_cadence` | Climbing/downhill biomechanics, VAM (m/h) and cadence (spm) broken down by gradient percentage (-25% to +25%) |
| `get_enduraw_cardio_zones` | Karvonen heart rate zones (Z1 to Z5), threshold BPMs, and total training hours/shares spent in each zone |
| `get_enduraw_records_progression` | Historical personal records and progression curves for benchmark distances (1k, 5k, 10k, 15k, Semi, 30k, Marathon) |

### 🏃 4. Activities & Deep In-Session Analysis (5 tools)

| Tool | Description |
|---|---|
| `get_enduraw_activities` | Synced activities with weather conditions (temperature, wind), duration, distance, and analysis readiness |
| `get_enduraw_activity_analysis` | Deep session analysis: physiological storyline, quality score, heart rate zone distribution, and efficiency metrics |
| `get_enduraw_activities_stats` | Global activity volume statistics over 52 weeks or lifetime (total distance, observed vs estimated moving time, session count) |
| `get_enduraw_activities_map` | Complete GPS coordinates array of all activities for personal Heatmap mapping |
| `get_enduraw_analysis_quota` | Consult current monthly/annual deep-analysis quota and subscription level |

### ⏱️ 5. Pacing Plans, Race Database & Custom Simulations (5 tools)

| Tool | Description |
|---|---|
| `get_enduraw_pacing_plans` | Active and upcoming race pacing & nutrition plans, including available plan credits |
| `get_enduraw_races` | Official race course database (329+ races: UTMB, CCC, Saintélyon, Diagonale des Fous, etc.) |
| `get_enduraw_race_course_profile` | Full 3D elevation profile of an official race with D+, D-, min/max altitude, and aid stations count |
| `get_enduraw_race_gpx` | Full GPX GeoJSON track and official checkpoints/aid stations with exact distances and cumulative elevation |
| `simulate_enduraw_pacing_plan` | Scientific personalized pacing plan simulation segment-by-segment with gradient-adjusted paces (VAM uphill, descent speed, flat pace) and targeted carb/hydration intake |

### 📈 6. Fitness & Fatigue Modeling (1 tool)

| Tool | Description |
|---|---|
| `get_enduraw_form_fatigue` | Banister/Coggan impulse-response model: CTL (Fitness 42d), ATL (Fatigue 7d), TSB (Form), ACWR injury risk ratio, and pre-race tapering status |

### 🔔 7. Notifications (1 tool)

| Tool | Description |
|---|---|
| `get_enduraw_notifications` | Daily activity notifications, processing alerts, and training updates |

---

## Example Prompts

Here are examples of prompts you can use once connected:

- *"What is my Critical Speed ($V_c$) and $D'$ according to Enduraw, and what are my theoretical times on 5k and 10k?"*
- *"Analyze my cardiac cost between 10 km/h and 13.5 km/h. How many beats does each km/h cost me?"*
- *"What is my current CTL (fitness), ATL (fatigue), and TSB (freshness)? Am I in a good tapering window for this weekend?"*
- *"Simulate an optimal pacing plan for the CCC with an aggressive target, and show me the carb/hydration needs per hour."*
- *"What is my climbing VAM profile on 10% vs 20% slopes, and at what gradient does my cadence drop?"*
- *"Show me my progression curve on the Half-Marathon and Marathon benchmark distances."*

---

## Development

Clone and test locally:

```bash
git clone https://github.com/ploa33/enduraw-MCP.git
cd enduraw-MCP
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
# Edit .env with your ENDURAW_ACCESS_TOKEN
```

Run locally:

```bash
npm start
```

---

## License

[MIT](LICENSE) © [ploa33](https://github.com/ploa33)
