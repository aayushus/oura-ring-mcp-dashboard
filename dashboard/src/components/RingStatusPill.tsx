import React from "react";

interface RingStatusPillProps {
  ringInfo?: any;
  personalInfo?: any;
  lastSyncedTime?: string | null;
}

export function RingStatusPill({ ringInfo, personalInfo, lastSyncedTime }: RingStatusPillProps) {
  // If no hardware info available, render default connected status
  const model = ringInfo?.design || ringInfo?.hardware_type || "Oura Ring";
  const color = ringInfo?.color ? ringInfo.color.charAt(0).toUpperCase() + ringInfo.color.slice(1) : "";
  const battery = ringInfo?.battery_level ?? ringInfo?.battery_percentage ?? null;
  const firmware = ringInfo?.firmware_version || null;

  const batteryColor =
    battery === null
      ? "#8e929b"
      : battery > 50
      ? "#2ecc71"
      : battery > 20
      ? "#f1c40f"
      : "#e74c3c";

  return (
    <div
      className="ring-status-pill"
      title={`Oura Ring ${color ? `(${color})` : ""}${firmware ? ` • FW: ${firmware}` : ""}${
        lastSyncedTime ? ` • Synced at ${lastSyncedTime}` : ""
      }`}
    >
      <style>{`
        .ring-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 30px;
          padding: 0 10px;
          background: var(--bg-surface, rgba(255, 255, 255, 0.04));
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
          border-radius: var(--r-md, 8px);
          font-size: 12px;
          font-weight: 500;
          color: var(--text-2, rgba(235, 240, 248, 0.8));
          cursor: default;
          user-select: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .ring-status-pill:hover {
          border-color: var(--border-default, rgba(255, 255, 255, 0.16));
        }
        .ring-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${batteryColor};
          box-shadow: 0 0 6px ${batteryColor}80;
        }
        .ring-status-name {
          font-weight: 600;
          color: var(--text-1, #ffffff);
          letter-spacing: -0.2px;
        }
        .ring-status-battery {
          color: var(--text-3, rgba(235, 240, 248, 0.5));
          font-size: 11px;
        }
      `}</style>
      <span className="ring-status-dot" />
      <span className="ring-status-name">
        {model} {color ? `(${color})` : ""}
      </span>
      {battery !== null && (
        <span className="ring-status-battery">
          {battery}%
        </span>
      )}
    </div>
  );
}
