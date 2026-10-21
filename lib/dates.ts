import type { Duration, Status } from "./types";

const DAY = 86_400_000;

/** Parse YYYY-MM-DD as a UTC midnight timestamp, so day maths never drifts with time zones. */
function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function todayISO(): string {
  const now = new Date();
  return fromUTC(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function isValidISO(iso: string | undefined): iso is string {
  return !!iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(toUTC(iso));
}

/**
 * Validity end for a document issued on `from` with the given duration.
 * Follows the RTO convention: issued 12-03-2024 for 5 years → valid up to 11-03-2029.
 */
export function computeExpiry(from: string, duration: Duration): string {
  const [y, m, d] = from.split("-").map(Number);
  const totalMonths = m - 1 + duration.years * 12 + duration.months;
  const ty = y + Math.floor(totalMonths / 12);
  const tm = totalMonths % 12;
  // Clamp to the month's last day (e.g. 31 Jan + 1 month → 28/29 Feb).
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const target = Date.UTC(ty, tm, Math.min(d, lastDay));
  return fromUTC(target - DAY);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / DAY);
}

export function statusFor(daysLeft: number, alertDays: number): Status {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= alertDays) return "soon";
  return "valid";
}

export function formatDate(iso: string): string {
  return new Date(toUTC(iso)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDuration({ years, months }: Duration): string {
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (months) parts.push(`${months} mo${months > 1 ? "s" : ""}`);
  return parts.join(" ") || "Not set";
}

export function describeDays(days: number): string {
  if (days < 0) {
    const n = -days;
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** First day of the month `offset` months after `iso`, as YYYY-MM. */
export function monthKey(iso: string, offset = 0): string {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + offset;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });
}
