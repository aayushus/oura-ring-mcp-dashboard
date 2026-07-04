import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { DashboardLineChart } from "./charts";
import { METRIC_REGISTRY } from "../constants";
import type { HistorySummary } from "../types";
import { formatDayLabel } from "../utils";

interface CompareViewProps {
  data: HistorySummary | null;
  hues: any;
}

const COMPARABLE_METRICS = [
  { id: "sleep_score", label: "Sleep Score", dataKey: "score", dataset: "sleep", colorKey: "sleep" },
  { id: "sleep_efficiency", label: "Sleep Efficiency", dataKey: "efficiency", dataset: "sleep", colorKey: "sleep" },
  { id: "sleep_duration", label: "Sleep Duration", dataKey: "duration", dataset: "sleep", colorKey: "sleepDeep", format: (v: number) => Number((v / 3600).toFixed(1)) },
  { id: "readiness_score", label: "Readiness Score", dataKey: "score", dataset: "readiness", colorKey: "readiness" },
  { id: "hrv", label: "Heart Rate Variability", dataKey: "hrv", dataset: "readiness", colorKey: "optimal" },
  { id: "rhr", label: "Resting Heart Rate", dataKey: "rhr", dataset: "readiness", colorKey: "heart" },
  { id: "temperature_deviation", label: "Body Temp Deviation", dataKey: "temperature_deviation", dataset: "readiness", colorKey: "low" },
  { id: "activity_score", label: "Activity Score", dataKey: "score", dataset: "activity", colorKey: "activity" },
  { id: "steps", label: "Step Count", dataKey: "steps", dataset: "activity", colorKey: "activity" },
];

export function CompareView({ data, hues }: CompareViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "sleep_score",
    "readiness_score",
    "hrv",
    "rhr",
  ]);

  if (!data) {
    return (
      <div style={{ padding: "24px" }}>
        <div className="dashboard-skeleton card" style={{ height: "300px" }} />
      </div>
    );
  }

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev; // Keep at least 2 metrics
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 8) return prev; // Limit to max 8 metrics
        return [...prev, id];
      }
    });
  };

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--accent)" } as React.CSSProperties}
      >
        <span className="halo-module-overline">Metrics side by side</span>
        <h1 className="halo-module-title">Compare</h1>
        <span className="rule" />
        <p>Compare up to 8 core sleep, readiness, and movement trends simultaneously on a unified timeline.</p>
      </div>

      {/* Selector controls card */}
      <div style={{ marginBottom: "20px" }}>
        <Card>
          <CardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="halo-module-overline">Metrics to compare (2–8)</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COMPARABLE_METRICS.map((m) => {
                  const isSelected = selectedIds.includes(m.id);
                  const activeColor = hues[m.colorKey] || "var(--accent)";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="halo-chip"
                      data-active={isSelected}
                      style={{ "--chip-hue": activeColor } as React.CSSProperties}
                      onClick={() => handleToggle(m.id)}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked full-width panels — same pattern as the 24h timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {COMPARABLE_METRICS.filter((m) => selectedIds.includes(m.id)).map((metric, index) => {
          const registry = METRIC_REGISTRY[metric.id];
          const rawRows = (data as any)[metric.dataset] || [];

          const chartDataset = rawRows.map((r: any) => ({
            day: formatDayLabel(r.day),
            value: metric.format ? metric.format(r[metric.dataKey]) : r[metric.dataKey],
          }));

          const color = hues[metric.colorKey] || "var(--accent)";

          return (
            <Card key={metric.id}>
              <CardHeader
                title={`${index + 1}. ${metric.label}`}
                description={registry?.explain}
              />
              <CardContent>
                <div className="chart-frame" style={{ height: "210px" }}>
                  <DashboardLineChart
                    className="dashboard-chart"
                    dataset={chartDataset}
                    xAxis={[{ scaleType: "point", dataKey: "day" }]}
                    grid={{ horizontal: true }}
                    hideLegend
                    series={[
                      {
                        dataKey: "value",
                        label: metric.label,
                        color: color,
                        showMark: false,
                      },
                    ]}
                    height={190}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
