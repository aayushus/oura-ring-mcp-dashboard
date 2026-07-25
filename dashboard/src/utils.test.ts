import { describe, it, expect } from 'vitest';
import { formatHours } from './utils';

describe('formatHours', () => {
  it('should format exactly 1 hour correctly', () => {
    expect(formatHours(3600)).toBe('1.0h');
  });

  it('should handle zero seconds', () => {
    expect(formatHours(0)).toBe('0.0h');
  });

  it('should handle half hours correctly', () => {
    expect(formatHours(1800)).toBe('0.5h');
  });

  it('should handle longer durations correctly', () => {
    expect(formatHours(36000)).toBe('10.0h');
  });

  it('should handle negative durations correctly', () => {
    expect(formatHours(-1800)).toBe('-0.5h');
    expect(formatHours(-3600)).toBe('-1.0h');
  });

  it('should round fractional hours correctly to 1 decimal place', () => {
    expect(formatHours(3780)).toBe('1.1h'); // 1.05 hours -> 1.1h
    expect(formatHours(3660)).toBe('1.0h'); // 1.0166... hours -> 1.0h
    expect(formatHours(7199)).toBe('2.0h'); // 1.9997... hours -> 2.0h
  });
});
