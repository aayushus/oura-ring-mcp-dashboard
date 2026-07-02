import React, { useEffect, useState } from "react";

export function WeeklyReportView() {
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        setError(null);
        
        // Parallel fetch of weekly recaps and general summary
        const [wRes, sRes] = await Promise.all([
          fetch("/api/dashboard/weekly"),
          fetch("/api/dashboard/summary"),
        ]);

        if (!wRes.ok || !sRes.ok) {
          throw new Error("Failed to load weekly report data");
        }

        const [wJson, sJson] = await Promise.all([wRes.json(), sRes.json()]);
        setWeeklyData(wJson);
        setSummaryData(sJson);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, []);

  useEffect(() => {
    // Automatically trigger browser print dialog once content renders
    if (weeklyData && summaryData) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [weeklyData, summaryData]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Generating Print-Perfect Report...</h2>
        <p>Please wait a moment.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", color: "red", fontFamily: "sans-serif" }}>
        <h2>Report Generation Failed</h2>
        <p>{error}</p>
      </div>
    );
  }

  const { averages, narrative } = weeklyData;
  const sleepList = summaryData.sleep.slice(-7);
  const readinessList = summaryData.readiness.slice(-7);
  const activityList = summaryData.activity.slice(-7);

  return (
    <div className="print-report-container" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", background: "#FFFFFF", color: "#000000", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Dynamic CSS override for printing */}
      <style>{`
        @media print {
          body, html, #root, .print-report-container {
            background: #FFFFFF !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #DDDDDD !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
        .print-report-container h1, .print-report-container h2, .print-report-container h3 {
          color: #000000;
        }
        .print-card {
          border: 1px solid #EAEAEA;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          background: #FFFFFF;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border-bottom: 1px solid #EEEEEE;
          padding: 10px 8px;
          text-align: left;
          font-size: 0.85rem;
        }
        th {
          font-weight: 600;
          color: #666666;
        }
      `}</style>

      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #000000", paddingBottom: "12px", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.5px" }}>OURA HEALTH REPORT</h1>
          <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>WEEKLY SUMMARY PROTOCOL</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Narrative Section */}
      <div className="print-card">
        <h2 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", fontWeight: 700, borderBottom: "1px solid #EEEEEE", paddingBottom: "6px" }}>Weekly AI Narrative Recap</h2>
        <p style={{ fontSize: "0.9rem", lineHeight: "1.5", margin: 0, color: "#222222" }}>
          {narrative || "No narrative generated for this period."}
        </p>
      </div>

      {/* Averages Summary Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
        <div className="print-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: "0.75rem", color: "#666666", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Sleep Average</span>
          <span style={{ fontSize: "2rem", fontWeight: 800 }}>{Math.round(averages.sleep)}</span>
          <span style={{ fontSize: "0.75rem", display: "block", color: "#666666" }}>Target: 85+</span>
        </div>
        <div className="print-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: "0.75rem", color: "#666666", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Readiness Average</span>
          <span style={{ fontSize: "2rem", fontWeight: 800 }}>{Math.round(averages.readiness)}</span>
          <span style={{ fontSize: "0.75rem", display: "block", color: "#666666" }}>Target: 85+</span>
        </div>
        <div className="print-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: "0.75rem", color: "#666666", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Activity Average</span>
          <span style={{ fontSize: "2rem", fontWeight: 800 }}>{Math.round(averages.activity)}</span>
          <span style={{ fontSize: "0.75rem", display: "block", color: "#666666" }}>Target: 85+</span>
        </div>
      </div>

      {/* Daily Metrics Breakdown Table */}
      <div className="print-card">
        <h2 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", fontWeight: 700, borderBottom: "1px solid #EEEEEE", paddingBottom: "6px" }}>7-Day History Table</h2>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Sleep Score</th>
              <th>Readiness Score</th>
              <th>Activity Score</th>
              <th>HRV Average</th>
              <th>Resting HR</th>
            </tr>
          </thead>
          <tbody>
            {readinessList.map((row: any, idx: number) => {
              const sleepRow = sleepList[idx] || {};
              const activityRow = activityList[idx] || {};
              return (
                <tr key={row.day}>
                  <td style={{ fontWeight: 600 }}>{row.day}</td>
                  <td>{sleepRow.score || "—"}</td>
                  <td>{row.score || "—"}</td>
                  <td>{activityRow.score || "—"}</td>
                  <td>{row.hrv ? `${row.hrv} ms` : "—"}</td>
                  <td>{row.rhr ? `${row.rhr} bpm` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Print Trigger Button (Visible only on screen, hidden on print) */}
      <div className="no-print" style={{ marginTop: "30px", textAlign: "center" }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 24px",
            background: "#000000",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Print Report
        </button>
      </div>
    </div>
  );
}
