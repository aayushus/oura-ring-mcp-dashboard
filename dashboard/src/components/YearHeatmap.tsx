import React, { useState } from "react";
import { scoreBand, BAND_LABEL } from "./halo";

interface HeatmapDataPoint {
  day: string; // YYYY-MM-DD
  score: number;
}

interface YearHeatmapProps {
  data: HeatmapDataPoint[];
  metricLabel: string;
}

export function YearHeatmap({ data, metricLabel }: YearHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ date: string; score: number | null } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ date: string; score: number | null } | null>(null);

  // Generate date list for the last 365 days ending today
  const cells: { dateStr: string; score: number | null }[] = [];
  const now = new Date();
  
  // Calculate offset to align days of the week (0 = Sunday, 1 = Monday...)
  // We go back 364 days so that we have exactly 53 weeks (365 days)
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString("sv-SE");
    const match = data.find((r) => r.day === dateStr);
    cells.push({
      dateStr,
      score: match ? match.score : null,
    });
  }

  // Group cells into 53 columns (weeks) of 7 days (rows)
  const columns: typeof cells[] = [];
  let currentWeek: typeof cells = [];

  // Align start day of the week
  const startDayOfWeek = new Date(cells[0].dateStr).getDay();
  // Fill empty spacer cells for the first week if not starting on Sunday
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push({ dateStr: "", score: null });
  }

  cells.forEach((cell) => {
    currentWeek.push(cell);
    if (currentWeek.length === 7) {
      columns.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    // Pad the last week
    while (currentWeek.length < 7) {
      currentWeek.push({ dateStr: "", score: null });
    }
    columns.push(currentWeek);
  }

  const getCellColor = (score: number | null) => {
    if (score === null) return "var(--score-none)";
    const band = scoreBand(score);
    if (band === "optimal") return "var(--score-optimal)";
    if (band === "good") return "var(--score-good)";
    if (band === "fair") return "var(--score-fair)";
    return "var(--score-low)";
  };

  const svgWidth = columns.length * 13;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-card)", padding: "20px", borderRadius: "20px", border: "1px solid var(--divider-strong)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
          {metricLabel} — Year View Adherence
        </h4>
        
        {/* Colors Legend */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.75rem", color: "var(--text-3)" }}>
          <span>Low</span>
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--score-low)" }} />
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--score-fair)" }} />
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--score-good)" }} />
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--score-optimal)" }} />
          <span>Optimal</span>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", width: "100%" }}>
          {/* Weekday Labels Column */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-4)", height: "88px", paddingRight: "6px", paddingTop: "2px" }}>
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>

          {/* SVG Heatmap Grid - Responsive Viewbox */}
          <div style={{ flex: 1, width: "100%" }}>
            <svg
              viewBox={`0 0 ${svgWidth} 91`}
              width="100%"
              style={{ overflow: "visible", display: "block" }}
            >
              {columns.map((week, colIdx) => (
                <g key={colIdx} transform={`translate(${colIdx * 13}, 0)`}>
                  {week.map((dayCell, rowIdx) => {
                    if (!dayCell.dateStr) return null;
                    const isHovered = hoveredCell && hoveredCell.date === dayCell.dateStr;
                    return (
                      <rect
                        key={rowIdx}
                        y={rowIdx * 13}
                        width={10}
                        height={10}
                        rx={2}
                        ry={2}
                        fill={getCellColor(dayCell.score)}
                        style={{ cursor: "pointer", transition: "opacity 100ms ease" }}
                        opacity={isHovered ? 1 : 0.82}
                        onMouseEnter={(e) => {
                          setHoveredCell({ date: dayCell.dateStr, score: dayCell.score });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => setSelectedCell({ date: dayCell.dateStr, score: dayCell.score })}
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Hover Tooltip Overlay */}
        {hoveredCell && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%) translateY(-8px)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--divider-strong)",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              color: "var(--text-default)",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 100,
            }}
          >
            <strong>{hoveredCell.date}</strong>: {hoveredCell.score !== null ? `${hoveredCell.score} / 100` : "No Data"}
          </div>
        )}
      </div>

      {/* Premium Detail Modal Popup (Custom alert replacement) */}
      {selectedCell && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(6px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setSelectedCell(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "360px",
              background: "var(--bg-card)",
              borderRadius: "16px",
              border: "1px solid var(--divider-strong)",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
                Vitals Detail
              </span>
              <button
                onClick={() => setSelectedCell(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
              >
                ✕
              </button>
            </div>

            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-default)", marginBottom: "4px" }}>
                {new Date(selectedCell.date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>
                Date Ref: {selectedCell.date}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", margin: "10px 0" }}>
              <div
                style={{
                  height: "72px",
                  width: "72px",
                  borderRadius: "50%",
                  background: getCellColor(selectedCell.score),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                }}
              >
                {selectedCell.score ?? "—"}
              </div>
              
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-default)" }}>
                {selectedCell.score !== null 
                  ? `Status: ${BAND_LABEL[scoreBand(selectedCell.score)]}` 
                  : "No data logs found"}
              </div>
            </div>

            <button
              onClick={() => setSelectedCell(null)}
              style={{
                width: "100%",
                background: "var(--bg-hover)",
                border: "1px solid var(--divider-strong)",
                borderRadius: "10px",
                color: "var(--text-default)",
                padding: "10px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 80ms var(--ease)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--divider-strong)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
