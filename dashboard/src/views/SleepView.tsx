import React from "react";
import { Card, CardContent, CardHeader } from "../components/components";
import { MetricTable, type MetricColumn } from "../components/halo";
import type { SleepRecord } from "../types";
import { DashboardBarChart, DashboardLineChart } from "./charts";

interface SleepViewProps {
  sleepChartData: any[];
  sleepRows: SleepRecord[];
  sleepColumns: MetricColumn<SleepRecord>[];
  hues: any;
}

export function SleepView({
  sleepChartData,
  sleepRows,
  sleepColumns,
  hues,
}: SleepViewProps) {
  return (
    <div className="dashboard-stack">
      <div
        className="halo-module-head"
        style={{ "--hue": "var(--hue-sleep)" } as React.CSSProperties}
      >
        <span className="rule" />
        <p>Nightly duration, stage composition, and full history.</p>
      </div>

      <div className="dashboard-pane-grid">
        <Card>
          <CardHeader
            title="Sleep duration"
            description="Total nightly sleep hours"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardLineChart
                className="dashboard-chart"
                dataset={sleepChartData}
                xAxis={[{ scaleType: "point", dataKey: "day" }]}
                grid={{ horizontal: true }}
                hideLegend
                series={[
                  {
                    dataKey: "duration",
                    label: "Sleep hours",
                    color: hues.sleep,
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
            title="Stage composition"
            description="Deep, REM, and light per night"
          />
          <CardContent>
            <div className="chart-frame tall">
              <DashboardBarChart
                className="dashboard-chart"
                dataset={sleepChartData}
                xAxis={[{ scaleType: "band", dataKey: "day" }]}
                grid={{ horizontal: true }}
                series={[
                  { dataKey: "deep", label: "Deep", stack: "stages", color: hues.sleepDeep },
                  { dataKey: "rem", label: "REM", stack: "stages", color: hues.rem },
                  { dataKey: "light", label: "Light", stack: "stages", color: hues.sleep },
                ]}
                height={320}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Sleep log"
          description="Most recent nights first"
        />
        <CardContent>
          <MetricTable
            columns={sleepColumns}
            rows={sleepRows}
            rowKey={(row) => row.day}
          />
        </CardContent>
      </Card>
    </div>
  );
}
