import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import {
  AppShell,
  Sidebar,
  SidebarGroup,
  Main,
  Card,
  CardHeader,
  CardContent,
  StatStrip,
  SectionHead,
  Button,
  Tag,
  Alert,
  Callout,
  ThemeToggle,
  WorkspaceSwitcher,
  TreeItem,
  SidebarFooter,
  AIVerdict,
  AIFinding,
} from "./components/components";

// Interfaces mirroring backend schemas
interface SleepRecord {
  day: string;
  score: number;
  duration: number; // in seconds
  deep: number; // in seconds
  rem: number; // in seconds
  light: number; // in seconds
  efficiency: number;
}

interface ReadinessRecord {
  day: string;
  score: number;
  hrv: number;
  rhr: number;
  temperature_deviation: number;
}

interface ActivityRecord {
  day: string;
  score: number;
  steps: number;
  active_calories: number;
  total_calories: number;
}

interface StressRecord {
  day: string;
  stress_duration: number; // in seconds
  recovery_duration: number; // in seconds
}

interface HistorySummary {
  sleep: SleepRecord[];
  readiness: ReadinessRecord[];
  activity: ActivityRecord[];
  stress: StressRecord[];
}

function App() {
  const [activeTab, setActiveTab] = useState<"home" | "sleep" | "readiness" | "activity" | "insights">("home");
  const [data, setData] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set dark theme by default
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/dashboard/summary");
      if (!response.ok) {
        throw new Error(`Failed to load summary: ${response.statusText}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await fetch("/api/dashboard/sync", { method: "POST" });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Sync failed: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success && result.history) {
        setData(result.history);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  // Helper formatter calculations
  const formatSecondsToHours = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.round((secs % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  // Extract latest metrics
  const getLatestMetrics = () => {
    if (!data) return null;
    
    const latestSleep = data.sleep[data.sleep.length - 1] || null;
    const latestReadiness = data.readiness[data.readiness.length - 1] || null;
    const latestActivity = data.activity[data.activity.length - 1] || null;
    
    return {
      sleepScore: latestSleep?.score ?? 0,
      sleepDuration: latestSleep?.duration ?? 0,
      readinessScore: latestReadiness?.score ?? 0,
      hrv: latestReadiness?.hrv ?? 0,
      rhr: latestReadiness?.rhr ?? 0,
      steps: latestActivity?.steps ?? 0,
      activityScore: latestActivity?.score ?? 0,
      day: latestSleep?.day ?? latestReadiness?.day ?? latestActivity?.day ?? "N/A"
    };
  };

  const metrics = getLatestMetrics();

  // Create chart formatted datasets
  const getSleepChartData = () => {
    if (!data) return [];
    return data.sleep.map(s => ({
      day: s.day.slice(5), // MM-DD
      Deep: Math.round(s.deep / 3600 * 10) / 10,
      REM: Math.round(s.rem / 3600 * 10) / 10,
      Light: Math.round(s.light / 3600 * 10) / 10,
      duration: Math.round(s.duration / 3600 * 10) / 10
    }));
  };

  const getReadinessChartData = () => {
    if (!data) return [];
    return data.readiness.map(r => ({
      day: r.day.slice(5),
      Score: r.score,
      HRV: r.hrv,
      RHR: r.rhr
    }));
  };

  const getActivityChartData = () => {
    if (!data) return [];
    return data.activity.map(a => ({
      day: a.day.slice(5),
      Steps: a.steps,
      ActiveCal: a.active_calories
    }));
  };

  // (getStressChartData removed)

  // Perform simple correlation analysis for Insights tab
  const getInsights = () => {
    if (!data || data.sleep.length < 5) return [];
    
    const insights = [];
    
    // Anomaly 1: High Stress vs Sleep Quality
    const sleepScores = data.sleep.map(s => s.score);
    const avgSleep = sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length;
    
    const latestSleep = data.sleep[data.sleep.length - 1];
    if (latestSleep && latestSleep.score < avgSleep - 10) {
      insights.push({
        variant: "warn" as const,
        title: "Sleep Quality Drop Detected",
        body: `Your sleep score last night was ${latestSleep.score}, which is significantly lower than your 30-day average of ${Math.round(avgSleep)}. Check if high stress or late meals contributed.`,
        cta: "Sleep Stages Details"
      });
    }

    // Correlation 2: RHR & Sleep
    const rhrs = data.readiness.map(r => r.rhr).filter(r => r > 0);
    if (rhrs.length > 5) {
      const avgRhr = rhrs.reduce((a, b) => a + b, 0) / rhrs.length;
      const latestRhr = rhrs[rhrs.length - 1];
      if (latestRhr < avgRhr - 3) {
        insights.push({
          variant: "success" as const,
          title: "Optimized Recovery",
          body: `Your resting heart rate last night lowered to ${latestRhr} bpm (vs your average of ${Math.round(avgRhr)} bpm). This indicates excellent cardiovascular recovery and low physical fatigue.`,
          cta: "Recovery Details"
        });
      }
    }

    // Step adherence
    const steps = data.activity.map(a => a.steps);
    const activeDays = steps.filter(s => s >= 8000).length;
    const adherenceRate = Math.round((activeDays / steps.length) * 100);
    if (adherenceRate >= 60) {
      insights.push({
        variant: "info" as const,
        title: "Strong Step Goal Consistency",
        body: `You met your active daily step target (8,000+ steps) on ${activeDays} out of the last ${steps.length} days (${adherenceRate}% adherence). Consistency is driving your HRV upward.`,
        cta: "Activity Details"
      });
    } else {
      insights.push({
        variant: "info" as const,
        title: "Opportunity to Move More",
        body: `You reached 8,000 steps on ${activeDays} of the last ${steps.length} days (${adherenceRate}%). Try walking for 15 minutes post-lunch to boost daily blood flow and improve sleep efficiency.`,
        cta: "Activity Details"
      });
    }

    return insights;
  };

  return (
    <AppShell>
      <Sidebar>
        <WorkspaceSwitcher
          name="Oura MCP"
          role="Selfhosted Dashboard"
          avatarText="O"
        />

        <SidebarGroup label="Metrics">
          <TreeItem
            icon="🏠"
            label="Home Dashboard"
            active={activeTab === "home"}
            onClick={() => setActiveTab("home")}
          />
          <TreeItem
            icon="🌙"
            label="Sleep & Bedtime"
            active={activeTab === "sleep"}
            onClick={() => setActiveTab("sleep")}
          />
          <TreeItem
            icon="⚡"
            label="Readiness & Recovery"
            active={activeTab === "readiness"}
            onClick={() => setActiveTab("readiness")}
          />
          <TreeItem
            icon="🏃"
            label="Activity & Workouts"
            active={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
          />
        </SidebarGroup>

        <SidebarGroup label="Intelligence">
          <TreeItem
            icon="✨"
            label="AI Insights"
            active={activeTab === "insights"}
            onClick={() => setActiveTab("insights")}
          />
        </SidebarGroup>

        <div style={{ marginTop: "auto", padding: "16px" }}>
          <ThemeToggle />
        </div>

        <SidebarFooter
          userName="Selfhoster User"
          userMeta="Active Session"
          creditsUsed={data ? data.sleep.length : 0}
          creditsTotal={30}
        />
      </Sidebar>

      <Main>
        {/* Top Header Row */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          borderBottom: "1px solid var(--divider)",
          paddingBottom: "16px"
        }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-default)" }}>
              {activeTab === "home" && "Home Dashboard"}
              {activeTab === "sleep" && "Sleep & Sleep Stages"}
              {activeTab === "readiness" && "Readiness & Autonomic Nervous System"}
              {activeTab === "activity" && "Activity & Daily Cardio"}
              {activeTab === "insights" && "Autonmous AI health Insights"}
            </h1>
            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>
              Oura API v2 Sync Engine • {metrics ? `Last sync date: ${metrics.day}` : "Loading..."}
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {syncing && <span style={{ color: "var(--text-3)", fontSize: "13px" }}>Syncing with Oura Cloud...</span>}
            <Button
              variant={syncing ? "secondary" : "ai"}
              onClick={handleSync}
            >
              {syncing ? "Syncing..." : "Sync Oura Now"}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="warn" title="Sync / Load Error">
            {error}
          </Alert>
        )}

        {loading && !data ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-3)" }}>
            Loading dashboard data from SQLite DB...
          </div>
        ) : !data ? (
          <Callout variant="info" icon="⚠️">
            No health data available. Click "Sync Oura Now" to pull data.
          </Callout>
        ) : (
          <>
            {/* 🏠 HOME TAB */}
            {activeTab === "home" && metrics && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <StatStrip
                  cells={[
                    { label: "Sleep Score", children: `${metrics.sleepScore}` },
                    { label: "Sleep Duration", children: formatSecondsToHours(metrics.sleepDuration) },
                    { label: "Readiness Score", children: `${metrics.readinessScore}` },
                    { label: "HRV (Autonomic)", children: `${metrics.hrv} ms` },
                    { label: "Resting HR", children: `${metrics.rhr} bpm` },
                    { label: "Steps Today", children: metrics.steps.toLocaleString() },
                  ]}
                />

                <SectionHead title="Autonomic Trends & History" />

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
                  gap: "24px"
                }}>
                  <Card>
                    <CardHeader title="Readiness & Recovery Score" description="Last 30 days daily recovery readiness" />
                    <CardContent>
                      <div style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getReadinessChartData()}>
                            <defs>
                              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                            <XAxis dataKey="day" stroke="var(--text-4)" fontSize={11} />
                            <YAxis domain={[40, 100]} stroke="var(--text-4)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)", borderRadius: "var(--r-md)" }} />
                            <Area type="monotone" dataKey="Score" stroke="var(--chart-1)" fillOpacity={1} fill="url(#colorScore)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader title="Sleep Stages Stack" description="Daily sleep structure breakdown (hours)" />
                    <CardContent>
                      <div style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getSleepChartData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                            <XAxis dataKey="day" stroke="var(--text-4)" fontSize={11} />
                            <YAxis stroke="var(--text-4)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)", borderRadius: "var(--r-md)" }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="Deep" stackId="a" fill="var(--chart-1)" />
                            <Bar dataKey="REM" stackId="a" fill="var(--chart-5)" />
                            <Bar dataKey="Light" stackId="a" fill="var(--chart-2)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader title="Autonomic HRV vs RHR" description="Overnight HRV average compared to Resting Heart Rate" />
                    <CardContent>
                      <div style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getReadinessChartData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                            <XAxis dataKey="day" stroke="var(--text-4)" fontSize={11} />
                            <YAxis stroke="var(--text-4)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)", borderRadius: "var(--r-md)" }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="HRV" stroke="var(--chart-2)" strokeWidth={2} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="RHR" stroke="var(--chart-4)" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader title="Active Movement (Steps)" description="Garmin Connect-style daily steps tracker" />
                    <CardContent>
                      <div style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getActivityChartData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                            <XAxis dataKey="day" stroke="var(--text-4)" fontSize={11} />
                            <YAxis stroke="var(--text-4)" fontSize={11} />
                            <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)", borderRadius: "var(--r-md)" }} />
                            <Bar dataKey="Steps" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* 🌙 SLEEP TAB */}
            {activeTab === "sleep" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <Card>
                  <CardHeader title="Sleep Duration History" description="Total sleep hours compared to optimal" />
                  <CardContent>
                    <div style={{ height: "300px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getSleepChartData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                          <XAxis dataKey="day" stroke="var(--text-4)" />
                          <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft" }} stroke="var(--text-4)" />
                          <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)" }} />
                          <Line type="monotone" dataKey="duration" stroke="var(--chart-1)" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <SectionHead title="Sleep Metrics Breakdown" />
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  color: "var(--text-default)",
                  fontSize: "14px"
                }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--divider-strong)" }}>
                      <th style={{ textAlign: "left", padding: "12px" }}>Day</th>
                      <th style={{ textAlign: "center", padding: "12px" }}>Score</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Total Sleep</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Efficiency</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Deep Sleep</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>REM Sleep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sleep.slice().reverse().map((s) => (
                      <tr key={s.day} style={{ borderBottom: "1px solid var(--divider)" }}>
                        <td style={{ padding: "12px", fontWeight: 500 }}>{s.day}</td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <Tag variant={s.score >= 85 ? "green" : "gray"}>{s.score}</Tag>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{formatSecondsToHours(s.duration)}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{s.efficiency}%</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{formatSecondsToHours(s.deep)}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{formatSecondsToHours(s.rem)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ⚡ READINESS TAB */}
            {activeTab === "readiness" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
                  gap: "24px"
                }}>
                  <Card>
                    <CardHeader title="Heart Rate Variability (HRV)" description="Indicator of autonomic balance" />
                    <CardContent>
                      <div style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getReadinessChartData()}>
                            <defs>
                              <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                            <XAxis dataKey="day" stroke="var(--text-4)" />
                            <YAxis stroke="var(--text-4)" />
                            <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)" }} />
                            <Area type="monotone" dataKey="HRV" stroke="var(--chart-2)" fillOpacity={1} fill="url(#colorHrv)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader title="Resting Heart Rate (RHR)" description="Overnight average lowest heart rate" />
                    <CardContent>
                      <div style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getReadinessChartData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                            <XAxis dataKey="day" stroke="var(--text-4)" />
                            <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke="var(--text-4)" />
                            <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)" }} />
                            <Line type="monotone" dataKey="RHR" stroke="var(--chart-4)" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <SectionHead title="Recovery Metrics Log" />
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  color: "var(--text-default)",
                  fontSize: "14px"
                }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--divider-strong)" }}>
                      <th style={{ textAlign: "left", padding: "12px" }}>Day</th>
                      <th style={{ textAlign: "center", padding: "12px" }}>Readiness</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Resting HR</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>HRV Avg</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Temp Deviation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.readiness.slice().reverse().map((r) => (
                      <tr key={r.day} style={{ borderBottom: "1px solid var(--divider)" }}>
                        <td style={{ padding: "12px", fontWeight: 500 }}>{r.day}</td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <Tag variant={r.score >= 80 ? "green" : "gray"}>{r.score}</Tag>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{r.rhr ? `${r.rhr} bpm` : "N/A"}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{r.hrv ? `${r.hrv} ms` : "N/A"}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{ color: r.temperature_deviation > 0.3 ? "var(--red)" : "var(--text-default)" }}>
                            {r.temperature_deviation > 0 ? `+${r.temperature_deviation}` : r.temperature_deviation}°C
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 🏃 ACTIVITY TAB */}
            {activeTab === "activity" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <Card>
                  <CardHeader title="Steps vs target progress" description="Weekly movement consistency" />
                  <CardContent>
                    <div style={{ height: "300px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getActivityChartData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                          <XAxis dataKey="day" stroke="var(--text-4)" />
                          <YAxis stroke="var(--text-4)" />
                          <Tooltip contentStyle={{ background: "var(--bg-app)", borderColor: "var(--divider)" }} />
                          <Bar dataKey="Steps" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <SectionHead title="Active Energy Burn & Steps Log" />
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  color: "var(--text-default)",
                  fontSize: "14px"
                }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--divider-strong)" }}>
                      <th style={{ textAlign: "left", padding: "12px" }}>Day</th>
                      <th style={{ textAlign: "center", padding: "12px" }}>Activity Score</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Steps</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Active Calories</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Total Calories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activity.slice().reverse().map((a) => (
                      <tr key={a.day} style={{ borderBottom: "1px solid var(--divider)" }}>
                        <td style={{ padding: "12px", fontWeight: 500 }}>{a.day}</td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <Tag variant={a.score >= 85 ? "green" : "gray"}>{a.score}</Tag>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{a.steps.toLocaleString()}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{a.active_calories} kcal</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>{a.total_calories} kcal</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ✨ INSIGHTS TAB */}
            {activeTab === "insights" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <AIVerdict
                  recommendation="Autonomic Recovery Status"
                  score={metrics ? metrics.readinessScore : 0}
                  summary="Our analysis engine has computed your health metrics correlation. Your sleep score consistency, step goals adherence, and heart rate variability curves show stable nervous system balance."
                />

                <SectionHead title="Refracted Findings" />
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {getInsights().map((insight, idx) => (
                    <AIFinding
                      key={idx}
                      variant={insight.variant === "success" ? "positive" : insight.variant === "info" ? "action" : "warn"}
                      title={insight.title}
                      body={insight.body}
                      cta={{ label: insight.cta }}
                    />
                  ))}
                  {getInsights().length === 0 && (
                    <Callout variant="info" icon="⚡">
                      Not enough data to calculate correlations. Please keep wearing your ring and trigger a sync.
                    </Callout>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Main>
    </AppShell>
  );
}

export default App;
