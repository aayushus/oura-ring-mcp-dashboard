import React, { useState, useMemo } from "react";
import type { SleepRecord, ReadinessRecord } from "../types";

export interface YearHeatmapProps {
  data?: Array<{ day: string; score: number }>;
  metricLabel?: string;
  sleepData?: SleepRecord[];
  readinessData?: ReadinessRecord[];
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
}

export function YearHeatmap({
  data,
  metricLabel,
  sleepData = [],
  readinessData = [],
  selectedDay,
  onSelectDay,
}: YearHeatmapProps) {
  const [metric, setMetric] = useState<"readiness" | "sleep">("readiness");

  // Build a lookup map of day -> score
  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    if (data && data.length > 0) {
      for (const item of data) {
        if (item.day && typeof item.score === "number") {
          map.set(item.day, item.score);
        }
      }
      return map;
    }

    const dataset = metric === "readiness" ? readinessData : sleepData;
    for (const item of dataset) {
      if (item.day && typeof item.score === "number") {
        map.set(item.day, item.score);
      }
    }
    return map;
  }, [data, metric, sleepData, readinessData]);

  // Generate 52 weeks (364 days) up to today
  const weeks = useMemo(() => {
    const result: Array<Array<{ date: string; score: number | null; dayOfWeek: number }>> = [];
    const today = new Date();
    
    // Compute starting Sunday 52 weeks ago
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let current = new Date(startDate);
    let currentWeek: Array<{ date: string; score: number | null; dayOfWeek: number }> = [];

    while (current <= today) {
      const dateStr = current.toISOString().split("T")[0];
      const score = scoreMap.get(dateStr) ?? null;

      currentWeek.push({
        date: dateStr,
        score,
        dayOfWeek: current.getDay(),
      });

      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }

      current.setDate(current.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [scoreMap]);

  const getColor = (score: number | null) => {
    if (score === null || score === undefined) return "rgba(255, 255, 255, 0.04)";
    const activeMetric = metricLabel ? metricLabel.toLowerCase() : metric;
    if (activeMetric.includes("sleep")) {
      if (score >= 85) return "#9b51e0";
      if (score >= 70) return "#8e44ad";
      if (score >= 60) return "#f39c12";
      return "#e74c3c";
    } else {
      if (score >= 85) return "#2ecc71";
      if (score >= 70) return "#27ae60";
      if (score >= 60) return "#f39c12";
      return "#e74c3c";
    }
  };

  return (
    <div className="year-heatmap-container">
      <style>{`
        .year-heatmap-container {
          background: var(--bg-surface, rgba(20, 22, 29, 0.6));
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
          border-radius: var(--r-lg, 14px);
          padding: 20px;
          margin-bottom: 24px;
        }
        .heatmap-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .heatmap-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-1, #ffffff);
          letter-spacing: -0.2px;
        }
        .heatmap-toggle {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 2px;
          gap: 2px;
        }
        .heatmap-btn {
          border: none;
          background: transparent;
          color: var(--text-3, rgba(235, 240, 248, 0.5));
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .heatmap-btn.active {
          background: var(--bg-app, #141722);
          color: var(--text-1, #ffffff);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        }
        .heatmap-grid-scroll {
          overflow-x: auto;
          padding-bottom: 6px;
        }
        .heatmap-grid {
          display: flex;
          gap: 3px;
          min-width: 700px;
        }
        .heatmap-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .heatmap-cell {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          cursor: pointer;
          transition: transform 0.1s ease, outline 0.1s ease;
        }
        .heatmap-cell:hover {
          transform: scale(1.3);
          z-index: 10;
        }
        .heatmap-cell.selected {
          outline: 2px solid #ffffff;
          transform: scale(1.2);
        }
        .heatmap-legend {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          font-size: 11px;
          color: var(--text-3, rgba(235, 240, 248, 0.5));
          margin-top: 12px;
        }
        .legend-box {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
      `}</style>

      <div className="heatmap-header">
        <div className="heatmap-title">
          52-Week {metricLabel || (metric === "readiness" ? "Readiness & Recovery" : "Sleep Score")} Density
        </div>
        {!metricLabel && (
          <div className="heatmap-toggle">
            <button
              className={`heatmap-btn ${metric === "readiness" ? "active" : ""}`}
              onClick={() => setMetric("readiness")}
            >
              Readiness
            </button>
            <button
              className={`heatmap-btn ${metric === "sleep" ? "active" : ""}`}
              onClick={() => setMetric("sleep")}
            >
              Sleep
            </button>
          </div>
        )}
      </div>

      <div className="heatmap-grid-scroll">
        <div className="heatmap-grid">
          {weeks.map((week, wIdx) => (
            <div className="heatmap-col" key={wIdx}>
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`heatmap-cell ${day.date === selectedDay ? "selected" : ""}`}
                  style={{ background: getColor(day.score) }}
                  title={`${day.date}: ${day.score !== null ? `${day.score} pts` : "No data recorded"}`}
                  onClick={() => onSelectDay && onSelectDay(day.date)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-legend">
        <span>Low (&lt;60)</span>
        <div className="legend-box" style={{ background: "#e74c3c" }} />
        <div className="legend-box" style={{ background: "#f39c12" }} />
        <div className="legend-box" style={{ background: metric === "readiness" ? "#27ae60" : "#8e44ad" }} />
        <div className="legend-box" style={{ background: metric === "readiness" ? "#2ecc71" : "#9b51e0" }} />
        <span>Optimal (85+)</span>
      </div>
    </div>
  );
}
