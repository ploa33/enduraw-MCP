# enduraw-MCP

MCP server for [Enduraw](https://app.enduraw.co). Connects directly to Enduraw's official APIs to access your physiological Runner Matrix, Critical Speed, cardio efficiency, climbing/downhill biomechanics, official race database (329+ races), 3D course elevation profiles, aid station checkpoints, and training history from Claude Code, Claude Desktop, Cursor, Windsurf, Antigravity, or any MCP client.

24 tools across 7 categories:
- Profile and Runner Matrix (5 tools)
- Athlete Lab and Modeling (3 tools)
- Physiological Tests and Evaluations (5 tools)
- Activities and Deep In-Session Analysis (5 tools)
- Race Database, Elevation Profiles and Pacing Plans (4 tools)
- Form and Fatigue (1 tool)
- Notifications and Daily Alerts (1 tool)

---

## Requirements

- Node.js 20+
- An Enduraw account ([app.enduraw.co](https://app.enduraw.co)) with your session access token.

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

The server communicates over stdio using the Model Context Protocol.

---

## Authentication

To connect to Enduraw, you need your `ENDURAW_ACCESS_TOKEN` (JWT session token):

1. Log into your account on [app.enduraw.co](https://app.enduraw.co).
2. Open your browser Developer Tools (F12 or right-click > Inspect).
3. Go to the Application (Chrome/Brave/Edge) or Storage (Firefox) tab.
4. Under Cookies, select `https://app.enduraw.co`.
5. Find the cookie named `access_token` and copy its full value.
6. Paste it as the `ENDURAW_ACCESS_TOKEN` environment variable in your configuration.

---

## Available Tools (24 Tools)

### 1. Profile and Runner Matrix (5 tools)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_athlete_profile` | None | Athlete biometrics (weight, height, age), Strava connection status, and plan entitlements |
| `get_enduraw_matrix` | None | Complete Runner Matrix (global volume, key sessions, cohort percentiles, terrain stats) |
| `get_enduraw_matrix_summary` | None | Compact summary of Runner Matrix scores and key indicators |
| `get_enduraw_matrix_history` | None | Historical progression and chronological evolution of Runner Matrix scores |
| `get_enduraw_archive_status` | None | Status of the activity/FIT archive processing pipeline |

### 2. Athlete Lab and Modeling (3 tools)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_athlete_lab` | None | Complete synthesis of the 5 performance pillars, critical speed model, and cohort percentiles (tab=modeling) |
| `get_enduraw_pillar_deep_dive` | `pillar` (enum: endurance, resilience, uphill, downhill, physiology, all) | Granular deep dive into physiological pillars (climbing duration, downhill VDM, cardiac decoupling, resilience calendar) |
| `get_enduraw_performance_profile` | None | Critical Speed (Vc, D', benchmark times), radar scores (0-100 on 6 dimensions), and race format ratings |

### 3. Physiological Tests and Evaluations (5 tools)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_physio_tests` | None | Physiological evaluation hub: lab test catalogue (Flat, Incline, Lactate) and athlete's real computed benchmarks |
| `get_enduraw_cardio_efficiency` | `min_speed_kmh` (optional), `max_speed_kmh` (optional) | Cardiac cost of pace across 66 speed bands with median HR, Q25/Q75 dispersion, and post-effort recovery kinetics |
| `get_enduraw_slope_and_cadence` | None | Climbing/downhill biomechanics, VAM (m/h) and cadence (spm) broken down by gradient percentage (-25% to +25%) |
| `get_enduraw_cardio_zones` | None | Karvonen heart rate zones (Z1 to Z5), threshold BPMs, and total training hours/shares spent in each zone |
| `get_enduraw_records_progression` | `distance` (optional: 1k, 5k, 10k, 15k, semi, 30k, marathon) | Historical personal records and progression curves for benchmark distances with milestones |

### 4. Activities and Deep In-Session Analysis (5 tools)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_activities` | `limit` (default: 10), `period` (optional: 52w, all, 12w, 4w), `analyzed_only` (optional boolean) | Synced activities with weather conditions (temperature, wind), duration, distance, and analysis readiness |
| `get_enduraw_activity_analysis` | `activity_id` (number, required) | Deep session analysis: physiological storyline, quality score, heart rate zone distribution, and efficiency metrics |
| `get_enduraw_activities_stats` | None | Global activity volume statistics over 52 weeks or lifetime (total distance, observed vs estimated moving time, session count) |
| `get_enduraw_activities_map` | None | Complete GPS coordinates array of all activities for personal Heatmap mapping |
| `get_enduraw_analysis_quota` | None | Consult current monthly/annual deep-analysis quota and subscription level |

### 5. Race Database, Elevation Profiles and Pacing Plans (4 tools)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_pacing_plans` | None | Active and upcoming race pacing and nutrition plans, including available plan credits |
| `get_enduraw_races` | `query` (optional string) | Official race course database (329+ races: UTMB, CCC, Saintelyon, Diagonale des Fous, etc.) |
| `get_enduraw_race_course_profile` | `race_name` (string, required) | Full 3D elevation profile of an official race with D+, D-, min/max altitude, and aid stations count |
| `get_enduraw_race_gpx` | `race_name` (string, required) | Full GPX GeoJSON track and official checkpoints/aid stations with exact distances and cumulative elevation |

### 6. Form and Fatigue (1 tool)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_form_fatigue` | `days` (default: 180), `sport` (default: 'all') | Official Enduraw Form and Fatigue modeling (CTL, ATL, TSB curves) directly from `/auth/api/activities/form-fatigue/`. Returns official metrics or subscription requirement status (Starter tier) |

### 7. Notifications (1 tool)

| Tool | Parameters | Description |
|---|---|---|
| `get_enduraw_notifications` | `today` (optional YYYY-MM-DD) | Daily activity notifications, processing alerts, and training updates |

---

## Example Prompts

Here are examples of prompts you can use once connected:

- "What is my Critical Speed (Vc) and D' according to Enduraw, and what are my theoretical times on 5k and 10k?"
- "Analyze my cardiac cost between 10 km/h and 13.5 km/h. How many beats does each km/h cost me?"
- "Extract the full 3D course elevation profile and official checkpoints for the CCC."
- "Show me all 20 aid stations on the UTMB with their exact kilometer markers and cumulative elevation gain."
- "What is my climbing VAM profile on 10% vs 20% slopes, and at what gradient does my cadence drop?"
- "Show me my progression curve on the Half-Marathon and Marathon benchmark distances."
- "What is the breakdown of continuous climbs in my Athlete Lab (<5 min to 20+ min) and my downhill descent speed (VDM)?"

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

[MIT](LICENSE) (c) [ploa33](https://github.com/ploa33)
