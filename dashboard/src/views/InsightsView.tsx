import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { ScoreRing, Kpi, DeltaChip, BAND_LABEL, scoreBand } from "../components/halo";
import type { ReadinessRecord } from "../types";
import { formatDayLabel } from "../utils";

interface InsightsViewProps {
  latestReadiness: ReadinessRecord | null;
  recoveryPosture: string;
  headline: string;
  tempFlag: boolean;
  heroDate: string | null;
  weekCompare: any[] | null;
  insights: any[];
  anomalies: any[];
  setActiveTab: (tab: any) => void;
  weeklyData?: any;
}

export function InsightsView({
  latestReadiness,
  recoveryPosture,
  headline,
  tempFlag,
  heroDate,
  weekCompare,
  insights,
  anomalies,
  setActiveTab,
  weeklyData,
}: InsightsViewProps) {
  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--ai)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Current recovery posture, key risks, and next best actions.</p>
      </div>

      <section className="halo-verdict" aria-label="Today's verdict">
        <ScoreRing score={latestReadiness?.score ?? null} size={140} strokeWidth={10} />
        <div className="halo-verdict-copy">
          <span className="halo-verdict-posture">
            Posture: {recoveryPosture}
          </span>
          <span className="halo-verdict-headline">{headline}</span>
          <span className="halo-verdict-body">
            {latestReadiness
              ? `Readiness is ${latestReadiness.score} (${BAND_LABEL[scoreBand(latestReadiness.score)].toLowerCase()}). Resting HR ${latestReadiness.rhr} bpm and HRV ${latestReadiness.hrv} ms${
                  tempFlag
                    ? `, with temperature ${latestReadiness.temperature_deviation > 0 ? "+" : ""}${latestReadiness.temperature_deviation.toFixed(1)} °C off baseline`
                    : ""
                }.`
              : "Sync your ring to build today's verdict."}
          </span>
          <span className="halo-verdict-meta">
            {heroDate
              ? `From data through ${formatDayLabel(heroDate)} · rule-based, computed locally`
              : "Waiting for enough history"}
          </span>
        </div>
      </section>

      {weeklyData && (
        <div style={{ margin: "20px 0" }}>
          <Card>
          <CardHeader
            title="Weekly Narrative Recap"
            description="Comparing trailing 7 days vs previous 7 days."
          />
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div style={{ padding: "12px", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--divider)" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.6, display: "block" }}>Avg Sleep Score</span>
                <span style={{ fontSize: "1.5rem", fontWeight: 600, display: "block", margin: "4px 0" }}>{weeklyData.sleepAvg || "—"}</span>
                <span style={{ fontSize: "0.8rem", color: Number(weeklyData.sleepDelta) >= 0 ? "var(--score-optimal)" : "var(--score-low)" }}>
                  {Number(weeklyData.sleepDelta) >= 0 ? `▲ +${weeklyData.sleepDelta}` : `▼ ${weeklyData.sleepDelta}`}
                </span>
              </div>
              <div style={{ padding: "12px", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--divider)" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.6, display: "block" }}>Avg Readiness Score</span>
                <span style={{ fontSize: "1.5rem", fontWeight: 600, display: "block", margin: "4px 0" }}>{weeklyData.readinessAvg || "—"}</span>
                <span style={{ fontSize: "0.8rem", color: Number(weeklyData.readinessDelta) >= 0 ? "var(--score-optimal)" : "var(--score-low)" }}>
                  {Number(weeklyData.readinessDelta) >= 0 ? `▲ +${weeklyData.readinessDelta}` : `▼ ${weeklyData.readinessDelta}`}
                </span>
              </div>
              <div style={{ padding: "12px", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--divider)" }}>
                <span style={{ fontSize: "0.75rem", opacity: 0.6, display: "block" }}>Avg Activity Score</span>
                <span style={{ fontSize: "1.5rem", fontWeight: 600, display: "block", margin: "4px 0" }}>{weeklyData.activityAvg || "—"}</span>
                <span style={{ fontSize: "0.8rem", color: Number(weeklyData.activityDelta) >= 0 ? "var(--score-optimal)" : "var(--score-low)" }}>
                  {Number(weeklyData.activityDelta) >= 0 ? `▲ +${weeklyData.activityDelta}` : `▼ ${weeklyData.activityDelta}`}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "0.9rem" }}>
                <span style={{ fontSize: "1.2rem" }}>🏆</span>
                <div>
                  <strong>Win of the Week:</strong> Improved {weeklyData.biggestWin.toLowerCase()}. Nice effort maintaining consistency!
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "0.9rem" }}>
                <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                <div>
                  <strong>Watch Out:</strong> Pay attention to your {weeklyData.watchOut.toLowerCase()}. Focus on recovery overlays here.
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "0.9rem" }}>
                <span style={{ fontSize: "1.2rem" }}>🔥</span>
                <div>
                  <strong>Sleep Streak:</strong> You maintained a sleep score of &ge; 75 for <strong>{weeklyData.sleepStreak} consecutive days</strong> this period. Keep up the clean sleep hygiene!
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {weekCompare && (
        <>
          <div className="halo-topbar-overline" style={{ marginTop: 8 }}>
            This week vs last week
          </div>
          <section className="halo-vitals" aria-label="Week over week">
            {weekCompare.map((entry) => (
              <Kpi
                key={entry.label}
                label={entry.label}
                value={entry.cur != null ? entry.format(entry.cur) : "—"}
                unit={entry.unit}
                note={
                  entry.prev != null && entry.cur != null ? (
                    <DeltaChip
                      value={entry.cur - entry.prev}
                      higherIsBetter={entry.higherIsBetter}
                      format={(v) =>
                        entry.label === "Steps"
                          ? Math.abs(Math.round(v)).toLocaleString()
                          : `${Math.abs(Math.round(v))}`
                      }
                    />
                  ) : (
                    "no prior week yet"
                  )
                }
              />
            ))}
          </section>
        </>
      )}

      <div className="halo-insights-grid">
        <div className="halo-findings" aria-label="Findings">
          <div className="halo-topbar-overline">What to act on</div>
          {insights.map((insight) => (
            <div key={insight.title} className={`halo-finding ${insight.variant}`}>
              <span className="halo-finding-title">{insight.title}</span>
              <span className="halo-finding-body">{insight.body}</span>
              {insight.tab && (
                <button
                  type="button"
                  className="halo-finding-cta"
                  onClick={() => setActiveTab(insight.tab)}
                >
                  {insight.cta} →
                </button>
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader
            title="Unusual readings"
            description="Days that stood out from your own normal"
          />
          <CardContent>
            <div className="halo-anomalies">
              {anomalies.length === 0 ? (
                <span className="halo-empty-note">
                  No unusual readings in this window — steady is good.
                </span>
              ) : (
                anomalies.map((item, index) => (
                  <div className="halo-anomaly" key={`${item.day}-${index}`}>
                    <span className="halo-anomaly-date">
                      {formatDayLabel(item.day)}
                    </span>
                    <span className={`halo-anomaly-dot ${item.tone}`} />
                    <span className="halo-anomaly-text">
                      <strong>{item.metric}</strong> — {item.detail}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
