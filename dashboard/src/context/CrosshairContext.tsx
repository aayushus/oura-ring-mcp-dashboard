import React, { createContext, useContext, useState, useCallback } from "react";

export type HoverKind = "day" | "time" | null;

export interface HoverState {
  kind: HoverKind;
  value: string | null; // e.g. "2026-03-03" or "14:15"
}

interface CrosshairContextType {
  hover: HoverState;
  setHoverState: (kind: HoverKind, value: string | null) => void;
}

const CrosshairContext = createContext<CrosshairContextType | undefined>(undefined);

export function CrosshairProvider({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState<HoverState>({ kind: null, value: null });

  const setHoverState = useCallback((kind: HoverKind, value: string | null) => {
    setHover((prev) => {
      // Prevent unnecessary state updates if it hasn't changed
      if (prev.kind === kind && prev.value === value) {
        return prev;
      }
      return { kind, value };
    });
  }, []);

  return (
    <CrosshairContext.Provider value={{ hover, setHoverState }}>
      {children}
    </CrosshairContext.Provider>
  );
}

export function useCrosshair() {
  const context = useContext(CrosshairContext);
  if (!context) {
    throw new Error("useCrosshair must be used within a CrosshairProvider");
  }
  return context;
}
