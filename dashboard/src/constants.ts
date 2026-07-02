import type { TabKey } from "./types";

/* Domain hues per theme (DESIGN.md 3.1) — JS copies for chart series,
   kept in sync with tokens.css */
export const HUES = {
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

export const TAB_TITLES: Record<TabKey, string> = {
  home: "Overview",
  sleep: "Sleep",
  readiness: "Readiness",
  activity: "Activity",
  heart: "Heart Rate & HRV",
  stress: "Stress & Resilience",
  cardio: "Cardiovascular Health",
  workouts: "Workouts & Sessions",
  correlation: "Tag Correlation Lab",
  experiments: "Self-Experiments",
  anomalies: "Anomaly Feed",
  insights: "Insights",
  daystrip: "24h Day-Strip",
  compare: "Small-Multiples Lab",
  settings: "Settings",
};

export interface MetricRegistryEntry {
  id: string;
  label: string;
  unit: string;
  direction: "higher_better" | "lower_better" | "neutral";
  source: string;
  explain: string;
  formula: string;
  thresholds: Array<{ gte?: number; lt?: number; color: string }>;
}

export const METRIC_REGISTRY: Record<string, MetricRegistryEntry> = {
  sleep_score: {
    id: "sleep_score",
    label: "Sleep Score",
    unit: "",
    direction: "higher_better",
    source: "Oura Sleep Summary",
    explain: "Overall measure of last night's sleep quality based on duration, efficiency, deep/rem stages, and timing.",
    formula: "Weighted combination of 7 sleep contributors",
    thresholds: [{ gte: 85, color: "var(--score-optimal)" }, { gte: 70, color: "var(--score-good)" }, { lt: 70, color: "var(--score-low)" }],
  },
  readiness_score: {
    id: "readiness_score",
    label: "Readiness Score",
    unit: "",
    direction: "higher_better",
    source: "Oura Readiness Summary",
    explain: "Indicates how prepared your body is for physical and mental strain, built from HRV, sleep, body temp, and activity balance.",
    formula: "Weighted combination of 8 readiness contributors",
    thresholds: [{ gte: 85, color: "var(--score-optimal)" }, { gte: 70, color: "var(--score-good)" }, { lt: 70, color: "var(--score-low)" }],
  },
  activity_score: {
    id: "activity_score",
    label: "Activity Score",
    unit: "",
    direction: "higher_better",
    source: "Oura Activity Summary",
    explain: "Evaluates physical exertion balance over the day and rolling week, checking if you reach move targets while getting recovery.",
    formula: "Combination of active calories, steps, and target training loads",
    thresholds: [{ gte: 85, color: "var(--score-optimal)" }, { gte: 70, color: "var(--score-good)" }, { lt: 70, color: "var(--score-low)" }],
  },
  hrv: {
    id: "hrv",
    label: "Heart Rate Variability",
    unit: "ms",
    direction: "higher_better",
    source: "Oura sleep session average_hrv",
    explain: "Measures the variation in time between consecutive heartbeats, reflecting autonomic nervous system resilience and recovery status.",
    formula: "RMSSD calculation of overnight inter-beat intervals (IBI)",
    thresholds: [{ gte: 50, color: "var(--score-optimal)" }, { gte: 30, color: "var(--score-good)" }, { lt: 30, color: "var(--score-low)" }],
  },
  rhr: {
    id: "rhr",
    label: "Resting Heart Rate",
    unit: "bpm",
    direction: "lower_better",
    source: "Oura sleep session lowest_heart_rate",
    explain: "Your lowest overnight heart rate. A lower resting heart rate is a strong sign of cardiovascular fitness and recovery.",
    formula: "Lowest 10-minute median heartbeat average during sleep",
    thresholds: [{ lt: 60, color: "var(--score-optimal)" }, { lt: 75, color: "var(--score-good)" }, { gte: 75, color: "var(--score-low)" }],
  },
  steps: {
    id: "steps",
    label: "Step Count",
    unit: "steps",
    direction: "higher_better",
    source: "Oura daily_activity.steps",
    explain: "Total number of steps taken during the day. Keeping movement high supports general metabolic health.",
    formula: "Raw pedometer readings aggregated over 24h",
    thresholds: [{ gte: 10000, color: "var(--score-optimal)" }, { gte: 6000, color: "var(--score-good)" }, { lt: 6000, color: "var(--score-low)" }],
  },
  sleep_efficiency: {
    id: "sleep_efficiency",
    label: "Sleep Efficiency",
    unit: "%",
    direction: "higher_better",
    source: "Oura sleep.efficiency",
    explain: "The percentage of time you actually spent asleep while in bed. Values above 85% reflect high-quality sleep setup.",
    formula: "total_sleep_duration / time_in_bed × 100",
    thresholds: [{ gte: 85, color: "var(--score-optimal)" }, { gte: 75, color: "var(--score-good)" }, { lt: 75, color: "var(--score-low)" }],
  },
  sleep_duration: {
    id: "sleep_duration",
    label: "Sleep Duration",
    unit: "h",
    direction: "higher_better",
    source: "Oura sleep.total_sleep_duration",
    explain: "Total amount of time spent in light, deep, and REM sleep stages. Adults generally need 7 to 9 hours.",
    formula: "deep_sleep_duration + rem_sleep_duration + light_sleep_duration",
    thresholds: [{ gte: 28800, color: "var(--score-optimal)" }, { gte: 25200, color: "var(--score-good)" }, { lt: 25200, color: "var(--score-low)" }],
  },
  temperature_deviation: {
    id: "temperature_deviation",
    label: "Body Temperature Deviation",
    unit: "°C",
    direction: "neutral",
    source: "Oura readiness.temperature_deviation",
    explain: "Overnight skin temperature fluctuation compared to your rolling 30-day baseline. Deviations above +0.5°C can signal acute infection.",
    formula: "average_skin_temp - baseline_skin_temp",
    thresholds: [{ lt: 0.3, color: "var(--score-optimal)" }, { lt: 0.5, color: "var(--score-good)" }, { gte: 0.5, color: "var(--score-low)" }],
  },
};

