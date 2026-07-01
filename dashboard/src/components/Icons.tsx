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

export function Upload({ size = 14, className, strokeWidth = 1.6, style, onClick }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgBase} strokeWidth={strokeWidth} className={className} style={style} onClick={onClick}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
    </svg>
  );
}
