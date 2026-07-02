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
  sleepCompare?: SleepRecord[];
  readiness: ReadinessRecord[];
  readinessCompare?: ReadinessRecord[];
  activity: ActivityRecord[];
  activityCompare?: ActivityRecord[];
  stress: StressRecord[];
  sleepDebt?: Array<{ day: string; debt: number }>;
  acwr?: Array<{ day: string; acute: number; chronic: number; ratio: number }>;
  anomalies?: Array<{ day: string; metric_id: string; value: number; z_score: number }>;
  illnessWarning?: boolean;
  worstContributor?: { source: string; name: string; score: number } | null;
  workouts?: any[];
  cardioAge?: any[];
  vo2Max?: any[];
  resilience?: any[];
  rawSleep?: any[];
  rawReadiness?: any[];
  rawActivity?: any[];
  correlations?: Record<string, Record<string, number>>;
  tagEffects?: any[];
  targets?: any;
  profile?: any;
}

export type TabKey =
  | "home"
  | "sleep"
  | "readiness"
  | "activity"
  | "heart"
  | "stress"
  | "cardio"
  | "workouts"
  | "correlation"
  | "experiments"
  | "anomalies"
  | "insights"
  | "daystrip"
  | "compare"
  | "settings";
