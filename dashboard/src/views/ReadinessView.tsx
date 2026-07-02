import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { MetricTable, type MetricColumn } from "../components/halo";
import type { ReadinessRecord } from "../types";
import { DashboardLineChart } from "./charts";

interface ReadinessViewProps {
  readinessChartData: any[];
  readinessRows: ReadinessRecord[];
  readinessColumns: MetricColumn<ReadinessRecord>[];
  hues: any;
}

export function ReadinessView({
  readinessChartData,
  readinessRows,
  readinessColumns,
  hues,
}: ReadinessViewProps) {
  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-readiness)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Recovery score, HRV, resting heart rate, and thermal drift.</p>
      </div>

      <div className="dashboard-pane-grid">
        <Card>
          <CardHeader
            title="Heart rate variability"
            description="Nightly average — higher is better"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={readinessChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "hrv",
                    label: "HRV",
                    color: hues.readiness,
                    area: true,
                    showMark: false,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Resting heart rate"
            description="Lowest overnight — lower is better"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={readinessChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "rhr",
                    label: "RHR",
                    color: hues.heart,
                    showMark: false,
                  },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recovery log"
          description="Latest days first so outliers stand out"
        />
        <CardContent>
          <MetricTable
            columns={readinessColumns}
            rows={readinessRows}
            rowKey={(row) => row.day}
          />
        </CardContent>
      </Card>
    </div>
  );
}
