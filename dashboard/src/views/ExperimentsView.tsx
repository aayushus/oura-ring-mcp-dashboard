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
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
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
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
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
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--ai)" } as React.CSSProperties}
      >
        <span className="halo-module-overline">Lab</span>
        <h1 className="halo-module-title">Self-experiments</h1>
        <span className="rule" />
        <p>Change one habit for a set period and measure what it actually does to your sleep and recovery.</p>
      </div>

      {error && (
        <Alert variant="warn" title="Experiment issue">
          {error}
        </Alert>
      )}

      <div className="halo-grid-2">
        {/* Setup wizard */}
        <Card>
          <CardHeader
            title="Start an experiment"
            description="Pick a behavior, a duration, and the metrics to judge it by"
          />
          <CardContent>
            <form className="halo-form" onSubmit={handleCreate}>
              <div className="halo-field">
                <label htmlFor="exp-title">Title</label>
                <input
                  id="exp-title"
                  type="text"
                  placeholder="No caffeine after 2pm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="halo-field">
                <label htmlFor="exp-behavior">Behavior to log daily</label>
                <textarea
                  id="exp-behavior"
                  placeholder="Sleep with a weighted blanket — log whether you stuck to it."
                  value={behavior}
                  onChange={(e) => setBehavior(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <div className="halo-form-row">
                <div className="halo-field">
                  <label htmlFor="exp-start">Start date</label>
                  <input
                    id="exp-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="halo-field">
                  <label htmlFor="exp-duration">Duration (days)</label>
                  <input
                    id="exp-duration"
                    type="number"
                    min="7"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="halo-field">
                <label>Metrics to measure</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { id: "sleep_score", label: "Sleep score" },
                    { id: "readiness_score", label: "Readiness" },
                    { id: "hrv", label: "HRV" },
                    { id: "rhr", label: "Resting HR" },
                    { id: "deep_sleep", label: "Deep sleep" },
                    { id: "rem_sleep", label: "REM sleep" },
                  ].map((m) => {
                    const active = metricIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="halo-chip"
                        data-active={active}
                        style={{ "--chip-hue": "var(--ai)" } as React.CSSProperties}
                        onClick={() =>
                          setMetricIds(
                            active
                              ? metricIds.filter((id) => id !== m.id)
                              : [...metricIds, m.id]
                          )
                        }
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="halo-field">
                <label htmlFor="exp-confounder">Known confounders (optional)</label>
                <input
                  id="exp-confounder"
                  type="text"
                  placeholder="Alcohol will skew results"
                  value={confounder}
                  onChange={(e) => setConfounder(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="halo-btn halo-btn-primary halo-btn-block"
                disabled={submitting || metricIds.length === 0}
              >
                {submitting ? "Starting…" : "Start experiment"}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Experiments List & Compliance Log */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <Card>
            <CardHeader
              title="Active experiments"
              description="Tap a day to log whether you stuck to the habit"
            />
            <CardContent>
              {experiments.length === 0 ? (
                <p className="halo-muted">No experiments yet — start one on the left.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
                      <div key={exp.id} className="halo-changelog-item">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                          <span style={{ fontSize: "var(--t-body)", fontWeight: 500 }}>{exp.title}</span>
                          <span className="halo-delta flat" style={{ flexShrink: 0 }}>
                            {totalLogged > 0 ? `${adherenceRate}% adherence` : "not logged yet"}
                          </span>
                        </div>
                        <p style={{ fontSize: "var(--t-caption)", color: "var(--text-2)", margin: "0 0 12px" }}>
                          {exp.behavior_text}
                        </p>

                        {exp.confounder_warning && (
                          <div className="halo-finding warn" style={{ padding: "10px 14px", marginBottom: 12 }}>
                            <span className="halo-finding-body">Watch out for: {exp.confounder_warning}</span>
                          </div>
                        )}

                        <div className="halo-module-overline" style={{ marginBottom: 8 }}>
                          Daily log
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {datesList.map((day) => {
                            const isPast = new Date(day) <= new Date();
                            const logRecord = exp.loggedDays?.find((l: any) => l.day === day);
                            const isAdherent = logRecord ? logRecord.adherent === 1 : false;
                            const state = isAdherent ? "adherent" : logRecord ? "missed" : "pending";

                            return (
                              <button
                                key={day}
                                type="button"
                                className="halo-day-chip"
                                data-state={state}
                                onClick={() => handleLogAdherence(exp.id, day, isAdherent)}
                                disabled={!isPast}
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
