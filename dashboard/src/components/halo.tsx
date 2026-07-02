/**
 * Halo components — score rings, KPI cards, delta chips, metric table,
 * icon rail. See DESIGN.md at repo root for the spec each implements.
 */
import { useEffect, useState, type ReactNode } from "react";
import { METRIC_REGISTRY } from "../constants";

/* ── Score bands (REQ B4) ─────────────────────────────────── */

export type ScoreBand = "optimal" | "good" | "fair" | "low" | "none";

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null || score <= 0) return "none";
  if (score >= 85) return "optimal";
  if (score >= 70) return "good";
  if (score >= 60) return "fair";
  return "low";
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  optimal: "Optimal",
  good: "Good",
  fair: "Fair",
  low: "Pay attention",
  none: "No data",
};

export function bandColor(band: ScoreBand): string {
  return `var(--score-${band})`;
}

/* ── ScoreRing — the signature component (DESIGN.md 4.1) ──── */

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const band = scoreBand(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target =
    score == null || score <= 0
      ? circumference
      : circumference * (1 - Math.min(score, 100) / 100);

  // sweep from empty once on mount (transition lives in CSS)
  const [offset, setOffset] = useState(circumference);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={score != null ? `Score ${score}` : "No data"}
    >
      <circle
        className="halo-ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
      />
      <circle
        className="halo-ring-arc"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={bandColor(band)}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dy="0.36em"
        textAnchor="middle"
        className="halo-ring-value halo-num"
        fill={score != null ? bandColor(band) : "var(--score-none)"}
        style={{ fontSize: size * 0.28, fontWeight: 300 }}
      >
        {score ?? "—"}
      </text>
    </svg>
  );
}

/* ── HaloMark — brand mark (score-ring arc, indigo→teal) ──── */

export function HaloMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Halo"
    >
      <defs>
        <linearGradient id="halo-mark-g" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8A93F8" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="23" stroke="#8A93F8" strokeOpacity="0.25" strokeWidth="9" />
      <circle
        cx="32"
        cy="32"
        r="23"
        stroke="url(#halo-mark-g)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="120.4 144.5"
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}

/* ── Delta chip (DESIGN.md 4.2) ───────────────────────────── */

export function DeltaChip({
  value,
  higherIsBetter = true,
  format = (v: number) => `${Math.abs(Math.round(v))}`,
}: {
  value: number | null;
  higherIsBetter?: boolean;
  format?: (v: number) => string;
}) {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.5) {
    return <span className="halo-delta flat">≈ steady</span>;
  }
  const rising = rounded > 0;
  const good = rising === higherIsBetter;
  return (
    <span className={`halo-delta ${good ? "good" : "bad"}`}>
      {rising ? "▲" : "▼"} {format(rounded)}
    </span>
  );
}

/* ── Ring score card ──────────────────────────────────────── */

export function RingCard({
  label,
  score,
  delta,
  onClick,
}: {
  label: string;
  score: number | null;
  delta: number | null;
  onClick?: () => void;
}) {
  const band = scoreBand(score);
  return (
    <button type="button" className="halo-ring-card" onClick={onClick}>
      <span className="halo-ring-label">{label}</span>
      <ScoreRing score={score} />
      <span className="halo-ring-sub">
        {BAND_LABEL[band]}
        <DeltaChip value={delta} />
      </span>
    </button>
  );
}

/* ── KPI card (vitals strip) ──────────────────────────────── */

export function Kpi({
  label,
  value,
  unit,
  note,
  children,
  metricId,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  children?: ReactNode;
  metricId?: string;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const info = metricId ? METRIC_REGISTRY[metricId] : null;

  return (
    <div className="halo-kpi" style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", justifyContent: "space-between" }}>
        <span className="halo-kpi-label">{label}</span>
        {info && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPopover(!showPopover);
            }}
            onMouseEnter={() => setShowPopover(true)}
            onMouseLeave={() => setShowPopover(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)",
              fontSize: "0.85rem",
              padding: "2px",
              opacity: 0.6,
              display: "inline-flex",
              alignItems: "center",
              transition: "opacity 100ms ease, color 100ms ease",
            }}
            onFocus={() => setShowPopover(true)}
            onBlur={() => setShowPopover(false)}
            className="info-button"
            title="How is this calculated?"
          >
            ⓘ
          </button>
        )}
      </div>

      <span className="halo-kpi-value halo-num">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {note && <span className="halo-kpi-note">{note}</span>}
      {children}

      {/* Floating Info Popover details card */}
      {showPopover && info && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "260px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--divider-strong)",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
            zIndex: 1000,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            backdropFilter: "blur(8px)",
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-default)", borderBottom: "1px solid var(--divider)", paddingBottom: "4px" }}>
            {info.label} Details
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: "1.3" }}>
            {info.explain}
          </div>
          {info.formula && (
            <div style={{ fontSize: "0.7rem", color: "var(--accent)", background: "rgba(0, 0, 0, 0.2)", padding: "4px 8px", borderRadius: "6px", fontFamily: "monospace" }}>
              <strong>Formula:</strong> {info.formula}
            </div>
          )}
          <div style={{ fontSize: "0.65rem", color: "var(--text-4)" }}>
            <strong>Source:</strong> {info.source}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Icon rail item ───────────────────────────────────────── */

export function RailItem({
  icon,
  label,
  hue,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hue?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`halo-rail-item ${active ? "active" : ""}`}
      style={hue ? ({ "--hue": hue } as React.CSSProperties) : undefined}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="halo-rail-tip">{label}</span>
    </button>
  );
}

/* ── Metric table (replaces DataGrid — DESIGN.md §6.5) ────── */

export interface MetricColumn<Row> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
}

export function MetricTable<Row>({
  columns,
  rows,
  rowKey,
  initialCount = 7,
}: {
  columns: MetricColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, initialCount);
  return (
    <div>
      <table className="halo-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === "right" ? "num" : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === "right" ? "num" : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > initialCount && (
        <button
          type="button"
          className="halo-table-more"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer" : `Show all ${rows.length} days`}
        </button>
      )}
    </div>
  );
}
