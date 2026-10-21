"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { todayISO } from "@/lib/dates";
import { useData } from "@/lib/store";
import type { AppData, DocKind } from "@/lib/types";

type Fleet = { data: AppData; today: string };

const FleetContext = createContext<Fleet | null>(null);

export function useFleet(): Fleet {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used inside <FleetGate>");
  return ctx;
}

/** Renders `fallback` until localStorage has been read in the browser. */
export function FleetGate({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const data = useData();
  if (!data) return fallback;
  return <FleetContext.Provider value={{ data, today: todayISO() }}>{children}</FleetContext.Provider>;
}

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}

interface UIState {
  detailId: string | null;
  vehicleForm: { id?: string } | null;
  docForm: { vehicleId: string; kind: DocKind } | null;
  renew: { vehicleId: string; kind: DocKind } | null;
  confirm: ConfirmOptions | null;
}

interface UIActions {
  openDetail: (id: string) => void;
  openVehicleForm: (id?: string) => void;
  openDocForm: (vehicleId: string, kind: DocKind) => void;
  openRenew: (vehicleId: string, kind: DocKind) => void;
  askConfirm: (opts: ConfirmOptions) => void;
  close: (key: keyof UIState) => void;
}

const UIContext = createContext<(UIState & UIActions) | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UIState>({
    detailId: null,
    vehicleForm: null,
    docForm: null,
    renew: null,
    confirm: null,
  });

  const close = useCallback((key: keyof UIState) => setState((s) => ({ ...s, [key]: null })), []);

  const value = useMemo(
    () => ({
      ...state,
      close,
      openDetail: (id: string) => setState((s) => ({ ...s, detailId: id })),
      openVehicleForm: (id?: string) => setState((s) => ({ ...s, vehicleForm: { id } })),
      openDocForm: (vehicleId: string, kind: DocKind) => setState((s) => ({ ...s, docForm: { vehicleId, kind } })),
      openRenew: (vehicleId: string, kind: DocKind) => setState((s) => ({ ...s, renew: { vehicleId, kind } })),
      askConfirm: (opts: ConfirmOptions) => setState((s) => ({ ...s, confirm: opts })),
    }),
    [state, close],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
