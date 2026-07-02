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

export interface EnrichedLineChartProps extends LineChartProps {
  compareDataset?: any[];
}

export function DashboardLineChart(props: EnrichedLineChartProps) {
  const { dataset, xAxis, series, compareDataset, ...rest } = props;
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

  // Merge datasets for comparison if active
  let finalDataset = dataset;
  let finalSeries = series;

  if (compareDataset && compareDataset.length > 0 && dataset) {
    finalDataset = dataset.map((d, i) => {
      const matched = compareDataset[i];
      const merged: any = { ...d };
      if (series) {
        series.forEach((s: any) => {
          if (s.dataKey) {
            merged[`${String(s.dataKey)}_compare`] = matched ? matched[s.dataKey] : null;
          }
        });
      }
      return merged;
    });

    if (series) {
      const extra: any[] = [];
      series.forEach((s: any) => {
        if (s.dataKey) {
          extra.push({
            ...s,
            dataKey: `${String(s.dataKey)}_compare`,
            label: `${s.label || "Metric"} (Previous)`,
            color: "var(--text-4)",
            area: false,
            showMark: false,
          });
        }
      });
      finalSeries = [...series, ...extra];
    }
  }

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

  const primaryKey = series?.[0]?.dataKey ? String(series[0].dataKey) : "";
  const annotations = primaryKey ? computeAnnotations(dataset || [], primaryKey) : [];

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Suspense fallback={<DashboardLazyFallback />}>
        <LineChart
          {...rest}
          xAxis={xAxis}
          margin={margin}
          series={finalSeries}
          dataset={finalDataset}
        />
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

      {annotations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", padding: "0 10px" }}>
          {annotations.map((ann, idx) => (
            <span
              key={idx}
              style={{
                fontSize: "0.68rem",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--divider)",
                borderRadius: "6px",
                padding: "2px 8px",
                color: "var(--text-3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ color: ann.type === "z-score" ? "var(--hue-stress)" : "var(--accent)", fontWeight: 700 }}>•</span>
              <strong>{ann.day}:</strong> {ann.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface EnrichedBarChartProps extends BarChartProps {
  compareDataset?: any[];
}

export function DashboardBarChart(props: EnrichedBarChartProps) {
  const { dataset, xAxis, series, compareDataset, ...rest } = props;
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

  // Merge datasets for comparison if active
  let finalDataset = dataset;
  let finalSeries = series;

  if (compareDataset && compareDataset.length > 0 && dataset) {
    finalDataset = dataset.map((d, i) => {
      const matched = compareDataset[i];
      const merged: any = { ...d };
      if (series) {
        series.forEach((s: any) => {
          if (s.dataKey) {
            merged[`${String(s.dataKey)}_compare`] = matched ? matched[s.dataKey] : null;
          }
        });
      }
      return merged;
    });

    if (series) {
      const extra: any[] = [];
      series.forEach((s: any) => {
        if (s.dataKey) {
          extra.push({
            ...s,
            dataKey: `${String(s.dataKey)}_compare`,
            label: `${s.label || "Metric"} (Previous)`,
            color: "var(--text-4)",
          });
        }
      });
      finalSeries = [...series, ...extra];
    }
  }

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

  const primaryKey = series?.[0]?.dataKey ? String(series[0].dataKey) : "";
  const annotations = primaryKey ? computeAnnotations(dataset || [], primaryKey) : [];

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Suspense fallback={<DashboardLazyFallback />}>
        <BarChart
          {...rest}
          xAxis={xAxis}
          margin={margin}
          series={finalSeries}
          dataset={finalDataset}
        />
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

      {annotations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", padding: "0 10px" }}>
          {annotations.map((ann, idx) => (
            <span
              key={idx}
              style={{
                fontSize: "0.68rem",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--divider)",
                borderRadius: "6px",
                padding: "2px 8px",
                color: "var(--text-3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ color: ann.type === "z-score" ? "var(--hue-stress)" : "var(--accent)", fontWeight: 700 }}>•</span>
              <strong>{ann.day}:</strong> {ann.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function computeAnnotations(dataset: readonly any[], dataKey: string) {
  if (!dataset || dataset.length === 0 || !dataKey) return [];
  const values = dataset
    .map((d) => d[dataKey])
    .filter((v) => typeof v === "number" && !isNaN(v));
  if (values.length === 0) return [];

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance) || 1;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const annotations: Array<{ day: string; label: string; z: number; type: string }> = [];

  dataset.forEach((d) => {
    const val = d[dataKey];
    if (typeof val !== "number" || isNaN(val)) return;

    const z = (val - mean) / stdDev;
    const dayLabel = d.day || "";

    if (Math.abs(z) >= 2) {
      annotations.push({
        day: dayLabel,
        label: `Unusually ${z > 0 ? "high" : "low"} (${val}${z > 0 ? " ▲" : " ▼"})`,
        z: Math.abs(z),
        type: "z-score",
      });
    } else if (val === maxVal && values.length >= 6) {
      annotations.push({
        day: dayLabel,
        label: `Period best (${val} ▲)`,
        z: 1.5,
        type: "max",
      });
    } else if (val === minVal && values.length >= 6) {
      annotations.push({
        day: dayLabel,
        label: `Period lowest (${val} ▼)`,
        z: 1.5,
        type: "min",
      });
    }
  });

  // Sort by strength (z-score value) descending and limit to top 3
  return annotations
    .sort((a, b) => b.z - a.z)
    .slice(0, 3);
}
