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
