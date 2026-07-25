import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatLongDate } from './utils';

describe('formatLongDate', () => {
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;

  afterEach(() => {
    Date.prototype.toLocaleDateString = originalToLocaleDateString;
    vi.restoreAllMocks();
  });

  it('should create correct date and use correct formatting options', () => {
    const toLocaleDateStringSpy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    toLocaleDateStringSpy.mockReturnValue('Mocked Date String');

    const result = formatLongDate('2023-10-25');

    // We can't easily assert the exact Date object created because it's a new instance,
    // but we can assert the spy was called with the correct parameters.
    expect(toLocaleDateStringSpy).toHaveBeenCalledWith(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    expect(result).toBe('Mocked Date String');
  });

  it('should format a valid date string correctly (integration)', () => {
    // This relies on the system locale, which could technically be flaky if not en-US,
    // but typically node defaults to en-US. We'll use a regex to be a bit more robust
    // or just test it based on known en-US output as requested.
    const dateStr = '2023-10-25';
    const formatted = formatLongDate(dateStr);

    // Wednesday, October 25
    expect(formatted).toMatch(/Wednesday, October 25/);
  });

  it('should handle different date correctly (integration)', () => {
    const dateStr = '2024-01-01'; // Monday, January 1
    const formatted = formatLongDate(dateStr);

    expect(formatted).toMatch(/Monday, January 1/);
  });
});
