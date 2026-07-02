import { lazy, Suspense } from "react";
import type { BarChartProps } from "@mui/x-charts/BarChart";
import type { LineChartProps } from "@mui/x-charts/LineChart";

const LineChart = lazy(() =>
  import("@mui/x-charts/LineChart").then((module) => ({ default: module.LineChart }))
);
const BarChart = lazy(() =>
  import("@mui/x-charts/BarChart").then((module) => ({ default: module.BarChart }))
);

function DashboardLazyFallback() {
  return <div className="dashboard-lazy-fallback chart" />;
}

export function DashboardLineChart(props: LineChartProps) {
  return (
    <Suspense fallback={<DashboardLazyFallback />}>
      <LineChart {...props} />
    </Suspense>
  );
}

export function DashboardBarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<DashboardLazyFallback />}>
      <BarChart {...props} />
    </Suspense>
  );
}
