import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  formatSecondsToHours,
  formatHours,
  formatDayLabel,
  formatLongDate,
  greeting,
  average,
  zScorer
} from './utils.ts'; // Changed to explicit .ts or allow resolution to handle it (Vitest usually handles .ts imports without extension or with .ts just fine)

describe('formatSecondsToHours', () => {
  it('formats seconds into hours and minutes', () => {
    expect(formatSecondsToHours(3600)).toBe('1h 0m');
    expect(formatSecondsToHours(3660)).toBe('1h 1m');
    expect(formatSecondsToHours(7200)).toBe('2h 0m');
    expect(formatSecondsToHours(1800)).toBe('0h 30m');
  });
});

describe('formatHours', () => {
  it('formats seconds into decimal hours with 1 decimal place', () => {
    expect(formatHours(3600)).toBe('1.0h');
    expect(formatHours(5400)).toBe('1.5h');
    expect(formatHours(3660)).toBe('1.0h'); // 1.01666 -> 1.0
  });
});

describe('formatDayLabel', () => {
  it('formats a standard date string into short month and numeric day', () => {
    const result = formatDayLabel('2023-10-15');
    // E.g., 'Oct 15'
    expect(result).toMatch(/Oct 15|15 Oct/i);
  });

  it('formats a leap year date correctly', () => {
    const result = formatDayLabel('2024-02-29');
    expect(result).toMatch(/Feb 29|29 Feb/i);
  });

  it('formats a single digit day correctly', () => {
    const result = formatDayLabel('2023-01-05');
    expect(result).toMatch(/Jan 5|5 Jan/i);
  });
});

describe('formatLongDate', () => {
  it('formats date string with weekday, long month, and numeric day', () => {
    const result = formatLongDate('2023-10-15'); // Oct 15, 2023 was a Sunday
    expect(result).toMatch(/Sunday/i);
    expect(result).toMatch(/October/i);
    expect(result).toMatch(/15/);
  });
});

describe('greeting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Good night before 5 AM', () => {
    vi.setSystemTime(new Date('2023-01-01T03:00:00'));
    expect(greeting()).toBe('Good night');
  });

  it('returns Good morning before 12 PM', () => {
    vi.setSystemTime(new Date('2023-01-01T09:00:00'));
    expect(greeting()).toBe('Good morning');
  });

  it('returns Good afternoon before 6 PM', () => {
    vi.setSystemTime(new Date('2023-01-01T15:00:00'));
    expect(greeting()).toBe('Good afternoon');
  });

  it('returns Good evening after 6 PM', () => {
    vi.setSystemTime(new Date('2023-01-01T20:00:00'));
    expect(greeting()).toBe('Good evening');
  });
});

describe('average', () => {
  it('calculates the average of an array of numbers', () => {
    expect(average([10, 20, 30])).toBe(20);
  });

  it('ignores zero, negative, and non-finite values', () => {
    expect(average([10, -5, 0, NaN, Infinity, 30])).toBe(20); // valid are 10, 30
  });

  it('returns null for an empty array', () => {
    expect(average([])).toBeNull();
  });

  it('returns null if no valid numbers are provided', () => {
    expect(average([-1, 0, NaN])).toBeNull();
  });
});

describe('zScorer', () => {
  it('returns 0 for z and mean if fewer than 5 valid values are provided', () => {
    const { z, mean } = zScorer([1, 2, 3, 4]);
    expect(mean).toBe(0);
    expect(z(10)).toBe(0);
  });

  it('calculates mean and provides z-score function for valid values', () => {
    // Valid values: 2, 4, 4, 4, 5, 5, 7, 9
    // mean: 40 / 8 = 5
    // std dev: approx 2
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const { z, mean } = zScorer(values);
    expect(mean).toBe(5);

    // z = (v - mean) / sd
    // sd = sqrt(((2-5)^2 + 3*(4-5)^2 + 2*(5-5)^2 + (7-5)^2 + (9-5)^2) / 7)
    // sd = sqrt((9 + 3 + 0 + 4 + 16) / 7) = sqrt(32 / 7) = sqrt(4.57) approx 2.138
    const expectedSd = Math.sqrt(32 / 7);
    expect(z(5)).toBe(0);
    expect(z(5 + expectedSd)).toBeCloseTo(1);
    expect(z(5 - expectedSd)).toBeCloseTo(-1);
  });

  it('handles standard deviation of 0 gracefully', () => {
    const { z, mean } = zScorer([5, 5, 5, 5, 5]);
    expect(mean).toBe(5);
    expect(z(10)).toBe(0);
  });
});
