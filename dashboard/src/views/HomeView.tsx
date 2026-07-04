import { useState } from "react";
import { Card, CardContent, CardHeader, Alert, Button } from "../components/components";
import { DeltaChip, Kpi, RingCard, bandColor, scoreBand } from "../components/halo";
import type { ReadinessRecord, SleepRecord, ActivityRecord, StressRecord, TabKey } from "../types";
import { DashboardLineChart } from "./charts";
import { SunburstGlyph } from "../components/SunburstGlyph";

interface HomeViewProps {
  flags?: {
    signupsEnabled: boolean;
    isFirstRun: boolean;
    ouraAppConfigured: boolean;
    ouraConnected: boolean;
  };
  latestReadiness: ReadinessRecord | null;
  latestSleep: SleepRecord | null;
  latestActivity: ActivityRecord | null;
  latestStress: StressRecord | null;
  readinessBaseline: number | null;
  sleepBaseline: number | null;
  activityBaseline: number | null;
  rhrBaseline: number | null;
  hrvBaseline: number | null;
  tempFlag: boolean;
  strainHours: number;
  recoveryHours: number;
  headline: string;
  recoveryPosture: string;
  readinessChartData: any[];
  insights: any[];
  hues: any;
  setActiveTab: (tab: TabKey) => void;
  AIFinding: any;
  illnessWarning?: boolean;
  worstContributor?: { source: string; name: string; score: number } | null;
  onMuteAlert?: (alertType: string) => void;
  rawSleep: any[];
  rawReadiness: any[];
}

export function HomeView({
  flags,
  latestReadiness,
  latestSleep,
  latestActivity,
  latestStress,
  readinessBaseline,
  sleepBaseline,
  activityBaseline,
  rhrBaseline,
  hrvBaseline,
  tempFlag,
  strainHours,
  recoveryHours,
  headline,
  recoveryPosture,
  readinessChartData,
  insights,
  hues,
  setActiveTab,
  AIFinding,
  illnessWarning,
  worstContributor,
  onMuteAlert,
  rawSleep,
  rawReadiness,
}: HomeViewProps) {
  const hasNoData = !latestReadiness && !latestSleep && !latestActivity;

  if (hasNoData) {
    return (
      <div className="dashboard-stack" style={{ maxWidth: "680px", margin: "40px auto" }}>
        <div className="halo-card" style={{ padding: "40px", background: "rgba(20, 22, 29, 0.7)", backdropFilter: "blur(20px)", borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", background: "linear-gradient(135deg, #ffffff 0%, #aeb3b7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Welcome to Halo MCP
          </h1>
          <p style={{ color: "rgba(235, 240, 248, 0.6)", fontSize: "15px", marginBottom: "32px", lineHeight: "1.6" }}>
            To begin visualising your sleep, readiness, and activity, follow the steps below to connect your Oura Ring.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", gap: "16px", padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#27ae60", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>✓</div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: "4px" }}>Step 1: Create Admin Account</h3>
                <p style={{ fontSize: "13.5px", color: "rgba(235, 240, 248, 0.5)" }}>Your administrator profile is active.</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: flags?.ouraAppConfigured ? "#27ae60" : "#b55fe6", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flexShrink: 0 }}>
                {flags?.ouraAppConfigured ? "✓" : "2"}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: "4px" }}>Step 2: Oura App Credentials</h3>
                <p style={{ fontSize: "13.5px", color: "rgba(235, 240, 248, 0.5)", marginBottom: "12px", lineHeight: "1.4" }}>
                  {flags?.ouraAppConfigured ? "Developer credentials successfully saved." : "Provide your Oura Client ID and Secret in settings so other users can authorize their rings."}
                </p>
                {!flags?.ouraAppConfigured && (
                  <Button variant="primary" onClick={() => setActiveTab("settings")}>Configure settings</Button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: flags?.ouraConnected ? "#27ae60" : (flags?.ouraAppConfigured ? "#b55fe6" : "rgba(255,255,255,0.1)"), color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flexShrink: 0 }}>
                {flags?.ouraConnected ? "✓" : "3"}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: "4px" }}>Step 3: Link Oura Ring Account</h3>
                <p style={{ fontSize: "13.5px", color: "rgba(235, 240, 248, 0.5)", marginBottom: "12px", lineHeight: "1.4" }}>
                  {flags?.ouraConnected ? "Oura Ring account connected!" : "Authenticate with Oura to authorize daily sync."}
                </p>
                {!flags?.ouraConnected && (
                  <Button variant="primary" disabled={!flags?.ouraAppConfigured} onClick={() => setActiveTab("settings")}>
                    Connect Oura Ring
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-stack">
      {illnessWarning && (
        <Alert variant="warn" title="Early Illness Warning Alert">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span>Your biometric markers (RHR, HRV, or body temperature deviation) indicate significant strain. Consider prioritizing recovery and reducing training intensity.</span>
            {onMuteAlert && (
              <button
                type="button"
                className="halo-btn halo-btn-ghost halo-btn-sm"
                style={{ marginLeft: 16, flexShrink: 0 }}
                onClick={() => onMuteAlert("illness_warning")}
              >
                Mute
              </button>
            )}
          </div>
        </Alert>
      )}
      <section className="halo-rings" aria-label="Today's scores">
        <RingCard
          label="Readiness"
          score={latestReadiness?.score ?? null}
          delta={
            latestReadiness && readinessBaseline != null
              ? latestReadiness.score - readinessBaseline
              : null
          }
          onClick={() => setActiveTab("readiness")}
        />
        <RingCard
          label="Sleep"
          score={latestSleep?.score ?? null}
          delta={
            latestSleep && sleepBaseline != null
              ? latestSleep.score - sleepBaseline
              : null
          }
          onClick={() => setActiveTab("sleep")}
        />
        <RingCard
          label="Activity"
          score={latestActivity?.score ?? null}
          delta={
            latestActivity && activityBaseline != null
              ? latestActivity.score - activityBaseline
              : null
          }
          onClick={() => setActiveTab("activity")}
        />
      </section>

      <div style={{ padding: "16px 24px", background: "var(--bg-card)", border: "1px solid var(--divider)", borderRadius: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginTop: "24px", marginBottom: "4px", transition: "all 150ms var(--ease)" }} onClick={() => setActiveTab("daystrip")} onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent)"} onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--divider)"}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--accent)", fontWeight: 600 }}>Explore Aligned 24-Hour Timeline</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            Analyze Sleep stages, Heart Rate buckets, Movement intensity, and Workout events aligned chronologically.
          </p>
        </div>
        <span style={{ fontSize: "1.4rem", color: "var(--accent)" }}>→</span>
      </div>

      <section className="halo-vitals" aria-label="Vitals">
        <Kpi
          label="Resting HR"
          metricId="rhr"
          value={latestReadiness?.rhr || "—"}
          unit="bpm"
          note={
            latestReadiness && rhrBaseline != null ? (
              <DeltaChip
                value={latestReadiness.rhr - rhrBaseline}
                higherIsBetter={false}
              />
            ) : (
              "vs baseline pending"
            )
          }
        />
        <Kpi
          label="HRV"
          metricId="hrv"
          value={latestReadiness?.hrv || "—"}
          unit="ms"
          note={
            latestReadiness && hrvBaseline != null ? (
              <DeltaChip value={latestReadiness.hrv - hrvBaseline} />
            ) : (
              "vs baseline pending"
            )
          }
        />
        <Kpi
          label="Temp"
          metricId="temperature_deviation"
          value={
            latestReadiness ? (
              <span className={tempFlag ? "tone-fair" : undefined}>
                {latestReadiness.temperature_deviation > 0 ? "+" : ""}
                {latestReadiness.temperature_deviation.toFixed(1)}
              </span>
            ) : (
              "—"
            )
          }
          unit="°C"
          note={tempFlag ? "outside normal range" : "normal range"}
        />
        <Kpi
          label="Stress balance"
          value={latestStress ? `${strainHours}h` : "—"}
          note={
            latestStress
              ? `${recoveryHours}h recovery time`
              : "no stress sample"
          }
        />
      </section>

      {/* Contributors Breakdown Section */}
      {(() => {
        const [viewMode, setViewMode] = useState<"list" | "sunburst">("sunburst");

        const latestRawSleep = latestSleep ? rawSleep.find((s) => s.day === latestSleep.day) : null;
        const latestRawReadiness = latestReadiness ? rawReadiness.find((r) => r.day === latestReadiness.day) : null;

        const sleepContribs = latestRawSleep?.contributors
          ? Object.entries(latestRawSleep.contributors).map(([name, val]: any) => ({
              name: name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
              score: val,
            }))
          : [];

        const readinessContribs = latestRawReadiness?.contributors
          ? Object.entries(latestRawReadiness.contributors).map(([name, val]: any) => ({
              name: name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
              score: val,
            }))
          : [];

        return (
          <div style={{ marginTop: "24px" }}>
            <Card>
              <div style={{ padding: "16px 20px 8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Contributors Breakdown</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", opacity: 0.6 }}>
                    Detailed rating factors contributing to your overall recovery and sleep.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button
                    variant={viewMode === "list" ? "primary" : "secondary"}
                    onClick={() => setViewMode("list")}
                    style={{ padding: "4px 10px", fontSize: "0.75rem", height: "28px" }}
                  >
                    List View
                  </Button>
                  <Button
                    variant={viewMode === "sunburst" ? "primary" : "secondary"}
                    onClick={() => setViewMode("sunburst")}
                    style={{ padding: "4px 10px", fontSize: "0.75rem", height: "28px" }}
                  >
                    Sunburst View
                  </Button>
                </div>
              </div>
              <CardContent>
                <div style={{ padding: "16px 20px" }}>
              {viewMode === "list" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "0.85rem", marginBottom: "12px", color: "var(--hue-sleep)" }}>Sleep Factors</strong>
                    {sleepContribs.length === 0 ? <p style={{ opacity: 0.6, fontSize: "0.8rem" }}>Pending data...</p> : sleepContribs.map((c) => (
                      <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{c.name}</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: bandColor(scoreBand(c.score)) }}>{c.score}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: "0.85rem", marginBottom: "12px", color: "var(--hue-readiness)" }}>Readiness Factors</strong>
                    {readinessContribs.length === 0 ? <p style={{ opacity: 0.6, fontSize: "0.8rem" }}>Pending data...</p> : readinessContribs.map((c) => (
                      <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{c.name}</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: bandColor(scoreBand(c.score)) }}>{c.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "24px", padding: "12px 0" }}>
                  {latestSleep && sleepContribs.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--hue-sleep)" }}>Sleep Contributors</span>
                      <SunburstGlyph score={latestSleep.score} contributors={sleepContribs} />
                    </div>
                  ) : (
                    <p style={{ opacity: 0.6, fontSize: "0.85rem" }}>Sleep contributors pending...</p>
                  )}
                  {latestReadiness && readinessContribs.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--hue-readiness)" }}>Readiness Contributors</span>
                      <SunburstGlyph score={latestReadiness.score} contributors={readinessContribs} />
                    </div>
                  ) : (
                    <p style={{ opacity: 0.6, fontSize: "0.85rem" }}>Readiness contributors pending...</p>
                  )}
                </div>
              )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      <div className="halo-home-grid">
        <Card>
          <CardHeader
            title="Readiness trend"
            description="Daily score across your tracked history"
          />
          <CardContent>
            <div className="chart-frame feature">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={readinessChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                yAxis={[{ min: 0, max: 100 }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "score",
                    label: "Readiness",
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

        <div className="halo-home-rail">
          <div className="halo-insight">
            <span className="halo-insight-overline">Today</span>
            <span className="halo-insight-headline">{headline}</span>
            <span className="halo-insight-sub">
              {latestReadiness
                ? `Readiness is ${latestReadiness.score} · posture: ${recoveryPosture}`
                : "Waiting for data"}
            </span>
          </div>
          {worstContributor && (
            <div style={{ marginTop: "16px", padding: "16px", border: "1px solid var(--divider-strong)", borderRadius: "14px", background: "rgba(255, 107, 94, 0.08)" }}>
              <strong style={{ display: "block", fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase", marginBottom: "4px" }}>Worst Biometric Contributor</strong>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--low)" }}>{worstContributor.name} ({worstContributor.score})</div>
              <p style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "6px", marginBottom: 0 }}>
                This metric in your {worstContributor.source} data had the lowest rating today. Prioritizing improvement here will yield the largest recovery benefit.
              </p>
            </div>
          )}
          <div className="insights-list">
            {insights.map((insight) => {
              const text = (insight.cta || "").toLowerCase();
              const target = text.includes("sleep")
                ? "sleep"
                : text.includes("readiness")
                ? "readiness"
                : text.includes("activity")
                ? "activity"
                : text.includes("stress")
                ? "stress"
                : null;
              return (
                <AIFinding
                  key={insight.title}
                  variant={insight.variant}
                  title={insight.title}
                  body={insight.body}
                  cta={{
                    label: insight.cta,
                    onClick: target ? () => setActiveTab(target) : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
