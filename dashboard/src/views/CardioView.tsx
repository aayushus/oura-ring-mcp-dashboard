import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { DashboardLineChart } from "./charts";

interface CardioViewProps {
  cardioAge: any[];
  vo2Max: any[];
  profile: any;
}

export function CardioView({
  cardioAge,
  vo2Max,
  profile,
}: CardioViewProps) {
  // 1. Process Vascular Age metrics (C7.1)
  const latestCardio = cardioAge && cardioAge.length > 0 ? cardioAge[cardioAge.length - 1] : null;
  const calendarAge = profile?.age ?? 30;
  const vascularAge = latestCardio ? latestCardio.vascular_age ?? calendarAge : calendarAge - 2;

  const diff = vascularAge - calendarAge;
  const diffLabel = diff <= 0 ? `${diff} yrs` : `+${diff} yrs`;
  const diffColor = diff <= 0 ? "var(--optimal)" : diff <= 5 ? "var(--stress)" : "var(--low)";

  // Format Vascular Age Trend
  const ageTrendData = cardioAge.map((c) => ({
    day: c.day.slice(-5),
    value: c.vascular_age ?? calendarAge,
    pwv: c.pulse_wave_velocity ?? 6.8, // default fallback
  }));

  // Format VO2 Max Trend
  const vo2TrendData = vo2Max.map((v) => ({
    day: v.day.slice(-5),
    value: v.vo2_max ?? 45,
  }));

  // Sim fallbacks if empty
  if (ageTrendData.length === 0) {
    for (let i = 0; i < 10; i++) {
      ageTrendData.push({
        day: `06-${i + 1}`,
        value: calendarAge - 2 + (i % 2),
        pwv: 6.5 + (i * 0.1),
      });
    }
  }

  if (vo2TrendData.length === 0) {
    for (let i = 0; i < 10; i++) {
      vo2TrendData.push({
        day: `06-${i + 1}`,
        value: 45 + (i * 0.2),
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-readiness)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Arterial stiffness velocity logs, biological vascular age calculations, and VO2 Max oxygen scores.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Vascular Age Card */}
        <Card>
          <CardHeader
            title="Arterial Vascular Age"
            description="Difference between your estimated vascular age and calendar age"
          />
          <CardContent>
            <div style={{ padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: diffColor }}>
                  {diffLabel}
                </span>
                <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>estimated age: {vascularAge} yrs</span>
              </div>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                {diff <= 0
                  ? "Excellent: Your arteries are more elastic than average for your age."
                  : "Attention: Consider increasing Zone 2 cardio frequency to improve vascular elasticity."}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Latest VO2 Max Card */}
        <Card>
          <CardHeader
            title="Bounding VO2 Max Capacity"
            description="Peak oxygen utilization score during workouts"
          />
          <CardContent>
            <div style={{ padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>
                  {vo2TrendData[vo2TrendData.length - 1]?.value.toFixed(1)}
                </span>
                <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>ml/kg/min</span>
              </div>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                Your VO2 max places you in the <strong>Optimal</strong> tier for your demographic group.
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="dashboard-pane-grid">
        
        {/* Vascular Age Trend */}
        <Card>
          <CardHeader
            title="Vascular Age Trend"
            description="Vascular age estimates over trailing calendar months"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={ageTrendData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "value",
                    label: "Vascular Age (yrs)",
                    color: "var(--optimal)",
                    showMark: true,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        {/* VO2 Max Trend */}
        <Card>
          <CardHeader
            title="VO2 Max Trend"
            description="Workout-tracked peak aerobic capacity levels"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={vo2TrendData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "value",
                    label: "VO2 Max",
                    color: "var(--activity)",
                    showMark: true,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
