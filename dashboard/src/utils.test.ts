import { describe, it, expect } from 'vitest';
import { zScorer } from './utils';

describe('zScorer', () => {
  it('returns mean 0 and z-score 0 when fewer than 5 valid numbers are provided', () => {
    const { mean, z } = zScorer([1, 2, 3, 4]);
    expect(mean).toBe(0);
    expect(z(10)).toBe(0);
  });

  it('ignores non-positive and non-finite numbers', () => {
    // 4 valid numbers, plus invalid ones, so it falls back to 0
    const { mean, z } = zScorer([1, 2, 3, 4, -1, 0, NaN, Infinity, -Infinity]);
    expect(mean).toBe(0);
    expect(z(10)).toBe(0);
  });

  it('computes mean and correct z-score for a valid array', () => {
    // Array: 2, 4, 4, 4, 5, 5, 7, 9
    // mean = 40 / 8 = 5
    // squared differences from 5:
    // (2-5)^2 = 9
    // (4-5)^2 = 1 (*3) = 3
    // (5-5)^2 = 0 (*2) = 0
    // (7-5)^2 = 4
    // (9-5)^2 = 16
    // sum = 9 + 3 + 0 + 4 + 16 = 32
    // variance (sample) = 32 / (8 - 1) = 32 / 7 = 4.571428...
    // sd = sqrt(4.571428...) = 2.1380899...
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const { mean, z } = zScorer(values);
    expect(mean).toBe(5);

    // Test z-score for value 9
    // (9 - 5) / 2.1380899...
    const expectedZFor9 = (9 - 5) / Math.sqrt(32 / 7);
    expect(z(9)).toBeCloseTo(expectedZFor9);

    // Test z-score for value 5 (mean)
    expect(z(5)).toBe(0);
  });

  it('returns z-score 0 when standard deviation is 0', () => {
    // Array of 5 identical numbers
    const { mean, z } = zScorer([3, 3, 3, 3, 3]);
    expect(mean).toBe(3);
    // Since all values are identical, sd = 0. The function should return 0 to avoid division by zero.
    expect(z(5)).toBe(0);
  });
});
