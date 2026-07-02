import { useEffect, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import {
  AIFinding,
  Alert,
  AppShell,
  Button,
  Callout,
  Main,
  ThemeToggle,
} from "./components/components";
import {
  BAND_LABEL,
  HaloMark,
  RailItem,
  scoreBand,
  type MetricColumn,
} from "./components/halo";
import {
  ActivityIcon,
  HomeIcon,
  InsightsIcon,
  ReadinessIcon,
  SleepIcon,
  SettingsIcon,
  HeartIcon,
  Warn,
  StressIcon,
  CardioIcon,
  WorkoutsIcon,
  CorrelationIcon,
  ExperimentsIcon,
  TimelineIcon,
  CompareIcon,
} from "./components/Icons";

import type { HistorySummary, TabKey, SleepRecord, ReadinessRecord, ActivityRecord } from "./types";
import { HUES, TAB_TITLES } from "./constants";
import {
  formatDayLabel,
  formatLongDate,
  greeting,
  average,
  zScorer,
  formatSecondsToHours,
  formatHours,
} from "./utils";

import { HomeView } from "./views/HomeView";
import { SleepView } from "./views/SleepView";
import { ReadinessView } from "./views/ReadinessView";
import { ActivityView } from "./views/ActivityView";
import { InsightsView } from "./views/InsightsView";
import { SettingsView } from "./views/SettingsView";
import { HeartRateView } from "./views/HeartRateView";
import { StressView } from "./views/StressView";
import { CardioView } from "./views/CardioView";
import { WorkoutsView } from "./views/WorkoutsView";
import { CorrelationView } from "./views/CorrelationView";
import { ExperimentsView } from "./views/ExperimentsView";
import { AnomaliesView } from "./views/AnomaliesView";
import { DayStripView } from "./views/DayStripView";
import { CompareView } from "./views/CompareView";
import { WeeklyReportView } from "./views/WeeklyReportView";
import { CrosshairProvider } from "./context/CrosshairContext";
import { CommandPalette } from "./components/CommandPalette";

function ScoreCell({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <span className={`tone-${band} halo-num`} style={{ fontWeight: 500 }}>
      {score > 0 ? score : "—"}
    </span>
  );
}

const getUrlDay = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("day") || new Date().toISOString().slice(0, 10);
};

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [selectedDay, setSelectedDay] = useState<string>(getUrlDay);
  const [data, setData] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => localStorage.getItem("last_synced_time"));

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("day") !== selectedDay) {
      params.set("day", selectedDay);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [selectedDay]);

  useEffect(() => {
    const handleLocationChange = () => {
      const dayFromUrl = new URLSearchParams(window.location.search).get("day");
      if (dayFromUrl && dayFromUrl !== selectedDay) {
        setSelectedDay(dayFromUrl);
      }
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, [selectedDay]);
  const [comparePrevious, setComparePrevious] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [alertPrefs, setAlertPrefs] = useState<any[]>([]);

  const loadWeeklyData = async () => {
    try {
      const res = await fetch("/api/dashboard/weekly");
      if (res.ok) {
        const json = await res.json();
        setWeeklyData(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAlertPrefs = async () => {
    try {
      const res = await fetch("/api/dashboard/alerts/prefs");
      if (res.ok) {
        const json = await res.json();
        setAlertPrefs(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const muteAlert = async (alertType: string) => {
    try {
      const res = await fetch("/api/dashboard/alerts/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_type: alertType, muted: true }),
      });
      if (res.ok) {
        loadAlertPrefs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Keyboard shortcut listener for Cmd+K / Ctrl+K and Time Travel Date Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // Ignore key events inside editable elements
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const current = new Date(selectedDay + "T00:00:00Z");
        current.setUTCDate(current.getUTCDate() + (e.shiftKey ? -7 : -1));
        setSelectedDay(current.toISOString().slice(0, 10));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const current = new Date(selectedDay + "T00:00:00Z");
        current.setUTCDate(current.getUTCDate() + (e.shiftKey ? 7 : 1));
        setSelectedDay(current.toISOString().slice(0, 10));
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setSelectedDay(new Date().toISOString().slice(0, 10));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDay]);
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

      const response = await fetch(`/api/dashboard/summary?day=${selectedDay}`);
      if (!response.ok) {
        throw new Error(`Failed to load summary: ${response.statusText}`);
      }

      const json = (await response.json()) as HistorySummary;
      setData(json);
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      localStorage.setItem("last_synced_time", timeStr);
      setLastSyncedTime(timeStr);

      // Async fetch supplementary recaps and mute configs
      loadWeeklyData();
      loadAlertPrefs();
    } catch (err) {
      const isOffline = err instanceof TypeError || String(err).includes("Failed to fetch") || String(err).includes("fetch failed");
      setError(isOffline ? "Connection lost. The local dashboard server is offline or unreachable." : (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [selectedDay]);

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
      const isOffline = err instanceof TypeError || String(err).includes("Failed to fetch") || String(err).includes("fetch failed");
      setError(isOffline ? "Connection lost. The local dashboard server is offline or unreachable." : (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncing(false);
      fetchData();
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

  const compareSleepChartData =
    comparePrevious && data?.sleepCompare
      ? data.sleepCompare.map((entry) => ({
          day: formatDayLabel(entry.day),
          duration: Number((entry.duration / 3600).toFixed(1)),
          deep: Number((entry.deep / 3600).toFixed(1)),
          rem: Number((entry.rem / 3600).toFixed(1)),
          light: Number((entry.light / 3600).toFixed(1)),
        }))
      : undefined;

  const compareReadinessChartData =
    comparePrevious && data?.readinessCompare
      ? data.readinessCompare.map((entry) => ({
          day: formatDayLabel(entry.day),
          score: entry.score,
          hrv: entry.hrv,
          rhr: entry.rhr,
          temperature: Number(entry.temperature_deviation.toFixed(2)),
        }))
      : undefined;

  const compareActivityChartData =
    comparePrevious && data?.activityCompare
      ? data.activityCompare.map((entry) => ({
          day: formatDayLabel(entry.day),
          steps: entry.steps,
          activeCalories: entry.active_calories,
          totalCalories: entry.total_calories,
        }))
      : undefined;

  const stressChartData =
    data?.stress.map((entry) => ({
      day: formatDayLabel(entry.day),
      stress: Number((entry.stress_duration / 3600).toFixed(1)),
      recovery: -Number((entry.recovery_duration / 3600).toFixed(1)),
    })) ?? [];

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
    !!(latestReadiness && Math.abs(latestReadiness.temperature_deviation) >= 0.3);

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
    { key: "readiness", label: "Readiness", hue: "var(--hue-readiness)", icon: <ReadinessIcon size={20} /> },
    { key: "activity", label: "Activity", hue: "var(--hue-activity)", icon: <ActivityIcon size={20} /> },
    { key: "heart", label: "Heart Rate", hue: "var(--hue-heart)", icon: <HeartIcon size={20} /> },
    { key: "stress", label: "Stress", hue: "var(--stress)", icon: <StressIcon size={20} /> },
    { key: "cardio", label: "Cardio Age", hue: "var(--hue-heart)", icon: <CardioIcon size={20} /> },
    { key: "workouts", label: "Workouts", hue: "var(--hue-activity)", icon: <WorkoutsIcon size={20} /> },
    { key: "correlation", label: "Correlations", hue: "var(--ai)", icon: <CorrelationIcon size={20} /> },
    { key: "experiments", label: "Experiments", hue: "var(--optimal)", icon: <ExperimentsIcon size={20} /> },
    { key: "anomalies", label: "Anomalies", hue: "var(--low)", icon: <Warn size={20} /> },
    { key: "insights", label: "Insights", hue: "var(--ai)", icon: <InsightsIcon size={20} /> },
    { key: "daystrip", label: "24h Timeline", hue: "var(--accent)", icon: <TimelineIcon size={20} /> },
    { key: "compare", label: "Comparison", hue: "var(--accent)", icon: <CompareIcon size={20} /> },
    { key: "settings", label: "Settings", hue: "var(--divider-strong)", icon: <SettingsIcon size={20} /> },
  ];

  const isReportMode = new URLSearchParams(window.location.search).get("report") === "weekly";

  if (isReportMode) {
    return <WeeklyReportView />;
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CrosshairProvider>
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
                  ? "Syncing past year (365 days)..."
                  : isFresh
                    ? `Up to date${lastSyncedTime ? ` (${lastSyncedTime})` : ""}`
                    : heroDate
                      ? `Data through ${formatDayLabel(heroDate)}`
                      : "No data yet"}
              </span>
              <Button
                variant={comparePrevious ? "primary" : "secondary"}
                onClick={() => setComparePrevious((prev) => !prev)}
                style={{ height: "30px", fontSize: "12.5px" }}
              >
                {comparePrevious ? "Compare: ON" : "Compare Previous"}
              </Button>
              <ThemeToggle />
              <Button variant="primary" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing (365d)..." : "Sync now"}
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
                  <HomeView
                    latestReadiness={latestReadiness}
                    latestSleep={latestSleep}
                    latestActivity={latestActivity}
                    latestStress={latestStress}
                    readinessBaseline={readinessBaseline}
                    sleepBaseline={sleepBaseline}
                    activityBaseline={activityBaseline}
                    rhrBaseline={rhrBaseline}
                    hrvBaseline={hrvBaseline}
                    tempFlag={tempFlag}
                    strainHours={strainHours}
                    recoveryHours={recoveryHours}
                    headline={headline}
                    recoveryPosture={recoveryPosture}
                    readinessChartData={readinessChartData}
                    insights={insights}
                    hues={hues}
                    setActiveTab={setActiveTab}
                    AIFinding={AIFinding}
                    illnessWarning={data?.illnessWarning && !alertPrefs.some((p: any) => p.alert_type === "illness_warning" && p.muted === 1)}
                    worstContributor={data?.worstContributor}
                    onMuteAlert={muteAlert}
                    rawSleep={data?.rawSleep || []}
                    rawReadiness={data?.rawReadiness || []}
                  />
                )}

                {activeTab === "sleep" && (
                  <SleepView
                    sleepChartData={sleepChartData}
                    compareSleepData={compareSleepChartData}
                    sleepRows={sleepRows}
                    sleepColumns={sleepColumns}
                    hues={hues}
                    sleepDebt={data?.sleepDebt || []}
                    rawSleep={data?.rawSleep || []}
                  />
                )}

                {activeTab === "readiness" && (
                  <ReadinessView
                    readinessChartData={readinessChartData}
                    compareReadinessData={compareReadinessChartData}
                    readinessRows={readinessRows}
                    readinessColumns={readinessColumns}
                    hues={hues}
                    illnessWarning={data?.illnessWarning && !alertPrefs.some((p: any) => p.alert_type === "illness_warning" && p.muted === 1)}
                  />
                )}

                {activeTab === "activity" && (
                  <ActivityView
                    activityChartData={activityChartData}
                    compareActivityData={compareActivityChartData}
                    stressChartData={stressChartData}
                    activityRows={activityRows}
                    activityColumns={activityColumns}
                    hues={hues}
                    acwr={data?.acwr || []}
                    targets={data?.targets}
                    rawActivity={data?.rawActivity || []}
                  />
                )}

                {activeTab === "heart" && (
                  <HeartRateView
                    readinessRows={readinessRows}
                    rawSleep={data?.rawSleep || []}
                    hues={hues}
                  />
                )}

                {activeTab === "stress" && (
                  <StressView
                    stressChartData={stressChartData}
                    resilience={data?.resilience || []}
                  />
                )}

                {activeTab === "cardio" && (
                  <CardioView
                    cardioAge={data?.cardioAge || []}
                    vo2Max={data?.vo2Max || []}
                    profile={data?.profile}
                    hues={hues}
                  />
                )}

                {activeTab === "workouts" && (
                  <WorkoutsView
                    workouts={data?.workouts || []}
                    readinessRows={readinessRows}
                    hues={hues}
                  />
                )}

                {activeTab === "correlation" && (
                  <CorrelationView
                    correlations={data?.correlations}
                    tagEffects={data?.tagEffects}
                  />
                )}

                {activeTab === "experiments" && (
                  <ExperimentsView />
                )}

                {activeTab === "anomalies" && (
                  <AnomaliesView />
                )}

                {activeTab === "insights" && (
                  <InsightsView
                    latestReadiness={latestReadiness}
                    recoveryPosture={recoveryPosture}
                    headline={headline}
                    tempFlag={tempFlag}
                    heroDate={heroDate}
                    weekCompare={weekCompare}
                    insights={insights}
                    anomalies={anomalies}
                    setActiveTab={setActiveTab}
                    weeklyData={weeklyData}
                  />
                )}

                {activeTab === "daystrip" && (
                  <DayStripView hues={hues} />
                )}

                {activeTab === "compare" && (
                  <CompareView data={data} hues={hues} />
                )}

                {activeTab === "settings" && (
                  <SettingsView />
                )}
              </>
            )}
          </div>
        </Main>
      </AppShell>
      <CommandPalette
        active={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        setActiveTab={setActiveTab}
      />
      </CrosshairProvider>
    </ThemeProvider>
  );
}

export default App;
