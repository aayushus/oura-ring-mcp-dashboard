import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";

interface CorrelationViewProps {
  correlations?: Record<string, Record<string, number>>;
  tagEffects?: any[];
}

export function CorrelationView({
  correlations,
  tagEffects,
}: CorrelationViewProps) {
  // Get correlation matrix keys
  const keys = correlations ? Object.keys(correlations) : [];

  // Helper to determine cell background color based on Pearson value (-1.0 to 1.0)
  const getCellColor = (value: number) => {
    const abs = Math.abs(value);
    if (value > 0) {
      return `rgba(45, 212, 191, ${abs})`; // Turquoise positive correlation
    } else {
      return `rgba(255, 107, 94, ${abs})`; // Red negative correlation
    }
  };

  // Helper to format key names for display
  const formatKeyName = (key: string) => {
    return key.replace(/_/g, " ");
  };

  // Sort tag effects by absolute effect size descending
  const sortedTagEffects = tagEffects
    ? [...tagEffects].sort((a, b) => Math.abs(b.cohensD) - Math.abs(a.cohensD))
    : [];

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--ai)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Pearson biometric correlations heatmaps and tag-effect Cohen's d comparisons lab.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "start" }}>
        
        {/* Pearson Correlation Heatmap */}
        <div style={{ flex: 1.5 }}>
          <Card>
            <CardHeader
              title="Biometric Pearson Correlation Matrix"
              description="Correlation values (-1.0 to +1.0) between daily vitals. Green = Positive relationship, Red = Inverse relationship."
            />
            <CardContent>
              <div style={{ overflowX: "auto" }}>
                {!correlations ? (
                  <p style={{ opacity: 0.6, padding: "20px" }}>Awaiting sync to compute matrix.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "8px", border: "1px solid var(--divider)", fontSize: "0.8rem", textAlign: "left" }}>Metric</th>
                        {keys.map((k) => (
                          <th
                            key={k}
                            style={{
                              padding: "8px",
                              border: "1px solid var(--divider)",
                              fontSize: "0.75rem",
                              textTransform: "capitalize",
                              writingMode: "vertical-lr",
                              transform: "rotate(180deg)",
                              maxHeight: "100px",
                              textAlign: "center",
                            }}
                          >
                            {formatKeyName(k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k1) => (
                        <tr key={k1}>
                          <td
                            style={{
                              padding: "8px",
                              border: "1px solid var(--divider)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              textTransform: "capitalize",
                              background: "rgba(0,0,0,0.05)",
                            }}
                          >
                            {formatKeyName(k1)}
                          </td>
                          {keys.map((k2) => {
                            const val = correlations[k1][k2] ?? 0;
                            const bg = getCellColor(val);
                            const color = Math.abs(val) > 0.5 ? "#FFFFFF" : "inherit";
                            return (
                              <td
                                key={k2}
                                style={{
                                  padding: "8px",
                                  border: "1px solid var(--divider)",
                                  fontSize: "0.85rem",
                                  fontWeight: 700,
                                  textAlign: "center",
                                  background: bg,
                                  color,
                                  transition: "background 0.2s",
                                }}
                                title={`Correlation between ${formatKeyName(k1)} and ${formatKeyName(k2)}: ${val}`}
                              >
                                {val.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tag Effects (Cohen's d) */}
        <div style={{ flex: 1 }}>
          <Card>
            <CardHeader
              title="Tags Impact Analysis (Cohen's d)"
              description="Metric variations on days WITH tag present vs days WITHOUT tag present (Effect sizes)"
            />
            <CardContent>
              {sortedTagEffects.length === 0 ? (
                <p style={{ opacity: 0.6, padding: "20px 0" }}>
                  Add Oura tags (e.g. Alcohol, Late Meal, Caffeine) to see biometric effect sizes comparison.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {sortedTagEffects.map((effect, idx) => {
                    const val = effect.cohensD;
                    const isPositive = val >= 0;
                    const effectStrength =
                      Math.abs(val) >= 0.8
                        ? "Large"
                        : Math.abs(val) >= 0.5
                          ? "Medium"
                          : "Small";
                    
                    const barColor = isPositive ? "var(--score-optimal)" : "var(--score-low)";

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "12px",
                          border: "1px solid var(--divider)",
                          borderRadius: "10px",
                          background: "rgba(0,0,0,0.02)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                            Tag: <span style={{ textTransform: "capitalize", color: "var(--accent)" }}>{effect.tag}</span>
                          </span>
                          <span style={{ fontSize: "0.8rem", opacity: 0.6, fontStyle: "italic" }}>
                            {effectStrength} Effect
                          </span>
                        </div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.8, marginBottom: "8px" }}>
                          Impacts <strong>{formatKeyName(effect.metric)}</strong> by <strong>{val > 0 ? "+" : ""}{val}</strong> standard deviations.
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.8rem" }}>
                          <span style={{ flex: 1, textAlign: "right", opacity: 0.6 }}>Without: {effect.withoutAvg}</span>
                          <div style={{ flex: 2, height: "8px", background: "var(--divider)", borderRadius: "4px", position: "relative" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, Math.abs(val) * 50)}%`,
                                background: barColor,
                                borderRadius: "4px",
                                position: "absolute",
                                left: isPositive ? "50%" : "auto",
                                right: !isPositive ? "50%" : "auto",
                              }}
                            />
                            <div style={{ position: "absolute", left: "50%", top: "-2px", height: "12px", width: "1px", background: "var(--divider-strong)" }} />
                          </div>
                          <span style={{ flex: 1, opacity: 0.6 }}>With: {effect.withAvg}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
