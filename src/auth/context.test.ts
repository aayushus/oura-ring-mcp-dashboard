import { describe, it, expect } from 'vitest';
import { getContextUserId, getContextOuraClient, requestContextStorage } from './context.js';

describe('Context', () => {
  describe('getContextUserId', () => {
    it('should return undefined when outside of context', () => {
      expect(getContextUserId()).toBeUndefined();
    });

    it('should return the user ID when inside context', () => {
      requestContextStorage.run({ userId: 123 }, () => {
        expect(getContextUserId()).toBe(123);
      });
    });
  });

  describe('getContextOuraClient', () => {
    it('should return undefined when outside of context', () => {
      expect(getContextOuraClient()).toBeUndefined();
    });

    it('should return undefined when inside context but client is not set', () => {
      requestContextStorage.run({ userId: 123 }, () => {
        expect(getContextOuraClient()).toBeUndefined();
      });
    });

    it('should return the oura client when inside context', () => {
      const mockClient = { some: 'client' };
      requestContextStorage.run({ userId: 123, ouraClient: mockClient }, () => {
        expect(getContextOuraClient()).toBe(mockClient);
      });
    });
  });
});
