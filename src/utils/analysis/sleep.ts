import { mean, sampleStandardDeviation } from "./statistics.js";

export interface SleepDebtResult {
  targetHours: number;
  actualHours: number;
  debtHours: number; // negative = sleep surplus
  debtPercentage: number;
  status: "surplus" | "balanced" | "mild_debt" | "significant_debt";
}

/**
 * Calculate sleep debt against a target (default 8 hours)
 */
export function sleepDebt(sleepDurations: number[], targetHours = 8): SleepDebtResult {
  const actualHours = mean(sleepDurations) / 3600;
  const debtHours = targetHours - actualHours;
  const debtPercentage = ((targetHours - actualHours) / targetHours) * 100;

  let status: "surplus" | "balanced" | "mild_debt" | "significant_debt";
  if (debtHours <= -0.5) status = "surplus";
  else if (debtHours < 0.5) status = "balanced";
  else if (debtHours < 1.5) status = "mild_debt";
  else status = "significant_debt";

  return {
    targetHours,
    actualHours,
    debtHours,
    debtPercentage,
    status,
  };
}

export interface SleepRegularityResult {
  bedtimeStd: number; // hours
  waketimeStd: number; // hours
  regularityScore: number; // 0-100, higher = more regular
  status: "very_regular" | "regular" | "somewhat_irregular" | "irregular";
}

/**
 * Calculate sleep regularity based on consistency of bed/wake times
 */
export function sleepRegularity(bedtimes: string[], waketimes: string[]): SleepRegularityResult {
  const extractHour = (iso: string): number => {
    const date = new Date(iso);
    let hour = date.getHours() + date.getMinutes() / 60;
    if (hour < 12) hour += 24;
    return hour;
  };

  const bedtimeHours = bedtimes.map(extractHour);
  const waketimeHours = waketimes.map((iso) => {
    const date = new Date(iso);
    return date.getHours() + date.getMinutes() / 60;
  });

  const bedtimeStd = sampleStandardDeviation(bedtimeHours);
  const waketimeStd = sampleStandardDeviation(waketimeHours);

  const avgStd = (bedtimeStd + waketimeStd) / 2;
  const regularityScore = Math.max(0, Math.min(100, 100 - (avgStd - 0.5) * (100 / 1.5)));

  let status: "very_regular" | "regular" | "somewhat_irregular" | "irregular";
  if (regularityScore >= 80) status = "very_regular";
  else if (regularityScore >= 60) status = "regular";
  else if (regularityScore >= 40) status = "somewhat_irregular";
  else status = "irregular";

  return {
    bedtimeStd,
    waketimeStd,
    regularityScore,
    status,
  };
}

export interface SleepStageRatios {
  deepRatio: number; // 0-1, percentage as decimal
  remRatio: number;
  lightRatio: number;
  deepPercent: number; // 0-100
  remPercent: number;
  lightPercent: number;
  deepStatus: "low" | "normal" | "good" | "excellent";
  remStatus: "low" | "normal" | "good" | "excellent";
  totalSleepSeconds: number;
}

/**
 * Calculate sleep stage ratios from duration data
 */
export function sleepStageRatios(
  deepSeconds: number,
  remSeconds: number,
  lightSeconds: number
): SleepStageRatios {
  const totalSleepSeconds = deepSeconds + remSeconds + lightSeconds;

  if (totalSleepSeconds === 0) {
    return {
      deepRatio: 0,
      remRatio: 0,
      lightRatio: 0,
      deepPercent: 0,
      remPercent: 0,
      lightPercent: 0,
      deepStatus: "low",
      remStatus: "low",
      totalSleepSeconds: 0,
    };
  }

  const deepRatio = deepSeconds / totalSleepSeconds;
  const remRatio = remSeconds / totalSleepSeconds;
  const lightRatio = lightSeconds / totalSleepSeconds;

  const deepPercent = deepRatio * 100;
  const remPercent = remRatio * 100;
  const lightPercent = lightRatio * 100;

  let deepStatus: "low" | "normal" | "good" | "excellent";
  if (deepPercent < 10) deepStatus = "low";
  else if (deepPercent < 15) deepStatus = "normal";
  else if (deepPercent < 20) deepStatus = "good";
  else deepStatus = "excellent";

  let remStatus: "low" | "normal" | "good" | "excellent";
  if (remPercent < 15) remStatus = "low";
  else if (remPercent < 20) remStatus = "normal";
  else if (remPercent < 25) remStatus = "good";
  else remStatus = "excellent";

  return {
    deepRatio,
    remRatio,
    lightRatio,
    deepPercent,
    remPercent,
    lightPercent,
    deepStatus,
    remStatus,
    totalSleepSeconds,
  };
}

export interface ComputedSleepScore {
  score: number; // 0-100
  components: {
    efficiencyScore: number;
    deepScore: number;
    remScore: number;
  };
  interpretation: "poor" | "fair" | "good" | "excellent";
}

/**
 * Compute a sleep quality score from key metrics
 */
export function computeSleepScore(
  efficiency: number,
  deepPercent: number,
  remPercent: number
): ComputedSleepScore {
  const efficiencyScore = Math.min(100, efficiency);
  const deepScore = Math.min(100, (deepPercent / 20) * 100);
  const remScore = Math.min(100, (remPercent / 25) * 100);

  const score = 0.5 * efficiencyScore + 0.3 * deepScore + 0.2 * remScore;

  let interpretation: "poor" | "fair" | "good" | "excellent";
  if (score < 50) interpretation = "poor";
  else if (score < 70) interpretation = "fair";
  else if (score < 85) interpretation = "good";
  else interpretation = "excellent";

  return {
    score: Math.round(score),
    components: {
      efficiencyScore: Math.round(efficiencyScore),
      deepScore: Math.round(deepScore),
      remScore: Math.round(remScore),
    },
    interpretation,
  };
}

export interface HrvRecoveryPattern {
  firstHalfAvg: number; // Average HRV in first half of sleep (ms)
  secondHalfAvg: number; // Average HRV in second half of sleep (ms)
  difference: number; // firstHalf - secondHalf
  differencePercent: number; // Percentage difference
  pattern: "good_recovery" | "flat" | "declining" | "insufficient_data";
  interpretation: string;
}

/**
 * Analyze HRV recovery pattern during sleep
 */
export function hrvRecoveryPattern(hrvSamples: number[]): HrvRecoveryPattern {
  const validSamples = hrvSamples.filter((v) => v > 0 && isFinite(v));

  if (validSamples.length < 4) {
    return {
      firstHalfAvg: 0,
      secondHalfAvg: 0,
      difference: 0,
      differencePercent: 0,
      pattern: "insufficient_data",
      interpretation: "Not enough HRV samples to analyze recovery pattern (need at least 4).",
    };
  }

  const midpoint = Math.floor(validSamples.length / 2);
  const firstHalf = validSamples.slice(0, midpoint);
  const secondHalf = validSamples.slice(midpoint);

  const firstHalfAvg = mean(firstHalf);
  const secondHalfAvg = mean(secondHalf);
  const difference = firstHalfAvg - secondHalfAvg;
  const differencePercent = secondHalfAvg !== 0 ? (difference / secondHalfAvg) * 100 : 0;

  let pattern: "good_recovery" | "flat" | "declining";
  let interpretation: string;

  if (differencePercent > 5) {
    pattern = "good_recovery";
    interpretation = `Good recovery pattern: HRV was ${Math.abs(differencePercent).toFixed(0)}% higher in the first half of the night, indicating healthy parasympathetic activity during deep sleep.`;
  } else if (differencePercent < -5) {
    pattern = "declining";
    interpretation = `Declining pattern: HRV was ${Math.abs(differencePercent).toFixed(0)}% lower in the first half of the night. This may indicate stress, alcohol consumption, late meals, or incomplete recovery.`;
  } else {
    pattern = "flat";
    interpretation = `Flat pattern: HRV was relatively stable throughout the night. This is neutral - neither strong recovery nor concerning.`;
  }

  return {
    firstHalfAvg: Math.round(firstHalfAvg * 10) / 10,
    secondHalfAvg: Math.round(secondHalfAvg * 10) / 10,
    difference: Math.round(difference * 10) / 10,
    differencePercent: Math.round(differencePercent * 10) / 10,
    pattern,
    interpretation,
  };
}
