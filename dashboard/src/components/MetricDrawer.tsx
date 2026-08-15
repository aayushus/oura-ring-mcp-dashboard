import React from "react";
import type { SleepRecord, ReadinessRecord, ActivityRecord, StressRecord } from "../types";

interface MetricDrawerProps {
  type: "sleep" | "readiness" | "activity" | "stress" | null;
  onClose: () => void;
  sleepRecord?: SleepRecord;
  readinessRecord?: ReadinessRecord;
  activityRecord?: ActivityRecord;
  stressRecord?: StressRecord;
  rawSleepDoc?: any;
  rawReadinessDoc?: any;
  rawActivityDoc?: any;
}

export function MetricDrawer({
  type,
  onClose,
  sleepRecord,
  readinessRecord,
  activityRecord,
  stressRecord,
  rawSleepDoc,
  rawReadinessDoc,
  rawActivityDoc,
}: MetricDrawerProps) {
  if (!type) return null;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getTitle = () => {
    switch (type) {
      case "sleep":
        return "Sleep Analysis & Stages";
      case "readiness":
        return "Readiness & Autonomic Nervous System";
      case "activity":
        return "Activity & Energy Burn";
      case "stress":
        return "Daily Daytime Stress & Recovery";
    }
  };

  return (
    <>
      <div className="metric-drawer-backdrop" onClick={onClose} />
      <div className="metric-drawer">
        <style>{`
          .metric-drawer-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            z-index: 1000;
          }
          .metric-drawer {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            max-width: 460px;
            background: var(--bg-card);
            border-left: 1px solid var(--divider);
            z-index: 1001;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-float, -10px 0 40px rgba(0, 0, 0, 0.3));
            overflow-y: auto;
            color: var(--text-default);
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
            animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .metric-drawer-header {
            padding: 24px 24px 20px;
            border-bottom: 1px solid var(--divider);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .metric-drawer-title {
            font-size: 17px;
            font-weight: 700;
            letter-spacing: -0.3px;
            color: var(--text-default);
          }
          .metric-drawer-close {
            background: var(--bg-hover);
            border: 1px solid var(--divider);
            border-radius: 8px;
            color: var(--text-3);
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.15s ease;
          }
          .metric-drawer-close:hover {
            background: var(--bg-hover-2);
            color: var(--text-default);
          }
          .metric-drawer-body {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .metric-score-hero {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--bg-hover);
            border: 1px solid var(--divider);
            border-radius: 16px;
            padding: 18px 20px;
          }
          .metric-score-val {
            font-size: 38px;
            font-weight: 800;
            letter-spacing: -1px;
          }
          .metric-stage-bar {
            height: 12px;
            border-radius: 6px;
            display: flex;
            overflow: hidden;
            gap: 2px;
            margin: 12px 0 6px;
          }
          .metric-stage-slice {
            height: 100%;
            transition: width 0.3s ease;
          }
          .metric-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid var(--divider);
            font-size: 13.5px;
          }
          .metric-row:last-child {
            border-bottom: none;
          }
          .metric-row-label {
            color: var(--text-2);
          }
          .metric-row-val {
            font-weight: 600;
            color: var(--text-default);
          }
          .contributor-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            padding: 8px 12px;
            background: var(--bg-hover);
            border-radius: 8px;
            margin-bottom: 6px;
            color: var(--text-default);
          }
        `}</style>

        <div className="metric-drawer-header">
          <div className="metric-drawer-title">{getTitle()}</div>
          <button className="metric-drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="metric-drawer-body">
          {/* SLEEP DRAWER */}
          {type === "sleep" && sleepRecord && (
            <>
              <div className="metric-score-hero">
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    Sleep Score
                  </div>
                  <div className="metric-score-val" style={{ color: "#9b51e0" }}>
                    {sleepRecord.score}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    Total Sleep
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>
                    {formatDuration(sleepRecord.duration)}
                  </div>
                </div>
              </div>

              {/* Sleep Stage Breakdown Bar */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase" }}>
                  Sleep Stages
                </div>
                <div className="metric-stage-bar">
                  <div
                    className="metric-stage-slice"
                    style={{ width: `${(sleepRecord.deep / (sleepRecord.duration || 1)) * 100}%`, background: "#4a3aff" }}
                    title={`Deep Sleep: ${formatDuration(sleepRecord.deep)}`}
                  />
                  <div
                    className="metric-stage-slice"
                    style={{ width: `${(sleepRecord.rem / (sleepRecord.duration || 1)) * 100}%`, background: "#9b51e0" }}
                    title={`REM Sleep: ${formatDuration(sleepRecord.rem)}`}
                  />
                  <div
                    className="metric-stage-slice"
                    style={{ width: `${(sleepRecord.light / (sleepRecord.duration || 1)) * 100}%`, background: "#00d2ff" }}
                    title={`Light Sleep: ${formatDuration(sleepRecord.light)}`}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-3)" }}>
                  <span>🔵 Deep: {formatDuration(sleepRecord.deep)}</span>
                  <span>🟣 REM: {formatDuration(sleepRecord.rem)}</span>
                  <span>💠 Light: {formatDuration(sleepRecord.light)}</span>
                </div>
              </div>

              <div>
                <div className="metric-row">
                  <span className="metric-row-label">Sleep Efficiency</span>
                  <span className="metric-row-val">{sleepRecord.efficiency}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row-label">Deep Sleep Ratio</span>
                  <span className="metric-row-val">
                    {((sleepRecord.deep / (sleepRecord.duration || 1)) * 100).toFixed(0)}% (Goal: 15–25%)
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-row-label">REM Sleep Ratio</span>
                  <span className="metric-row-val">
                    {((sleepRecord.rem / (sleepRecord.duration || 1)) * 100).toFixed(0)}% (Goal: 20–25%)
                  </span>
                </div>
                {rawSleepDoc?.latency && (
                  <div className="metric-row">
                    <span className="metric-row-label">Sleep Latency</span>
                    <span className="metric-row-val">{Math.round(rawSleepDoc.latency / 60)} min</span>
                  </div>
                )}
                {rawSleepDoc?.lowest_heart_rate && (
                  <div className="metric-row">
                    <span className="metric-row-label">Lowest Sleeping HR</span>
                    <span className="metric-row-val">{rawSleepDoc.lowest_heart_rate} bpm</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* READINESS DRAWER */}
          {type === "readiness" && readinessRecord && (
            <>
              <div className="metric-score-hero">
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    Readiness Score
                  </div>
                  <div className="metric-score-val" style={{ color: "#2ecc71" }}>
                    {readinessRecord.score}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    HRV Average
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>
                    {readinessRecord.hrv ? `${readinessRecord.hrv} ms` : "--"}
                  </div>
                </div>
              </div>

              <div>
                <div className="metric-row">
                  <span className="metric-row-label">Resting Heart Rate</span>
                  <span className="metric-row-val">{readinessRecord.rhr ? `${readinessRecord.rhr} bpm` : "--"}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row-label">Body Temperature Deviation</span>
                  <span
                    className="metric-row-val"
                    style={{
                      color:
                        Math.abs(readinessRecord.temperature_deviation) > 0.5 ? "#e74c3c" : "#2ecc71",
                    }}
                  >
                    {readinessRecord.temperature_deviation > 0 ? "+" : ""}
                    {readinessRecord.temperature_deviation?.toFixed(2)} °C
                  </span>
                </div>
              </div>

              {rawReadinessDoc?.contributors && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Readiness Contributors
                  </div>
                  {Object.entries(rawReadinessDoc.contributors).map(([k, val]: [string, any]) => (
                    <div className="contributor-item" key={k}>
                      <span style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                      <span style={{ fontWeight: 600, color: val >= 85 ? "#2ecc71" : val >= 70 ? "#3498db" : "#e74c3c" }}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ACTIVITY DRAWER */}
          {type === "activity" && activityRecord && (
            <>
              <div className="metric-score-hero">
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    Activity Score
                  </div>
                  <div className="metric-score-val" style={{ color: "#3498db" }}>
                    {activityRecord.score}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    Total Steps
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>
                    {activityRecord.steps?.toLocaleString() || "0"}
                  </div>
                </div>
              </div>

              <div>
                <div className="metric-row">
                  <span className="metric-row-label">Active Calories</span>
                  <span className="metric-row-val">{activityRecord.active_calories} kcal</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row-label">Total Burn</span>
                  <span className="metric-row-val">{activityRecord.total_calories} kcal</span>
                </div>
                {rawActivityDoc?.high_activity_time && (
                  <div className="metric-row">
                    <span className="metric-row-label">High Activity Time</span>
                    <span className="metric-row-val">{Math.round(rawActivityDoc.high_activity_time / 60)} min</span>
                  </div>
                )}
                {rawActivityDoc?.medium_activity_time && (
                  <div className="metric-row">
                    <span className="metric-row-label">Medium Activity Time</span>
                    <span className="metric-row-val">{Math.round(rawActivityDoc.medium_activity_time / 60)} min</span>
                  </div>
                )}
                {rawActivityDoc?.inactive_alerts !== undefined && (
                  <div className="metric-row">
                    <span className="metric-row-label">Inactive Alerts</span>
                    <span className="metric-row-val">{rawActivityDoc.inactive_alerts}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STRESS DRAWER */}
          {type === "stress" && stressRecord && (
            <>
              <div className="metric-score-hero">
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    High Stress Time
                  </div>
                  <div className="metric-score-val" style={{ color: "#e67e22" }}>
                    {Math.round(stressRecord.stress_duration / 60)}m
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>
                    Recovery Time
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#2ecc71" }}>
                    {Math.round(stressRecord.recovery_duration / 60)}m
                  </div>
                </div>
              </div>

              <div>
                <div className="metric-row">
                  <span className="metric-row-label">Daytime Restored vs Stressed</span>
                  <span className="metric-row-val">
                    {stressRecord.recovery_duration >= stressRecord.stress_duration
                      ? "Restored state dominated"
                      : "Elevated physiological stress"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
