import { describe, it, expect } from "vitest";
import { gaussianSmooth, movingAverage } from "./smoothing.js";
import { max, min } from "./statistics.js";

describe("Smoothing", () => {
  describe("gaussianSmooth", () => {
    it("smooths data", () => {
      const data = [1, 10, 1, 10, 1, 10, 1]; // jagged
      const smoothed = gaussianSmooth(data, 1);

      // Smoothed values should be less extreme
      const originalRange = max(data) - min(data);
      const smoothedRange = max(smoothed) - min(smoothed);
      expect(smoothedRange).toBeLessThan(originalRange);
    });

    it("returns original for sigma 0", () => {
      const data = [1, 2, 3];
      expect(gaussianSmooth(data, 0)).toEqual(data);
    });

    it("returns original for negative sigma", () => {
      const data = [1, 2, 3];
      expect(gaussianSmooth(data, -1)).toEqual(data);
    });

    it("handles empty array", () => {
      expect(gaussianSmooth([], 1)).toEqual([]);
    });
  });

  describe("movingAverage", () => {
    it("smooths with window", () => {
      const data = [1, 2, 3, 4, 5];
      const smoothed = movingAverage(data, 3);

      expect(smoothed.length).toBe(5);
      expect(smoothed[2]).toBe(3); // mean of [2, 3, 4]
    });

    it("handles window larger than data", () => {
      const data = [1, 2, 3];
      const smoothed = movingAverage(data, 10);

      expect(smoothed.length).toBe(3);
    });

    it("returns original for window <= 1", () => {
      const data = [1, 2, 3];
      expect(movingAverage(data, 1)).toEqual(data);
      expect(movingAverage(data, 0)).toEqual(data);
    });

    it("handles empty array", () => {
      expect(movingAverage([], 3)).toEqual([]);
    });
  });
});
