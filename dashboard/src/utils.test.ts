import { expect, test, describe } from 'vitest';
import { formatSecondsToHours } from './utils';

describe('formatSecondsToHours', () => {
  test('formats 0 seconds correctly', () => {
    expect(formatSecondsToHours(0)).toBe('0h 0m');
  });

  test('formats exact hours without minutes correctly', () => {
    expect(formatSecondsToHours(3600)).toBe('1h 0m');
    expect(formatSecondsToHours(7200)).toBe('2h 0m');
  });

  test('formats hours with exact minutes correctly', () => {
    expect(formatSecondsToHours(5400)).toBe('1h 30m');
    expect(formatSecondsToHours(3660)).toBe('1h 1m');
  });

  test('rounds minutes correctly', () => {
    expect(formatSecondsToHours(5429)).toBe('1h 30m'); // 1h 30.4833m -> 1h 30m
    expect(formatSecondsToHours(5430)).toBe('1h 31m'); // 1h 30.5m -> 1h 31m
  });

  test('formats less than an hour correctly', () => {
    expect(formatSecondsToHours(1800)).toBe('0h 30m');
    expect(formatSecondsToHours(59)).toBe('0h 1m'); // 59s -> 0.9833m -> 1m
  });
});
