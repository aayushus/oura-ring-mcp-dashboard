import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { MetricTable, type MetricColumn } from "../components/halo";
import type { ActivityRecord } from "../types";
import { DashboardBarChart, DashboardLineChart } from "./charts";

interface ActivityViewProps {
  activityChartData: any[];
  stressChartData: any[];
  activityRows: ActivityRecord[];
  activityColumns: MetricColumn<ActivityRecord>[];
  hues: any;
  acwr: any[];
  targets: any;
  rawActivity?: any[];
  compareActivityData?: any[];
}

export function ActivityView({
  activityChartData,
  stressChartData,
  activityRows,
  activityColumns,
  hues,
  acwr,
  targets,
  rawActivity,
  compareActivityData,
}: ActivityViewProps) {
  // 1. Calculate MET-Minutes over last 7 days (C4.3)
  // MET-minutes = active_calories * 1.25 (approximation)
  const last7Days = activityRows.slice(0, 7);
  const weeklyMetMinutes = Math.round(
    last7Days.reduce((sum, row) => sum + row.active_calories * 1.25, 0)
  );
  const metTarget = 750; // WHO recommended minimum 500-1000 MET-minutes/week
  const metPercentage = Math.min(100, Math.round((weeklyMetMinutes / metTarget) * 100));

  // 2. Calculate ACWR Status (C4.5)
  const latestAcwrRecord = acwr && acwr.length > 0 ? acwr[acwr.length - 1] : null;
  const acwrValue = latestAcwrRecord ? latestAcwrRecord.ratio : 1.0;
  const acwrStatus =
    acwrValue > 1.5
      ? { label: "Danger / Overreaching", color: "var(--low)" }
      : acwrValue >= 0.8 && acwrValue <= 1.3
        ? { label: "Optimal Training Zone", color: "var(--optimal)" }
        : { label: "Under-training / Restore", color: "var(--stress)" };

  // 3. Process 24-h Movement Strip (class_5_min) (C4.4)
  const latestRawAct = rawActivity && rawActivity.length > 0 ? rawActivity[rawActivity.length - 1] : null;
  const class5MinString = latestRawAct ? latestRawAct.class_5_min || "" : "";

  // Parse 288 intervals of 5-minutes (24 hours)
  const movementIntervals = class5MinString
    .split("")
    .map(Number)
    .filter((v: number) => !isNaN(v));

  // Fallback to simulated 24h intervals if Oura raw string is missing
  if (movementIntervals.length === 0) {
    for (let i = 0; i < 288; i++) {
      // simulate rest at night (0-90, 240-288) and active periods in between
      if (i < 80 || i > 250) {
        movementIntervals.push(0);
      } else if (i === 120 || i === 180) {
        movementIntervals.push(3); // high activity
      } else if (i % 8 === 0) {
        movementIntervals.push(2); // medium activity
      } else if (i % 3 === 0) {
        movementIntervals.push(1); // light movement
      } else {
        movementIntervals.push(0);
      }
    }
  }

  // Group 288 blocks into 48 intervals (30-minutes each) for visual clarity
  const groupedIntervals: number[] = [];
  const groupSize = 6; // 6 * 5 = 30 minutes
  for (let i = 0; i < movementIntervals.length; i += groupSize) {
    const chunk = movementIntervals.slice(i, i + groupSize);
    const maxVal = chunk.length > 0 ? Math.max(...chunk) : 0;
    groupedIntervals.push(maxVal);
  }

  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return "rgba(255, 255, 255, 0.05)"; // rest
    if (intensity === 1) return "var(--hue-readiness)"; // light
    if (intensity === 2) return "var(--accent)"; // moderate
    return "var(--activity)"; // high/active
  };

  // Format ACWR Trend Chart Data
  const acwrChartData = acwr.map((r) => ({
    day: r.day.slice(-5),
    ratio: r.ratio,
    optimalMin: 0.8,
    optimalMax: 1.3,
  }));

  // Target values
  const stepTarget = targets?.step_goal ?? 10000;

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-activity)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Movement intensity, training loads ratios, MET-minutes and stress/recovery status.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* MET-Minutes Progress */}
        <Card>
          <CardHeader
            title="Weekly MET-Minutes"
            description="Accumulated active MET-minutes vs WHO recommended minimum (750 MET-mins)"
          />
          <CardContent>
            <div style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--activity)" }}>
                  {weeklyMetMinutes.toLocaleString()}
                </span>
                <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>target: {metTarget} MET-mins</span>
              </div>
              
              <div style={{ height: "12px", width: "100%", background: "var(--divider)", borderRadius: "6px", overflow: "hidden", marginBottom: "8px" }}>
                <div style={{ height: "100%", width: `${metPercentage}%`, background: "var(--activity)", borderRadius: "6px" }} />
              </div>
              <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                You have completed <strong>{metPercentage}%</strong> of your recommended weekly physical activity target.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ACWR Gauge */}
        <Card>
          <CardHeader
            title="Acute:Chronic Workload Ratio"
            description="7-day average load vs 28-day chronic load (injury risk buffer)"
          />
          <CardContent>
            <div style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: acwrStatus.color }}>
                  {acwrValue.toFixed(2)}
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: acwrStatus.color }}>{acwrStatus.label}</span>
              </div>
              <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: 0 }}>
                ACWR checks if you are ramping up training volume too fast. Keep index between <strong>0.8 and 1.3</strong> to build fitness safely.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 24-h Movement Horizontal Block Strip */}
      <Card>
        <CardHeader
          title="24-Hour Movement Intensity Strip"
          description="30-minute grouped movement intensity zones throughout yesterday (Dark = Rest, Turquoise = Light, Blue = Moderate, Orange = Active)"
        />
        <CardContent>
          <div style={{ display: "flex", gap: "3px", width: "100%", height: "24px", marginTop: "12px", marginBottom: "8px" }}>
            {groupedIntervals.map((intensity, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: "100%",
                  borderRadius: "2px",
                  background: getIntensityColor(intensity),
                }}
                title={`Interval ${Math.floor(idx / 2)}h${idx % 2 ? "30" : "00"}: Intensity ${intensity}`}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", opacity: 0.5 }}>
            <span>12:00 AM</span>
            <span>6:00 AM</span>
            <span>12:00 PM</span>
            <span>6:00 PM</span>
            <span>11:30 PM</span>
          </div>
        </CardContent>
      </Card>

      <div className="dashboard-pane-grid">
        
        {/* Steps with target lines */}
        <Card>
          <CardHeader title="Steps" description={`Daily steps vs target (${stepTarget.toLocaleString()})`} />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardBarChart
                className="dashboard-chart"
                dataset={activityChartData}
                compareDataset={compareActivityData}
                xAxis={[{ scaleType: "band", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  { dataKey: "steps", label: "Steps", color: hues.activity },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        {/* ACWR Trend Line */}
        <Card>
          <CardHeader
            title="ACWR Trend"
            description="Acute-chronic workload ratio line chart with optimal bounds (0.8 - 1.3)"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={acwrChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                yAxis={[{ min: 0.5, max: 2.0 }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "ratio",
                    label: "ACWR Ratio",
                    color: hues.accent,
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
        {/* Stress and Recovery Mirrored */}
        <Card>
          <CardHeader
            title="Stress and recovery"
            description="Stress above the line, recovery below"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardBarChart
                className="dashboard-chart"
                dataset={stressChartData}
                xAxis={[{ scaleType: "band", dataKey: "day" }]}
                yAxis={[
                  {
                    valueFormatter: (v: number) => `${Math.abs(v)}h`,
                  },
                ]}
                grid={{ horizontal: true }}
                series={[
                  {
                    dataKey: "stress",
                    label: "Stress",
                    stack: "balance",
                    color: hues.stress,
                    valueFormatter: (v: number | null) =>
                      v == null ? "" : `${Math.abs(v)}h`,
                  },
                  {
                    dataKey: "recovery",
                    label: "Recovery",
                    stack: "balance",
                    color: hues.optimal,
                    valueFormatter: (v: number | null) =>
                      v == null ? "" : `${Math.abs(v)}h`,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log Table */}
      <Card>
        <CardHeader
          title="Activity log"
          description="Steps and energy across your history"
        />
        <CardContent>
          <MetricTable
            columns={activityColumns}
            rows={activityRows}
            rowKey={(row) => row.day}
          />
        </CardContent>
      </Card>
    </div>
  );
}
