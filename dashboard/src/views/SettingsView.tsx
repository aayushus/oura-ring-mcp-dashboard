import React, { useState, useEffect } from "react";
import { Button, Alert } from "../components/components";

interface UserProfile {
  age: number;
  weight_kg: number;
  height_cm: number;
  biological_sex: string;
  target_wake_time: string;
  goal: string;
  training_days: number;
}

interface UserTargets {
  sleep_need_seconds: number;
  recommended_bedtime: string;
  step_goal: number;
  max_hr: number;
  bmr_kcal: number;
}

interface TargetHistoryRecord {
  id: number;
  target_id: string;
  old_value: string;
  new_value: string;
  reason: string;
  change_date: string;
}

export function SettingsView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<UserTargets | null>(null);
  const [history, setHistory] = useState<TargetHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [age, setAge] = useState("30");
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("175");
  const [sex, setSex] = useState("male");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [goal, setGoal] = useState("general_health");
  const [trainingDays, setTrainingDays] = useState("3");

  async function loadTargets() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/dashboard/targets");
      if (!response.ok) {
        throw new Error(`Failed to load targets: ${response.statusText}`);
      }
      const json = await response.json();
      if (json.profile) {
        setProfile(json.profile);
        setAge(json.profile.age.toString());
        setWeight(json.profile.weight_kg.toString());
        setHeight(json.profile.height_cm.toString());
        setSex(json.profile.biological_sex);
        setWakeTime(json.profile.target_wake_time);
        setGoal(json.profile.goal);
        setTrainingDays(json.profile.training_days.toString());
      }
      if (json.targets) {
        setTargets(json.targets);
      }
      if (json.history) {
        setHistory(json.history);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTargets();
  }, []);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const response = await fetch("/api/dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: Number(age),
          weight_kg: Number(weight),
          height_cm: Number(height),
          biological_sex: sex,
          target_wake_time: wakeTime,
          goal,
          training_days: Number(trainingDays),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Save failed: ${response.statusText}`);
      }

      const json = await response.json();
      setProfile(json.profile);
      setTargets(json.targets);
      setHistory(json.history);
      setSuccessMsg("Onboarding details saved. Your targets have been recalculated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <div className="dashboard-skeleton card" style={{ height: "150px", marginBottom: "16px" }} />
        <div className="dashboard-skeleton card" style={{ height: "300px" }} />
      </div>
    );
  }

  const formatSecondsToHoursAndMinutes = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="settings-view-container" style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {error && (
        <Alert variant="warn" title="Settings Issue">
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" title="Success">
          {successMsg}
        </Alert>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", alignItems: "start" }}>
        
        {/* Onboarding Form Card */}
        <div className="halo-card" style={{ padding: "24px" }}>
          <h2 className="halo-card-title" style={{ marginTop: 0, marginBottom: "8px" }}>Onboarding & Profile</h2>
          <p style={{ opacity: 0.7, fontSize: "0.9rem", marginBottom: "20px" }}>
            Configure your target goals. These metrics will seed your sleep, steps, and activity targets.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Biological Sex</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Height (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Weekday Target Wake Up Time</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Primary Health Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
              >
                <option value="sleep_better">Improve Sleep Quality</option>
                <option value="get_fitter">Increase Fitness / Longevity</option>
                <option value="manage_stress">Reduce Stress / Restore Vitals</option>
                <option value="general_health">Optimize Overall Health</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", opacity: 0.8, marginBottom: "6px" }}>Structured Workout Days per Week</label>
              <input
                type="number"
                min="0"
                max="7"
                value={trainingDays}
                onChange={(e) => setTrainingDays(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--divider-strong)", background: "rgba(0,0,0,0.1)", color: "inherit" }}
                required
              />
            </div>

            <Button
              onClick={handleSubmit}
              variant="primary"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                marginTop: "12px",
                fontWeight: "600",
                fontSize: "0.95rem",
              }}
            >
              {submitting ? "Saving..." : "Save & Recalculate"}
            </Button>
          </div>
        </div>

        {/* Targets Display & Target History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Targets Summary */}
          <div className="halo-card" style={{ padding: "24px" }}>
            <h2 className="halo-card-title" style={{ marginTop: 0, marginBottom: "16px" }}>Calculated Targets</h2>
            {!targets ? (
              <p style={{ opacity: 0.7 }}>Fill out the onboarding form to generate targets.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ padding: "12px", border: "1px solid var(--divider)", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase" }}>Sleep Need</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--accent)" }}>
                    {formatSecondsToHoursAndMinutes(targets.sleep_need_seconds)}
                  </div>
                </div>
                <div style={{ padding: "12px", border: "1px solid var(--divider)", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase" }}>Ideal Bedtime</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--accent)" }}>
                    {targets.recommended_bedtime}
                  </div>
                </div>
                <div style={{ padding: "12px", border: "1px solid var(--divider)", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase" }}>Step Goal</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--accent)" }}>
                    {targets.step_goal.toLocaleString()} steps
                  </div>
                </div>
                <div style={{ padding: "12px", border: "1px solid var(--divider)", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase" }}>Max HR</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--accent)" }}>
                    {targets.max_hr} bpm
                  </div>
                </div>
                <div style={{ padding: "12px", border: "1px solid var(--divider)", borderRadius: "10px", gridColumn: "span 2" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, textTransform: "uppercase" }}>Basal Metabolic Rate (BMR)</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--accent)" }}>
                    {Math.round(targets.bmr_kcal)} kcal/day
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "4px" }}>
                    Energy burned at complete rest, computed via Mifflin-St Jeor.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Targets Changelog History */}
          <div className="halo-card" style={{ padding: "24px" }}>
            <h2 className="halo-card-title" style={{ marginTop: 0, marginBottom: "12px" }}>Targets Changelog</h2>
            {history.length === 0 ? (
              <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>No target changes recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "300px", overflowY: "auto", paddingRight: "8px" }}>
                {history.map((record) => (
                  <div key={record.id} style={{ borderBottom: "1px solid var(--divider)", paddingBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", opacity: 0.6, marginBottom: "4px" }}>
                      <span>{record.change_date}</span>
                      <span style={{ fontWeight: 600, textTransform: "uppercase", color: "var(--accent)" }}>
                        {record.target_id.replace("_", " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "4px" }}>
                      {record.old_value} &rarr; {record.new_value}
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.7, fontStyle: "italic" }}>
                      {record.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Export (F-9) */}
          <div className="halo-card" style={{ padding: "24px" }}>
            <h2 className="halo-card-title" style={{ marginTop: 0, marginBottom: "12px" }}>Data Portability & Export</h2>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "16px" }}>
              Download your complete biometric history, anomaly alerts list, and calculated targets changelog.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <a href="/api/dashboard/export?format=json" download style={{ textDecoration: "none", flex: 1 }}>
                <Button variant="primary" style={{ width: "100%" }}>Export JSON</Button>
              </a>
              <a href="/api/dashboard/export?format=csv" download style={{ textDecoration: "none", flex: 1 }}>
                <Button variant="secondary" style={{ width: "100%" }}>Export CSV</Button>
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
