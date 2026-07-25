import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { greeting } from './utils';

describe('greeting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Good night" for hours < 5', () => {
    const date = new Date(2023, 1, 1, 3); // 3 AM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good night");
  });

  it('returns "Good morning" for hours < 12', () => {
    const date = new Date(2023, 1, 1, 9); // 9 AM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good morning");
  });

  it('returns "Good afternoon" for hours < 18', () => {
    const date = new Date(2023, 1, 1, 15); // 3 PM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good afternoon");
  });

  it('returns "Good evening" for hours >= 18', () => {
    const date = new Date(2023, 1, 1, 20); // 8 PM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good evening");
  });

  it('returns "Good night" at exactly midnight', () => {
    const date = new Date(2023, 1, 1, 0, 0, 0); // 12 AM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good night");
  });

  it('returns "Good morning" at exactly 5 AM', () => {
    const date = new Date(2023, 1, 1, 5, 0, 0); // 5 AM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good morning");
  });

  it('returns "Good afternoon" at exactly 12 PM', () => {
    const date = new Date(2023, 1, 1, 12, 0, 0); // 12 PM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good afternoon");
  });

  it('returns "Good evening" at exactly 6 PM', () => {
    const date = new Date(2023, 1, 1, 18, 0, 0); // 6 PM
    vi.setSystemTime(date);
    expect(greeting()).toBe("Good evening");
  });
});
