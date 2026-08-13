import React from "react";
import type { HistorySummary } from "../types";

interface RecoveryBannerProps {
  data: HistorySummary;
  selectedDay: string;
}

export function RecoveryBanner({ data, selectedDay }: RecoveryBannerProps) {
  const currentSleep = data.sleep?.find((s) => s.day === selectedDay) || data.sleep?.[data.sleep.length - 1];
  const currentReadiness = data.readiness?.find((r) => r.day === selectedDay) || data.readiness?.[data.readiness.length - 1];

  if (!currentReadiness && !currentSleep) {
    return null;
  }

  // Calculate 30-day baseline HRV & RHR
  const hrvValues = data.readiness?.map((r) => r.hrv).filter((h) => h > 0) || [];
  const avgHrv = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : 0;
  
  const rhrValues = data.readiness?.map((r) => r.rhr).filter((r) => r > 0) || [];
  const avgRhr = rhrValues.length > 0 ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : 0;

  const hrvDelta = avgHrv > 0 && currentReadiness?.hrv ? ((currentReadiness.hrv - avgHrv) / avgHrv) * 100 : 0;
  const rhrDelta = avgRhr > 0 && currentReadiness?.rhr ? currentReadiness.rhr - avgRhr : 0;
  const sleepHours = currentSleep?.duration ? (currentSleep.duration / 3600).toFixed(1) : "0";

  // Determine recovery status
  const readinessScore = currentReadiness?.score ?? 0;
  const sleepScore = currentSleep?.score ?? 0;

  let badgeText = "Optimal Recovery";
  let badgeColor = "#2ecc71";
  let badgeBg = "rgba(46, 204, 113, 0.12)";
  let badgeBorder = "rgba(46, 204, 113, 0.25)";
  let narrative = "";
  let recommendation = "";

  if (readinessScore >= 85) {
    badgeText = "Peak Readiness";
    badgeColor = "#2ecc71";
    badgeBg = "rgba(46, 204, 113, 0.12)";
    badgeBorder = "rgba(46, 204, 113, 0.25)";
    narrative = `Your body is primed for high physical and mental demand. HRV is ${
      hrvDelta >= 0 ? `+${hrvDelta.toFixed(0)}% above` : `${hrvDelta.toFixed(0)}% vs`
    } your 30-day baseline (${avgHrv.toFixed(0)} ms), with a resting heart rate of ${currentReadiness?.rhr || "--"} bpm.`;
    recommendation = "Optimal day for high-intensity training, personal records, or demanding deep-work tasks.";
  } else if (readinessScore >= 70) {
    badgeText = "Good Recovery";
    badgeColor = "#3498db";
    badgeBg = "rgba(52, 152, 219, 0.12)";
    badgeBorder = "rgba(52, 152, 219, 0.25)";
    narrative = `You logged ${sleepHours}h of sleep (${sleepScore} score) with steady cardiovascular stability. Resting heart rate is ${
      rhrDelta <= 0 ? `${Math.abs(rhrDelta).toFixed(0)} bpm below` : `+${rhrDelta.toFixed(0)} bpm above`
    } baseline.`;
    recommendation = "Great capacity for moderate exercise and standard daily activity. Keep hydration consistent.";
  } else if (readinessScore >= 60) {
    badgeText = "Pay Attention";
    badgeColor = "#f39c12";
    badgeBg = "rgba(243, 156, 18, 0.12)";
    badgeBorder = "rgba(243, 156, 18, 0.25)";
    narrative = `Recovery markers indicate mild physiological strain or accumulated sleep debt. Your HRV dropped ${Math.abs(
      hrvDelta
    ).toFixed(0)}% below your 30-day norm.`;
    recommendation = "Focus on light aerobic movement or active recovery. Avoid late-night meals or caffeine.";
  } else {
    badgeText = "Rest Recommended";
    badgeColor = "#e74c3c";
    badgeBg = "rgba(231, 76, 60, 0.12)";
    badgeBorder = "rgba(231, 76, 60, 0.25)";
    narrative = `Your autonomic nervous system is under significant stress or insufficient sleep (${sleepHours}h recorded). Elevating activity may delay recovery.`;
    recommendation = "Prioritize total rest, restorative sleep, and early bedtime to replenish nervous system reserves.";
  }

  return (
    <div className="recovery-banner">
      <style>{`
        .recovery-banner {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px 20px;
          background: var(--bg-surface, rgba(20, 22, 29, 0.6));
          backdrop-filter: blur(12px);
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
          border-radius: var(--r-lg, 14px);
          margin-bottom: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        .recovery-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: ${badgeColor};
          background: ${badgeBg};
          border: 1px solid ${badgeBorder};
          white-space: nowrap;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .recovery-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .recovery-narrative {
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--text-1, #f2f4f8);
          font-weight: 500;
        }
        .recovery-recommendation {
          font-size: 12.5px;
          line-height: 1.45;
          color: var(--text-2, rgba(235, 240, 248, 0.65));
        }
        @media (max-width: 640px) {
          .recovery-banner {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
      <div className="recovery-badge">{badgeText}</div>
      <div className="recovery-content">
        <div className="recovery-narrative">{narrative}</div>
        <div className="recovery-recommendation">💡 <strong>Guidance:</strong> {recommendation}</div>
      </div>
    </div>
  );
}
