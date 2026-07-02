import React from "react";
import { Card, CardContent, CardHeader, Alert } from "../components/components";
import { MetricTable, type MetricColumn } from "../components/halo";
import type { ReadinessRecord } from "../types";
import { DashboardLineChart } from "./charts";

interface ReadinessViewProps {
  readinessChartData: any[];
  readinessRows: ReadinessRecord[];
  readinessColumns: MetricColumn<ReadinessRecord>[];
  hues: any;
  illnessWarning?: boolean;
}

export function ReadinessView({
  readinessChartData,
  readinessRows,
  readinessColumns,
  hues,
  illnessWarning,
}: ReadinessViewProps) {
  // Get last 14 days of readiness scores for the heatmap grid
  const trailing14Days = readinessRows.slice(0, 14).reverse();

  // Helper to determine score color band
  const getScoreBandClass = (score: number) => {
    if (score >= 85) return "optimal";
    if (score >= 70) return "fair";
    return "low";
  };

  const getScoreBandColor = (score: number) => {
    if (score >= 85) return "var(--optimal)";
    if (score >= 70) return "var(--stress)";
    return "var(--low)";
  };

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-readiness)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Overnight recovery indexes, heart rate variability patterns, resting pulse, and body temperature fluctuations.</p>
      </div>

      {illnessWarning && (
        <Alert variant="warn" title="Early Illness Infection Detected">
          Warning: Your body temperature deviation is elevated above standard thresholds or RHR/HRV indicate acute systemic strain. Consider pausing workouts and prioritizing sleep.
        </Alert>
      )}

      {/* Trailing 14-Day Heatmap Grid */}
      <Card>
        <CardHeader
          title="Readiness Contributor Heatmap"
          description="Trailing 14 days of recovery score bands (Dark green = Optimal, Yellow = Attention, Red = Alert)"
        />
        <CardContent>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", padding: "10px 0" }}>
            {trailing14Days.map((dayRecord) => {
              const score = dayRecord.score;
              const dateStr = dayRecord.day.slice(-5); // MM-DD
              const color = getScoreBandColor(score);
              return (
                <div
                  key={dayRecord.day}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    flex: "1 1 60px",
                    minWidth: "50px",
                    padding: "12px 6px",
                    border: "1px solid var(--divider)",
                    borderRadius: "10px",
                    background: "rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{dateStr}</span>
                  <div
                    style={{
                      height: "36px",
                      width: "36px",
                      borderRadius: "8px",
                      background: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                    }}
                    title={`Readiness score: ${score}`}
                  >
                    {score}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="dashboard-pane-grid">
        
        {/* Heart Rate Variability */}
        <Card>
          <CardHeader
            title="Heart rate variability"
            description="Nightly average — higher is better"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={readinessChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "hrv",
                    label: "HRV",
                    color: hues.readiness,
                    area: true,
                    showMark: false,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resting Heart Rate */}
        <Card>
          <CardHeader
            title="Resting heart rate"
            description="Lowest overnight — lower is better"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={readinessChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "rhr",
                    label: "RHR",
                    color: hues.heart,
                    showMark: false,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="dashboard-pane-grid">
        
        {/* Temperature Deviation Line Chart */}
        <Card>
          <CardHeader
            title="Overnight Temperature Drift"
            description="Daily skin temperature deviation vs 30-day baseline. Guidelines at ±0.3°C and ±0.5°C indicate anomalies."
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={readinessChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                yAxis={[{ min: -1.0, max: 1.5 }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "temperature",
                    label: "Temp Drift (°C)",
                    color: "var(--stress)",
                    showMark: true,
                  },
                ]}
                height={320}
              />
            </div>
            {/* Legend for temperature drift guidelines */}
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", fontSize: "0.8rem", opacity: 0.7, marginTop: "8px" }}>
              <div><span style={{ color: "var(--low)", fontWeight: 700 }}>&gt; +0.5°C</span> Critical Drift Threshold</div>
              <div><span style={{ color: "var(--stress)", fontWeight: 700 }}>&gt; +0.3°C</span> Cautionary Drift Threshold</div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Recovery Log Table */}
      <Card>
        <CardHeader
          title="Recovery log"
          description="Latest days first so outliers stand out"
        />
        <CardContent>
          <MetricTable
            columns={readinessColumns}
            rows={readinessRows}
            rowKey={(row) => row.day}
          />
        </CardContent>
      </Card>
    </div>
  );
}
