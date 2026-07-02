import React, { useState, useEffect, useRef } from "react";
import type { TabKey } from "../types";

interface CommandItem {
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  active: boolean;
  onClose: () => void;
  setActiveTab: (tab: TabKey) => void;
}

export function CommandPalette({ active, onClose, setActiveTab }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Command database
  const commands: CommandItem[] = [
    { label: "Go to Overview (Home)", category: "Navigation", shortcut: "G O", action: () => setActiveTab("home") },
    { label: "Go to Sleep Analysis", category: "Navigation", shortcut: "G S", action: () => setActiveTab("sleep") },
    { label: "Go to Readiness Recovery", category: "Navigation", shortcut: "G R", action: () => setActiveTab("readiness") },
    { label: "Go to Activity Training", category: "Navigation", shortcut: "G A", action: () => setActiveTab("activity") },
    { label: "Go to Heart Rate & HRV Vitals", category: "Navigation", shortcut: "G H", action: () => setActiveTab("heart") },
    { label: "Go to Stress & Resilience Tracker", category: "Navigation", shortcut: "G T", action: () => setActiveTab("stress") },
    { label: "Go to Cardiovascular Health", category: "Navigation", shortcut: "G C", action: () => setActiveTab("cardio") },
    { label: "Go to Workouts & Sessions", category: "Navigation", shortcut: "G W", action: () => setActiveTab("workouts") },
    { label: "Go to Tag Correlation Lab", category: "Navigation", shortcut: "G L", action: () => setActiveTab("correlation") },
    { label: "Go to Self-Experiments Adherence", category: "Navigation", shortcut: "G E", action: () => setActiveTab("experiments") },
    { label: "Go to Anomaly Alerts Feed", category: "Navigation", shortcut: "G N", action: () => setActiveTab("anomalies") },
    { label: "Go to 24h Aligned Day-Strip", category: "Navigation", shortcut: "G D", action: () => setActiveTab("daystrip") },
    { label: "Go to Onboarding Settings", category: "Navigation", shortcut: "G I", action: () => setActiveTab("settings") },
    {
      label: "Toggle Light / Dark Theme",
      category: "Appearance",
      shortcut: "T T",
      action: () => {
        const curr = document.documentElement.getAttribute("data-theme") || "dark";
        const next = curr === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("oura-dashboard-theme", next);
      },
    },
    {
      label: "Export Personal Vitals Data (JSON)",
      category: "Data Portability",
      shortcut: "E J",
      action: () => window.open("/api/dashboard/export?format=json", "_blank"),
    },
    {
      label: "Export Personal Vitals Data (CSV)",
      category: "Data Portability",
      shortcut: "E C",
      action: () => window.open("/api/dashboard/export?format=csv", "_blank"),
    },
  ];

  // Open & Focus listener
  useEffect(() => {
    if (active) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [active]);

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, query, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(".active-palette-item");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Filter logic (Fuzzy search + date jump check)
  const isDateJump = /^\d{4}-\d{2}-\d{2}$/.test(query.trim());
  
  const filtered = isDateJump
    ? [
        {
          label: `Jump to Date: ${query.trim()}`,
          category: "Actions",
          action: () => {
            alert(`Jumping to date: ${query.trim()}`);
          },
        },
      ]
    : commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
      );

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "var(--bg-card)",
          borderRadius: "16px",
          border: "1px solid var(--divider-strong)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px", borderBottom: "1px solid var(--divider)" }}>
          <span style={{ fontSize: "1.2rem", opacity: 0.5, marginRight: "12px" }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, category name, or date (YYYY-MM-DD)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text-default)",
              fontSize: "1.05rem",
              fontFamily: "var(--f-sans)",
            }}
          />
        </div>

        {/* Search results list */}
        <div
          ref={listRef}
          style={{
            maxHeight: "360px",
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-3)", fontSize: "0.9rem" }}>
              No commands found. Try searching for "Sleep" or "Export".
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={idx}
                  className={isSelected ? "active-palette-item" : ""}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: isSelected ? "var(--bg-hover)" : "transparent",
                    color: isSelected ? "var(--text-default)" : "var(--text-2)",
                    transition: "background 80ms var(--ease)",
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: "0.95rem" }}>{cmd.label}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{cmd.category}</span>
                  </div>
                  {cmd.shortcut && (
                    <div style={{ display: "flex", gap: "4px" }}>
                      {cmd.shortcut.split(" ").map((char, cIdx) => (
                        <kbd
                          key={cIdx}
                          style={{
                            fontFamily: "var(--f-sans)",
                            fontSize: "0.75rem",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--divider-strong)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            color: "var(--text-3)",
                          }}
                        >
                          {char}
                        </kbd>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info strip */}
        <div
          style={{
            padding: "10px 16px",
            background: "var(--bg-elevated)",
            borderTop: "1px solid var(--divider)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--text-3)",
          }}
        >
          <span>Use <kbd>↑</kbd><kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
