import React, { lazy, Suspense, useRef, useState, useEffect } from "react";
import type { BarChartProps } from "@mui/x-charts/BarChart";
import type { LineChartProps } from "@mui/x-charts/LineChart";
import { useCrosshair } from "../context/CrosshairContext";

const LineChart = lazy(() =>
  import("@mui/x-charts/LineChart").then((module) => ({ default: module.LineChart }))
);
const BarChart = lazy(() =>
  import("@mui/x-charts/BarChart").then((module) => ({ default: module.BarChart }))
);

function DashboardLazyFallback() {
  return <div className="dashboard-lazy-fallback chart" />;
}

// Default margins for MUI charts (in pixels)
const DEFAULT_MARGIN = { left: 50, right: 20, top: 20, bottom: 30 };

function parseMargin(raw: any) {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_MARGIN;
  }
  return {
    left: typeof raw.left === "number" ? raw.left : DEFAULT_MARGIN.left,
    right: typeof raw.right === "number" ? raw.right : DEFAULT_MARGIN.right,
    top: typeof raw.top === "number" ? raw.top : DEFAULT_MARGIN.top,
    bottom: typeof raw.bottom === "number" ? raw.bottom : DEFAULT_MARGIN.bottom,
  };
}

export function DashboardLineChart(props: LineChartProps) {
  const { dataset, xAxis } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const { hover, setHoverState } = useCrosshair();
  const [containerWidth, setContainerWidth] = useState(0);

  const margin = parseMargin(props.margin);
  const xAxisKey = (xAxis && xAxis[0] && (xAxis[0] as any).dataKey) || "day";
  const kind = xAxisKey === "time" ? "time" : "day";

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !dataset || dataset.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - margin.left - margin.right;
    const relativeX = x - margin.left;

    if (relativeX >= 0 && relativeX <= plotWidth) {
      const pct = relativeX / plotWidth;
      const index = Math.min(dataset.length - 1, Math.max(0, Math.round(pct * (dataset.length - 1))));
      const datum = dataset[index];
      if (datum) {
        const val = datum[xAxisKey];
        setHoverState(kind, val ? String(val) : null);
      }
    }
  };

  const handlePointerLeave = () => {
    setHoverState(null, null);
  };

  // Calculate synchronized line position
  const hoverIndex =
    dataset && hover.value
      ? dataset.findIndex((d) => String(d[xAxisKey]) === hover.value)
      : -1;
  
  const showLine = hoverIndex >= 0 && (hover.kind === kind || (kind === "day" && hover.kind === "time"));
  const matchedIndex = showLine ? hoverIndex : -1;

  const lineLeft =
    matchedIndex >= 0 && dataset
      ? margin.left +
        (matchedIndex / (dataset.length - 1)) *
          (containerWidth - margin.left - margin.right)
      : 0;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Suspense fallback={<DashboardLazyFallback />}>
        <LineChart {...props} />
      </Suspense>

      {/* Synchronized Vertical Hairline indicator */}
      {showLine && matchedIndex >= 0 && (
        <div
          style={{
            position: "absolute",
            top: margin.top,
            bottom: margin.bottom,
            left: lineLeft,
            width: "1px",
            background: "var(--divider-strong)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}

export function DashboardBarChart(props: BarChartProps) {
  const { dataset, xAxis } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const { hover, setHoverState } = useCrosshair();
  const [containerWidth, setContainerWidth] = useState(0);

  const margin = parseMargin(props.margin);
  const xAxisKey = (xAxis && xAxis[0] && (xAxis[0] as any).dataKey) || "day";
  const kind = xAxisKey === "time" ? "time" : "day";

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !dataset || dataset.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - margin.left - margin.right;
    const relativeX = x - margin.left;

    if (relativeX >= 0 && relativeX <= plotWidth) {
      const pct = relativeX / plotWidth;
      const index = Math.min(dataset.length - 1, Math.max(0, Math.floor(pct * dataset.length)));
      const datum = dataset[index];
      if (datum) {
        const val = datum[xAxisKey];
        setHoverState(kind, val ? String(val) : null);
      }
    }
  };

  const handlePointerLeave = () => {
    setHoverState(null, null);
  };

  // Calculate synchronized line position (centered on active bar band)
  const hoverIndex =
    dataset && hover.value
      ? dataset.findIndex((d) => String(d[xAxisKey]) === hover.value)
      : -1;
  
  const showLine = hoverIndex >= 0 && (hover.kind === kind || (kind === "day" && hover.kind === "time"));
  const matchedIndex = showLine ? hoverIndex : -1;

  const lineLeft =
    matchedIndex >= 0 && dataset
      ? margin.left +
        ((matchedIndex + 0.5) / dataset.length) *
          (containerWidth - margin.left - margin.right)
      : 0;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Suspense fallback={<DashboardLazyFallback />}>
        <BarChart {...props} />
      </Suspense>

      {/* Synchronized Vertical Hairline indicator */}
      {showLine && matchedIndex >= 0 && (
        <div
          style={{
            position: "absolute",
            top: margin.top,
            bottom: margin.bottom,
            left: lineLeft,
            width: "1px",
            background: "var(--divider-strong)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
