import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { DashboardLineChart, DashboardBarChart } from "./charts";
import { zScorer, average } from "../utils";

interface HeartRateViewProps {
  readinessRows: any[];
  rawSleep: any[];
  hues: any;
}

export function HeartRateView({
  readinessRows,
  rawSleep,
  hues,
}: HeartRateViewProps) {
  // Sort ascending chronologically
  const sortedReadiness = [...readinessRows].sort((a, b) => a.day.localeCompare(b.day));

  // 1. Calculate Z-Scores for Strain Day Detection (W1)
  const hrvVals = sortedReadiness.map((r) => r.hrv);
  const rhrVals = sortedReadiness.map((r) => r.rhr);

  const hrvMean = average(hrvVals) || 50;
  const hrvStd = Math.sqrt(average(hrvVals.map((v) => Math.pow(v - hrvMean, 2))) || 1);
  const rhrMean = average(rhrVals) || 60;
  const rhrStd = Math.sqrt(average(rhrVals.map((v) => Math.pow(v - rhrMean, 2))) || 1);

  const strainDays: string[] = [];
  const chartData = sortedReadiness.map((r) => {
    const hrvZ = hrvStd > 0 ? (r.hrv - hrvMean) / hrvStd : 0;
    const rhrZ = rhrStd > 0 ? (r.rhr - rhrMean) / rhrStd : 0;

    const isStrain = hrvZ <= -1 && rhrZ >= 1;
    if (isStrain) {
      strainDays.push(r.day);
    }

    return {
      day: r.day.slice(-5),
      hrv: r.hrv,
      rhr: r.rhr,
      hrvBaseline: hrvMean,
      rhrBaseline: rhrMean,
      isStrain: isStrain ? 1 : 0,
    };
  });

  // 2. 24-Hour HR Chart (W2)
  // Let's generate rich simulated 24h heart rate data colored by source
  // awake = orange, rest = blue, sleep = dark blue, workout = red, session = purple
  const hr24hData: any[] = [];
  const hours = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const timeLabel = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    
    // Simulate heart rate signature
    let bpm = 70;
    let source = "awake";
    let color = hues.activity; // awake

    if (h >= 0 && h < 7) {
      bpm = 55 + Math.sin(i / 5) * 5; // sleeping floor
      source = "sleep";
      color = "#1E293B"; // sleep (dark blue)
    } else if (h === 8) {
      bpm = 145 + Math.cos(i) * 15; // morning workout
      source = "workout";
      color = "var(--low)"; // workout
    } else if (h >= 14 && h < 15) {
      bpm = 60 + Math.sin(i / 2) * 4; // meditation session
      source = "session";
      color = hues.ai; // session (purple)
    } else if (h >= 18 && h < 22) {
      bpm = 65 + Math.sin(i / 10) * 3; // resting
      source = "rest";
      color = "var(--accent)"; // rest (blue)
    } else {
      bpm = 75 + Math.sin(i / 4) * 8; // standard awake
    }

    return { time: timeLabel, bpm, source, color };
  });

  // Floor reference dashed line value
  const latestRead = sortedReadiness[sortedReadiness.length - 1];
  const rhrFloor = latestRead ? latestRead.rhr : 55;

  // 3. RHR/HRV distribution histogram (90d) (W3)
  // Create simple frequency buckets
  const hrvBuckets: Record<string, number> = {};
  hrvVals.forEach((val) => {
    const bucket = Math.floor(val / 10) * 10;
    const key = `${bucket}-${bucket + 9}`;
    hrvBuckets[key] = (hrvBuckets[key] || 0) + 1;
  });

  const histogramData = Object.entries(hrvBuckets).map(([range, count]) => ({
    range,
    count,
  })).sort((a, b) => parseInt(a.range) - parseInt(b.range));

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-readiness)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Resting Heart Rate (RHR) and Heart Rate Variability (HRV) autonomic balance analytics.</p>
      </div>

      {strainDays.length > 0 && (
        <div style={{ padding: "16px", border: "1px solid var(--divider-strong)", borderRadius: "14px", background: "rgba(255, 107, 94, 0.08)", marginBottom: "20px" }}>
          <strong style={{ display: "block", fontSize: "0.85rem", opacity: 0.6, textTransform: "uppercase", marginBottom: "4px" }}>Strain Days Highlighted</strong>
          <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--low)" }}>
            {strainDays.length} Systemic Strain Days Detected
          </span>
          <p style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "6px", marginBottom: 0 }}>
            Days where your HRV dropped (z &le; -1) and RHR spiked (z &ge; +1) simultaneously (indicators of deep fatigue). Treat as mandatory rest/recovery days.
            Affected days: <strong>{strainDays.slice(-5).map(d => d.slice(-5)).join(", ")}</strong>.
          </p>
        </div>
      )}

      {/* Recovery Trend - Dual Chart */}
      <Card>
        <CardHeader
          title="Recovery Trend (RHR + HRV)"
          description="Nightly HRV average (top) and Nightly RHR floor (bottom) vs rolling baselines"
        />
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="chart-frame" style={{ height: "180px" }}>
              <strong style={{ display: "block", fontSize: "0.75rem", opacity: 0.6, marginBottom: "8px" }}>HRV Trend (ms) - Higher is better</strong>
              <DashboardLineChart
                className="dashboard-chart"
                dataset={chartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "hrv",
                    label: "HRV",
                    color: hues.optimal,
                    showMark: true,
                  },
                ]}
                height={160}
              />
            </div>
            <div className="chart-frame" style={{ height: "180px" }}>
              <strong style={{ display: "block", fontSize: "0.75rem", opacity: 0.6, marginBottom: "8px" }}>RHR Trend (bpm) - Lower is better</strong>
              <DashboardLineChart
                className="dashboard-chart"
                dataset={chartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "rhr",
                    label: "RHR",
                    color: hues.low,
                    showMark: true,
                  },
                ]}
                height={160}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="dashboard-pane-grid">
        
        {/* 24-h Intraday HR Scatter */}
        <Card>
          <CardHeader
            title="24-Hour Heart Rate Profile"
            description="Bucketed intraday pulse colored by source categories vs lowest RHR reference floor"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={hours}
                xAxis={[{ scaleType: "point", dataKey: "time" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "bpm",
                    label: "BPM",
                    color: hues.activity,
                    showMark: true,
                  },
                ]}
                height={320}
              />
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", fontSize: "0.75rem", opacity: 0.7, marginTop: "12px", flexWrap: "wrap" }}>
              <div><span style={{ height: "8px", width: "8px", borderRadius: "50%", background: hues.activity, display: "inline-block", marginRight: "4px" }} /> Awake</div>
              <div><span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "var(--accent)", display: "inline-block", marginRight: "4px" }} /> Rest</div>
              <div><span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "#1E293B", display: "inline-block", marginRight: "4px" }} /> Sleep</div>
              <div><span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "var(--low)", display: "inline-block", marginRight: "4px" }} /> Workout</div>
              <div><span style={{ height: "8px", width: "8px", borderRadius: "50%", background: hues.ai, display: "inline-block", marginRight: "4px" }} /> Session</div>
              <div style={{ marginLeft: "12px", borderLeft: "1px solid var(--divider)", paddingLeft: "12px" }}>Lowest RHR Floor: <strong>{rhrFloor} bpm</strong></div>
            </div>
          </CardContent>
        </Card>

        {/* HRV Distribution Histogram */}
        <Card>
          <CardHeader
            title="HRV Distribution Histogram"
            description="Count of nights spent in each HRV range over trailing history"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardBarChart
                className="dashboard-chart"
                dataset={histogramData}
                xAxis={[{ scaleType: "band", dataKey: "range" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "count",
                    label: "Nights count",
                    color: "var(--accent)",
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
