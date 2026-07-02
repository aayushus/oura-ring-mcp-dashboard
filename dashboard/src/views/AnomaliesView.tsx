import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, Alert } from "../components/components";

export function AnomaliesView() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAnomalies() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard/anomalies");
      if (!res.ok) throw new Error("Failed to load anomalies");
      const json = await res.json();
      setAnomalies(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnomalies();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <div className="dashboard-skeleton card" style={{ height: "200px", marginBottom: "16px" }} />
        <div className="dashboard-skeleton card" style={{ height: "200px" }} />
      </div>
    );
  }

  return (
    <div className="dashboard-stack" style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--low)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Systemic biometric deviations and z-score warning feeds.</p>
      </div>

      {error && (
        <Alert variant="warn" title="Anomaly Issue">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Reverse-Chronological Anomaly Feed"
          description="Deviations exceeding ±2.0 standard deviations from your 30-day baseline"
        />
        <CardContent>
          {anomalies.length === 0 ? (
            <p style={{ opacity: 0.6, padding: "20px 0", textAlign: "center" }}>
              ✅ No biometric anomalies detected recently. Your vitals are stable.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {anomalies.map((record, index) => {
                const isTemp = record.metric_id === "temperature_deviation";
                const label = isTemp
                  ? "Body Temperature Drift"
                  : record.metric_id === "hrv"
                    ? "Heart Rate Variability (HRV)"
                    : "Resting Heart Rate (RHR)";

                const unit = isTemp ? "°C" : record.metric_id === "hrv" ? "ms" : "bpm";
                const isSpike = record.z_score > 0;
                
                return (
                  <div
                    key={index}
                    style={{
                      padding: "16px",
                      border: "1px solid var(--divider-strong)",
                      borderRadius: "14px",
                      background: "rgba(255, 107, 94, 0.05)",
                      display: "flex",
                      gap: "16px",
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        height: "40px",
                        width: "40px",
                        borderRadius: "50%",
                        background: "rgba(255, 107, 94, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--low)",
                        fontSize: "1.2rem",
                        fontWeight: 700,
                      }}
                    >
                      ⚠️
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, fontSize: "1rem" }}>{label}</span>
                        <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>{record.day}</span>
                      </div>
                      <p style={{ fontSize: "0.85rem", opacity: 0.85, margin: "6px 0" }}>
                        Vitals value measured at <strong>{record.value}{unit}</strong>, representing a Z-score of <strong>{record.z_score > 0 ? "+" : ""}{record.z_score}</strong>.
                      </p>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--low)", textTransform: "uppercase" }}>
                        {isSpike ? "Elevated Spike Alert" : "Depressed Dip Warning"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
