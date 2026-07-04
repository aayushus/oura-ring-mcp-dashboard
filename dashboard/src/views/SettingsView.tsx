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

interface McpApiKey {
  key_hash: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  disabled: number;
  created_at: string;
}

interface SettingsViewProps {
  user: any;
  flags: {
    signupsEnabled: boolean;
    isFirstRun: boolean;
    ouraAppConfigured: boolean;
    ouraConnected: boolean;
  };
  onRefreshFlags: () => Promise<void>;
}

export function SettingsView({ user, flags, onRefreshFlags }: SettingsViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<UserTargets | null>(null);
  const [history, setHistory] = useState<TargetHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile Form states
  const [age, setAge] = useState("30");
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("175");
  const [sex, setSex] = useState("male");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [goal, setGoal] = useState("general_health");
  const [trainingDays, setTrainingDays] = useState("3");

  // Admin App Settings Form states
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // MCP API Key states
  const [apiKeys, setApiKeys] = useState<McpApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  // Admin User Directory states
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const redirectUri = `${window.location.protocol}//${window.location.host}/api/auth/oura/callback`;

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

  async function loadAppSettings() {
    if (user?.role !== "admin") return;
    try {
      const response = await fetch("/api/dashboard/settings");
      if (response.ok) {
        const json = await response.json();
        setClientId(json.oura_client_id || "");
        setSecretConfigured(json.oura_client_secret_configured || false);
      }
    } catch (err) {
      console.error("Failed to load app settings:", err);
    }
  }

  async function loadMcpKeys() {
    try {
      const response = await fetch("/api/auth/mcp/keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (err) {
      console.error("Failed to load MCP keys:", err);
    }
  }

  async function loadUsersList() {
    if (user?.role !== "admin") return;
    try {
      setLoadingUsers(true);
      const response = await fetch("/api/dashboard/users");
      if (response.ok) {
        const data = await response.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadTargets();
    loadAppSettings();
    loadMcpKeys();
    loadUsersList();
  }, [user]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const response = await fetch("/api/dashboard/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
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

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setError(null);
      setSuccessMsg(null);

      const response = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
        body: JSON.stringify({
          oura_client_id: clientId,
          oura_client_secret: clientSecret || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save credentials");
      }

      setClientSecret("");
      await loadAppSettings();
      await onRefreshFlags();
      setSuccessMsg("Oura Developer Application settings saved successfully.");
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleConnectOura() {
    try {
      setError(null);
      setSuccessMsg(null);
      const response = await fetch("/api/auth/oura/connect");
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to fetch connect URL");
      }

      const width = 600, height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(json.url, "Connect Oura", `width=${width},height=${height},left=${left},top=${top}`);

      const listener = (event: MessageEvent) => {
        if (event.data?.type === "oura_connected") {
          onRefreshFlags();
          setSuccessMsg("Oura Ring account connected successfully!");
          window.removeEventListener("message", listener);
        }
      };
      window.addEventListener("message", listener);
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }

  async function handleDisconnectOura() {
    try {
      setError(null);
      setSuccessMsg(null);
      const response = await fetch("/api/auth/oura/connection", {
        method: "DELETE",
        headers: { "X-Requested-With": "fetch" }
      });
      if (!response.ok) {
        throw new Error("Failed to disconnect Oura account");
      }
      await onRefreshFlags();
      setSuccessMsg("Oura Ring account disconnected successfully.");
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      setGeneratingKey(true);
      setError(null);
      setSuccessMsg(null);

      const response = await fetch("/api/auth/mcp/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate key");

      setGeneratedKey(data.key);
      setNewKeyName("");
      loadMcpKeys();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleRevokeKey(hash: string) {
    try {
      setError(null);
      setSuccessMsg(null);
      const response = await fetch(`/api/auth/mcp/keys/${hash}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "fetch" }
      });
      if (!response.ok) throw new Error("Failed to revoke key");

      setSuccessMsg("MCP API Key revoked successfully.");
      loadMcpKeys();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  }

  async function handleToggleUserStatus(userIdToToggle: number) {
    try {
      setError(null);
      setSuccessMsg(null);
      const response = await fetch(`/api/dashboard/users/${userIdToToggle}/toggle-disabled`, {
        method: "POST",
        headers: { "X-Requested-With": "fetch" }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to toggle user status");

      setSuccessMsg("User status updated successfully.");
      loadUsersList();
    } catch (err: any) {
      setError(err.message || String(err));
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

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--accent)" } as React.CSSProperties}
      >
        <span className="halo-module-overline">Your targets</span>
        <h1 className="halo-module-title">Settings</h1>
        <span className="rule" />
        <p>Profile details seed your sleep, bedtime, step, and heart-rate targets — they recalculate as your data comes in.</p>
      </div>

      {error && (
        <Alert variant="warn" title="Settings issue">
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" title="Saved">
          {successMsg}
        </Alert>
      )}

      {generatedKey && (
        <Alert variant="success" title="New API Key Generated">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
            <p>Make sure to copy your new MCP access token now. You will not be able to see it again!</p>
            <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <input
                type="text"
                readOnly
                value={generatedKey}
                style={{ background: "none", border: "none", color: "#27ae60", fontSize: "13px", fontWeight: "bold", flex: 1, padding: 0, outline: "none" }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  setSuccessMsg("Copied key to clipboard!");
                }}
                style={{ background: "none", border: "none", color: "#b55fe6", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: 0 }}
              >
                Copy
              </button>
            </div>
            <Button variant="secondary" onClick={() => setGeneratedKey(null)} style={{ alignSelf: "flex-end", height: "26px", fontSize: "11px" }}>Close Warning</Button>
          </div>
        </Alert>
      )}

      <div className="halo-grid-2">
        <div className="halo-stack-20">
          {/* Profile form */}
          <div className="halo-card">
            <h2 className="halo-card-title">Profile</h2>
            <p className="halo-card-desc">
              These details seed your personalized targets.
            </p>

            <form className="halo-form" onSubmit={handleSubmit}>
              <div className="halo-form-row">
                <div className="halo-field">
                  <label htmlFor="set-age">Age</label>
                  <input
                    id="set-age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  />
                </div>
                <div className="halo-field">
                  <label htmlFor="set-sex">Biological sex</label>
                  <select id="set-sex" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div className="halo-form-row">
                <div className="halo-field">
                  <label htmlFor="set-weight">Weight (kg)</label>
                  <input
                    id="set-weight"
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                  />
                </div>
                <div className="halo-field">
                  <label htmlFor="set-height">Height (cm)</label>
                  <input
                    id="set-height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="halo-field">
                <label htmlFor="set-wake">Weekday wake-up time</label>
                <input
                  id="set-wake"
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  required
                />
              </div>

              <div className="halo-field">
                <label htmlFor="set-goal">Main goal</label>
                <select id="set-goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
                  <option value="sleep_better">Sleep better</option>
                  <option value="get_fitter">Get fitter</option>
                  <option value="manage_stress">Manage stress</option>
                  <option value="general_health">General health</option>
                </select>
              </div>

              <div className="halo-field">
                <label htmlFor="set-training">Structured workout days per week</label>
                <input
                  id="set-training"
                  type="number"
                  min="0"
                  max="7"
                  value={trainingDays}
                  onChange={(e) => setTrainingDays(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="halo-btn halo-btn-primary halo-btn-block" disabled={submitting}>
                {submitting ? "Saving…" : "Save and recalculate"}
              </button>
            </form>
          </div>

          {/* Oura Connection Card */}
          <div className="halo-card">
            <h2 className="halo-card-title">Oura Connection</h2>
            <p className="halo-card-desc">
              Connect your own Oura Ring account to authorize sync updates.
            </p>

            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {flags.ouraConnected ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(39, 174, 96, 0.1)", border: "1px solid rgba(39, 174, 96, 0.2)", borderRadius: "12px", padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#27ae60", boxShadow: "0 0 8px #27ae60" }} />
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#27ae60" }}>Link Active</span>
                  </div>
                  <Button variant="secondary" onClick={handleDisconnectOura} style={{ height: "30px", fontSize: "12px", background: "rgba(235, 87, 87, 0.1)", color: "#eb5757", border: "1px solid rgba(235, 87, 87, 0.2)" }}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px 16px", lineHeight: "1.4" }}>
                    {flags.ouraAppConfigured ? (
                      "Your administrator has set up the Oura API application. You can link your account now."
                    ) : (
                      <span style={{ color: "#eb5757" }}>Oura API Developer credentials must be configured in settings below before you can link your Oura Ring account.</span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleConnectOura}
                    disabled={!flags.ouraAppConfigured}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Link Oura Ring Account
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* MCP API Keys Management Card */}
          <div className="halo-card">
            <h2 className="halo-card-title">Claude Desktop Connect (MCP Keys)</h2>
            <p className="halo-card-desc">
              Generate secure bearer tokens to link Claude, Cursor, or other AI clients to your Oura data.
            </p>

            <form onSubmit={handleGenerateKey} style={{ display: "flex", gap: "8px", marginTop: "16px", marginBottom: "16px" }}>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Claude Desktop"
                style={{
                  background: "rgba(11, 12, 16, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  color: "#ffffff",
                  fontSize: "14px",
                  flex: 1,
                  outline: "none"
                }}
                required
              />
              <button type="submit" className="halo-btn halo-btn-primary" disabled={generatingKey} style={{ height: "40px" }}>
                {generatingKey ? "Generating..." : "Generate Key"}
              </button>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {apiKeys.length === 0 ? (
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "12px", background: "rgba(255,255,255,0.01)", borderRadius: "10px" }}>
                  No API Keys active. Generate one above to connect.
                </div>
              ) : (
                apiKeys.map((key) => (
                  <div key={key.key_hash} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>{key.name}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                        Created {formatDate(key.created_at)}
                        {key.last_used_at && ` · Last used ${formatDate(key.last_used_at)}`}
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => handleRevokeKey(key.key_hash)} style={{ height: "26px", fontSize: "11px", color: "#eb5757", background: "rgba(235, 87, 87, 0.05)", border: "1px solid rgba(235, 87, 87, 0.1)" }}>
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Targets, changelog, export */}
        <div className="halo-stack-20">
          <div className="halo-card">
            <h2 className="halo-card-title">Calculated targets</h2>
            {!targets ? (
              <p className="halo-muted">Fill out your profile to generate targets.</p>
            ) : (
              <div className="halo-mini-stats" style={{ marginTop: 12 }}>
                <div className="halo-mini-stat">
                  <span className="label">Sleep need</span>
                  <span className="value">{formatSecondsToHoursAndMinutes(targets.sleep_need_seconds)}</span>
                </div>
                <div className="halo-mini-stat">
                  <span className="label">Ideal bedtime</span>
                  <span className="value">{targets.recommended_bedtime}</span>
                </div>
                <div className="halo-mini-stat">
                  <span className="label">Step goal</span>
                  <span className="value">{targets.step_goal.toLocaleString()}</span>
                </div>
                <div className="halo-mini-stat">
                  <span className="label">Max heart rate</span>
                  <span className="value">{targets.max_hr} <span className="note">bpm</span></span>
                </div>
                <div className="halo-mini-stat wide">
                  <span className="label">Basal metabolic rate</span>
                  <span className="value">{Math.round(targets.bmr_kcal)} <span className="note">kcal/day</span></span>
                  <span className="note">Energy burned at complete rest (Mifflin-St Jeor).</span>
                </div>
              </div>
            )}
          </div>

          {/* Oura Developer App Settings (Admin Only) */}
          {user?.role === "admin" && (
            <div className="halo-card">
              <h2 className="halo-card-title">Oura App Credentials</h2>
              <p className="halo-card-desc">
                Configure Developer credentials to permit OAuth connections.
              </p>

              <form className="halo-form" onSubmit={handleSaveSettings} style={{ marginTop: "16px" }}>
                <div className="halo-field">
                  <label htmlFor="settings-client-id">Client ID</label>
                  <input
                    id="settings-client-id"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Enter Oura Client ID"
                    required
                  />
                </div>

                <div className="halo-field">
                  <label htmlFor="settings-client-secret">
                    Client Secret {secretConfigured && <span style={{ color: "#27ae60", fontSize: "11px", fontWeight: "normal" }}>(Configured ✓)</span>}
                  </label>
                  <input
                    id="settings-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={secretConfigured ? "••••••••••••••••" : "Enter Oura Client Secret"}
                    required={!secretConfigured}
                  />
                </div>

                <div className="halo-field">
                  <label>Redirect URI</label>
                  <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <input
                      type="text"
                      readOnly
                      value={redirectUri}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "12px", flex: 1, padding: 0, outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(redirectUri)}
                      style={{ background: "none", border: "none", color: "#b55fe6", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: 0 }}
                    >
                      Copy
                    </button>
                  </div>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px", display: "block" }}>
                    Configure this Redirect URI in your Oura Developer portal account settings.
                  </span>
                </div>

                <button type="submit" className="halo-btn halo-btn-primary halo-btn-block" disabled={savingSettings}>
                  {savingSettings ? "Saving Settings..." : "Save API Settings"}
                </button>
              </form>
            </div>
          )}

          {/* User Directory Management Card (Admin Only) */}
          {user?.role === "admin" && (
            <div className="halo-card">
              <h2 className="halo-card-title">User Directory</h2>
              <p className="halo-card-desc">
                Manage registered user accounts and toggle access status.
              </p>

              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {loadingUsers ? (
                  <div style={{ textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Loading users directory...</div>
                ) : (
                  usersList.map((mUser) => (
                    <div key={mUser.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                          {mUser.name}
                          <span style={{ fontSize: "10px", fontWeight: "normal", background: mUser.role === "admin" ? "#b55fe6" : "rgba(255,255,255,0.1)", color: "#ffffff", padding: "1px 6px", borderRadius: "8px" }}>
                            {mUser.role}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                          {mUser.email} · Joined {formatDate(mUser.created_at)}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={mUser.id === user.id}
                        onClick={() => handleToggleUserStatus(mUser.id)}
                        style={{
                          height: "26px",
                          fontSize: "11px",
                          color: mUser.disabled === 1 ? "#27ae60" : "#eb5757",
                          background: mUser.disabled === 1 ? "rgba(39, 174, 96, 0.05)" : "rgba(235, 87, 87, 0.05)",
                          border: mUser.disabled === 1 ? "1px solid rgba(39, 174, 96, 0.1)" : "1px solid rgba(235, 87, 87, 0.1)"
                        }}
                      >
                        {mUser.disabled === 1 ? "Enable" : "Disable"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="halo-card">
            <h2 className="halo-card-title">Targets changelog</h2>
            {history.length === 0 ? (
              <p className="halo-muted">No target changes recorded yet.</p>
            ) : (
              <div className="halo-changelog halo-scroll">
                {history.map((record) => (
                  <div key={record.id} className="halo-changelog-item">
                    <div className="halo-changelog-meta">
                      <span>{record.change_date}</span>
                      <span className="target">{record.target_id.replace("_", " ")}</span>
                    </div>
                    <div className="halo-changelog-change">
                      {record.old_value} → {record.new_value}
                    </div>
                    <div className="halo-changelog-reason">{record.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="halo-card">
            <h2 className="halo-card-title">Export your data</h2>
            <p className="halo-card-desc">
              Download your full history, anomalies, and targets changelog.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
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
