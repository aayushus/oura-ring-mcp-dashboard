import { useState } from "react";
import { Card, CardContent, CardHeader, Alert, Button } from "../components/components";
import { DeltaChip, Kpi, RingCard, bandColor, scoreBand } from "../components/halo";
import type { ReadinessRecord, SleepRecord, ActivityRecord, StressRecord, TabKey, HistorySummary } from "../types";
import { DashboardLineChart } from "./charts";
import { SunburstGlyph } from "../components/SunburstGlyph";
import { RecoveryBanner } from "../components/RecoveryBanner";
import { YearHeatmap } from "../components/YearHeatmap";
import { InitialSyncCard } from "../components/InitialSyncCard";

interface HomeViewProps {
  flags?: {
    signupsEnabled: boolean;
    isFirstRun: boolean;
    ouraAppConfigured: boolean;
    ouraConnected: boolean;
  };
  data?: HistorySummary;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
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
  onOpenMetricDrawer?: (type: "sleep" | "readiness" | "activity" | "stress") => void;
  onSync?: () => void;
  syncing?: boolean;
}

export function HomeView({
  flags,
  data,
  selectedDay,
  onSelectDay,
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
  onOpenMetricDrawer,
  onSync,
  syncing,
}: HomeViewProps) {
  const hasNoData = !latestReadiness && !latestSleep && !latestActivity;

  if (hasNoData) {
    if (flags?.ouraConnected && onSync) {
      return (
        <div style={{ maxWidth: "680px", margin: "40px auto" }}>
          <InitialSyncCard onSync={onSync} syncing={!!syncing} />
        </div>
      );
    }

    return (
      <div className="dashboard-stack" style={{ maxWidth: "680px", margin: "40px auto" }}>
        <div className="halo-card" style={{ padding: "40px", background: "rgba(20, 22, 29, 0.7)", backdropFilter: "blur(20px)", borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", background: "linear-gradient(135deg, #ffffff 0%, #aeb3b7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Welcome to Oura MCP Server
          </h1>
          <p style={{ color: "rgba(235, 240, 248, 0.6)", fontSize: "15px", marginBottom: "32px", lineHeight: "1.6" }}>
            To begin visualising your sleep, readiness, and activity, follow the steps below to connect your Oura Ring.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", gap: "16px", padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#27ae60", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>✓</div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: "4px" }}>Step 1: Account Created</h3>
                <p style={{ fontSize: "13.5px", color: "rgba(235, 240, 248, 0.5)" }}>Your user profile is active.</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: flags?.ouraConnected ? "#27ae60" : "#b55fe6", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flexShrink: 0 }}>
                {flags?.ouraConnected ? "✓" : "2"}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: "4px" }}>Step 2: Link Oura Ring Account</h3>
                <p style={{ fontSize: "13.5px", color: "rgba(235, 240, 248, 0.5)", marginBottom: "12px", lineHeight: "1.4" }}>
                  {flags?.ouraConnected ? "Oura Ring account connected!" : "Provide a Personal Access Token or link via OAuth in Settings."}
                </p>
                {!flags?.ouraConnected && (
                  <Button variant="primary" onClick={() => setActiveTab("settings")}>
                    Connect Oura in Settings
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
      {/* Daily Narrative Recovery Banner */}
      {data && selectedDay && <RecoveryBanner data={data} selectedDay={selectedDay} />}

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

      {/* Metric Score Rings */}
      <section className="halo-rings" aria-label="Today's scores">
        <RingCard
          label="Readiness"
          score={latestReadiness?.score ?? null}
          delta={
            latestReadiness && readinessBaseline != null
              ? latestReadiness.score - readinessBaseline
              : null
          }
          onClick={() => {
            if (onOpenMetricDrawer) onOpenMetricDrawer("readiness");
            else setActiveTab("readiness");
          }}
        />
        <RingCard
          label="Sleep"
          score={latestSleep?.score ?? null}
          delta={
            latestSleep && sleepBaseline != null
              ? latestSleep.score - sleepBaseline
              : null
          }
          onClick={() => {
            if (onOpenMetricDrawer) onOpenMetricDrawer("sleep");
            else setActiveTab("sleep");
          }}
        />
        <RingCard
          label="Activity"
          score={latestActivity?.score ?? null}
          delta={
            latestActivity && activityBaseline != null
              ? latestActivity.score - activityBaseline
              : null
          }
          onClick={() => {
            if (onOpenMetricDrawer) onOpenMetricDrawer("activity");
            else setActiveTab("activity");
          }}
        />
      </section>

      {/* 52-Week Contribution Density Heatmap */}
      {data && onSelectDay && (
        <YearHeatmap
          sleepData={data.sleep || []}
          readinessData={data.readiness || []}
          selectedDay={selectedDay || ""}
          onSelectDay={onSelectDay}
        />
      )}

      <div style={{ padding: "16px 24px", background: "var(--bg-card)", border: "1px solid var(--divider)", borderRadius: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginTop: "12px", marginBottom: "4px", transition: "all 150ms var(--ease)" }} onClick={() => setActiveTab("daystrip")} onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent)"} onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--divider)"}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--accent)", fontWeight: 600 }}>Explore Aligned 24-Hour Timeline</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            Analyze Sleep stages, Heart Rate buckets, Movement intensity, and Workout events aligned chronologically.
          </p>
        </div>
        <span style={{ fontSize: "1.4rem", color: "var(--accent)" }}>→</span>
      </div>

      <section className="halo-vitals" aria-label="Vitals">
        <div onClick={() => onOpenMetricDrawer && onOpenMetricDrawer("readiness")} style={{ cursor: "pointer" }}>
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
        </div>
        <div onClick={() => onOpenMetricDrawer && onOpenMetricDrawer("readiness")} style={{ cursor: "pointer" }}>
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
        </div>
        <div onClick={() => onOpenMetricDrawer && onOpenMetricDrawer("readiness")} style={{ cursor: "pointer" }}>
          <Kpi
            label="Temp"
            metricId="temp"
            value={
              latestReadiness?.temperature_deviation != null
                ? `${latestReadiness.temperature_deviation > 0 ? "+" : ""}${latestReadiness.temperature_deviation.toFixed(2)}`
                : "—"
            }
            unit="°C"
            note={
              tempFlag ? (
                <span className="halo-warn-pill">Elevated</span>
              ) : (
                "Normal deviation"
              )
            }
          />
        </div>
        <div onClick={() => onOpenMetricDrawer && onOpenMetricDrawer("sleep")} style={{ cursor: "pointer" }}>
          <Kpi
            label="Sleep Total"
            metricId="sleep_need"
            value={
              latestSleep
                ? `${Math.floor(latestSleep.duration / 3600)}h ${Math.floor((latestSleep.duration % 3600) / 60)}m`
                : "—"
            }
            note={`Efficiency: ${latestSleep?.efficiency || 0}%`}
          />
        </div>
        <div onClick={() => onOpenMetricDrawer && onOpenMetricDrawer("sleep")} style={{ cursor: "pointer" }}>
          <Kpi
            label="Deep Sleep"
            metricId="sleep_need"
            value={
              latestSleep
                ? `${Math.floor(latestSleep.deep / 3600)}h ${Math.floor((latestSleep.deep % 3600) / 60)}m`
                : "—"
            }
            note={latestSleep ? `${((latestSleep.deep / (latestSleep.duration || 1)) * 100).toFixed(0)}% of total` : "—"}
          />
        </div>
        <div onClick={() => onOpenMetricDrawer && onOpenMetricDrawer("activity")} style={{ cursor: "pointer" }}>
          <Kpi
            label="Active Burn"
            metricId="acwr"
            value={latestActivity?.active_calories || "—"}
            unit="kcal"
            note={`Total: ${latestActivity?.total_calories || 0} kcal`}
          />
        </div>
      </section>

      <section className="halo-grid-2" aria-label="30-day overview and recovery posture">
        <Card>
          <CardHeader
            title="Readiness & Recovery"
            description="30-day trend with baseline average"
          />
          <CardContent>
            {readinessChartData.length > 0 ? (
              <div style={{ height: "240px" }}>
                <DashboardLineChart
                  className="dashboard-chart"
                  dataset={readinessChartData}
                  xAxis={[{ scaleType: "point", dataKey: "day" }]}
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
                />
              </div>
            ) : (
              <div className="halo-empty-state">No trend data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Physiological Posture"
            description="Composite stress & recovery balance"
          />
          <CardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>Current State</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-1)", marginTop: "2px" }}>{recoveryPosture}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", textTransform: "uppercase" }}>Restored / Stressed</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-2)", marginTop: "2px" }}>
                    {recoveryHours}h / {strainHours}h
                  </div>
                </div>
              </div>

              {worstContributor && (
                <div style={{ background: "rgba(235, 87, 87, 0.08)", border: "1px solid rgba(235, 87, 87, 0.2)", borderRadius: "12px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11.5px", color: "#eb5757", fontWeight: 600, textTransform: "uppercase" }}>Key Drag: {worstContributor.source}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-1)", textTransform: "capitalize", marginTop: "2px" }}>{worstContributor.name}</div>
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#eb5757" }}>{worstContributor.score}</div>
                </div>
              )}

              <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "var(--text-2)" }}>
                {headline}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
