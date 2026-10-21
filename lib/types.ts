export type VehicleType = "bus" | "lorry";
export type DocKind = "permit" | "fc";

export interface Duration {
  years: number;
  months: number;
}

export type Masters = Record<VehicleType, Record<DocKind, Duration>>;

export interface Payment {
  id: string;
  /** Date the fee was paid (YYYY-MM-DD). */
  date: string;
  amount: number;
  kind: "issue" | "renewal";
  validFrom: string;
  validTo: string;
}

export interface DocRecord {
  issueDate: string;
  expiryDate: string;
  payments: Payment[];
}

export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  ownerName: string;
  ownerPhone: string;
  permit?: DocRecord;
  fc?: DocRecord;
  createdAt: string;
}

export interface Settings {
  alertDays: number;
}

export interface AppData {
  version: 1;
  vehicles: Vehicle[];
  masters: Masters;
  settings: Settings;
}

export type Status = "expired" | "critical" | "soon" | "valid";

export const DOC_LABEL: Record<DocKind, string> = { permit: "Permit", fc: "FC" };
export const TYPE_LABEL: Record<VehicleType, string> = { bus: "Bus", lorry: "Lorry" };
