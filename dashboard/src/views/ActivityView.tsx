import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { MetricTable, type MetricColumn } from "../components/halo";
import type { ActivityRecord } from "../types";
import { DashboardBarChart } from "./charts";

interface ActivityViewProps {
  activityChartData: any[];
  stressChartData: any[];
  activityRows: ActivityRecord[];
  activityColumns: MetricColumn<ActivityRecord>[];
  hues: any;
}

export function ActivityView({
  activityChartData,
  stressChartData,
  activityRows,
  activityColumns,
  hues,
}: ActivityViewProps) {
  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-activity)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Movement volume, energy burn, and stress balance.</p>
      </div>

      <div className="dashboard-pane-grid">
        <Card>
          <CardHeader title="Steps" description="Daily step count" />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardBarChart
                className="dashboard-chart"
                dataset={activityChartData}
                xAxis={[{ scaleType: "band", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  { dataKey: "steps", label: "Steps", color: hues.activity },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Stress and recovery"
            description="Stress above the line, recovery below"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardBarChart
                className="dashboard-chart"
                dataset={stressChartData}
                xAxis={[{ scaleType: "band", dataKey: "day" }]}
                yAxis={[
                  {
                    valueFormatter: (v: number) => `${Math.abs(v)}h`,
                  },
                ]}
                grid={{ horizontal: true }}
                series={[
                  {
                    dataKey: "stress",
                    label: "Stress",
                    stack: "balance",
                    color: hues.stress,
                    valueFormatter: (v: number | null) =>
                      v == null ? "" : `${Math.abs(v)}h`,
                  },
                  {
                    dataKey: "recovery",
                    label: "Recovery",
                    stack: "balance",
                    color: hues.optimal,
                    valueFormatter: (v: number | null) =>
                      v == null ? "" : `${Math.abs(v)}h`,
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
          title="Activity log"
          description="Steps and energy across your history"
        />
        <CardContent>
          <MetricTable
            columns={activityColumns}
            rows={activityRows}
            rowKey={(row) => row.day}
          />
        </CardContent>
      </Card>
    </div>
  );
}
