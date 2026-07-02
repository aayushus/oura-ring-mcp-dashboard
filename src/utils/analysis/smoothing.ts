import { mean } from "./statistics.js";

/**
 * Apply Gaussian smoothing to a time series
 */
export function gaussianSmooth(values: number[], sigma: number): number[] {
  if (values.length === 0 || sigma <= 0) return [...values];

  const kernelRadius = Math.ceil(sigma * 3);
  const kernelSize = kernelRadius * 2 + 1;

  const kernel: number[] = [];
  let kernelSum = 0;
  for (let i = -kernelRadius; i <= kernelRadius; i++) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(weight);
    kernelSum += weight;
  }
  const normalizedKernel = kernel.map((k) => k / kernelSum);

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    let smoothedValue = 0;
    for (let j = 0; j < kernelSize; j++) {
      const dataIndex = i + j - kernelRadius;
      const clampedIndex = Math.max(0, Math.min(values.length - 1, dataIndex));
      smoothedValue += values[clampedIndex] * normalizedKernel[j];
    }
    result.push(smoothedValue);
  }

  return result;
}

/**
 * Simple moving average smoothing
 */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0 || window <= 1) return [...values];

  const halfWindow = Math.floor(window / 2);
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(values.length, i + halfWindow + 1);
    const slice = values.slice(start, end);
    result.push(mean(slice));
  }

  return result;
}
