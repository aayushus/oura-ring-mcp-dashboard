import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, Alert } from "../components/components";
import { DashboardLineChart, DashboardBarChart } from "./charts";

interface DayStripViewProps {
  hues: any;
}

export function DayStripView({ hues }: DayStripViewProps) {
  const [day, setDay] = useState(new Date().toLocaleDateString("sv-SE"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDayStrip() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/dashboard/daystrip?day=${day}`);
        if (!res.ok) throw new Error("Failed to load unified day-strip data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    loadDayStrip();
  }, [day]);

  // Construct 96 timeline intervals (21:00 D-1 to 21:00 D)
  const timeline: any[] = [];
  for (let i = 0; i < 96; i++) {
    const totalMins = 21 * 60 + i * 15;
    const isPrevDay = totalMins < 24 * 60; // D-1 if minutes < 1440
    const hour = Math.floor((totalMins % 1440) / 60);
    const min = (totalMins % 1440) % 60;
    const timeLabel = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
    timeline.push({
      time: timeLabel,
      isPrevDay,
      label: `${timeLabel} ${isPrevDay ? "(Yesterday)" : ""}`,
      sleepValue: null,
      sleepStage: "None",
      bpm: null,
      movement: 0,
      eventLabel: "—",
    });
  }

  // Parse raw data if loaded
  if (data) {
    // Helper to map a Date object to interval index (21:00 D-1 to 21:00 D)
    const getIntervalIndex = (dateObj: Date): number => {
      const h = dateObj.getHours();
      const m = dateObj.getMinutes();
      const totalMins = h * 60 + m;
      
      // Determine if date belongs to prevDay (D-1) or day (D)
      const dateStr = dateObj.toLocaleDateString("sv-SE");
      const isD1 = dateStr === data.prevDay;
      
      let relativeMins = 0;
      if (isD1) {
        relativeMins = totalMins - 21 * 60;
      } else {
        relativeMins = totalMins + 3 * 60; // hours past midnight D-1 21:00
      }

      const idx = Math.floor(relativeMins / 15);
      return idx >= 0 && idx < 96 ? idx : -1;
    };

    // 1. Populate Sleep Stages (using sleep docs)
    if (data.sleep && data.sleep.length > 0) {
      data.sleep.forEach((sDoc: any) => {
        if (sDoc.sleep_phase_5_min && sDoc.bedtime_start) {
          const start = new Date(sDoc.bedtime_start);
          const stages = sDoc.sleep_phase_5_min.split("").map(Number);
          stages.forEach((stage: number, j: number) => {
            const timeOffset = new Date(start.getTime() + j * 5 * 60 * 1000);
            const idx = getIntervalIndex(timeOffset);
            if (idx >= 0) {
              // 4 = Awake, 3 = REM, 2 = Light, 1 = Deep
              timeline[idx].sleepValue = stage === 4 ? 4 : stage === 3 ? 3 : stage === 2 ? 2 : 1;
              timeline[idx].sleepStage = stage === 4 ? "Awake" : stage === 3 ? "REM" : stage === 2 ? "Light" : "Deep";
            }
          });
        }
      });
    }

    // 2. Populate Heart Rate (using heartrate docs timeseries)
    if (data.heartrate && data.heartrate.length > 0) {
      // Group by interval to find median
      const hrBuckets: Record<number, number[]> = {};
      data.heartrate.forEach((sample: any) => {
        if (sample.timestamp) {
          const time = new Date(sample.timestamp);
          const idx = getIntervalIndex(time);
          if (idx >= 0) {
            if (!hrBuckets[idx]) hrBuckets[idx] = [];
            hrBuckets[idx].push(sample.bpm);
          }
        }
      });

      // Calculate averages/medians per interval
      Object.entries(hrBuckets).forEach(([idxStr, bpms]) => {
        const idx = Number(idxStr);
        if (bpms.length > 0) {
          const sorted = [...bpms].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          timeline[idx].bpm = median;
        }
      });
    }

    // 3. Populate Movement Intensity (using activity class_5_min)
    if (data.activity && data.activity.length > 0) {
      data.activity.forEach((aDoc: any) => {
        if (aDoc.class_5_min && aDoc.day) {
          // Oura's activity class starts at 04:00 of D day
          const start = new Date(`${aDoc.day}T04:00:00`);
          const intensities = aDoc.class_5_min.split("").map(Number);
          intensities.forEach((intensity: number, j: number) => {
            const timeOffset = new Date(start.getTime() + j * 5 * 60 * 1000);
            const idx = getIntervalIndex(timeOffset);
            if (idx >= 0) {
              timeline[idx].movement = Math.max(timeline[idx].movement, intensity);
            }
          });
        }
      });
    }

    // 4. Populate Events Row (workouts & sessions)
    const activeEvents: any[] = [...(data.workouts || []), ...(data.sessions || [])];
    activeEvents.forEach((evt: any) => {
      const start = new Date(evt.start_datetime || evt.start_time);
      const end = evt.end_datetime ? new Date(evt.end_datetime) : new Date(start.getTime() + 30 * 60 * 1000);

      const startIdx = getIntervalIndex(start);
      const endIdx = getIntervalIndex(end);

      if (startIdx >= 0) {
        const endLoop = endIdx >= 0 ? endIdx : 95;
        const name = evt.activity || evt.type || "workout";
        for (let idx = startIdx; idx <= endLoop; idx++) {
          timeline[idx].eventLabel = name.toUpperCase();
        }
      }
    });
  }

  // Fallbacks for charts when no values exist
  const sleepChartDataset = timeline.map((t) => ({
    time: t.time,
    value: t.sleepValue ?? 0,
  }));

  const hrChartDataset = timeline.map((t) => ({
    time: t.time,
    bpm: t.bpm ?? 0,
  }));

  const movementChartDataset = timeline.map((t) => ({
    time: t.time,
    movement: t.movement,
  }));

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--accent)" } as React.CSSProperties}
      >
        <span className="halo-module-overline">Aligned 24h Axis</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <h1 className="halo-module-title">Unified Day-Strip</h1>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", opacity: 0.7 }}>Select Day:</label>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
            />
          </div>
        </div>
        <span className="rule" />
        <p>Hypnogram, overnight HR/HRV, daytime movement, workouts, and tags aligned on one shared time scale (21:00 yesterday to 21:00 today).</p>
      </div>

      {error && (
        <Alert variant="warn" title="Timeline Loading Error">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="dashboard-skeleton card" style={{ height: "400px" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Sleep Stages Panel */}
          <Card>
            <CardHeader
              title="1. Sleep Hypnogram Stages"
              description="Nightly hypnogram step cycles (4=Awake, 3=REM, 2=Light, 1=Deep)"
            />
            <CardContent>
              <div className="chart-frame" style={{ height: "180px" }}>
                <DashboardLineChart
                  className="dashboard-chart"
                  dataset={sleepChartDataset}
                  xAxis={[{ scaleType: "point", dataKey: "time" }]}
                  yAxis={[{ min: 0, max: 4 }]}
                  grid={{ horizontal: true }}
                  hideLegend
                  series={[
                    {
                      dataKey: "value",
                      label: "Stage Code",
                      color: hues.sleep,
                      showMark: false,
                      curve: "stepAfter",
                    },
                  ]}
                  height={150}
                />
              </div>
            </CardContent>
          </Card>

          {/* Heart Rate Panel */}
          <Card>
            <CardHeader
              title="2. Heart Rate Timeline"
              description="15-minute median overnight and daytime pulse samples (bpm)"
            />
            <CardContent>
              <div className="chart-frame" style={{ height: "180px" }}>
                <DashboardLineChart
                  className="dashboard-chart"
                  dataset={hrChartDataset}
                  xAxis={[{ scaleType: "point", dataKey: "time" }]}
                  grid={{ horizontal: true }}
                  hideLegend
                  series={[
                    {
                      dataKey: "bpm",
                      label: "BPM",
                      color: hues.heart,
                      showMark: false,
                    },
                  ]}
                  height={150}
                />
              </div>
            </CardContent>
          </Card>

          {/* Movement Intensity Panel */}
          <Card>
            <CardHeader
              title="3. Movement Volume & Intensity"
              description="Intraday movement class categories (0=Rest, 1=Light, 2=Moderate, 3=High)"
            />
            <CardContent>
              <div className="chart-frame" style={{ height: "180px" }}>
                <DashboardBarChart
                  className="dashboard-chart"
                  dataset={movementChartDataset}
                  xAxis={[{ scaleType: "band", dataKey: "time" }]}
                  grid={{ horizontal: true }}
                  hideLegend
                  series={[
                    {
                      dataKey: "movement",
                      label: "Intensity",
                      color: hues.activity,
                    },
                  ]}
                  height={150}
                />
              </div>
            </CardContent>
          </Card>

          {/* Events Timeline Panel */}
          <Card>
            <CardHeader
              title="4. Registered Exercise & Session Events"
              description="Active workout windows and tagged sessions logged throughout the day"
            />
            <CardContent>
              <div style={{ display: "flex", width: "100%", height: "40px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--divider)", overflow: "hidden", marginTop: "10px" }}>
                {timeline.map((t, idx) => {
                  const hasEvent = t.eventLabel !== "—";
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: "100%",
                        background: hasEvent ? "var(--ai-bg)" : "transparent",
                        borderRight: "1px solid var(--divider)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        color: "var(--ai)",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                      title={`${t.label}: ${t.eventLabel}`}
                    >
                      {hasEvent && t.time.slice(-2) === "00" ? t.eventLabel : ""}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", opacity: 0.5, marginTop: "6px" }}>
                <span>9:00 PM (Yesterday)</span>
                <span>3:00 AM</span>
                <span>9:00 AM</span>
                <span>3:00 PM</span>
                <span>9:00 PM</span>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
