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
          background: var(--bg-card);
          border: 1px solid var(--divider-strong, rgba(181, 95, 230, 0.25));
          border-radius: 20px;
          padding: 32px;
          text-align: center;
          margin-bottom: 28px;
          box-shadow: var(--shadow-float, 0 12px 32px rgba(0, 0, 0, 0.2));
        }
        .sync-ring-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid var(--accent, #b55fe6);
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px var(--accent-bg, rgba(181, 95, 230, 0.3));
          animation: pulseRing 2s infinite ease-in-out;
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); box-shadow: 0 0 15px rgba(181, 95, 230, 0.2); }
          50% { transform: scale(1.05); box-shadow: 0 0 25px rgba(181, 95, 230, 0.5); }
        }
        .initial-sync-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-default);
          margin-bottom: 8px;
          letter-spacing: -0.3px;
        }
        .initial-sync-desc {
          font-size: 14px;
          color: var(--text-2);
          max-width: 440px;
          margin: 0 auto 24px;
          line-height: 1.5;
        }
        .initial-sync-btn {
          background: var(--accent, #b55fe6);
          border: none;
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 600;
          border-radius: 12px;
          padding: 12px 24px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .initial-sync-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
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
        Start your first historical backfill to download your complete history of sleep, readiness, HRV, stress, and activity
        biometrics from Day 1 of wearing your Oura Ring.
      </p>
      <button className="initial-sync-btn" onClick={onSync} disabled={syncing}>
        {syncing ? "Syncing All Historical Biometrics..." : "⚡ Sync All Biometrics (From Day 1)"}
      </button>
    </div>
  );
}
