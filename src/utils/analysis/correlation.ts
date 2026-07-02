import { mean, standardDeviation } from "./statistics.js";

export interface CorrelationResult {
  correlation: number; // Pearson correlation coefficient (-1 to 1)
  pValue: number; // Statistical significance
  significant: boolean; // p < 0.05
  strength: "none" | "weak" | "moderate" | "strong";
  direction: "positive" | "negative" | "none";
  n: number; // Sample size
}

/**
 * Calculate Pearson correlation between two arrays
 * Includes p-value for statistical significance
 */
export function correlate(x: number[], y: number[]): CorrelationResult {
  const n = Math.min(x.length, y.length);

  if (n < 3) {
    return {
      correlation: 0,
      pValue: 1,
      significant: false,
      strength: "none",
      direction: "none",
      n,
    };
  }

  // Trim to same length
  const xTrim = x.slice(0, n);
  const yTrim = y.slice(0, n);

  const xMean = mean(xTrim);
  const yMean = mean(yTrim);

  let numerator = 0;
  let xSS = 0;
  let ySS = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xTrim[i] - xMean;
    const yDiff = yTrim[i] - yMean;
    numerator += xDiff * yDiff;
    xSS += xDiff * xDiff;
    ySS += yDiff * yDiff;
  }

  const denominator = Math.sqrt(xSS * ySS);
  const r = denominator !== 0 ? numerator / denominator : 0;

  // Calculate p-value using t-distribution
  let pValue: number;
  if (Math.abs(r) >= 0.9999) {
    pValue = 0;
  } else {
    const tStat = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
    pValue = tDistributionPValue(Math.abs(tStat), n - 2);
  }

  // Determine strength
  const absR = Math.abs(r);
  let strength: "none" | "weak" | "moderate" | "strong";
  if (absR < 0.1) strength = "none";
  else if (absR < 0.3) strength = "weak";
  else if (absR < 0.5) strength = "moderate";
  else strength = "strong";

  return {
    correlation: r,
    pValue,
    significant: pValue < 0.05,
    strength,
    direction: r > 0.1 ? "positive" : r < -0.1 ? "negative" : "none",
    n,
  };
}

/**
 * Approximate p-value for two-tailed t-test (borrowed from regression / internal helper)
 */
function tDistributionPValue(t: number, df: number): number {
  if (df <= 0) return 1;
  if (t === 0) return 1;

  const x = df / (df + t * t);

  if (df > 100) {
    const z = Math.abs(t);
    const p = 0.5 * (1 + erf(z / Math.sqrt(2)));
    return 2 * (1 - p);
  }

  const a = df / 2;
  const b = 0.5;
  return incompleteBeta(x, a, b);
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  const eps = 1e-10;
  const maxIter = 200;
  let f = 1;
  let c = 1;
  let d = 0;

  for (let m = 0; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m === 0 ? 1 : (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    d = 1 / d;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    f *= c * d;
    aa = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < eps) d = eps;
    d = 1 / d;
    c = 1 + aa / c;
    if (Math.abs(c) < eps) c = eps;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }
  return front * f;
}

function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
