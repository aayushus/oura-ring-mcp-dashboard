import { mean } from "./statistics.js";

export interface DayOfWeekResult {
  dayAverages: Record<string, number>;
  dayCount: Record<string, number>;
  bestDay: { day: string; average: number };
  worstDay: { day: string; average: number };
  weekdayAverage: number;
  weekendAverage: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Analyze patterns by day of week
 */
export function dayOfWeekAnalysis(
  data: Array<{ date: string; value: number }>
): DayOfWeekResult {
  const dayTotals: Record<string, number[]> = {
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  };

  for (const { date, value } of data) {
    const d = new Date(date);
    const dayIndex = date.includes("T") ? d.getDay() : d.getUTCDay();
    const dayName = DAY_NAMES[dayIndex];
    dayTotals[dayName].push(value);
  }

  const dayAverages: Record<string, number> = {};
  const dayCount: Record<string, number> = {};
  let bestDay = { day: "", average: -Infinity };
  let worstDay = { day: "", average: Infinity };

  for (const day of DAY_NAMES) {
    const avg = mean(dayTotals[day]);
    dayAverages[day] = avg;
    dayCount[day] = dayTotals[day].length;

    if (dayTotals[day].length > 0) {
      if (avg > bestDay.average) {
        bestDay = { day, average: avg };
      }
      if (avg < worstDay.average) {
        worstDay = { day, average: avg };
      }
    }
  }

  const weekdayValues = [
    ...dayTotals.Monday,
    ...dayTotals.Tuesday,
    ...dayTotals.Wednesday,
    ...dayTotals.Thursday,
    ...dayTotals.Friday,
  ];
  const weekendValues = [...dayTotals.Saturday, ...dayTotals.Sunday];

  return {
    dayAverages,
    dayCount,
    bestDay: bestDay.day ? bestDay : { day: "N/A", average: 0 },
    worstDay: worstDay.day ? worstDay : { day: "N/A", average: 0 },
    weekdayAverage: mean(weekdayValues),
    weekendAverage: mean(weekendValues),
  };
}
