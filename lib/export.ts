import { daysBetween, statusFor } from "./dates";
import { totalPaid } from "./fleet";
import { normalize } from "./store";
import type { AppData, DocRecord } from "./types";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBackup(data: AppData, today: string) {
  download(`fleetdue-backup-${today}.json`, JSON.stringify(data, null, 2), "application/json");
}

/** Parses and validates a backup file; throws a readable error on bad input. */
export async function readBackup(file: File): Promise<AppData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as AppData).vehicles)) {
    throw new Error("That file doesn't look like a FleetDue backup.");
  }
  return normalize(parsed);
}

const STATUS_TEXT = { expired: "Expired", critical: "Due in 7 days", soon: "Due soon", valid: "Valid" };

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCSV(data: AppData, today: string) {
  const docCols = (d: DocRecord | undefined) => {
    if (!d) return ["", "", "", "Not added"];
    const left = daysBetween(today, d.expiryDate);
    return [d.issueDate, d.expiryDate, left, STATUS_TEXT[statusFor(left, data.settings.alertDays)]];
  };
  const header = [
    "Plate", "Type", "Owner", "Phone",
    "Permit issued", "Permit expiry", "Permit days left", "Permit status",
    "FC issued", "FC expiry", "FC days left", "FC status",
    "Total paid (INR)",
  ];
  const rows = data.vehicles.map((v) => [
    v.plate, v.type === "bus" ? "Bus" : "Lorry", v.ownerName, v.ownerPhone,
    ...docCols(v.permit), ...docCols(v.fc), totalPaid(v),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel opens it as UTF-8.
  download(`fleetdue-vehicles-${today}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
}
