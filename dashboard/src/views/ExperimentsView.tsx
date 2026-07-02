import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, Alert } from "../components/components";

export function ExperimentsView() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [behavior, setBehavior] = useState("");
  const [metricIds, setMetricIds] = useState<string[]>(["sleep_score"]);
  const [hypothesis, setHypothesis] = useState("improve");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState("14");
  const [confounder, setConfounder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadExperiments() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard/experiments");
      if (!res.ok) throw new Error("Failed to load experiments");
      const json = await res.json();
      setExperiments(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExperiments();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/dashboard/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          behavior_text: behavior,
          metric_ids: metricIds,
          direction_hypothesis: hypothesis,
          start_date: startDate,
          duration_days: Number(duration),
          confounder_warning: confounder,
        }),
      });
      if (!res.ok) throw new Error("Failed to save experiment");
      const saved = await res.json();
      setExperiments([saved, ...experiments]);
      
      // Reset form
      setTitle("");
      setBehavior("");
      setConfounder("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogAdherence(expId: string, day: string, currentStatus: boolean) {
    try {
      const newStatus = !currentStatus;
      const res = await fetch(`/api/dashboard/experiments/${expId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          adherent: newStatus ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to log adherence");
      
      // Update local state
      setExperiments(experiments.map((exp) => {
        if (exp.id !== expId) return exp;
        
        let newLogged = [...(exp.loggedDays || [])];
        const existingIdx = newLogged.findIndex((l) => l.day === day);
        if (existingIdx >= 0) {
          newLogged[existingIdx] = { ...newLogged[existingIdx], adherent: newStatus ? 1 : 0 };
        } else {
          newLogged.push({ experiment_id: expId, day, adherent: newStatus ? 1 : 0 });
        }
        return { ...exp, loggedDays: newLogged };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <div className="dashboard-skeleton card" style={{ height: "300px" }} />
      </div>
    );
  }

  return (
    <div className="dashboard-stack" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      
      {error && (
        <Alert variant="warn" title="Experiment Error">
          {error}
        </Alert>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "start" }}>
        
        {/* Setup Wizard */}
        <Card>
          <CardHeader
            title="Setup Self-Experiment"
            description="Run controlled N-of-1 self-experiments to scientifically measure the impact of habits on sleep or recovery."
          />
          <CardContent>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Experiment Title</label>
                <input
                  type="text"
                  placeholder="e.g. No caffeine after 2:00 PM"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Core Behavior to Log</label>
                <textarea
                  placeholder="e.g. Sleep with a weighted blanket, log if adhered or not."
                  value={behavior}
                  onChange={(e) => setBehavior(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit", fontFamily: "inherit" }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Duration (days)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Metric to Measure</label>
                <select
                  multiple
                  value={metricIds}
                  onChange={(e) => setMetricIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit", height: "100px" }}
                >
                  <option value="sleep_score">Sleep Score</option>
                  <option value="readiness_score">Readiness Score</option>
                  <option value="hrv">HRV Average</option>
                  <option value="rhr">RHR Average</option>
                  <option value="deep_sleep">Deep Sleep Duration</option>
                  <option value="rem_sleep">REM Sleep Duration</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Hypothesized Confounders / Warnings</label>
                <input
                  type="text"
                  placeholder="e.g. Alcohol ingestion will skew results."
                  value={confounder}
                  onChange={(e) => setConfounder(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                />
              </div>

              <button
                type="submit"
                className="halo-btn halo-btn-primary"
                disabled={submitting}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                {submitting ? "Starting..." : "Start Experiment"}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Experiments List & Compliance Log */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <Card>
            <CardHeader
              title="Active Experiments"
              description="Review progress and mark daily habit compliance checkboxes"
            />
            <CardContent>
              {experiments.length === 0 ? (
                <p style={{ opacity: 0.6 }}>No experiments configured yet. Launch one above!</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {experiments.map((exp) => {
                    // Calculate adherence rate
                    const totalLogged = exp.loggedDays?.length ?? 0;
                    const totalAdherent = exp.loggedDays?.filter((d: any) => d.adherent === 1).length ?? 0;
                    const adherenceRate = totalLogged > 0 ? Math.round((totalAdherent / totalLogged) * 100) : 0;

                    // Generate calendar logging boxes for the experiment duration
                    const datesList: string[] = [];
                    const start = new Date(exp.start_date + "T00:00:00Z");
                    for (let i = 0; i < exp.duration_days; i++) {
                      const d = new Date(start);
                      d.setUTCDate(start.getUTCDate() + i);
                      datesList.push(d.toISOString().slice(0, 10));
                    }

                    return (
                      <div key={exp.id} style={{ borderBottom: "1px solid var(--divider)", paddingBottom: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{exp.title}</h3>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }}>
                            {adherenceRate}% Adherence
                          </span>
                        </div>
                        <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: "4px 0 12px 0" }}>
                          {exp.behavior_text}
                        </p>
                        
                        {/* Confounder Warning Alert */}
                        {exp.confounder_warning && (
                          <div style={{ fontSize: "0.75rem", background: "rgba(251, 191, 36, 0.08)", color: "var(--score-low)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "6px", padding: "8px", marginBottom: "12px" }}>
                            ⚠️ Confounder: {exp.confounder_warning}
                          </div>
                        )}

                        <div style={{ fontSize: "0.8rem", fontWeight: 600, opacity: 0.7, marginBottom: "8px" }}>Adherence Calendar Log</div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {datesList.map((day) => {
                            const isPast = new Date(day) <= new Date();
                            const logRecord = exp.loggedDays?.find((l: any) => l.day === day);
                            const isAdherent = logRecord ? logRecord.adherent === 1 : false;

                            return (
                              <button
                                key={day}
                                onClick={() => handleLogAdherence(exp.id, day, isAdherent)}
                                disabled={!isPast}
                                style={{
                                  padding: "6px 8px",
                                  fontSize: "0.75rem",
                                  borderRadius: "6px",
                                  border: "1px solid var(--divider)",
                                  background: isAdherent
                                    ? "var(--score-optimal)"
                                    : logRecord
                                      ? "var(--score-low)"
                                      : "rgba(0,0,0,0.05)",
                                  color: isAdherent || logRecord ? "#FFFFFF" : "inherit",
                                  cursor: isPast ? "pointer" : "default",
                                  opacity: isPast ? 1 : 0.4,
                                }}
                                title={day}
                              >
                                {day.slice(-2)}
                              </button>
                            );
                          })}
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
