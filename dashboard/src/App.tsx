import { lazy, Suspense, useEffect, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { BarChartProps } from "@mui/x-charts/BarChart";
import type { LineChartProps } from "@mui/x-charts/LineChart";
import {
  AIFinding,
  Alert,
  AppShell,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  Main,
  ThemeToggle,
} from "./components/components";
import {
  BAND_LABEL,
  DeltaChip,
  HaloMark,
  Kpi,
  MetricTable,
  RailItem,
  RingCard,
  ScoreRing,
  scoreBand,
  type MetricColumn,
} from "./components/halo";
import {
  ActivityIcon,
  HomeIcon,
  InsightsIcon,
  ReadinessIcon,
  SleepIcon,
} from "./components/Icons";

const LineChart = lazy(() =>
  import("@mui/x-charts/LineChart").then((module) => ({ default: module.LineChart }))
);
const BarChart = lazy(() =>
  import("@mui/x-charts/BarChart").then((module) => ({ default: module.BarChart }))
);

function DashboardLazyFallback() {
  return <div className="dashboard-lazy-fallback chart" />;
}

function DashboardLineChart(props: LineChartProps) {
  return (
    <Suspense fallback={<DashboardLazyFallback />}>
      <LineChart {...props} />
    </Suspense>
  );
}

function DashboardBarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<DashboardLazyFallback />}>
      <BarChart {...props} />
    </Suspense>
  );
}

interface SleepRecord {
  day: string;
  score: number;
  duration: number;
  deep: number;
  rem: number;
  light: number;
  efficiency: number;
}

interface ReadinessRecord {
  day: string;
  score: number;
  hrv: number;
  rhr: number;
  temperature_deviation: number;
}

interface ActivityRecord {
  day: string;
  score: number;
  steps: number;
  active_calories: number;
  total_calories: number;
}

interface StressRecord {
  day: string;
  stress_duration: number;
  recovery_duration: number;
}

interface HistorySummary {
  sleep: SleepRecord[];
  readiness: ReadinessRecord[];
  activity: ActivityRecord[];
  stress: StressRecord[];
}

type TabKey = "home" | "sleep" | "readiness" | "activity" | "insights";

/* Domain hues per theme (DESIGN.md 3.1) — JS copies for chart series,
   kept in sync with tokens.css */
const HUES = {
  dark: {
    sleep: "#8A93F8",
    sleepDeep: "#5B66E8",
    rem: "#38BDF8",
    readiness: "#2DD4BF",
    activity: "#FF9F0A",
    heart: "#FF6482",
    stress: "#FBBF24",
    optimal: "#30D158",
    low: "#FF6B5E",
    accent: "#7C9EF8",
    ai: "#BF7AF0",
  },
  light: {
    sleep: "#5B66E8",
    sleepDeep: "#4048C8",
    rem: "#0284C7",
    readiness: "#0D9488",
    activity: "#D97706",
    heart: "#E11D48",
    stress: "#B45309",
    optimal: "#1E9E50",
    low: "#D6453A",
    accent: "#3B6FE0",
    ai: "#7C3AED",
  },
} as const;

function formatSecondsToHours(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatDayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function average(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/* z-score helper for the anomaly feed (FEATURES F-4, simplified:
   baseline = the whole loaded window) */
function zScorer(values: number[]): { z: (v: number) => number; mean: number } {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length < 5) return { z: () => 0, mean: 0 };
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const sd = Math.sqrt(
    valid.reduce((s, v) => s + (v - mean) ** 2, 0) / (valid.length - 1)
  );
  return { z: (v: number) => (sd > 0 ? (v - mean) / sd : 0), mean };
}

function ScoreCell({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <span className={`tone-${band} halo-num`} style={{ fontWeight: 500 }}>
      {score > 0 ? score : "—"}
    </span>
  );
}

const TAB_TITLES: Record<TabKey, string> = {
  home: "Overview",
  sleep: "Sleep",
  readiness: "Readiness",
  activity: "Activity",
  insights: "Insights",
};

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [data, setData] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "dark";
    const savedTheme = localStorage.getItem("oura-dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return (
      (document.documentElement.getAttribute("data-theme") as "light" | "dark" | null) ??
      "dark"
    );
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("oura-dashboard-theme");
    const domTheme = document.documentElement.getAttribute("data-theme") as
      | "light"
      | "dark"
      | null;
    const initialTheme =
      savedTheme === "light" || savedTheme === "dark" ? savedTheme : domTheme ?? "dark";

    document.documentElement.setAttribute("data-theme", initialTheme);
    setCurrentTheme(initialTheme);

    const observer = new MutationObserver(() => {
      const theme =
        (document.documentElement.getAttribute("data-theme") as "light" | "dark" | null) ??
        "dark";
      localStorage.setItem("oura-dashboard-theme", theme);
      setCurrentTheme(theme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const hues = HUES[currentTheme];

  const muiTheme = createTheme({
    palette: {
      mode: currentTheme,
      primary: { main: hues.accent },
      background: {
        default: currentTheme === "dark" ? "#0B0C10" : "#F5F6F8",
        paper: currentTheme === "dark" ? "#14161D" : "#FFFFFF",
      },
      text: {
        primary: currentTheme === "dark" ? "#F2F4F8" : "#14161D",
        secondary:
          currentTheme === "dark"
            ? "rgba(235, 240, 248, 0.44)"
            : "rgba(20, 22, 29, 0.46)",
      },
      divider:
        currentTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,18,28,0.07)",
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif',
    },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: true } },
    },
  });

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dashboard/summary");
      if (!response.ok) {
        throw new Error(`Failed to load summary: ${response.statusText}`);
      }

      const json = (await response.json()) as HistorySummary;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch("/api/dashboard/sync", { method: "POST" });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.history) {
        setData(result.history as HistorySummary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  const sleepRows = data ? data.sleep.slice().reverse() : [];
  const readinessRows = data ? data.readiness.slice().reverse() : [];
  const activityRows = data ? data.activity.slice().reverse() : [];

  const latestSleep = data?.sleep[data.sleep.length - 1] ?? null;
  const latestReadiness = data?.readiness[data.readiness.length - 1] ?? null;
  const latestActivity = data?.activity[data.activity.length - 1] ?? null;
  const latestStress = data?.stress[data.stress.length - 1] ?? null;

  const heroDate =
    latestSleep?.day ?? latestReadiness?.day ?? latestActivity?.day ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const isFresh = heroDate === today;

  const sleepChartData =
    data?.sleep.map((entry) => ({
      day: formatDayLabel(entry.day),
      duration: Number((entry.duration / 3600).toFixed(1)),
      deep: Number((entry.deep / 3600).toFixed(1)),
      rem: Number((entry.rem / 3600).toFixed(1)),
      light: Number((entry.light / 3600).toFixed(1)),
    })) ?? [];

  const readinessChartData =
    data?.readiness.map((entry) => ({
      day: formatDayLabel(entry.day),
      score: entry.score,
      hrv: entry.hrv,
      rhr: entry.rhr,
      temperature: Number(entry.temperature_deviation.toFixed(2)),
    })) ?? [];

  const activityChartData =
    data?.activity.map((entry) => ({
      day: formatDayLabel(entry.day),
      steps: entry.steps,
      activeCalories: entry.active_calories,
      totalCalories: entry.total_calories,
    })) ?? [];

  // mirrored stress chart: recovery plotted below the zero axis (REQ C6 W1)
  const stressChartData =
    data?.stress.map((entry) => ({
      day: formatDayLabel(entry.day),
      stress: Number((entry.stress_duration / 3600).toFixed(1)),
      recovery: -Number((entry.recovery_duration / 3600).toFixed(1)),
    })) ?? [];

  // baselines: average of history excluding the latest day, for deltas
  const sleepBaseline = data ? average(data.sleep.slice(0, -1).map((d) => d.score)) : null;
  const readinessBaseline = data
    ? average(data.readiness.slice(0, -1).map((d) => d.score))
    : null;
  const activityBaseline = data
    ? average(data.activity.slice(0, -1).map((d) => d.score))
    : null;
  const hrvBaseline = data ? average(data.readiness.slice(0, -1).map((d) => d.hrv)) : null;
  const rhrBaseline = data ? average(data.readiness.slice(0, -1).map((d) => d.rhr)) : null;

  const sleepAverage =
    data && data.sleep.length > 0
      ? Math.round(data.sleep.reduce((sum, item) => sum + item.score, 0) / data.sleep.length)
      : 0;

  const readinessAverage =
    data && data.readiness.length > 0
      ? Math.round(
          data.readiness.reduce((sum, item) => sum + item.score, 0) / data.readiness.length
        )
      : 0;

  const activityStepsAverage =
    data && data.activity.length > 0
      ? Math.round(
          data.activity.reduce((sum, item) => sum + item.steps, 0) / data.activity.length
        )
      : 0;

  const strainHours = latestStress
    ? Number((latestStress.stress_duration / 3600).toFixed(1))
    : 0;

  const recoveryHours = latestStress
    ? Number((latestStress.recovery_duration / 3600).toFixed(1))
    : 0;

  const recoveryPosture = latestReadiness
    ? latestReadiness.score >= 85
      ? "Stable"
      : latestReadiness.score >= 72
        ? "Watch"
        : "Recover"
    : "Pending";

  const tempFlag =
    latestReadiness && Math.abs(latestReadiness.temperature_deviation) >= 0.3;

  // headline insight — first match wins (REQ C1 W3)
  const headline = (() => {
    if (!latestReadiness) return "Sync your ring to see today's picture.";
    if (tempFlag && latestReadiness.temperature_deviation >= 0.5) {
      return "Temperature is well above your normal — your body may be fighting something. Consider taking it easy.";
    }
    if (latestReadiness.score >= 85) {
      return "You're recovered — good day to push.";
    }
    if (latestReadiness.score < 70) {
      return "Recovery is limited today. Favor light movement and an early night.";
    }
    return "Signals are steady. Keep to your usual rhythm.";
  })();

  const insights = (() => {
    if (!data || data.sleep.length < 5) return [];

    const items: Array<{
      variant: "positive" | "warn" | "action";
      title: string;
      body: string;
      cta: string;
      tab: TabKey | null;
    }> = [];

    if (latestSleep && latestSleep.score < sleepAverage - 8) {
      items.push({
        variant: "warn",
        title: "Sleep quality dipped below baseline",
        body: `Last night scored ${latestSleep.score}, below your recent baseline of ${sleepAverage}. Review sleep timing and evening load before this becomes a pattern.`,
        cta: "Review sleep detail",
        tab: "sleep",
      });
    }

    if (latestReadiness && latestReadiness.hrv > 0 && latestReadiness.score >= readinessAverage) {
      items.push({
        variant: "positive",
        title: "Recovery is holding steady",
        body: `Readiness is ${latestReadiness.score} with HRV at ${latestReadiness.hrv} ms. Your autonomic markers are tracking at or above your recent norm.`,
        cta: "Open readiness view",
        tab: "readiness",
      });
    }

    if (latestActivity && latestActivity.steps < activityStepsAverage * 0.8) {
      items.push({
        variant: "action",
        title: "Movement is the easiest lever today",
        body: `Today's step volume is below your rolling average of ${activityStepsAverage.toLocaleString()} steps. A short walk block would close the gap quickly.`,
        cta: "Open activity view",
        tab: "activity",
      });
    }

    if (items.length === 0) {
      items.push({
        variant: "positive",
        title: "Signals look balanced",
        body: "Sleep, readiness, and movement are staying inside a healthy operating band. Nothing stands out as needing intervention right now.",
        cta: "Stay on course",
        tab: null,
      });
    }

    return items;
  })();

  // week-over-week comparison: last 7 days vs the 7 before (needs ≥ 10 days)
  const weekCompare = (() => {
    if (!data || data.readiness.length < 10) return null;
    const week = <T,>(rows: T[]) => ({ cur: rows.slice(-7), prev: rows.slice(-14, -7) });
    const s = week(data.sleep);
    const r = week(data.readiness);
    const a = week(data.activity);
    const entries: Array<{
      label: string;
      cur: number | null;
      prev: number | null;
      unit?: string;
      higherIsBetter: boolean;
      format: (v: number) => string;
    }> = [
      {
        label: "Sleep score",
        cur: average(s.cur.map((x) => x.score)),
        prev: average(s.prev.map((x) => x.score)),
        higherIsBetter: true,
        format: (v) => `${Math.round(v)}`,
      },
      {
        label: "Readiness",
        cur: average(r.cur.map((x) => x.score)),
        prev: average(r.prev.map((x) => x.score)),
        higherIsBetter: true,
        format: (v) => `${Math.round(v)}`,
      },
      {
        label: "HRV",
        cur: average(r.cur.map((x) => x.hrv)),
        prev: average(r.prev.map((x) => x.hrv)),
        unit: "ms",
        higherIsBetter: true,
        format: (v) => `${Math.round(v)}`,
      },
      {
        label: "Resting HR",
        cur: average(r.cur.map((x) => x.rhr)),
        prev: average(r.prev.map((x) => x.rhr)),
        unit: "bpm",
        higherIsBetter: false,
        format: (v) => `${Math.round(v)}`,
      },
      {
        label: "Steps",
        cur: average(a.cur.map((x) => x.steps)),
        prev: average(a.prev.map((x) => x.steps)),
        higherIsBetter: true,
        format: (v) => Math.round(v).toLocaleString(),
      },
    ];
    return entries.filter((e) => e.cur != null);
  })();

  // anomaly feed: readings well outside the window's own normal (|z| ≥ 1.5)
  const anomalies = (() => {
    if (!data || data.readiness.length < 7) return [];
    const out: Array<{
      day: string;
      tone: "good" | "bad" | "warn";
      metric: string;
      detail: string;
    }> = [];

    const hrv = zScorer(data.readiness.map((x) => x.hrv));
    const rhr = zScorer(data.readiness.map((x) => x.rhr));
    const sleepScore = zScorer(data.sleep.map((x) => x.score));
    const steps = zScorer(data.activity.map((x) => x.steps));

    for (const rec of data.readiness) {
      if (rec.hrv > 0 && hrv.z(rec.hrv) <= -1.5) {
        out.push({
          day: rec.day, tone: "bad", metric: `HRV ${rec.hrv} ms`,
          detail: `well below your average of ${Math.round(hrv.mean)} ms`,
        });
      } else if (rec.hrv > 0 && hrv.z(rec.hrv) >= 1.5) {
        out.push({
          day: rec.day, tone: "good", metric: `HRV ${rec.hrv} ms`,
          detail: `well above your average of ${Math.round(hrv.mean)} ms`,
        });
      }
      if (rec.rhr > 0 && rhr.z(rec.rhr) >= 1.5) {
        out.push({
          day: rec.day, tone: "bad", metric: `Resting HR ${rec.rhr} bpm`,
          detail: `elevated vs your average of ${Math.round(rhr.mean)} bpm`,
        });
      }
      if (rec.temperature_deviation >= 0.4) {
        out.push({
          day: rec.day, tone: "warn",
          metric: `Temp +${rec.temperature_deviation.toFixed(1)} °C`,
          detail: "above baseline — possible strain or illness signal",
        });
      }
    }
    for (const rec of data.sleep) {
      if (rec.score > 0 && sleepScore.z(rec.score) <= -1.5) {
        out.push({
          day: rec.day, tone: "bad", metric: `Sleep score ${rec.score}`,
          detail: `a rough night vs your average of ${Math.round(sleepScore.mean)}`,
        });
      } else if (rec.score > 0 && sleepScore.z(rec.score) >= 1.5) {
        out.push({
          day: rec.day, tone: "good", metric: `Sleep score ${rec.score}`,
          detail: `one of your best nights in this window`,
        });
      }
    }
    for (const rec of data.activity) {
      if (rec.steps > 0 && steps.z(rec.steps) >= 1.5) {
        out.push({
          day: rec.day, tone: "good",
          metric: `${rec.steps.toLocaleString()} steps`,
          detail: "a big movement day",
        });
      }
    }

    return out.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 8);
  })();

  const sleepColumns: MetricColumn<SleepRecord>[] = [
    { key: "day", label: "Day", render: (row) => formatDayLabel(row.day) },
    { key: "score", label: "Score", align: "right", render: (row) => <ScoreCell score={row.score} /> },
    {
      key: "duration",
      label: "Total sleep",
      align: "right",
      render: (row) => formatSecondsToHours(row.duration),
    },
    {
      key: "efficiency",
      label: "Efficiency",
      align: "right",
      render: (row) => `${row.efficiency}%`,
    },
    { key: "deep", label: "Deep", align: "right", render: (row) => formatHours(row.deep) },
    { key: "rem", label: "REM", align: "right", render: (row) => formatHours(row.rem) },
  ];

  const readinessColumns: MetricColumn<ReadinessRecord>[] = [
    { key: "day", label: "Day", render: (row) => formatDayLabel(row.day) },
    { key: "score", label: "Readiness", align: "right", render: (row) => <ScoreCell score={row.score} /> },
    {
      key: "rhr",
      label: "Resting HR",
      align: "right",
      render: (row) => (row.rhr ? `${row.rhr} bpm` : "—"),
    },
    {
      key: "hrv",
      label: "HRV",
      align: "right",
      render: (row) => (row.hrv ? `${row.hrv} ms` : "—"),
    },
    {
      key: "temperature_deviation",
      label: "Temp drift",
      align: "right",
      render: (row) => {
        const value = Number(row.temperature_deviation ?? 0);
        return (
          <span className={Math.abs(value) >= 0.3 ? "tone-fair" : undefined}>
            {value > 0 ? `+${value}` : value}°C
          </span>
        );
      },
    },
  ];

  const activityColumns: MetricColumn<ActivityRecord>[] = [
    { key: "day", label: "Day", render: (row) => formatDayLabel(row.day) },
    { key: "score", label: "Activity", align: "right", render: (row) => <ScoreCell score={row.score} /> },
    {
      key: "steps",
      label: "Steps",
      align: "right",
      render: (row) => row.steps.toLocaleString(),
    },
    {
      key: "active_calories",
      label: "Active burn",
      align: "right",
      render: (row) => `${row.active_calories} kcal`,
    },
    {
      key: "total_calories",
      label: "Total burn",
      align: "right",
      render: (row) => `${row.total_calories} kcal`,
    },
  ];

  const railItems: Array<{ key: TabKey; label: string; hue: string; icon: React.ReactNode }> = [
    { key: "home", label: "Overview", hue: "var(--accent)", icon: <HomeIcon size={20} /> },
    { key: "sleep", label: "Sleep", hue: "var(--hue-sleep)", icon: <SleepIcon size={20} /> },
    {
      key: "readiness",
      label: "Readiness",
      hue: "var(--hue-readiness)",
      icon: <ReadinessIcon size={20} />,
    },
    {
      key: "activity",
      label: "Activity",
      hue: "var(--hue-activity)",
      icon: <ActivityIcon size={20} />,
    },
    { key: "insights", label: "Insights", hue: "var(--ai)", icon: <InsightsIcon size={20} /> },
  ];

  return (
    <ThemeProvider theme={muiTheme}>
      <AppShell>
        <nav className="halo-rail" aria-label="Modules">
          <div className="halo-rail-mark">
            <HaloMark size={34} />
          </div>
          {railItems.map((item) => (
            <RailItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              hue={item.hue}
              active={activeTab === item.key}
              onClick={() => setActiveTab(item.key)}
            />
          ))}
          <div className="halo-rail-spacer" />
        </nav>

        <Main>
          <header className="halo-topbar">
            <div>
              <div className="halo-topbar-overline">
                {heroDate ? formatLongDate(heroDate) : "Awaiting first sync"}
              </div>
              <div className="halo-topbar-title">
                {activeTab === "home" ? greeting() : TAB_TITLES[activeTab]}
              </div>
            </div>
            <div className="halo-topbar-right">
              <span className={`halo-fresh ${isFresh ? "" : "stale"}`}>
                <span className="dot" />
                {syncing
                  ? "Syncing…"
                  : isFresh
                    ? "Up to date"
                    : heroDate
                      ? `Data through ${formatDayLabel(heroDate)}`
                      : "No data yet"}
              </span>
              <ThemeToggle />
              <Button variant="primary" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          </header>

          <div className="workspace dashboard-workspace">
            {error && (
              <Alert variant="warn" title="Dashboard issue">
                {error}
              </Alert>
            )}

            {loading && !data ? (
              <div className="dashboard-loading-shell">
                <div className="dashboard-skeleton hero" />
                <div className="dashboard-skeleton card" />
                <div className="dashboard-skeleton card" />
              </div>
            ) : !data ? (
              <Callout variant="info" icon="◌">
                No health data is available yet. Trigger a sync to populate the local dashboard.
              </Callout>
            ) : (
              <>
                {activeTab === "home" && (
                  <div className="dashboard-stack">
                    <section className="halo-rings" aria-label="Today's scores">
                      <RingCard
                        label="Readiness"
                        score={latestReadiness?.score ?? null}
                        delta={
                          latestReadiness && readinessBaseline != null
                            ? latestReadiness.score - readinessBaseline
                            : null
                        }
                        onClick={() => setActiveTab("readiness")}
                      />
                      <RingCard
                        label="Sleep"
                        score={latestSleep?.score ?? null}
                        delta={
                          latestSleep && sleepBaseline != null
                            ? latestSleep.score - sleepBaseline
                            : null
                        }
                        onClick={() => setActiveTab("sleep")}
                      />
                      <RingCard
                        label="Activity"
                        score={latestActivity?.score ?? null}
                        delta={
                          latestActivity && activityBaseline != null
                            ? latestActivity.score - activityBaseline
                            : null
                        }
                        onClick={() => setActiveTab("activity")}
                      />
                    </section>

                    <section className="halo-vitals" aria-label="Vitals">
                      <Kpi
                        label="Resting HR"
                        value={latestReadiness?.rhr || "—"}
                        unit="bpm"
                        note={
                          latestReadiness && rhrBaseline != null ? (
                            <DeltaChip
                              value={latestReadiness.rhr - rhrBaseline}
                              higherIsBetter={false}
                            />
                          ) : (
                            "vs baseline pending"
                          )
                        }
                      />
                      <Kpi
                        label="HRV"
                        value={latestReadiness?.hrv || "—"}
                        unit="ms"
                        note={
                          latestReadiness && hrvBaseline != null ? (
                            <DeltaChip value={latestReadiness.hrv - hrvBaseline} />
                          ) : (
                            "vs baseline pending"
                          )
                        }
                      />
                      <Kpi
                        label="Temp"
                        value={
                          latestReadiness ? (
                            <span className={tempFlag ? "tone-fair" : undefined}>
                              {latestReadiness.temperature_deviation > 0 ? "+" : ""}
                              {latestReadiness.temperature_deviation.toFixed(1)}
                            </span>
                          ) : (
                            "—"
                          )
                        }
                        unit="°C"
                        note={tempFlag ? "outside normal range" : "normal range"}
                      />
                      <Kpi
                        label="Stress balance"
                        value={latestStress ? `${strainHours}h` : "—"}
                        note={
                          latestStress
                            ? `${recoveryHours}h recovery time`
                            : "no stress sample"
                        }
                      />
                    </section>

                    <div className="halo-home-grid">
                      <Card>
                        <CardHeader
                          title="Readiness trend"
                          description="Daily score across your tracked history"
                        />
                        <CardContent>
                          <div className="chart-frame feature">
                            <DashboardLineChart
                              className="dashboard-chart"
                              dataset={readinessChartData}
                              xAxis={[{ scaleType: "point", dataKey: "day" }]}
                              yAxis={[{ min: 0, max: 100 }]}
                              grid={{ horizontal: true }}
                              hideLegend
                              series={[
                                {
                                  dataKey: "score",
                                  label: "Readiness",
                                  color: hues.readiness,
                                  area: true,
                                  showMark: false,
                                },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <div className="halo-home-rail">
                        <div className="halo-insight">
                          <span className="halo-insight-overline">Today</span>
                          <span className="halo-insight-headline">{headline}</span>
                          <span className="halo-insight-sub">
                            {latestReadiness
                              ? `${BAND_LABEL[scoreBand(latestReadiness.score)]} readiness · posture: ${recoveryPosture}`
                              : "Waiting for data"}
                          </span>
                        </div>
                        <div className="insights-list">
                          {insights.map((insight) => (
                            <AIFinding
                              key={insight.title}
                              variant={insight.variant}
                              title={insight.title}
                              body={insight.body}
                              cta={{ label: insight.cta }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "sleep" && (
                  <div className="dashboard-stack">
                    <div
                      className="halo-module-head"
                      style={{ "--hue": "var(--hue-sleep)" } as React.CSSProperties}
                    >
                      <span className="rule" />
                      <p>Nightly duration, stage composition, and full history.</p>
                    </div>

                    <div className="dashboard-pane-grid">
                      <Card>
                        <CardHeader
                          title="Sleep duration"
                          description="Total nightly sleep hours"
                        />
                        <CardContent>
                          <div className="chart-frame tall">
                            <DashboardLineChart
                              className="dashboard-chart"
                              dataset={sleepChartData}
                              xAxis={[{ scaleType: "point", dataKey: "day" }]}
                              grid={{ horizontal: true }}
                              hideLegend
                              series={[
                                {
                                  dataKey: "duration",
                                  label: "Sleep hours",
                                  color: hues.sleep,
                                  area: true,
                                  showMark: false,
                                },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader
                          title="Stage composition"
                          description="Deep, REM, and light per night"
                        />
                        <CardContent>
                          <div className="chart-frame tall">
                            <DashboardBarChart
                              className="dashboard-chart"
                              dataset={sleepChartData}
                              xAxis={[{ scaleType: "band", dataKey: "day" }]}
                              grid={{ horizontal: true }}
                              series={[
                                { dataKey: "deep", label: "Deep", stack: "stages", color: hues.sleepDeep },
                                { dataKey: "rem", label: "REM", stack: "stages", color: hues.rem },
                                { dataKey: "light", label: "Light", stack: "stages", color: hues.sleep },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader
                        title="Sleep log"
                        description="Most recent nights first"
                      />
                      <CardContent>
                        <MetricTable
                          columns={sleepColumns}
                          rows={sleepRows}
                          rowKey={(row) => row.day}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "readiness" && (
                  <div className="dashboard-stack">
                    <div
                      className="halo-module-head"
                      style={{ "--hue": "var(--hue-readiness)" } as React.CSSProperties}
                    >
                      <span className="rule" />
                      <p>Recovery score, HRV, resting heart rate, and thermal drift.</p>
                    </div>

                    <div className="dashboard-pane-grid">
                      <Card>
                        <CardHeader
                          title="Heart rate variability"
                          description="Nightly average — higher is better"
                        />
                        <CardContent>
                          <div className="chart-frame tall">
                            <DashboardLineChart
                              className="dashboard-chart"
                              dataset={readinessChartData}
                              xAxis={[{ scaleType: "point", dataKey: "day" }]}
                              grid={{ horizontal: true }}
                              hideLegend
                              series={[
                                {
                                  dataKey: "hrv",
                                  label: "HRV",
                                  color: hues.readiness,
                                  area: true,
                                  showMark: false,
                                },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader
                          title="Resting heart rate"
                          description="Lowest overnight — lower is better"
                        />
                        <CardContent>
                          <div className="chart-frame tall">
                            <DashboardLineChart
                              className="dashboard-chart"
                              dataset={readinessChartData}
                              xAxis={[{ scaleType: "point", dataKey: "day" }]}
                              grid={{ horizontal: true }}
                              hideLegend
                              series={[
                                {
                                  dataKey: "rhr",
                                  label: "RHR",
                                  color: hues.heart,
                                  showMark: false,
                                },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader
                        title="Recovery log"
                        description="Latest days first so outliers stand out"
                      />
                      <CardContent>
                        <MetricTable
                          columns={readinessColumns}
                          rows={readinessRows}
                          rowKey={(row) => row.day}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "activity" && (
                  <div className="dashboard-stack">
                    <div
                      className="halo-module-head"
                      style={{ "--hue": "var(--hue-activity)" } as React.CSSProperties}
                    >
                      <span className="rule" />
                      <p>Movement volume, energy burn, and stress balance.</p>
                    </div>

                    <div className="dashboard-pane-grid">
                      <Card>
                        <CardHeader title="Steps" description="Daily step count" />
                        <CardContent>
                          <div className="chart-frame tall">
                            <DashboardBarChart
                              className="dashboard-chart"
                              dataset={activityChartData}
                              xAxis={[{ scaleType: "band", dataKey: "day" }]}
                              grid={{ horizontal: true }}
                              hideLegend
                              series={[
                                { dataKey: "steps", label: "Steps", color: hues.activity },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader
                          title="Stress and recovery"
                          description="Stress above the line, recovery below"
                        />
                        <CardContent>
                          <div className="chart-frame tall">
                            <DashboardBarChart
                              className="dashboard-chart"
                              dataset={stressChartData}
                              xAxis={[{ scaleType: "band", dataKey: "day" }]}
                              yAxis={[
                                {
                                  valueFormatter: (v: number) => `${Math.abs(v)}h`,
                                },
                              ]}
                              grid={{ horizontal: true }}
                              series={[
                                {
                                  dataKey: "stress",
                                  label: "Stress",
                                  stack: "balance",
                                  color: hues.stress,
                                  valueFormatter: (v: number | null) =>
                                    v == null ? "" : `${Math.abs(v)}h`,
                                },
                                {
                                  dataKey: "recovery",
                                  label: "Recovery",
                                  stack: "balance",
                                  color: hues.optimal,
                                  valueFormatter: (v: number | null) =>
                                    v == null ? "" : `${Math.abs(v)}h`,
                                },
                              ]}
                              height={320}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader
                        title="Activity log"
                        description="Steps and energy across your history"
                      />
                      <CardContent>
                        <MetricTable
                          columns={activityColumns}
                          rows={activityRows}
                          rowKey={(row) => row.day}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "insights" && (
                  <div className="dashboard-stack">
                    <div
                      className="halo-module-head"
                      style={{ "--hue": "var(--ai)" } as React.CSSProperties}
                    >
                      <span className="rule" />
                      <p>Current recovery posture, key risks, and next best actions.</p>
                    </div>

                    <section className="halo-verdict" aria-label="Today's verdict">
                      <ScoreRing score={latestReadiness?.score ?? null} size={140} strokeWidth={10} />
                      <div className="halo-verdict-copy">
                        <span className="halo-verdict-posture">
                          Posture: {recoveryPosture}
                        </span>
                        <span className="halo-verdict-headline">{headline}</span>
                        <span className="halo-verdict-body">
                          {latestReadiness
                            ? `Readiness is ${latestReadiness.score} (${BAND_LABEL[scoreBand(latestReadiness.score)].toLowerCase()}). Resting HR ${latestReadiness.rhr} bpm and HRV ${latestReadiness.hrv} ms${
                                tempFlag
                                  ? `, with temperature ${latestReadiness.temperature_deviation > 0 ? "+" : ""}${latestReadiness.temperature_deviation.toFixed(1)} °C off baseline`
                                  : ""
                              }.`
                            : "Sync your ring to build today's verdict."}
                        </span>
                        <span className="halo-verdict-meta">
                          {heroDate
                            ? `From data through ${formatDayLabel(heroDate)} · rule-based, computed locally`
                            : "Waiting for enough history"}
                        </span>
                      </div>
                    </section>

                    {weekCompare && (
                      <>
                        <div className="halo-topbar-overline" style={{ marginTop: 8 }}>
                          This week vs last week
                        </div>
                        <section className="halo-vitals" aria-label="Week over week">
                          {weekCompare.map((entry) => (
                            <Kpi
                              key={entry.label}
                              label={entry.label}
                              value={entry.cur != null ? entry.format(entry.cur) : "—"}
                              unit={entry.unit}
                              note={
                                entry.prev != null && entry.cur != null ? (
                                  <DeltaChip
                                    value={entry.cur - entry.prev}
                                    higherIsBetter={entry.higherIsBetter}
                                    format={(v) =>
                                      entry.label === "Steps"
                                        ? Math.abs(Math.round(v)).toLocaleString()
                                        : `${Math.abs(Math.round(v))}`
                                    }
                                  />
                                ) : (
                                  "no prior week yet"
                                )
                              }
                            />
                          ))}
                        </section>
                      </>
                    )}

                    <div className="halo-insights-grid">
                      <div className="halo-findings" aria-label="Findings">
                        <div className="halo-topbar-overline">What to act on</div>
                        {insights.map((insight) => (
                          <div key={insight.title} className={`halo-finding ${insight.variant}`}>
                            <span className="halo-finding-title">{insight.title}</span>
                            <span className="halo-finding-body">{insight.body}</span>
                            {insight.tab && (
                              <button
                                type="button"
                                className="halo-finding-cta"
                                onClick={() => setActiveTab(insight.tab as TabKey)}
                              >
                                {insight.cta} →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <Card>
                        <CardHeader
                          title="Unusual readings"
                          description="Days that stood out from your own normal"
                        />
                        <CardContent>
                          <div className="halo-anomalies">
                            {anomalies.length === 0 ? (
                              <span className="halo-empty-note">
                                No unusual readings in this window — steady is good.
                              </span>
                            ) : (
                              anomalies.map((item, index) => (
                                <div className="halo-anomaly" key={`${item.day}-${index}`}>
                                  <span className="halo-anomaly-date">
                                    {formatDayLabel(item.day)}
                                  </span>
                                  <span className={`halo-anomaly-dot ${item.tone}`} />
                                  <span className="halo-anomaly-text">
                                    <strong>{item.metric}</strong> — {item.detail}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Main>
      </AppShell>
    </ThemeProvider>
  );
}

export default App;
