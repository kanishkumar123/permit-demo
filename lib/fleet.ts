import { computeExpiry, daysBetween, statusFor } from "./dates";
import { uid, updateData } from "./store";
import type { AppData, DocKind, DocRecord, Status, Vehicle, VehicleType } from "./types";

export interface DueEntry {
  vehicle: Vehicle;
  kind: DocKind;
  doc: DocRecord;
  daysLeft: number;
  status: Status;
}

export function dueEntries(data: AppData, today: string): DueEntry[] {
  const out: DueEntry[] = [];
  for (const vehicle of data.vehicles) {
    for (const kind of ["permit", "fc"] as const) {
      const doc = vehicle[kind];
      if (!doc) continue;
      const daysLeft = daysBetween(today, doc.expiryDate);
      out.push({ vehicle, kind, doc, daysLeft, status: statusFor(daysLeft, data.settings.alertDays) });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

const STATUS_RANK: Record<Status, number> = { expired: 0, critical: 1, soon: 2, valid: 3 };

/** The most urgent status across a vehicle's documents (null when it has none). */
export function worstStatus(entries: DueEntry[]): Status | null {
  return entries.reduce<Status | null>(
    (worst, e) => (worst === null || STATUS_RANK[e.status] < STATUS_RANK[worst] ? e.status : worst),
    null,
  );
}

export function plateKey(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function cleanPlate(plate: string): string {
  return plate.toUpperCase().replace(/\s+/g, " ").trim();
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export function totalPaid(v: Vehicle): number {
  return [v.permit, v.fc].reduce((sum, d) => sum + (d?.payments.reduce((s, p) => s + p.amount, 0) ?? 0), 0);
}

export interface DocInput {
  issueDate: string;
  expiryDate: string;
  amount: number | null;
}

function newDoc(input: DocInput): DocRecord {
  return {
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    payments:
      input.amount != null && input.amount > 0
        ? [
            {
              id: uid(),
              date: input.issueDate,
              amount: input.amount,
              kind: "issue",
              validFrom: input.issueDate,
              validTo: input.expiryDate,
            },
          ]
        : [],
  };
}

export interface VehicleInput {
  plate: string;
  type: VehicleType;
  ownerName: string;
  ownerPhone: string;
}

export function addVehicle(input: VehicleInput, docs: Partial<Record<DocKind, DocInput>>): string {
  const id = uid();
  updateData((d) => ({
    ...d,
    vehicles: [
      {
        id,
        ...input,
        plate: cleanPlate(input.plate),
        permit: docs.permit ? newDoc(docs.permit) : undefined,
        fc: docs.fc ? newDoc(docs.fc) : undefined,
        createdAt: new Date().toISOString(),
      },
      ...d.vehicles,
    ],
  }));
  return id;
}

function patchVehicle(id: string, fn: (v: Vehicle) => Vehicle) {
  updateData((d) => ({ ...d, vehicles: d.vehicles.map((v) => (v.id === id ? fn(v) : v)) }));
}

export function updateVehicle(id: string, input: VehicleInput) {
  patchVehicle(id, (v) => ({ ...v, ...input, plate: cleanPlate(input.plate) }));
}

export function deleteVehicle(id: string) {
  updateData((d) => ({ ...d, vehicles: d.vehicles.filter((v) => v.id !== id) }));
}

/** Add a document, or correct the dates of an existing one without logging a payment. */
export function saveDoc(id: string, kind: DocKind, input: DocInput) {
  patchVehicle(id, (v) => {
    const existing = v[kind];
    if (!existing) return { ...v, [kind]: newDoc(input) };
    return { ...v, [kind]: { ...existing, issueDate: input.issueDate, expiryDate: input.expiryDate } };
  });
}

export function removeDoc(id: string, kind: DocKind) {
  patchVehicle(id, (v) => ({ ...v, [kind]: undefined }));
}

export function renewDoc(id: string, kind: DocKind, renewalDate: string, expiryDate: string, amount: number | null) {
  patchVehicle(id, (v) => {
    const prev = v[kind];
    const payments = prev?.payments ?? [];
    return {
      ...v,
      [kind]: {
        issueDate: renewalDate,
        expiryDate,
        payments:
          amount != null && amount > 0
            ? [
                ...payments,
                { id: uid(), date: renewalDate, amount, kind: "renewal", validFrom: renewalDate, validTo: expiryDate },
              ]
            : payments,
      },
    };
  });
}

export function deletePayment(id: string, kind: DocKind, paymentId: string) {
  patchVehicle(id, (v) => {
    const doc = v[kind];
    if (!doc) return v;
    return { ...v, [kind]: { ...doc, payments: doc.payments.filter((p) => p.id !== paymentId) } };
  });
}

export function expiryFor(data: AppData, type: VehicleType, kind: DocKind, from: string): string {
  return computeExpiry(from, data.masters[type][kind]);
}
