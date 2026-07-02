export interface SleepRecord {
  day: string;
  score: number;
  duration: number;
  deep: number;
  rem: number;
  light: number;
  efficiency: number;
}

export interface ReadinessRecord {
  day: string;
  score: number;
  hrv: number;
  rhr: number;
  temperature_deviation: number;
}

export interface ActivityRecord {
  day: string;
  score: number;
  steps: number;
  active_calories: number;
  total_calories: number;
}

export interface StressRecord {
  day: string;
  stress_duration: number;
  recovery_duration: number;
}

export interface HistorySummary {
  sleep: SleepRecord[];
  readiness: ReadinessRecord[];
  activity: ActivityRecord[];
  stress: StressRecord[];
}

export type TabKey = "home" | "sleep" | "readiness" | "activity" | "insights";
