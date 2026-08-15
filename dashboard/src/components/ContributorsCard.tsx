import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "./components";

export interface ContributorItem {
  key: string;
  name: string;
  value: number;
}

interface ContributorsCardProps {
  title?: string;
  description?: string;
  contributors: Record<string, number> | ContributorItem[];
  type?: "sleep" | "readiness" | "generic";
}

const CONTRIBUTOR_META: Record<string, { icon: string; label: string; desc: string }> = {
  // Sleep contributors
  total_sleep: { icon: "🌙", label: "Total Sleep", desc: "Sleep duration compared to personal sleep need" },
  timing: { icon: "⏰", label: "Timing", desc: "Circadian alignment of bedtime and wake window" },
  rem_sleep: { icon: "🧠", label: "REM Sleep", desc: "Mental recovery, cognitive function & dream stage" },
  deep_sleep: { icon: "⚓", label: "Deep Sleep", desc: "Physical restoration, tissue repair & immune boost" },
  restfulness: { icon: "🛏️", label: "Restfulness", desc: "Sleep interruptions, tossing & turning movements" },
  efficiency: { icon: "⚡", label: "Efficiency", desc: "Percentage of time in bed spent genuinely asleep" },
  latency: { icon: "⏱️", label: "Latency", desc: "Time taken to fall asleep (10–20 min is optimal)" },

  // Readiness contributors
  previous_night: { icon: "🌙", label: "Previous Night", desc: "Quality and duration of your previous night's sleep" },
  sleep_balance: { icon: "⚖️", label: "Sleep Balance", desc: "Cumulative sleep debt/surplus over past 14 days" },
  previous_day_activity: { icon: "🏃", label: "Previous Day Activity", desc: "Movement strain and active burn from yesterday" },
  activity_balance: { icon: "📊", label: "Activity Balance", desc: "Training load harmony over the past 2 weeks" },
  resting_heart_rate: { icon: "❤️", label: "Resting Heart Rate", desc: "Lowest overnight pulse rate vs historical baseline" },
  hrv_balance: { icon: "💓", label: "HRV Balance", desc: "Autonomic nervous system recovery and stress balance" },
  recovery_index: { icon: "🔋", label: "Recovery Index", desc: "Time required for resting heart rate to stabilize" },
  body_temperature: { icon: "🌡️", label: "Body Temperature", desc: "Nighttime skin temperature deviation from baseline" },
};

function getScoreBand(score: number): {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
} {
  if (score >= 85) {
    return {
      label: "Optimal",
      color: "var(--score-optimal, #30D158)",
      bg: "rgba(48, 209, 88, 0.12)",
      borderColor: "rgba(48, 209, 88, 0.28)",
    };
  }
  if (score >= 70) {
    return {
      label: "Good",
      color: "var(--score-good, #66D4A8)",
      bg: "rgba(102, 212, 168, 0.12)",
      borderColor: "rgba(102, 212, 168, 0.28)",
    };
  }
  if (score >= 60) {
    return {
      label: "Fair",
      color: "var(--score-fair, #FFD60A)",
      bg: "rgba(255, 214, 10, 0.12)",
      borderColor: "rgba(255, 214, 10, 0.28)",
    };
  }
  return {
    label: "Pay Attention",
    color: "var(--score-low, #FF6B5E)",
    bg: "rgba(255, 107, 94, 0.14)",
    borderColor: "rgba(255, 107, 94, 0.32)",
  };
}

export function ContributorsCard({
  title = "Contributors",
  description = "Worst sleeping parameters sorted on top",
  contributors,
  type = "sleep",
}: ContributorsCardProps) {
  const [sortOrder, setSortOrder] = useState<"worst" | "best">("worst");

  // Normalize list
  let items: ContributorItem[] = [];
  if (Array.isArray(contributors)) {
    items = contributors;
  } else if (contributors && typeof contributors === "object") {
    items = Object.entries(contributors).map(([k, v]) => ({
      key: k,
      name: k.replace(/_/g, " "),
      value: Number(v),
    }));
  }

  // Filter valid numbers
  items = items.filter((item) => !isNaN(item.value) && item.value >= 0);

  // Sort list
  const sortedItems = [...items].sort((a, b) => {
    return sortOrder === "worst" ? a.value - b.value : b.value - a.value;
  });

  const lowestItem = items.length > 0 ? [...items].sort((a, b) => a.value - b.value)[0] : null;

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
      >
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "worst" ? "best" : "worst")}
            style={{
              background: "var(--bg-hover, rgba(255,255,255,0.06))",
              border: "1px solid var(--divider, rgba(255,255,255,0.08))",
              color: "var(--text-2)",
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
            title="Toggle sort order"
          >
            <span>{sortOrder === "worst" ? "Worst on top ⬇" : "Best on top ⬆"}</span>
          </button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: "0.9rem", padding: "12px 0" }}>
            No contributor metrics available for this date.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0" }}>
            {/* Attention highlight if any item is in Fair/Pay Attention */}
            {lowestItem && lowestItem.value < 70 && (
              <div
                style={{
                  background: lowestItem.value < 60 ? "rgba(255, 107, 94, 0.08)" : "rgba(255, 214, 10, 0.08)",
                  border: `1px solid ${lowestItem.value < 60 ? "rgba(255, 107, 94, 0.25)" : "rgba(255, 214, 10, 0.25)"}`,
                  borderRadius: "10px",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <div style={{ fontSize: "12px", color: "var(--text-default)", lineHeight: 1.4 }}>
                  Lowest parameter: <strong style={{ textTransform: "capitalize" }}>{lowestItem.name}</strong> (
                  <span style={{ color: getScoreBand(lowestItem.value).color, fontWeight: 700 }}>
                    {lowestItem.value}/100
                  </span>
                  ) — {CONTRIBUTOR_META[lowestItem.key]?.desc || "Requires recovery attention"}
                </div>
              </div>
            )}

            {/* Contributor List */}
            {sortedItems.map((contrib) => {
              const meta = CONTRIBUTOR_META[contrib.key] || {
                icon: "📊",
                label: contrib.name,
                desc: "",
              };
              const band = getScoreBand(contrib.value);

              return (
                <div
                  key={contrib.key || contrib.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "var(--bg-hover, rgba(255,255,255,0.02))",
                    border: "1px solid var(--divider, rgba(255,255,255,0.04))",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Top line: Icon, Name, Desc, and Score + Band */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "15px", lineHeight: 1 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-default)", textTransform: "capitalize" }}>
                          {meta.label}
                        </div>
                        {meta.desc && (
                          <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "1px" }}>
                            {meta.desc}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* Score Band Badge */}
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: band.color,
                          background: band.bg,
                          border: `1px solid ${band.borderColor}`,
                          padding: "2px 7px",
                          borderRadius: "6px",
                          letterSpacing: "0.2px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {band.label}
                      </span>

                      {/* Score Value */}
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: band.color,
                          minWidth: "28px",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {contrib.value}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar with glowing indicator */}
                  <div
                    style={{
                      height: "8px",
                      width: "100%",
                      background: "var(--bg-elevated, rgba(255,255,255,0.06))",
                      border: "1px solid var(--divider, rgba(255,255,255,0.08))",
                      borderRadius: "6px",
                      overflow: "hidden",
                      position: "relative",
                      marginTop: "2px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, contrib.value))}%`,
                        background: `linear-gradient(90deg, ${band.color}88 0%, ${band.color} 100%)`,
                        borderRadius: "5px",
                        boxShadow: `0 0 8px ${band.color}40`,
                        transition: "width 0.4s ease-in-out",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
