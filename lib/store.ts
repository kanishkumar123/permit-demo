"use client";

import { useSyncExternalStore } from "react";
import type { AppData, Masters, Vehicle } from "./types";

const KEY = "fleetdue:data:v1";

export const DEFAULT_MASTERS: Masters = {
  bus: { permit: { years: 5, months: 0 }, fc: { years: 1, months: 0 } },
  lorry: { permit: { years: 5, months: 0 }, fc: { years: 1, months: 0 } },
};

export function emptyData(): AppData {
  return {
    version: 1,
    vehicles: [],
    masters: structuredClone(DEFAULT_MASTERS),
    settings: { alertDays: 30 },
  };
}

/** Fill in anything missing so older or hand-edited data never crashes the UI. */
export function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AppData>;
  const masters = structuredClone(DEFAULT_MASTERS);
  for (const t of ["bus", "lorry"] as const) {
    for (const k of ["permit", "fc"] as const) {
      const d = r.masters?.[t]?.[k];
      if (d && Number.isFinite(d.years) && Number.isFinite(d.months)) masters[t][k] = { years: d.years, months: d.months };
    }
  }
  const alertDays = Number(r.settings?.alertDays);
  return {
    version: 1,
    vehicles: Array.isArray(r.vehicles)
      ? r.vehicles
          .filter((v): v is Vehicle => !!v && typeof v.plate === "string" && typeof v.id === "string")
          .map((v) => ({
            ...v,
            type: v.type === "lorry" ? "lorry" : "bus",
            ownerName: v.ownerName ?? "",
            ownerPhone: v.ownerPhone ?? "",
            permit: v.permit ? { ...v.permit, payments: v.permit.payments ?? [] } : undefined,
            fc: v.fc ? { ...v.fc, payments: v.fc.payments ?? [] } : undefined,
          }))
      : [],
    masters,
    settings: { alertDays: alertDays > 0 && alertDays <= 365 ? Math.round(alertDays) : 30 },
  };
}

let cache: { raw: string | null; data: AppData } | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): AppData {
  const raw = readRaw();
  if (cache && cache.raw === raw) return cache.data;
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  cache = { raw, data: normalize(parsed) };
  return cache.data;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns null during prerender / before hydration, then the stored data. */
export function useData(): AppData | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setData(next: AppData) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    throw new Error("Could not save — browser storage is full or blocked.");
  }
  cache = { raw, data: next };
  listeners.forEach((l) => l());
}

export function updateData(fn: (d: AppData) => AppData) {
  setData(fn(getSnapshot()));
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
