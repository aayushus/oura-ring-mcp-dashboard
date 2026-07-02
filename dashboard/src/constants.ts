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
  insights: "Insights",
};
