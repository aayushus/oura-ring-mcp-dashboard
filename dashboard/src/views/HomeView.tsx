import { Card, CardContent, CardHeader, Alert } from "../components/components";
import { DeltaChip, Kpi, RingCard } from "../components/halo";
import type { ReadinessRecord, SleepRecord, ActivityRecord, StressRecord, TabKey } from "../types";
import { DashboardLineChart } from "./charts";

interface HomeViewProps {
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
}

export function HomeView({
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
}: HomeViewProps) {
  return (
    <div className="dashboard-stack">
      {illnessWarning && (
        <Alert variant="warn" title="Early Illness Warning Alert">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span>Your biometric markers (RHR, HRV, or body temperature deviation) indicate significant strain. Consider prioritizing recovery and reducing training intensity.</span>
            {onMuteAlert && (
              <button 
                onClick={() => onMuteAlert("illness_warning")}
                style={{ marginLeft: "16px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", color: "inherit", padding: "4px 8px", fontSize: "0.75rem", cursor: "pointer" }}
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
            {insights.map((insight) => (
              <AIFinding
                key={insight.title}
                variant={insight.variant}
                title={insight.title}
                body={insight.body}
                cta={{ label: insight.cta }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
