/**
 * Calculate the mean of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 * Uses population standard deviation (N) for consistency with scipy.stats
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate sample standard deviation (N-1 denominator)
 * Use for small samples when estimating population std
 */
export function sampleStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

/**
 * Calculate quantiles (0-1 range)
 * e.g., quantile(arr, 0.25) for Q1, quantile(arr, 0.75) for Q3
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Calculate min value
 */
export function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate max value
 */
export function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

export interface RollingAverageResult {
  value: number;
  window: number;
  count: number; // actual data points in window
}

/**
 * Calculate rolling averages for multiple windows
 * Returns averages for 7-day, 14-day, and 30-day windows
 */
export function rollingAverages(values: number[]): {
  day7: RollingAverageResult;
  day14: RollingAverageResult;
  day30: RollingAverageResult;
} {
  const calc = (window: number): RollingAverageResult => {
    const slice = values.slice(-window);
    return {
      value: mean(slice),
      window,
      count: slice.length,
    };
  };

  return {
    day7: calc(7),
    day14: calc(14),
    day30: calc(30),
  };
}

/**
 * Calculate a single rolling average for a custom window
 */
export function rollingAverage(values: number[], window: number): RollingAverageResult {
  const slice = values.slice(-window);
  return {
    value: mean(slice),
    window,
    count: slice.length,
  };
}

export interface DispersionResult {
  mean: number;
  standardDeviation: number;
  coefficientOfVariation: number; // CV = std/mean (as percentage)
  min: number;
  max: number;
  range: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
}

/**
 * Calculate dispersion/variability metrics
 */
export function dispersion(values: number[]): DispersionResult {
  if (values.length === 0) {
    return {
      mean: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
      min: 0,
      max: 0,
      range: 0,
      q1: 0,
      median: 0,
      q3: 0,
      iqr: 0,
    };
  }

  const avg = mean(values);
  const std = standardDeviation(values);
  const minVal = min(values);
  const maxVal = max(values);
  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);

  return {
    mean: avg,
    standardDeviation: std,
    coefficientOfVariation: avg !== 0 ? (std / avg) * 100 : 0,
    min: minVal,
    max: maxVal,
    range: maxVal - minVal,
    q1,
    median,
    q3,
    iqr: q3 - q1,
  };
}
