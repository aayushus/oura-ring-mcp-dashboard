/**
 * Target Engine for Oura Dashboard++
 * Calculates and dynamically adjusts user target metrics based on profile and history
 */

import {
  getUserProfile,
  getUserTargets,
  upsertUserTargets,
  addTargetHistory,
  getRawDocuments,
  UserProfile,
  UserTargets,
} from "../db.js";
import { getToday, getDaysAgo } from "./index.js";

// Helper to compute median of an array of numbers
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return (sorted[half - 1] + sorted[half]) / 2.0;
}

// Helper to check if a day is a weekday (Monday-Friday)
function isWeekday(dayStr: string): boolean {
  const date = new Date(dayStr + "T00:00:00Z");
  const day = date.getUTCDay();
  return day >= 1 && day <= 5; // 1 = Monday, 5 = Friday
}

// Helper to parse "HH:MM" clock time into minutes relative to midnight
export function parseClockTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper to format minutes relative to midnight back into "HH:MM" clock time
export function formatMinutesToClockTime(minutes: number): string {
  let normalized = minutes % 1440;
  if (normalized < 0) {
    normalized += 1440;
  }
  const hours = Math.floor(normalized / 60);
  const mins = Math.floor(normalized % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Seed sleep target based on age
 */
export function getSeedSleepNeed(age: number): number {
  if (age <= 25) return 8.0 * 3600; // 8 hours in seconds
  if (age <= 64) return 7.75 * 3600; // 7.75 hours in seconds
  return 7.25 * 3600; // 7.25 hours in seconds
}

/**
 * 1. Sleep Need Calculation (C0.2)
 */
export function calculateSleepNeed(
  profile: UserProfile,
  previousTargets: UserTargets | null,
  readinessScores: any[],
  sleepSessions: any[]
): { sleepNeed: number; reason: string } {
  const seed = getSeedSleepNeed(profile.age);

  // Group readiness scores by day
  const readinessByDay = new Map(readinessScores.map((r) => [r.day, r.score]));

  // Heuristic: check if sleep was alarm-truncated
  // bedtime_end within ±15 minutes of target_wake_time on a weekday
  const wakeTimeMinutes = parseClockTimeToMinutes(profile.target_wake_time);

  const goodSleepDurations: number[] = [];

  for (const session of sleepSessions) {
    const day = session.day;
    const readinessScore = readinessByDay.get(day) ?? 0;

    // Check if readiness is optimal (>= 80)
    if (readinessScore >= 80) {
      // Check weekday alarm truncation
      if (isWeekday(day) && session.bedtime_end) {
        // Extract time from bedtime_end string (e.g. "2024-01-01T07:12:34+00:00")
        const endParts = session.bedtime_end.split("T");
        if (endParts.length > 1) {
          const timePart = endParts[1].substring(0, 5); // "HH:MM"
          const endMinutes = parseClockTimeToMinutes(timePart);
          const diff = Math.abs(endMinutes - wakeTimeMinutes);
          if (diff <= 15) {
            // Likely alarm truncated; exclude
            continue;
          }
        }
      }

      if (session.total_sleep_duration) {
        goodSleepDurations.push(session.total_sleep_duration);
      }
    }
  }

  // If insufficient good sleep history, use seed target
  if (goodSleepDurations.length < 10) {
    const prev = previousTargets ? previousTargets.sleep_need_seconds : seed;
    return {
      sleepNeed: prev,
      reason: `Using seed target based on age ${profile.age} due to insufficient history (<10 well-recovered nights).`,
    };
  }

  // Calculate median total sleep on good days
  const estimate = median(goodSleepDurations);

  // blend estimate with age seed, clamp between 6.5h and 9.5h
  const computed = 0.7 * estimate + 0.3 * seed;
  const clamped = Math.max(6.5 * 3600, Math.min(9.5 * 3600, computed));

  // Apply change dampening of at most ±15 min (900 seconds) vs previous targets
  let finalSleepNeed = clamped;
  if (previousTargets) {
    const diff = clamped - previousTargets.sleep_need_seconds;
    if (Math.abs(diff) > 900) {
      finalSleepNeed = previousTargets.sleep_need_seconds + Math.sign(diff) * 900;
    }
  }

  const reason = `Your best mornings followed ~${(estimate / 3600).toFixed(2)}h nights (${goodSleepDurations.length} nights with readiness ≥ 80).`;
  return { sleepNeed: Math.round(finalSleepNeed), reason };
}

/**
 * 2. Recommended Bedtime Calculation (C0.2)
 */
export function calculateRecommendedBedtime(
  profile: UserProfile,
  sleepNeedSeconds: number,
  sleepSessions: any[]
): string {
  const wakeTimeMinutes = parseClockTimeToMinutes(profile.target_wake_time);

  // Get sleep latency and awake time from last 30 days
  const latencies: number[] = [];
  const awakeTimes: number[] = [];

  for (const session of sleepSessions) {
    if (session.latency) latencies.push(session.latency);
    if (session.awake_time) awakeTimes.push(session.awake_time);
  }

  // Convert medians from seconds to minutes
  const medianLatencyMin = median(latencies) / 60;
  const medianAwakeMin = median(awakeTimes) / 60;

  const sleepNeedMin = sleepNeedSeconds / 60;

  // recommended_bedtime = target_wake_time - sleep_need - median(latency) - median(awake)
  const bedtimeMinutes = wakeTimeMinutes - sleepNeedMin - medianLatencyMin - medianAwakeMin;

  return formatMinutesToClockTime(bedtimeMinutes);
}

/**
 * 3. Step Goal Calculation (C0.3)
 */
export function calculateStepGoal(
  profile: UserProfile,
  previousTargets: UserTargets | null,
  dailyActivities: any[]
): { stepGoal: number; reason: string } {
  // Seed step goal: 7000 + 1000 * min(training_days, 3)
  const seed = 7000 + 1000 * Math.min(profile.training_days, 3);

  // Filter out low-wear days: daily_activity.non_wear_time > 21600 (6 hours)
  const validSteps = dailyActivities
    .filter((act) => !(act.non_wear_time && act.non_wear_time > 21600))
    .map((act) => act.steps ?? 0);

  if (validSteps.length < 14) {
    const prev = previousTargets ? previousTargets.step_goal : seed;
    return {
      stepGoal: prev,
      reason: "Using onboarding seed target due to insufficient activity history (<14 valid wear days).",
    };
  }

  // Compute median steps over trailing period
  const baseSteps = median(validSteps);

  // 10% above median, rounded to nearest 500 steps
  const targetRaw = baseSteps * 1.1;
  const roundedTo500 = Math.round(targetRaw / 500) * 500;
  const clamped = Math.max(6000, Math.min(16000, roundedTo500));

  // Apply dampening: move at most ±1000 steps from previous step goal
  let finalStepGoal = clamped;
  if (previousTargets) {
    const diff = clamped - previousTargets.step_goal;
    if (Math.abs(diff) > 1000) {
      finalStepGoal = previousTargets.step_goal + Math.sign(diff) * 1000;
    }
  }

  const reason = `Computed step target based on 10% stretch over your trailing median steps of ${Math.round(baseSteps)}.`;
  return { stepGoal: finalStepGoal, reason };
}

/**
 * 4. Max HR Calculation (C0.5)
 */
export function calculateMaxHr(profile: UserProfile, hrSamples: any[]): number {
  // Tanaka formula: 208 - 0.7 * age
  const tanakaMax = 208 - 0.7 * profile.age;

  // Find max HR in workout samples over last 90 days
  let observedMax = 0;
  for (const sample of hrSamples) {
    // heartrate endpoint data rows have bpm
    if (sample.bpm && sample.bpm > observedMax) {
      observedMax = sample.bpm;
    }
  }

  // Observed data wins if higher than Tanaka
  return Math.max(tanakaMax, observedMax);
}

/**
 * 5. BMR Calculation (C0.4)
 */
export function calculateBmr(profile: UserProfile): number {
  // Mifflin-St Jeor formula
  const isMale = profile.biological_sex.toLowerCase() === "male";
  const weightFactor = 10 * profile.weight_kg;
  const heightFactor = 6.25 * profile.height_cm;
  const ageFactor = 5 * profile.age;

  if (isMale) {
    return weightFactor + heightFactor - ageFactor + 5;
  } else {
    return weightFactor + heightFactor - ageFactor - 161;
  }
}

/**
 * Main weekly recompute job
 */
export async function runWeeklyTargetJob(userId: number = 1): Promise<void> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    console.log("[Target Engine] No user profile configured. Skipping targets calculation.");
    return;
  }

  console.log("[Target Engine] Running weekly recompute target metrics...");

  const previousTargets = await getUserTargets(userId);

  const startDate = getDaysAgo(60);
  const endDate = getToday();

  // Load raw data from database
  const readinessScores = await getRawDocuments("daily_readiness", startDate, endDate, userId);
  const sleepSessions = await getRawDocuments("sleep", startDate, endDate, userId);
  const sleepScores = await getRawDocuments("daily_sleep", startDate, endDate, userId);
  const dailyActivities = await getRawDocuments("daily_activity", getDaysAgo(30), endDate, userId);
  const hrSamples = await getRawDocuments("heartrate", getDaysAgo(90), endDate, userId);

  // 1. Calculate Sleep Need
  const { sleepNeed, reason: sleepReason } = calculateSleepNeed(
    profile,
    previousTargets,
    readinessScores,
    sleepSessions
  );

  // 2. Calculate Recommended Bedtime
  const recommendedBedtime = calculateRecommendedBedtime(profile, sleepNeed, sleepSessions);

  // 3. Calculate Step Goal
  const { stepGoal, reason: stepReason } = calculateStepGoal(
    profile,
    previousTargets,
    dailyActivities
  );

  // 4. Calculate Max HR
  const maxHr = calculateMaxHr(profile, hrSamples);

  // 5. Calculate BMR
  const bmr = calculateBmr(profile);

  const newTargets: UserTargets = {
    sleep_need_seconds: sleepNeed,
    recommended_bedtime: recommendedBedtime,
    step_goal: stepGoal,
    max_hr: maxHr,
    bmr_kcal: bmr,
  };

  // Upsert new targets
  await upsertUserTargets(newTargets, userId);
  const todayStr = getToday();

  // Log changes to history if different
  if (previousTargets) {
    if (previousTargets.sleep_need_seconds !== sleepNeed) {
      const oldVal = `${(previousTargets.sleep_need_seconds / 3600).toFixed(2)}h`;
      const newVal = `${(sleepNeed / 3600).toFixed(2)}h`;
      await addTargetHistory("sleep_need", oldVal, newVal, sleepReason, todayStr, userId);
    }
    if (previousTargets.step_goal !== stepGoal) {
      await addTargetHistory(
        "step_goal",
        previousTargets.step_goal.toString(),
        stepGoal.toString(),
        stepReason,
        todayStr,
        userId
      );
    }
  } else {
    // Initial seeds logging
    await addTargetHistory(
      "sleep_need",
      "Seed",
      `${(sleepNeed / 3600).toFixed(2)}h`,
      "Initial calculation seed.",
      todayStr,
      userId
    );
    await addTargetHistory(
      "step_goal",
      "Seed",
      stepGoal.toString(),
      "Initial calculation seed.",
      todayStr,
      userId
    );
  }

  console.log("[Target Engine] Target metrics recompute complete:", newTargets);
}
