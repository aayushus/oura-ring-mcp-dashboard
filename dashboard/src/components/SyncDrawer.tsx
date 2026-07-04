/**
 * SyncDrawer — Option D of the sync UX: a right-hand drawer showing the
 * current sync run live (per-endpoint checklist, polled) and the persisted
 * history of past runs from sync_log.
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

const TRIGGER_LABEL: Record<string, string> = {
  manual: "manual",
  scheduled: "every 4h",
  startup: "on startup",
  auto: "auto",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

function formatRange(start: string, end: string): string {
  const crossesYears = start.slice(0, 4) !== end.slice(0, 4);
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(
      undefined,
      crossesYears
        ? { month: "short", day: "numeric", year: "numeric" }
        : { month: "short", day: "numeric" }
    );
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function resultSummary(entry: { status: string; new_days?: number; synced_days?: number; newDays?: number; syncedDays?: number }): string {
  const newDays = entry.new_days ?? entry.newDays ?? 0;
  const syncedDays = entry.synced_days ?? entry.syncedDays ?? 0;
  if (entry.status === "error") return "failed";
  if (newDays > 0) return `+${newDays} new day${newDays === 1 ? "" : "s"}`;
  if (syncedDays > 0) return "no new data";
  return "no data";
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
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const wasRunning = useRef(false);

  const loadLog = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/sync/log?limit=15");
      if (res.ok) setLog(await res.json());
    } catch {
      /* drawer is best-effort; the log list just stays stale */
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
        // run just finished — refresh history and notify the app
        loadLog();
        onSyncFinished?.();
      }
      wasRunning.current = json.running;
    } catch {
      /* ignore — next poll retries */
    }
  }, [loadLog, onSyncFinished]);

  // Poll status while open; fast while a run is live
  useEffect(() => {
    if (!open) return;
    loadStatus();
    loadLog();
    const interval = setInterval(loadStatus, running ? 1000 : 5000);
    return () => clearInterval(interval);
  }, [open, running, loadStatus, loadLog]);

  if (!open) return null;

  // Group current-run endpoints by their display group, preserving order
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
      <aside className="halo-drawer" aria-label="Sync activity">
        <div className="halo-drawer-head">
          <div>
            <div className="halo-module-overline">Data pipeline</div>
            <div className="halo-drawer-title">Sync activity</div>
          </div>
          <button type="button" className="halo-btn halo-btn-ghost halo-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {job && (
          <section className="halo-sync-current">
            <div className="halo-sync-current-head">
              <span className={`halo-sync-dot ${job.status}`} />
              <span className="halo-sync-current-title">
                {job.status === "running"
                  ? `Syncing ${formatRange(job.startDate, job.endDate)}…`
                  : `${formatRange(job.startDate, job.endDate)} · ${resultSummary(job)}`}
              </span>
              <span className="halo-sync-trigger">{TRIGGER_LABEL[job.trigger] ?? job.trigger}</span>
            </div>

            {job.status !== "running" && (
              <div className="halo-sync-current-sub">
                {job.syncedDays} days covered · {job.totalRecords.toLocaleString()} records
                {job.status === "partial" && " · some data missing"}
              </div>
            )}

            <div className="halo-sync-groups">
              {groups.map((group) => {
                const records = group.endpoints.reduce((sum, e) => sum + e.records, 0);
                const hasError = group.endpoints.some((e) => e.status === "error");
                const isRunning = group.endpoints.some((e) => e.status === "running");
                return (
                  <div className="halo-sync-group" key={group.name}>
                    <span
                      className={`halo-sync-dot ${hasError ? "error" : isRunning ? "running" : "success"}`}
                    />
                    <span className="halo-sync-group-name">{group.name}</span>
                    <span className="halo-sync-group-meta halo-num">
                      {isRunning ? "…" : hasError
                        ? group.endpoints.filter((e) => e.status === "error").map((e) => e.label).join(", ") + " failed"
                        : `${records.toLocaleString()} records`}
                    </span>
                  </div>
                );
              })}
            </div>

            {job.error && <div className="halo-sync-error">{job.error}</div>}
          </section>
        )}

        <div className="halo-module-overline" style={{ marginTop: 20, marginBottom: 8 }}>
          Previous syncs
        </div>
        <section className="halo-sync-history">
          {history.length === 0 ? (
            <span className="halo-empty-note">No syncs recorded yet.</span>
          ) : (
            history.map((entry) => (
              <div className="halo-sync-row" key={entry.id}>
                <span className={`halo-sync-dot ${entry.status}`} />
                <div className="halo-sync-row-main">
                  <div className="halo-sync-row-top">
                    <span>{formatTime(entry.started_at)}</span>
                    <span className="halo-sync-trigger">
                      {TRIGGER_LABEL[entry.trigger_source] ?? entry.trigger_source}
                    </span>
                  </div>
                  <div className="halo-sync-row-sub">
                    {formatRange(entry.start_date, entry.end_date)} · {resultSummary(entry)}
                    {entry.status === "partial" && " · partial"}
                  </div>
                  {entry.error && <div className="halo-sync-error">{entry.error}</div>}
                </div>
              </div>
            ))
          )}
        </section>

        <div className="halo-sync-foot">
          Syncs also run automatically every 4 hours. Data reaches Oura's cloud only when the
          phone app has synced with the ring.
        </div>
      </aside>
    </>
  );
}
