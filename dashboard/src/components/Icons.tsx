import type React from 'react';

/**
 * Icons.tsx
 *
 * Core icon set. Every icon here is a thin SVG stroke at currentColor
 * so it inherits text colour automatically.
 *
 * The Sparkle is the single AI glyph for the Prism design system.
 * Never use robots, lightbulbs,
 * wands, or brains for AI — only this star.
 */

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
};

const svgBase = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function Prism({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 1L11 7L7 13L3 7L7 1Z" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Sparkle({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 1L8.5 5L12.5 5.5L9.5 8L10.5 12L7 10L3.5 12L4.5 8L1.5 5.5L5.5 5Z" />
    </svg>
  );
}

export function Check({ size = 14, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" />
    </svg>
  );
}

export function Cross({ size = 14, className, strokeWidth = 1.8, style, onClick }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className} style={style} onClick={onClick}>
      <path d="M3 3L11 11M11 3L3 11" />
    </svg>
  );
}

export function Warn({ size = 14, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 1L13 12H1L7 1Z" />
      <path d="M7 5v3M7 10v.1" />
    </svg>
  );
}

export function Search({ size = 14, className, strokeWidth = 1.4 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <circle cx="6" cy="6" r="4" />
      <path d="M9 9l3 3" />
    </svg>
  );
}

export function Bell({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 2a3.5 3.5 0 00-3.5 3.5v3L2 10.5h10l-1.5-2v-3A3.5 3.5 0 007 2zM5.5 12a1.5 1.5 0 003 0" />
    </svg>
  );
}

export function Caret({ size = 12, className, strokeWidth = 1.5, direction = 'down' }: IconProps & { direction?: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 180, down: 0, left: 90, right: -90 }[direction];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" {...svgBase} strokeWidth={strokeWidth} className={className} style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M3 5L6 8L9 5" />
    </svg>
  );
}

export function Chevron({ size = 10, className, strokeWidth = 1.6, direction = 'right', style, onClick }: IconProps & { direction?: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: -90, down: 90, left: 180, right: 0 }[direction];
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" {...svgBase} strokeWidth={strokeWidth} className={className} style={{ transform: `rotate(${rot}deg)`, ...style }} onClick={onClick}>
      <path d="M3.5 2L6.5 5L3.5 8" />
    </svg>
  );
}

export function Dots({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <circle cx="3.5" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12.5" cy="8" r="1.2" />
    </svg>
  );
}

export function Plus({ size = 12, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

export function Clock({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4v3l2 1" />
    </svg>
  );
}

export function Sun({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <circle cx="7" cy="7" r="2.5" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.06 1.06M10.04 10.04l1.06 1.06M2.9 11.1l1.06-1.06M10.04 3.96l1.06-1.06" />
    </svg>
  );
}

export function Moon({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 1.5A5.5 5.5 0 1 0 12.5 7 4 4 0 0 1 7 1.5z" />
    </svg>
  );
}

export function Help({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 10v.1M7 7.5c0-1 1.5-1.3 1.5-2.3a1.5 1.5 0 10-3 0" />
    </svg>
  );
}

export function ArrowRight({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M3 7h8M7 3l4 4-4 4" />
    </svg>
  );
}

export function CalendarIcon({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <rect x="2" y="3" width="10" height="9" rx="1.5" />
      <path d="M4 2v2M10 2v2M2 6h10" />
    </svg>
  );
}

export function User({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 12c0-2 2-3.5 5-3.5s5 1.5 5 3.5" />
    </svg>
  );
}

export function ArrowLeft({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M11 7H3M7 3L3 7l4 4" />
    </svg>
  );
}

export function Upload({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 9V3M4 6l3-3 3 3M3 11h8" />
    </svg>
  );
}

/* ── Domain-specific nav icons ─────────────────────────────── */

export function HomeIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M2 6.5L7 2l5 4.5V12H9V9H5v3H2z" />
    </svg>
  );
}

export function SleepIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 2a5 5 0 1 0 5 5A4 4 0 0 1 7 2z" />
      <path d="M7 5v2.5l1.5 1" />
    </svg>
  );
}

export function ReadinessIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M1 7c1-3 2.5-4.5 4-4.5S8 5 9 5s2-2.5 4-2" />
      <path d="M1 7c1 3 2.5 4.5 4 4.5S8 9 9 9s2 2.5 4 2" />
    </svg>
  );
}

export function ActivityIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M1 7h2.5l2-4 2 8 2-5 1.5 1H13" />
    </svg>
  );
}

export function InsightsIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 1.5L8.5 5l3.5.5-2.5 2.5.5 3.5L7 9.5 4.5 11.5l.5-3.5L2.5 5.5 6 5z" />
    </svg>
  );
}

export function TrendUp({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M1 10l4-4 3 2.5L12 3" />
      <path d="M9 3h3v3" />
    </svg>
  );
}

export function TrendDown({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M1 4l4 4 3-2.5L12 11" />
      <path d="M9 11h3V8" />
    </svg>
  );
}

export function TrendFlat({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M2 7h10" />
      <path d="M9 4.5l2.5 2.5-2.5 2.5" />
    </svg>
  );
}

export function SettingsIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1c.3 0 .6.2.7.4l.2.8c.3.1.6.2.8.4l.7-.5c.2-.2.6-.1.8.1l1.1 1.1c.2.2.2.6 0 .8l-.5.7c.2.2.3.5.4.8l.8.2c.2.1.4.4.4.7v1.6c0 .3-.2.6-.4.7l-.8.2c-.1.3-.2.6-.4.8l.5.7c.2.2.2.6 0 .8l-1.1 1.1c-.2.2-.6.2-.8 0l-.7-.5c-.2.2-.5.3-.8.4l-.2.8c-.1.2-.4.4-.7.4H6.3c-.3 0-.6-.2-.7-.4l-.2-.8c-.3-.1-.6-.2-.8-.4l-.7.5c-.2.2-.6.1-.8-.1L2 10.3c-.2-.2-.2-.6 0-.8l.5-.7c-.2-.2-.3-.5-.4-.8l-.8-.2C1.2 7.7 1 7.4 1 7.1V5.5c0-.3.2-.6.4-.7l.8-.2c.1-.3.2-.6.4-.8l-.5-.7c-.2-.2-.2-.6 0-.8L3.2 2c.2-.2.6-.2.8 0l.7.5c.2-.2.5-.3.8-.4l.2-.8c.1-.2.4-.4.7-.4h1.3z" />
    </svg>
  );
}

export function HeartIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      <path d="M7 12.5s-5-3-5-6.5a2.5 2.5 0 014.3-1.8L7 5l.7-.8A2.5 2.5 0 0112 6c0 3.5-5 6.5-5 6.5z" />
    </svg>
  );
}

export function StressIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* Calm wavy balance pattern */}
      <path d="M1 7c2-3 4-3 6 0s4 3 6 0" />
      <path d="M1 7.5c2 3 4 3 6 0s4-3 6 0" opacity={0.5} />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CardioIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* Heart outline with pulse inside */}
      <path d="M7 12.5S2 9.5 2 6a2.5 2.5 0 014.3-1.8L7 5l.7-.8A2.5 2.5 0 0112 6c0 3.5-5 6.5-5 6.5z" />
      <path d="M4.5 6.5h1.2l.8-2 1 4 1-3.5 1 1.5" strokeWidth={1.3} />
    </svg>
  );
}

export function WorkoutsIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* Premium dumbbell */}
      <path d="M1.5 7h11M3.5 4h1v6h-1zm7 0h1v6h-1zm-9 1.5h1v4h-1zm10 0h1v4h-1z" />
    </svg>
  );
}

export function CorrelationIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* Two connected overlapping nodes or scatter charts */}
      <circle cx="4" cy="10" r="2.5" />
      <circle cx="10" cy="4" r="2.5" />
      <path d="M6 8.5L8 5.5" />
      <path d="M1.5 12.5l1.5-1M12.5 1.5l-1 1" opacity={0.5} />
    </svg>
  );
}

export function ExperimentsIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* Test tube/flask chemistry */}
      <path d="M5 2h4M6 2v7.5L3.5 12h7L8 9.5V2" />
      <path d="M4.5 10.5h5" opacity={0.6} />
    </svg>
  );
}

export function TimelineIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* Horizon timeline / clock tick marks */}
      <path d="M1 7h12M1 4.5V7M7 4.5V7M13 4.5V7" />
      <circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CompareIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...svgBase} strokeWidth={strokeWidth} className={className}>
      {/* 2 columns grid / comparison scales */}
      <path d="M1 2.5h5.5v9H1zM7.5 2.5H13v9H7.5zM3 5.5h1.5M9.5 5.5h1.5M3 8.5h1.5M9.5 8.5h1.5" />
    </svg>
  );
}

