export function formatSecondsToHours(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

export function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function formatDayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function average(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/* z-score helper for the anomaly feed (FEATURES F-4, simplified:
   baseline = the whole loaded window) */
export function zScorer(values: number[]): { z: (v: number) => number; mean: number } {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length < 5) return { z: () => 0, mean: 0 };
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const sd = Math.sqrt(
    valid.reduce((s, v) => s + (v - mean) ** 2, 0) / (valid.length - 1)
  );
  return { z: (v: number) => (sd > 0 ? (v - mean) / sd : 0), mean };
}
