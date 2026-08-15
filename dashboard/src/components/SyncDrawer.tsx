/**
 * SyncDrawer — Data Pipeline & Sync Activity Drawer
 * Provides live progress during active syncs and a clear, human-readable
 * history of past synchronization runs from Oura Cloud.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface EndpointResult {
  key: string;
  label: string;
  group: string;
  status: "pending" | "running" | "done" | "error";
  records: number;
  error?: string;
}

interface SyncJob {
  id: number;
  trigger: string;
  startDate: string;
  endDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "partial" | "error";
  syncedDays: number;
  newDays: number;
  totalRecords: number;
  endpoints: EndpointResult[];
  error?: string;
}

interface SyncLogEntry {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger_source: string;
  start_date: string;
  end_date: string;
  status: string;
  synced_days: number;
  new_days: number;
  total_records: number;
  endpoints: EndpointResult[];
  error: string | null;
}

const TRIGGER_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  manual: { label: "Manual Sync", icon: "⚡", color: "var(--accent, #7C9EF8)", bg: "rgba(124, 158, 248, 0.12)", border: "rgba(124, 158, 248, 0.25)" },
  scheduled: { label: "Auto (4h)", icon: "🔄", color: "var(--hue-readiness, #2DD4BF)", bg: "rgba(45, 212, 191, 0.12)", border: "rgba(45, 212, 191, 0.25)" },
  startup: { label: "Initial Backfill", icon: "🚀", color: "var(--ai, #BF7AF0)", bg: "rgba(191, 122, 240, 0.12)", border: "rgba(191, 122, 240, 0.25)" },
  auto: { label: "Auto Sync", icon: "⚡", color: "var(--accent, #7C9EF8)", bg: "rgba(124, 158, 248, 0.12)", border: "rgba(124, 158, 248, 0.25)" },
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${time}`;
}

function formatSyncScope(start: string, end: string): { title: string; subtitle: string } {
  // If queried from Day 1 / lifetime inception (2016-01-01)
  if (start <= "2016-01-01") {
    return {
      title: "Lifetime History (From Day 1)",
      subtitle: "All records since ring activation",
    };
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 350) {
    return {
      title: "Past 1 Year",
      subtitle: `${startDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })} – ${endDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`,
    };
  }
  if (diffDays >= 25 && diffDays <= 35) {
    return {
      title: "Past 30 Days",
      subtitle: `${startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    };
  }
  if (diffDays <= 3) {
    return {
      title: "Recent 2 Days",
      subtitle: "Routine incremental sync",
    };
  }

  return {
    title: `${startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
    subtitle: `${diffDays} days span`,
  };
}

function formatSyncOutcome(entry: {
  status: string;
  new_days?: number;
  synced_days?: number;
  newDays?: number;
  syncedDays?: number;
  total_records?: number;
  totalRecords?: number;
}): { badge: string; badgeColor: string; badgeBg: string; badgeBorder: string; desc: string } {
  const newDays = entry.new_days ?? entry.newDays ?? 0;
  const syncedDays = entry.synced_days ?? entry.syncedDays ?? 0;
  const totalRecs = entry.total_records ?? entry.totalRecords ?? 0;

  if (entry.status === "error") {
    return {
      badge: "Failed",
      badgeColor: "var(--score-low, #FF6B5E)",
      badgeBg: "rgba(255, 107, 94, 0.12)",
      badgeBorder: "rgba(255, 107, 94, 0.28)",
      desc: "Unable to reach Oura Cloud API",
    };
  }

  if (entry.status === "partial") {
    return {
      badge: "Partial",
      badgeColor: "var(--score-fair, #FFD60A)",
      badgeBg: "rgba(255, 214, 10, 0.12)",
      badgeBorder: "rgba(255, 214, 10, 0.28)",
      desc: `${syncedDays} days verified · Some endpoints missing`,
    };
  }

  if (newDays > 0) {
    return {
      badge: `+${newDays} New Day${newDays === 1 ? "" : "s"}`,
      badgeColor: "var(--score-optimal, #30D158)",
      badgeBg: "rgba(48, 209, 88, 0.12)",
      badgeBorder: "rgba(48, 209, 88, 0.28)",
      desc: totalRecs > 0 ? `${totalRecs.toLocaleString()} records downloaded` : `${syncedDays} days synced`,
    };
  }

  if (syncedDays > 0) {
    return {
      badge: "Up to Date",
      badgeColor: "var(--score-good, #66D4A8)",
      badgeBg: "rgba(102, 212, 168, 0.12)",
      badgeBorder: "rgba(102, 212, 168, 0.28)",
      desc: `${syncedDays} days verified · 0 new changes`,
    };
  }

  return {
    badge: "Up to Date",
    badgeColor: "var(--text-3, rgba(235, 240, 248, 0.44))",
    badgeBg: "var(--bg-hover, rgba(255, 255, 255, 0.04))",
    badgeBorder: "var(--divider, rgba(255, 255, 255, 0.08))",
    desc: "No new data from Oura Cloud",
  };
}

export function SyncDrawer({
  open,
  onClose,
  onSyncFinished,
}: {
  open: boolean;
  onClose: () => void;
  onSyncFinished?: () => void;
}) {
  const [job, setJob] = useState<SyncJob | null>(null);
  const [running, setRunning] = useState(false);
  const [triggeringSync, setTriggeringSync] = useState(false);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const wasRunning = useRef(false);

  const loadLog = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/sync/log?limit=20");
      if (res.ok) setLog(await res.json());
    } catch {
      /* drawer is best-effort */
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/sync/status");
      if (!res.ok) return;
      const json = await res.json();
      setJob(json.job);
      setRunning(json.running);
      if (wasRunning.current && !json.running) {
        loadLog();
        onSyncFinished?.();
      }
      wasRunning.current = json.running;
    } catch {
      /* ignore */
    }
  }, [loadLog, onSyncFinished]);

  const handleManualSync = async () => {
    try {
      setTriggeringSync(true);
      await fetch("/api/dashboard/sync", { method: "POST" });
      loadStatus();
      loadLog();
    } catch (err) {
      console.error("Manual sync failed:", err);
    } finally {
      setTriggeringSync(false);
    }
  };

  // Poll status while open; fast while a run is live
  useEffect(() => {
    if (!open) return;
    loadStatus();
    loadLog();
    const interval = setInterval(loadStatus, running ? 1000 : 5000);
    return () => clearInterval(interval);
  }, [open, running, loadStatus, loadLog]);

  if (!open) return null;

  // Group current-run endpoints by their display group
  const groups: Array<{ name: string; endpoints: EndpointResult[] }> = [];
  for (const endpoint of job?.endpoints ?? []) {
    const group = groups.find((g) => g.name === endpoint.group);
    if (group) group.endpoints.push(endpoint);
    else groups.push({ name: endpoint.group, endpoints: [endpoint] });
  }

  const history = log.filter((entry) => !(job && entry.id === job.id && job.status === "running"));

  return (
    <>
      <div className="halo-drawer-overlay" onClick={onClose} />
      <aside className="halo-drawer" aria-label="Sync activity" style={{ maxWidth: "460px", width: "100%" }}>
        {/* Drawer Header */}
        <div className="halo-drawer-head" style={{ borderBottom: "1px solid var(--divider)", paddingBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: running ? "var(--accent)" : "var(--score-optimal)" }} />
              <span className="halo-module-overline" style={{ margin: 0 }}>
                Data Pipeline · {running ? "Sync in Progress" : "Active & Healthy"}
              </span>
            </div>
            <div className="halo-drawer-title" style={{ fontSize: "1.25rem" }}>Sync Activity</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={running || triggeringSync}
              style={{
                background: "var(--accent, #7C9EF8)",
                border: "none",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "8px",
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{running ? "Syncing..." : "⚡ Sync Now"}</span>
            </button>
            <button type="button" className="halo-btn halo-btn-ghost halo-btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {/* Current Active Run Card */}
        {job && (
          <section
            style={{
              background: "var(--bg-card, #14161D)",
              border: "1px solid var(--divider-strong, rgba(255,255,255,0.12))",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`halo-sync-dot ${job.status}`} />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-default)" }}>
                    {job.status === "running" ? "Live Cloud Synchronization" : "Latest Sync Summary"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "4px", marginLeft: "16px" }}>
                  {formatSyncScope(job.startDate, job.endDate).title}
                </div>
              </div>

              {TRIGGER_CONFIG[job.trigger] && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: TRIGGER_CONFIG[job.trigger].color,
                    background: TRIGGER_CONFIG[job.trigger].bg,
                    border: `1px solid ${TRIGGER_CONFIG[job.trigger].border}`,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {TRIGGER_CONFIG[job.trigger].icon} {TRIGGER_CONFIG[job.trigger].label}
                </span>
              )}
            </div>

            {job.status !== "running" && (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-3)",
                  marginTop: "8px",
                  padding: "8px 12px",
                  background: "var(--bg-hover, rgba(255,255,255,0.03))",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{job.syncedDays} days processed</span>
                <span style={{ fontWeight: 600, color: "var(--text-default)" }}>{job.totalRecords.toLocaleString()} records</span>
              </div>
            )}

            {/* Category checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "14px" }}>
              {groups.map((group) => {
                const records = group.endpoints.reduce((sum, e) => sum + e.records, 0);
                const hasError = group.endpoints.some((e) => e.status === "error");
                const isRunning = group.endpoints.some((e) => e.status === "running");
                return (
                  <div
                    key={group.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12.5px",
                      padding: "4px 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`halo-sync-dot ${hasError ? "error" : isRunning ? "running" : "success"}`} />
                      <span style={{ color: "var(--text-default)", fontWeight: 500 }}>{group.name}</span>
                    </div>
                    <span style={{ fontSize: "11.5px", color: hasError ? "var(--score-low)" : "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                      {isRunning
                        ? "Syncing..."
                        : hasError
                        ? group.endpoints.filter((e) => e.status === "error").map((e) => e.label).join(", ") + " failed"
                        : `${records.toLocaleString()} records`}
                    </span>
                  </div>
                );
              })}
            </div>

            {job.error && (
              <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(255, 107, 94, 0.1)", borderRadius: "8px", color: "var(--score-low)", fontSize: "12px" }}>
                ⚠️ {job.error}
              </div>
            )}
          </section>
        )}

        {/* Previous Syncs Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", marginBottom: "12px" }}>
          <div className="halo-module-overline" style={{ margin: 0 }}>
            Sync History
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
            Showing recent {history.length} runs
          </span>
        </div>

        {/* Previous Syncs Cards List */}
        <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--text-3)", fontSize: "13px" }}>
              No previous syncs recorded yet.
            </div>
          ) : (
            history.map((entry) => {
              const scope = formatSyncScope(entry.start_date, entry.end_date);
              const outcome = formatSyncOutcome(entry);
              const trigger = TRIGGER_CONFIG[entry.trigger_source] || {
                label: entry.trigger_source,
                icon: "⚙️",
                color: "var(--text-3)",
                bg: "var(--bg-hover)",
                border: "var(--divider)",
              };

              return (
                <div
                  key={entry.id}
                  style={{
                    background: "var(--bg-card, #14161D)",
                    border: "1px solid var(--divider, rgba(255,255,255,0.06))",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {/* Top Row: Timestamp, Trigger badge, and Outcome Pill */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`halo-sync-dot ${entry.status}`} />
                      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-default)" }}>
                        {formatTime(entry.started_at)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {/* Trigger Badge */}
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 600,
                          color: trigger.color,
                          background: trigger.bg,
                          border: `1px solid ${trigger.border}`,
                          padding: "1px 6px",
                          borderRadius: "5px",
                        }}
                      >
                        {trigger.icon} {trigger.label}
                      </span>

                      {/* Outcome Badge */}
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: outcome.badgeColor,
                          background: outcome.badgeBg,
                          border: `1px solid ${outcome.badgeBorder}`,
                          padding: "1px 7px",
                          borderRadius: "5px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {outcome.badge}
                      </span>
                    </div>
                  </div>

                  {/* Scope & Outcome description */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "2px" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-2)", fontWeight: 500 }}>
                        {scope.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "1px" }}>
                        {scope.subtitle}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                      {outcome.desc}
                    </div>
                  </div>

                  {entry.error && (
                    <div style={{ fontSize: "11.5px", color: "var(--score-low)", marginTop: "4px", padding: "4px 8px", background: "rgba(255, 107, 94, 0.08)", borderRadius: "6px" }}>
                      ⚠️ {entry.error}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Footer Info */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "24px",
            fontSize: "11.5px",
            color: "var(--text-3)",
            lineHeight: 1.5,
            borderTop: "1px solid var(--divider)",
          }}
        >
          💡 <strong>How syncing works:</strong> Background syncs check Oura Cloud automatically every 4 hours for newly uploaded ring sleep and activity data. Manual syncs verify your complete lifetime history.
        </div>
      </aside>
    </>
  );
}
