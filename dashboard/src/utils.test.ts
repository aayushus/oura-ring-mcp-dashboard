import { describe, it, expect } from 'vitest';
import { average } from './utils';

describe('average', () => {
  it('should calculate the average of valid positive numbers', () => {
    expect(average([1, 2, 3, 4, 5])).toBe(3);
    expect(average([10, 20])).toBe(15);
  });

  it('should filter out zero and negative numbers', () => {
    expect(average([10, 0, -5, 20])).toBe(15);
    expect(average([0, -1, -2])).toBeNull();
  });

  it('should filter out NaN and Infinity', () => {
    expect(average([10, NaN, Infinity, -Infinity, 20])).toBe(15);
  });

  it('should return null for an empty array', () => {
    expect(average([])).toBeNull();
  });

  it('should return the number itself if there is only one valid number', () => {
    expect(average([42])).toBe(42);
    expect(average([42, -5, NaN])).toBe(42);
  });
});
