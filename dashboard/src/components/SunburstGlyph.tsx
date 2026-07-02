import React, { useState } from "react";
import { scoreBand, bandColor } from "./halo";

interface Contributor {
  name: string;
  score: number;
}

interface SunburstGlyphProps {
  score: number;
  contributors: Contributor[];
  size?: number;
}

function getArcPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
): string {
  const rad = Math.PI / 180;
  const x1Inner = cx + rInner * Math.cos(startAngle * rad);
  const y1Inner = cy + rInner * Math.sin(startAngle * rad);
  const x2Inner = cx + rInner * Math.cos(endAngle * rad);
  const y2Inner = cy + rInner * Math.sin(endAngle * rad);

  const x1Outer = cx + rOuter * Math.cos(startAngle * rad);
  const y1Outer = cy + rOuter * Math.sin(startAngle * rad);
  const x2Outer = cx + rOuter * Math.cos(endAngle * rad);
  const y2Outer = cy + rOuter * Math.sin(endAngle * rad);

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `
    M ${x1Outer} ${y1Outer}
    A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}
    L ${x2Inner} ${y2Inner}
    A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}
    Z
  `;
}

export function SunburstGlyph({ score, contributors, size = 180 }: SunburstGlyphProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.28;
  const rOuter = size * 0.44;

  const validContributors = contributors.filter((c) => c.score > 0);
  const count = validContributors.length;
  const segmentAngle = count > 0 ? 360 / count : 0;
  const gapAngle = 3; // Gap size in degrees between segments

  return (
    <div style={{ position: "relative", display: "inline-flex", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Draw arc segments for contributors */}
        {validContributors.map((c, idx) => {
          // Rotate arc segment so the first segment starts at 12 o'clock (-90 degrees)
          const startAngle = -90 + idx * segmentAngle + gapAngle / 2;
          const endAngle = -90 + (idx + 1) * segmentAngle - gapAngle / 2;
          const band = scoreBand(c.score);
          const color = bandColor(band);
          const isHovered = hoveredIdx === idx;

          return (
            <path
              key={idx}
              d={getArcPath(cx, cy, rInner, isHovered ? rOuter + 4 : rOuter, startAngle, endAngle)}
              fill={color}
              opacity={hoveredIdx === null || isHovered ? 0.95 : 0.4}
              style={{ cursor: "pointer", transition: "all 150ms var(--ease)" }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}

        {/* Central score display */}
        <circle cx={cx} cy={cy} r={rInner - 4} fill="var(--bg-card)" stroke="var(--divider)" strokeWidth={1} />
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fill="var(--text-default)"
          style={{ fontSize: "1.8rem", fontWeight: 700, fontFamily: "var(--f-sans)" }}
        >
          {score}
        </text>
      </svg>

      {/* Floating segment details hover tooltip */}
      {hoveredIdx !== null && validContributors[hoveredIdx] && (
        <div
          style={{
            position: "absolute",
            bottom: "0px",
            left: "50%",
            transform: "translateX(-50%) translateY(100%)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--divider-strong)",
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "var(--shadow-float)",
            zIndex: 50,
            whiteSpace: "nowrap",
            fontSize: "0.75rem",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            textAlign: "center",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text-default)" }}>
            {validContributors[hoveredIdx].name}
          </span>
          <span style={{ color: bandColor(scoreBand(validContributors[hoveredIdx].score)), fontWeight: 700 }}>
            Score: {validContributors[hoveredIdx].score} ({scoreBand(validContributors[hoveredIdx].score).toUpperCase()})
          </span>
        </div>
      )}
    </div>
  );
}
