#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const BASE_URL = "https://app.enduraw.co";
const token = process.env.ENDURAW_ACCESS_TOKEN;

if (!token) {
  console.error("Warning: ENDURAW_ACCESS_TOKEN is not set in environment or .env file.");
}

async function fetchEnduraw(endpoint, options = {}) {
  const currentToken = process.env.ENDURAW_ACCESS_TOKEN || token;
  if (!currentToken) {
    throw new Error("Missing ENDURAW_ACCESS_TOKEN. Please set it in your .env or environment.");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = {
    "Cookie": `access_token=${currentToken}`,
    "Authorization": `Bearer ${currentToken}`,
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MCP-Enduraw/1.2",
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 404) {
    const text = await response.text();
    let errJson;
    try { errJson = JSON.parse(text); } catch {}
    return {
      status: 404,
      notFound: true,
      error: errJson?.error || errJson?.detail || "Resource not found on Enduraw"
    };
  }

  if (response.status === 402) {
    const text = await response.text();
    let errJson;
    try { errJson = JSON.parse(text); } catch {}
    return {
      status: 402,
      quotaExceeded: true,
      error: errJson?.error || "Quota d'analyses atteint sur le plan actuel",
      detail: errJson
    };
  }

  if (response.status === 403) {
    const text = await response.text();
    let errJson;
    try { errJson = JSON.parse(text); } catch {}
    return {
      status: 403,
      forbidden: true,
      error: errJson?.detail?.error || "Feature locked or forbidden on current plan",
      detail: errJson?.detail
    };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Enduraw API error HTTP ${response.status}: ${text}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

// Memory cache for matrix to avoid re-fetching 250KB payload on consecutive tool calls
let cachedMatrix = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function getMatrixData() {
  const now = Date.now();
  if (cachedMatrix && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedMatrix;
  }
  const data = await fetchEnduraw("/auth/api/runner-matrix/");
  if (data && !data.notFound && !data.forbidden) {
    cachedMatrix = data;
    cacheTimestamp = now;
  }
  return data;
}

const server = new McpServer({
  name: "enduraw-mcp",
  version: "1.2.0"
});

// Tool 1: get_enduraw_athlete_profile
server.tool(
  "get_enduraw_athlete_profile",
  "Retrieves the Enduraw athlete profile, settings, biometrics (height, weight, age) and account plan/entitlements.",
  {},
  async () => {
    try {
      const sessionData = await fetchEnduraw("/auth/api/session");
      const user = sessionData?.user || {};
      let settings = null;
      if (user.email) {
        settings = await fetchEnduraw(`/auth/api/settings/?email=${encodeURIComponent(user.email)}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              athlete: {
                id: user.id,
                name: user.name,
                email: user.email,
                strava_connected: user.userStravaConnected,
                strava_id: user.stravaId,
                age: settings?.age || user.age,
                gender: settings?.gender,
                size_cm: settings?.size,
                weight_kg: settings?.weight,
                birthdate: settings?.birthdate
              },
              entitlements: user.entitlements || {}
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching Enduraw profile: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 2: get_enduraw_archive_status
server.tool(
  "get_enduraw_archive_status",
  "Checks the processing status of the athlete's uploaded activity archive / FIT history on Enduraw.",
  {},
  async () => {
    try {
      const data = await fetchEnduraw("/auth/api/archive/upload-status/");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching archive status: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 3: get_enduraw_matrix
server.tool(
  "get_enduraw_matrix",
  "Fetches the complete Enduraw Runner Matrix (physiological profile: aerobic endurance, climbing, downhill, speed, resilience, cohort percentiles).",
  {},
  async () => {
    try {
      const matrixRes = await getMatrixData();
      if (matrixRes && matrixRes.notFound) {
        const uploadStatus = await fetchEnduraw("/auth/api/archive/upload-status/");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "not_ready",
                message: "The Runner Matrix has not yet been computed or is currently being calculated.",
                archive_upload: uploadStatus
              }, null, 2)
            }
          ]
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({
          user_info: matrixRes.user_info,
          archive_summary: matrixRes.archive_summary,
          global_stats: matrixRes.global_stats,
          score_benchmarks: matrixRes.score_benchmarks,
          key_sessions: matrixRes.key_sessions,
          terrain_summary: matrixRes.terrain_summary
        }, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching Runner Matrix: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 4: get_enduraw_matrix_summary
server.tool(
  "get_enduraw_matrix_summary",
  "Fetches a summarized view of the athlete's Runner Matrix metrics and current scores.",
  {},
  async () => {
    try {
      const summaryRes = await fetchEnduraw("/auth/api/runner-matrix/summary");
      if (summaryRes && summaryRes.notFound) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "not_ready",
                message: "Runner Matrix summary not ready yet."
              }, null, 2)
            }
          ]
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(summaryRes, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching matrix summary: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 5: get_enduraw_matrix_history
server.tool(
  "get_enduraw_matrix_history",
  "Fetches the chronological evolution / history of the athlete's Runner Matrix data points.",
  {},
  async () => {
    try {
      const historyRes = await fetchEnduraw("/auth/api/runner-matrix/history");
      return {
        content: [{ type: "text", text: JSON.stringify(historyRes, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching matrix history: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 6: get_enduraw_performance_profile (from tab=performance)
server.tool(
  "get_enduraw_performance_profile",
  "Retrieves deep performance metrics from Enduraw: Critical Speed (Vc, D', benchmark points), radar scores (0-100 on Endurance, Uphill, Downhill, Speed, Physio, Resilience), and performance ratings by race format (short, intermediate, long, very_long).",
  {},
  async () => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const graphs = matrix.graphs || {};
      const criticalSpeed = graphs.critical_speed_estimate || {};
      const radar = graphs.hr_vs_speed?.radar_chart || {};
      const formats = graphs.speed_format_profile || [];
      const scoreBenchmarks = matrix.score_benchmarks?.dimensions || {};

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              critical_speed: {
                critical_speed_kmh: criticalSpeed.critical_speed_kmh,
                critical_pace_mmss: criticalSpeed.critical_pace_s_per_km
                  ? `${Math.floor(criticalSpeed.critical_pace_s_per_km / 60)}:${String(Math.round(criticalSpeed.critical_pace_s_per_km % 60)).padStart(2, "0")}/km`
                  : null,
                d_prime_meters: criticalSpeed.d_prime_m,
                r2_accuracy: criticalSpeed.r2,
                benchmark_points: criticalSpeed.points || []
              },
              radar_profile: radar.indicators || [],
              cohort_benchmarks: scoreBenchmarks,
              race_formats: formats
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching performance profile: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 7: get_enduraw_records_progression (All personal bests)
server.tool(
  "get_enduraw_records_progression",
  "Retrieves the personal records and progression curves computed by Enduraw on standard benchmark distances (1k, 5k, 10k, 15k, Half-Marathon, 30k, Marathon) with historical milestones.",
  {
    distance: z.string().optional().describe("Optional target distance filter ('1k', '5k', '10k', '15k', 'semi', '30k', 'marathon')")
  },
  async ({ distance }) => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const recordsProgression = matrix.graphs?.records_progression || {};
      let series = recordsProgression.series || [];

      if (distance) {
        const norm = distance.toLowerCase().trim();
        series = series.filter(s => s.target && s.target.toLowerCase() === norm);
      }

      const summary = series.map(s => {
        const points = s.points || [];
        const best = points.length > 0 ? points[points.length - 1] : null;
        return {
          target: s.target,
          best_record_hms: best?.record_hms,
          best_pace_mmss: best?.pace_mmss_per_km,
          date_achieved: best?.date,
          progression_steps: points.length,
          all_milestones: points
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              targets_meters: recordsProgression.targets_m,
              records: summary
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching records progression: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 8: get_enduraw_slope_and_cadence (Biomechanics & VAM)
server.tool(
  "get_enduraw_slope_and_cadence",
  "Retrieves VAM (vitesse ascensionnelle in m/h) and running cadence (spm) broken down by slope grade percentage (uphill and downhill). Highlights climbing efficiency and walking/running transition points.",
  {},
  async () => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const ascData = matrix.graphs?.ascensional_vs_gradient?.data?.bins || [];
      const upBins = ascData.find(b => b.type === "up")?.points || [];
      const downBins = ascData.find(b => b.type === "down")?.points || [];

      const filterKeyBins = (bins) => {
        return bins.filter(p => [2.5, 5.5, 8.5, 10.5, 12.5, 15.5, 18.5, 20.5, 24.5].some(g => Math.abs(p.grad_center_pct - g) < 0.2 || Math.abs(p.grad_center_pct + g) < 0.2));
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              vam_uphill_key_gradients: filterKeyBins(upBins),
              vam_downhill_key_gradients: filterKeyBins(downBins),
              all_uphill_points_count: upBins.length,
              all_downhill_points_count: downBins.length,
              terrain_summary: matrix.terrain_summary?.distance_by_slope || {}
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching slope and cadence: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 9: get_enduraw_cardio_zones (Karvonen zones)
server.tool(
  "get_enduraw_cardio_zones",
  "Retrieves Karvonen heart rate zones (Z1 to Z5), total time and share spent in each zone across training history, resting HR, and max HR.",
  {},
  async () => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const physio = matrix.user_info?.physiology || {};
      const repartition = matrix.karvonen_repartition || {};
      const zoneTime = matrix.karvonen_zone_time || {};

      const zonesWithHours = (zoneTime.zones || []).map(z => ({
        ...z,
        time_hours: Math.round((z.time_s / 3600) * 10) / 10,
        share_percent: Math.round(z.share * 1000) / 10
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              physiology: physio,
              zones_bpm_ranges: repartition,
              total_covered_hours: Math.round((zoneTime.covered_time_s || 0) / 3600 * 10) / 10,
              below_z1_hours: Math.round((zoneTime.below_z1_time_s || 0) / 3600 * 10) / 10,
              zones: zonesWithHours
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching cardio zones: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 10: get_enduraw_activities
server.tool(
  "get_enduraw_activities",
  "Fetches recent activities synced to Enduraw with duration, distance, weather conditions (temp, wind), and analysis readiness status. Supports period filtering ('52w', 'all', '12w', '4w') and filtering for analyzed sessions.",
  {
    limit: z.number().optional().default(10).describe("Number of activities to retrieve (default: 10, max: 100)"),
    period: z.string().optional().default("52w").describe("Time period ('52w', 'all', '12w', '4w')"),
    analyzed_only: z.boolean().optional().default(false).describe("If true, only return activities with completed deep analysis (analysis_ready: true)")
  },
  async ({ limit, period, analyzed_only }) => {
    try {
      const countData = await fetchEnduraw(`/auth/api/activities/count/?period=${period}`);
      let activities = await fetchEnduraw(`/auth/api/activities/?limit=${limit}&period=${period}`);
      if (!Array.isArray(activities)) activities = [];

      if (analyzed_only) {
        activities = activities.filter(a => a.analysis_ready === true);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_activities_count: countData?.count,
              synced: countData?.synced,
              period,
              returned_count: activities.length,
              activities
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching activities: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 11: get_enduraw_pacing_plans
server.tool(
  "get_enduraw_pacing_plans",
  "Retrieves all pacing plans created or in preparation on Enduraw, including available credits.",
  {},
  async () => {
    try {
      const plans = await fetchEnduraw("/auth/api/pacing-plans/");
      const ppList = await fetchEnduraw("/auth/api/PP/");
      const inPrep = await fetchEnduraw("/auth/api/pacing-plans/in-preparation");
      const credits = await fetchEnduraw("/auth/api/pacing-plans/credits");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              credits,
              in_preparation: inPrep,
              plans: Array.isArray(plans) ? plans : [],
              pp_list: Array.isArray(ppList) ? ppList : []
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching pacing plans: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 12: get_enduraw_races
server.tool(
  "get_enduraw_races",
  "Queries the Enduraw official races database (329+ races: CCC, UTMB, Sainté, Diagonale des Fous, etc.) with elevation gain/loss, distances, and date.",
  {
    query: z.string().optional().describe("Optional search query (e.g. 'CCC', 'UTMB', 'Sainté') to filter races")
  },
  async ({ query }) => {
    try {
      let races = await fetchEnduraw("/auth/api/races/");
      if (!Array.isArray(races)) {
        races = [];
      }

      if (query && typeof query === "string") {
        const q = query.toLowerCase();
        races = races.filter(r =>
          (r.race_name && r.race_name.toLowerCase().includes(q)) ||
          (r.location && r.location.toLowerCase().includes(q))
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              count: races.length,
              races
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching races: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 13: get_enduraw_notifications
server.tool(
  "get_enduraw_notifications",
  "Retrieves daily activity notifications and new updates from Enduraw.",
  {
    today: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)")
  },
  async ({ today }) => {
    try {
      const targetDate = today || new Date().toISOString().split("T")[0];
      const data = await fetchEnduraw(`/auth/api/notifications/?today=${targetDate}&tz_offset=-60`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching notifications: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 14: get_enduraw_cardio_efficiency
server.tool(
  "get_enduraw_cardio_efficiency",
  "Retrieves cardiac efficiency vs speed ('Que coute votre allure en battements ?') across 66 speed/pace intervals with median HR, Q25/Q75 dispersion, and post-effort heart rate recovery metrics.",
  {
    min_speed_kmh: z.number().optional().describe("Optional minimum speed in km/h (e.g. 8.0)"),
    max_speed_kmh: z.number().optional().describe("Optional maximum speed in km/h (e.g. 15.0)")
  },
  async ({ min_speed_kmh, max_speed_kmh }) => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const hrVsSpeed = matrix.graphs?.hr_vs_speed || {};
      const aggregations = hrVsSpeed.data_nuage?.aggregations || {};
      const speeds = aggregations.speed_center_kmh || [];
      const hrMeans = aggregations.hr_mean || [];
      const nPoints = aggregations.n_points || [];
      const q25 = aggregations.quantiles?.find(q => q.name === "hr_q25")?.y_hr_bpm || [];
      const q50 = aggregations.quantiles?.find(q => q.name === "hr_q50")?.y_hr_bpm || [];
      const q75 = aggregations.quantiles?.find(q => q.name === "hr_q75")?.y_hr_bpm || [];

      const bands = [];
      for (let i = 0; i < speeds.length; i++) {
        const spd = speeds[i];
        if (min_speed_kmh !== undefined && spd < min_speed_kmh) continue;
        if (max_speed_kmh !== undefined && spd > max_speed_kmh) continue;

        const paceSec = Math.round(3600 / spd);
        const paceMmSs = `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, "0")}/km`;

        bands.push({
          speed_kmh: spd,
          pace_mmss: paceMmSs,
          hr_median_bpm: q50[i],
          hr_central_half_bpm: `${q25[i]} à ${q75[i]}`,
          hr_mean_bpm: hrMeans[i],
          observations_count: nPoints[i]
        });
      }

      const recoverySessions = matrix.graphs?.premium_lab?.performance_lab?.physiology?.recovery_sessions || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_speed_bands: bands.length,
              speed_cost_bands: bands,
              recovery_sessions_count: recoverySessions.length,
              recent_recovery_sessions: recoverySessions.slice(-8)
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching cardio efficiency: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 15: get_enduraw_pillar_deep_dive
server.tool(
  "get_enduraw_pillar_deep_dive",
  "Retrieves granular sub-analysis data for any Enduraw physiological pillar: 'endurance' (cardiac decoupling and pace stability by duration), 'resilience' (28-day sustained effort calendar and durability), 'uphill' (continuous climbs and D+ by slope), 'downhill' (continuous descents and VDM), or 'all'.",
  {
    pillar: z.enum(["endurance", "resilience", "uphill", "downhill", "physiology", "all"]).describe("The physiological pillar to deep-dive into")
  },
  async ({ pillar }) => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const perfLab = matrix.graphs?.premium_lab?.performance_lab || {};

      let result = {};
      if (pillar === "endurance" || pillar === "all") {
        result.endurance = perfLab.endurance || {};
      }
      if (pillar === "resilience" || pillar === "all") {
        result.resilience = perfLab.resilience || {};
      }
      if (pillar === "uphill" || pillar === "all") {
        result.uphill = perfLab.uphill || {};
      }
      if (pillar === "downhill" || pillar === "all") {
        result.downhill = perfLab.downhill || {};
      }
      if (pillar === "physiology" || pillar === "all") {
        result.physiology = perfLab.physiology || {};
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching pillar deep dive: ${err.message}` }],
        isError: true
      };
    }
  }
);

// ============================================================================
// NEW TOOLS: UNLOCKING NON-PREMIUM CAPABILITIES (ACTIVITIES, TESTS, LABO, PACING, FORME)
// ============================================================================

// Tool 16: get_enduraw_activity_analysis
server.tool(
  "get_enduraw_activity_analysis",
  "Fetches the deep physiological and pacing analysis of a specific activity by its activityId. Includes storyline, performance claims, quality score, heart rate zones distribution, and weather impact. If the activity has not been analyzed yet due to free tier quotas, returns summary data and quota info.",
  {
    activity_id: z.number().describe("The numeric activity ID (e.g. 19918148378)")
  },
  async ({ activity_id }) => {
    try {
      const data = await fetchEnduraw(`/auth/api/activities/${activity_id}/analysis/`);
      if (data && data.quotaExceeded) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "quota_exceeded",
                message: "Le quota d'analyses approfondies est atteint sur l'interface web pour ce compte.",
                detail: data.detail,
                hint: "Vous pouvez inspecter l'activité déjà analysée avec get_enduraw_activities(analyzed_only=true) ou consulter le bilan global via get_enduraw_activities_stats."
              }, null, 2)
            }
          ]
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching activity analysis: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 17: get_enduraw_activities_stats
server.tool(
  "get_enduraw_activities_stats",
  "Fetches aggregate statistics across all training sessions recorded on Enduraw: total sessions, total distance (km), total time (h), observed vs estimated time breakdown, and time saved.",
  {
    period: z.string().optional().default("52w").describe("Time period to aggregate: '52w' (default), 'all', '12w', '4w'")
  },
  async ({ period }) => {
    try {
      const data = await fetchEnduraw(`/auth/api/activities/stats/?period=${period}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching activities stats: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 18: get_enduraw_activities_map
server.tool(
  "get_enduraw_activities_map",
  "Fetches geolocation GPS coordinates, start points, and session routes for all recorded activities across the globe (used in the Enduraw Heatmap and geographic explorer).",
  {
    period: z.string().optional().default("52w").describe("Time period ('52w' default, 'all')")
  },
  async ({ period }) => {
    try {
      const data = await fetchEnduraw(`/auth/api/activities/map/?period=${period}`);
      const points = data?.points || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_geolocated_points: points.length,
              period,
              points_sample: points.slice(0, 30),
              all_points_count: points.length
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching activities map: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 19: get_enduraw_analysis_quota
server.tool(
  "get_enduraw_analysis_quota",
  "Checks the current user's activity analysis quota on Enduraw (tier, limit, used, remaining, reset date).",
  {},
  async () => {
    try {
      const quota = await fetchEnduraw("/auth/api/activities/analysis/quota/");
      return {
        content: [{ type: "text", text: JSON.stringify(quota, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching analysis quota: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 20: get_enduraw_athlete_lab
server.tool(
  "get_enduraw_athlete_lab",
  "Directly retrieves the complete Enduraw 'Athlete Lab' / 'Modélisation' (tab=modeling), which is locked for free users on the web app. Unlocks the 5 performance pillars (Uphill continuous climbs, Downhill VDM, Endurance cardiac drift, Resilience 28-day training load calendar, Physiology recovery), Critical Speed profile, and cohort percentiles.",
  {},
  async () => {
    try {
      const matrix = await getMatrixData();
      if (!matrix || matrix.notFound) {
        return { content: [{ type: "text", text: "Matrix not available yet." }], isError: true };
      }

      const perfLab = matrix.graphs?.premium_lab?.performance_lab || {};
      const criticalSpeed = matrix.graphs?.critical_speed_estimate || {};
      const scores = matrix.score_benchmarks || {};
      const terrain = matrix.terrain_summary || {};
      const formatProfile = matrix.graphs?.speed_format_profile || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              lab_status: "UNLOCKED_VIA_MCP",
              athlete_info: matrix.user_info,
              performance_pillars: {
                uphill: {
                  summary: "Capacité de montée continue et D+ cumulé par tranche de durée",
                  data: perfLab.uphill
                },
                downhill: {
                  summary: "Profil de descente continue, VDM (vitesse de descente) et résistance aux chocs",
                  data: perfLab.downhill
                },
                endurance: {
                  summary: "Découplage cardiaque (drift) et stabilité de l'allure sur la durée (>30m, >60m, >90m, >120m)",
                  data: perfLab.endurance
                },
                resilience: {
                  summary: "Calendrier de charge sur 28 jours, durabilité musculaire et régularité des efforts",
                  data: perfLab.resilience
                },
                physiology: {
                  summary: "Cinétique de récupération cardiaque et signaux physiologiques observés",
                  data: perfLab.physiology
                }
              },
              critical_speed_model: {
                critical_speed_kmh: criticalSpeed.critical_speed_kmh,
                critical_pace_s_km: criticalSpeed.critical_pace_s_per_km,
                d_prime_m: criticalSpeed.d_prime_m,
                r2: criticalSpeed.r2,
                benchmark_curve: criticalSpeed.points || []
              },
              race_formats: formatProfile,
              cohort_percentiles: scores.dimensions || {},
              terrain_distribution: terrain.distance_by_slope || {}
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching athlete lab: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 21: get_enduraw_physio_tests
server.tool(
  "get_enduraw_physio_tests",
  "Comprehensive physiological testing hub: retrieves official Enduraw testing protocols (Flat VMA/Vc test, Incline VAM test, Lactate testing), booking availability, cognitive Stroop test status, AND all computed physiological benchmarks extracted from the runner's real history (Critical Speed, Slope VAM curve, Cardiac Efficiency, Post-effort Recovery Kinetics).",
  {},
  async () => {
    try {
      const catalogue = await fetchEnduraw("/auth/api/testing/catalogue");
      const slots = await fetchEnduraw("/auth/api/testing/slots");
      const userTests = await fetchEnduraw("/auth/api/testing/tests/");
      const stroop = await fetchEnduraw("/auth/api/stroop/");

      const matrix = await getMatrixData();
      const criticalSpeed = matrix?.graphs?.critical_speed_estimate || {};
      const ascData = matrix?.graphs?.ascensional_vs_gradient?.data?.bins || [];
      const upBins = ascData.find(b => b.type === "up")?.points || [];
      const physio = matrix?.graphs?.premium_lab?.performance_lab?.physiology || {};

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              lab_testing_protocols: Array.isArray(catalogue) ? catalogue : [],
              user_lab_tests: Array.isArray(userTests) ? userTests : [],
              slots_available: Array.isArray(slots) ? slots.length : 0,
              cognitive_test: {
                stroop_feature: "Cognitive & Mental Fatigue Test",
                status: stroop?.status || "available_in_pro",
                summary: stroop
              },
              computed_physiological_benchmarks: {
                critical_speed: {
                  critical_speed_kmh: criticalSpeed.critical_speed_kmh,
                  d_prime_meters: criticalSpeed.d_prime_m,
                  test_points: criticalSpeed.points || []
                },
                vam_slope_curve: upBins.filter(p => [5.5, 10.5, 15.5, 20.5].some(g => Math.abs(p.grad_center_pct - g) < 0.5)),
                recovery_kinetics: {
                  recovery_sessions_count: (physio.recovery_sessions || []).length,
                  latest_recovery_sessions: (physio.recovery_sessions || []).slice(-5)
                }
              }
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching physiological tests: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 22: get_enduraw_race_course_profile
server.tool(
  "get_enduraw_race_course_profile",
  "Retrieves the detailed 3D course elevation profile, distance, total D+, total D-, max altitude, and aid stations count for any of Enduraw's 329+ official races (CCC, UTMB, Sainté, etc.).",
  {
    race_name: z.string().describe("Official race name (e.g. 'CCC', 'UTMB', 'OCC', 'Saintélyon')")
  },
  async ({ race_name }) => {
    try {
      const data = await fetchEnduraw(`/auth/api/course-profile/?race_name=${encodeURIComponent(race_name)}`);
      if (data && data.notFound) {
        return {
          content: [{ type: "text", text: `Race course profile not found for '${race_name}'. Use get_enduraw_races to find valid race names.` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              meta: data.meta,
              elevation_profile_points_count: data.profile_3d?.data?.[0]?.x?.length || 0,
              min_altitude_m: data.meta?.min_altitude_m,
              max_altitude_m: data.meta?.max_altitude_m,
              total_elevation_gain_m: data.meta?.elevation_gain_m,
              total_elevation_loss_m: data.meta?.elevation_loss_m,
              nb_aid_stations: data.meta?.nb_aid_stations
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching race course profile: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 23: get_enduraw_race_gpx
server.tool(
  "get_enduraw_race_gpx",
  "Retrieves the complete GeoJSON track coordinates and ALL official checkpoints / aid stations (with distance, altitude, and cumulative D+) for a race.",
  {
    race_name: z.string().describe("Official race name (e.g. 'CCC', 'UTMB', 'Saintélyon')")
  },
  async ({ race_name }) => {
    try {
      const data = await fetchEnduraw(`/auth/api/gpx/?race_name=${encodeURIComponent(race_name)}`);
      if (data && data.notFound) {
        return {
          content: [{ type: "text", text: `GPX track not found for '${race_name}'. Use get_enduraw_races to find valid race names.` }],
          isError: true
        };
      }

      const features = data?.geojson?.features || [];
      const checkpoints = features.filter(f => f.geometry?.type === "Point").map(f => f.properties);
      const lineString = features.find(f => f.geometry?.type === "LineString");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              race_name,
              total_track_points: lineString?.geometry?.coordinates?.length || 0,
              checkpoints_count: checkpoints.length,
              checkpoints
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching race GPX: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 24: get_enduraw_form_fatigue
server.tool(
  "get_enduraw_form_fatigue",
  "Fetches the official Enduraw Form & Fatigue modeling (CTL, ATL, TSB, and training load curves) across the athlete's history directly from /auth/api/activities/form-fatigue/. Returns official metrics or subscription requirement status (Starter tier).",
  {
    days: z.number().optional().default(180).describe("Historical window in days (default: 180)"),
    sport: z.string().optional().default("all").describe("Sport filter ('all', 'run', 'trail')")
  },
  async ({ days, sport }) => {
    try {
      const data = await fetchEnduraw(`/auth/api/activities/form-fatigue/?days=${days}&sport=${sport}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching form and fatigue: ${err.message}` }],
        isError: true
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Enduraw MCP server:", err);
  process.exit(1);
});
