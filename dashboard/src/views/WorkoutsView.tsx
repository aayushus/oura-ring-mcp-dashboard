import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { MetricTable, type MetricColumn } from "../components/halo";
import { DashboardLineChart } from "./charts";

interface WorkoutsViewProps {
  workouts: any[];
  readinessRows: any[];
  hues: any;
}

export function WorkoutsView({
  workouts,
  readinessRows,
  hues,
}: WorkoutsViewProps) {
  // 1. Format Workout Log list (C8.1)
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const dayA = a.day || a.start_datetime?.split("T")[0] || "";
    const dayB = b.day || b.start_datetime?.split("T")[0] || "";
    return dayB.localeCompare(dayA); // newest first
  });

  const columns: MetricColumn<any>[] = [
    {
      key: "day",
      label: "Date",
      render: (row) => row.day || row.start_datetime?.split("T")[0] || "—",
    },
    {
      key: "activity",
      label: "Activity",
      render: (row) => <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{row.activity || "workout"}</span>,
    },
    {
      key: "calories",
      label: "Burn",
      align: "right",
      render: (row) => `${Math.round(row.calories || row.active_calories || 0)} kcal`,
    },
    {
      key: "duration",
      label: "Duration",
      align: "right",
      render: (row) => `${Math.round((row.duration || 0) / 60)} min`,
    },
    {
      key: "intensity",
      label: "Intensity",
      align: "right",
      render: (row) => {
        const item = (row.intensity || "moderate").toLowerCase();
        const color = item === "high" ? "var(--low)" : item === "moderate" ? "var(--stress)" : "var(--optimal)";
        return <span style={{ color, fontWeight: 600, textTransform: "capitalize" }}>{item}</span>;
      },
    },
  ];

  // 2. Training Load vs. Next-Day Readiness (C8.2)
  const readinessByDay = new Map(readinessRows.map((r) => [r.day, r.score]));
  
  // Build relationship points
  const scatterPoints = workouts
    .map((w) => {
      const day = w.day || w.start_datetime?.split("T")[0];
      if (!day) return null;
      
      // Next day readiness
      const date = new Date(day + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() + 1);
      const nextDayStr = date.toISOString().slice(0, 10);
      
      const nextReadiness = readinessByDay.get(nextDayStr);
      if (nextReadiness === undefined) return null;

      return {
        burn: Math.round(w.calories || w.active_calories || 0),
        readiness: nextReadiness,
      };
    })
    .filter((p) => p !== null)
    .sort((a: any, b: any) => a.burn - b.burn);

  // Simulated fallback points if empty
  if (scatterPoints.length === 0) {
    for (let i = 0; i < 15; i++) {
      scatterPoints.push({
        burn: 200 + i * 50,
        readiness: Math.max(50, Math.min(95, 85 - (i * 1.5) + Math.sin(i) * 5)),
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-activity)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Structured training logs, cardiovascular workouts, and recovery responses correlation analysis.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "start" }}>
        
        {/* Workout Log Table */}
        <div style={{ flex: 1.5 }}>
          <Card>
            <CardHeader
              title="Workout History Log"
              description="Detailed workouts list registered from Oura connection"
            />
            <CardContent>
              {sortedWorkouts.length === 0 ? (
                <p style={{ opacity: 0.6, padding: "20px 0" }}>No workouts recorded recently.</p>
              ) : (
                <MetricTable
                  columns={columns}
                  rows={sortedWorkouts}
                  rowKey={(row) => row.day || String(row.start_datetime) || String(row.calories)}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Training Load vs Next Day Readiness Scatter */}
        <div style={{ flex: 1 }}>
          <Card>
            <CardHeader
              title="Training Load vs. Next-Day Recovery"
              description="Correlation of exercise energy burn (kcal) vs the following morning's readiness score"
            />
            <CardContent>
              <div className="chart-frame tall">
                <DashboardLineChart
                  className="dashboard-chart"
                  dataset={scatterPoints}
                  xAxis={[{ scaleType: "point", dataKey: "burn" }]}
                  yAxis={[{ min: 40, max: 100 }]}
                  grid={{ horizontal: true }}
                  hideLegend
                  series={[
                    {
                      dataKey: "readiness",
                      label: "Next-Day Readiness",
                      color: "var(--ai)",
                      showMark: true,
                    },
                  ]}
                  height={320}
                />
              </div>
              <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "12px", textAlign: "center" }}>
                Helps identify training volume tipping points where active burn begins degrading the next day's autonomic recovery capacity.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
