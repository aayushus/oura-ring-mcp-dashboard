import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { DashboardBarChart, DashboardLineChart } from "./charts";
import { average } from "../utils";

interface StressViewProps {
  stressChartData: any[];
  resilience: any[];
}

export function StressView({
  stressChartData,
  resilience,
}: StressViewProps) {
  // 1. Calculate Stress Balance Ratio (C6.1)
  const stressHoursList = stressChartData.map((d) => Math.abs(d.stress || 0));
  const recoveryHoursList = stressChartData.map((d) => Math.abs(d.recovery || 0));

  const avgStress = average(stressHoursList) ?? 0;
  const avgRecovery = average(recoveryHoursList) ?? 0;

  const totalTime = avgStress + avgRecovery;
  const stressRatio = totalTime > 0 ? Math.round((avgStress / totalTime) * 100) : 0;
  const recoveryRatio = totalTime > 0 ? 100 - stressRatio : 0;

  // 2. Count Weekly Stressful Days (C6.3)
  // Flag stressful days where stress hours > 3h
  const stressfulDaysCount = stressHoursList.filter((h) => h >= 3.0).length;

  // 3. Resilience timeline data (C6.2)
  // Map level: limited=1, adequate=2, optimal=3, exceptional=4...
  const resilienceChartData = resilience.map((r) => {
    const levelStr = (r.level || "adequate").toLowerCase();
    const val = levelStr === "limited" ? 1 : levelStr === "adequate" ? 2 : levelStr === "optimal" ? 3 : 4;
    return {
      day: r.day.slice(-5),
      value: val,
      sleep_recovery: r.contributors?.sleep_recovery ?? 70,
      daytime_recovery: r.contributors?.daytime_recovery ?? 65,
      stress: r.contributors?.stress ?? 50,
    };
  });

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-activity)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Daytime physiological stress, recovery balance ratios, and long-term resilience tracking.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Stress Balance Ratio widget */}
        <Card>
          <CardHeader
            title="Stress Balance Ratio"
            description="Overall balance between physiological load and recovery status"
          />
          <CardContent>
            <div style={{ padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>
                <span style={{ color: "var(--stress)" }}>{stressRatio}% Stress</span>
                <span style={{ color: "var(--optimal)" }}>{recoveryRatio}% Recovery</span>
              </div>
              <div style={{ display: "flex", height: "12px", width: "100%", background: "var(--divider)", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
                <div style={{ width: `${stressRatio}%`, background: "var(--stress)" }} />
                <div style={{ width: `${recoveryRatio}%`, background: "var(--optimal)" }} />
              </div>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                Measured from heart rate and HRV drift. Lower stress ratios promote optimal resilience.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stressful Days Count */}
        <Card>
          <CardHeader
            title="Stressful Days Alert"
            description="Days with high physiological load (&gt;3.0h of stress)"
          />
          <CardContent>
            <div style={{ padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: stressfulDaysCount >= 4 ? "var(--low)" : "var(--optimal)" }}>
                  {stressfulDaysCount} / 7
                </span>
                <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>days of strain</span>
              </div>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                {stressfulDaysCount >= 4
                  ? "Warning: High stress days detected. Prioritize active rest nights."
                  : "Good balance: Load is within sustainable boundaries."}
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="dashboard-pane-grid">
        
        {/* Stress vs Recovery Mirrored Chart */}
        <Card>
          <CardHeader
            title="Stress vs. Recovery Hours"
            description="physiological stress hours (up) vs recovery hours (down) per day"
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
                  { dataKey: "stress", label: "Stress Hours", stack: "balance", color: "var(--stress)" },
                  { dataKey: "recovery", label: "Recovery Hours", stack: "balance", color: "var(--optimal)" },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resilience Level Timeline */}
        <Card>
          <CardHeader
            title="Resilience level stepped timeline"
            description="Stepped line of physiological capacity level (Limited=1 ... Exceptional=4)"
          />
          <CardContent>
            <div className="chart-frame tall">
              {resilienceChartData.length === 0 ? (
                <p style={{ opacity: 0.6, padding: "20px" }}>No resilience data synced yet.</p>
              ) : (
                <DashboardLineChart
                  className="dashboard-chart"
                  dataset={resilienceChartData}
                  xAxis={[{ scaleType: "point", dataKey: "day" }]}
                  yAxis={[{
                    min: 1,
                    max: 4,
                    valueFormatter: (v: number) => {
                      if (v === 4) return "Exceptional";
                      if (v === 3) return "Optimal";
                      if (v === 2) return "Adequate";
                      return "Limited";
                    }
                  }]}
                  grid={{ horizontal: true }}
                  hideLegend
                  series={[
                    {
                      dataKey: "value",
                      label: "Resilience Level",
                      color: "var(--ai)",
                      showMark: true,
                    },
                  ]}
                  height={320}
                />
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
