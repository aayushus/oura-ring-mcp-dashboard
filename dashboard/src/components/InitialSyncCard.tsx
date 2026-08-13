import React from "react";

interface InitialSyncCardProps {
  onSync: () => void;
  syncing: boolean;
}

export function InitialSyncCard({ onSync, syncing }: InitialSyncCardProps) {
  return (
    <div className="initial-sync-card">
      <style>{`
        .initial-sync-card {
          background: radial-gradient(circle at top right, rgba(181, 95, 230, 0.12) 0%, rgba(20, 22, 29, 0.7) 100%);
          border: 1px solid rgba(181, 95, 230, 0.25);
          border-radius: 20px;
          padding: 32px;
          text-align: center;
          margin-bottom: 28px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
        }
        .sync-ring-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid #b55fe6;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(181, 95, 230, 0.5);
          animation: pulseRing 2s infinite ease-in-out;
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); box-shadow: 0 0 15px rgba(181, 95, 230, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 25px rgba(181, 95, 230, 0.7); }
        }
        .initial-sync-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
          letter-spacing: -0.3px;
        }
        .initial-sync-desc {
          font-size: 14px;
          color: rgba(235, 240, 248, 0.65);
          max-width: 440px;
          margin: 0 auto 24px;
          line-height: 1.5;
        }
        .initial-sync-btn {
          background: linear-gradient(135deg, #b55fe6 0%, #e65fa8 100%);
          border: none;
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 600;
          border-radius: 12px;
          padding: 12px 24px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px rgba(181, 95, 230, 0.3);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .initial-sync-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(181, 95, 230, 0.45);
        }
        .initial-sync-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
      <div className="sync-ring-icon">
        <img src="/dashboard/favicon.svg" alt="Oura Ring" style={{ width: "24px", height: "24px" }} />
      </div>
      <h2 className="initial-sync-title">Your Oura Ring is Connected!</h2>
      <p className="initial-sync-desc">
        Start your first historical backfill to download your past 365 days of sleep, readiness, HRV, and activity
        biometrics from Oura Cloud.
      </p>
      <button className="initial-sync-btn" onClick={onSync} disabled={syncing}>
        {syncing ? "Syncing 365 Days of Biometrics..." : "⚡ Start 365-Day Historical Sync"}
      </button>
    </div>
  );
}
