"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownUp, Bus, ChevronRight, Plus, Search, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { daysBetween, describeDays, formatDate, statusFor } from "@/lib/dates";
import { dueEntries, formatMoney, plateKey, totalPaid, worstStatus, type DueEntry } from "@/lib/fleet";
import type { DocKind, Status, Vehicle, VehicleType } from "@/lib/types";
import { useFleet, useUI } from "../fleet-context";
import { Button, Card, cn, EmptyState, PageHeader, Plate, Segmented, STATUS_META, StatusPill } from "../ui";

type StatusFilter = "all" | "attention" | "expired" | "valid";
type Sort = "urgent" | "plate" | "recent";

const SORT_LABEL: Record<Sort, string> = { urgent: "Most urgent", plate: "Plate A–Z", recent: "Recently added" };

interface Row {
  vehicle: Vehicle;
  entries: DueEntry[];
  worst: Status | null;
  minDays: number;
}

export function VehiclesView() {
  const { data, today } = useFleet();
  const ui = useUI();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | VehicleType>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("urgent");

  const rows = useMemo<Row[]>(() => {
    const byVehicle = new Map<string, DueEntry[]>();
    dueEntries(data, today).forEach((e) => byVehicle.set(e.vehicle.id, [...(byVehicle.get(e.vehicle.id) ?? []), e]));
    return data.vehicles.map((vehicle) => {
      const entries = byVehicle.get(vehicle.id) ?? [];
      return {
        vehicle,
        entries,
        worst: worstStatus(entries),
        minDays: entries.length ? Math.min(...entries.map((e) => e.daysLeft)) : Infinity,
      };
    });
  }, [data, today]);

  const q = query.trim().toLowerCase();
  const qPlate = plateKey(query);
  const filtered = rows
    .filter(({ vehicle: v, worst }) => {
      if (type !== "all" && v.type !== type) return false;
      if (status === "attention" && (worst === null || worst === "valid")) return false;
      if (status === "expired" && worst !== "expired") return false;
      if (status === "valid" && worst !== "valid") return false;
      if (!q) return true;
      return (
        (qPlate && plateKey(v.plate).includes(qPlate)) ||
        v.ownerName.toLowerCase().includes(q) ||
        v.ownerPhone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000")
      );
    })
    .sort((a, b) =>
      sort === "plate"
        ? a.vehicle.plate.localeCompare(b.vehicle.plate)
        : sort === "recent"
          ? b.vehicle.createdAt.localeCompare(a.vehicle.createdAt)
          : a.minDays - b.minDays,
    );

  const nextSort = () => setSort(sort === "urgent" ? "plate" : sort === "plate" ? "recent" : "urgent");

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle={`${data.vehicles.length} registered · ${rows.filter((r) => r.worst && r.worst !== "valid").length} need attention`}
        actionsClassName="max-md:hidden"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => ui.openVehicleForm()}>
            Add vehicle
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plate, owner or phone"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-10 pl-10 text-[15px] shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-accent/12 sm:text-sm"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-ink/5 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:mx-0 xl:px-0">
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "All" },
              { value: "bus", label: <><Bus className="size-4" />Bus</> },
              { value: "lorry", label: <><Truck className="size-4" />Lorry</> },
            ]}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Any status" },
              { value: "attention", label: "Due" },
              { value: "expired", label: "Expired" },
              { value: "valid", label: "Valid" },
            ]}
          />
          <Button variant="secondary" className="shrink-0" icon={<ArrowDownUp className="size-4" />} onClick={nextSort}>
            {SORT_LABEL[sort]}
          </Button>
        </div>
      </div>

      {data.vehicles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck className="size-6" />}
            title="No vehicles yet"
            body="Add a bus or lorry to start tracking its Permit and FC."
            action={<Button onClick={() => ui.openVehicleForm()}>Add vehicle</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<Search className="size-6" />} title="No matches" body="Try a different search or clear the filters." />
        </Card>
      ) : (
        <>
          {/* Tablet & desktop: table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/70 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  <th className="py-3 pr-3 pl-5 font-semibold">Vehicle</th>
                  <th className="px-3 py-3 font-semibold">Permit</th>
                  <th className="px-3 py-3 font-semibold">FC</th>
                  <th className="hidden px-3 py-3 text-right font-semibold lg:table-cell">Paid</th>
                  <th className="w-10 py-3 pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {filtered.map((r) => (
                    <motion.tr
                      key={r.vehicle.id}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => ui.openDetail(r.vehicle.id)}
                      className="group cursor-pointer transition-colors hover:bg-surface-2"
                    >
                      <td className="py-3.5 pr-3 pl-5">
                        <div className="flex items-center gap-3">
                          <TypeIcon type={r.vehicle.type} />
                          <div className="min-w-0">
                            <Plate plate={r.vehicle.plate} />
                            <p className="mt-1 max-w-[180px] truncate text-xs text-ink-3">{r.vehicle.ownerName || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5"><DocCell vehicle={r.vehicle} kind="permit" /></td>
                      <td className="px-3 py-3.5"><DocCell vehicle={r.vehicle} kind="fc" /></td>
                      <td className="hidden px-3 py-3.5 text-right font-medium text-ink-2 tabular lg:table-cell">
                        {formatMoney(totalPaid(r.vehicle))}
                      </td>
                      <td className="py-3.5 pr-4">
                        <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </Card>

          {/* Phone: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            <AnimatePresence initial={false}>
              {filtered.map((r, i) => (
                <motion.li
                  key={r.vehicle.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    type="button"
                    onClick={() => ui.openDetail(r.vehicle.id)}
                    className={cn(
                      "w-full rounded-2xl border bg-surface p-4 text-left shadow-card transition-transform active:scale-[0.99]",
                      r.worst === "expired" ? "border-expired/30" : "border-line",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <TypeIcon type={r.vehicle.type} />
                      <div className="min-w-0 flex-1">
                        <Plate plate={r.vehicle.plate} />
                        <p className="mt-1 truncate text-xs text-ink-3">{r.vehicle.ownerName || "No owner name"}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-ink-3" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(["permit", "fc"] as const).map((kind) => (
                        <MiniDoc key={kind} vehicle={r.vehicle} kind={kind} />
                      ))}
                    </div>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </>
  );
}

function TypeIcon({ type }: { type: VehicleType }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl",
        type === "bus" ? "bg-accent-soft text-accent" : "bg-[#fff4e5] text-[#c26a00]",
      )}
      title={type === "bus" ? "Bus" : "Lorry"}
    >
      {type === "bus" ? <Bus className="size-5" /> : <Truck className="size-5" />}
    </span>
  );
}

function useDocState(vehicle: Vehicle, kind: DocKind) {
  const { data, today } = useFleet();
  const doc = vehicle[kind];
  if (!doc) return null;
  const days = daysBetween(today, doc.expiryDate);
  return { doc, days, status: statusFor(days, data.settings.alertDays) };
}

function DocCell({ vehicle, kind }: { vehicle: Vehicle; kind: DocKind }) {
  const ui = useUI();
  const s = useDocState(vehicle, kind);
  if (!s) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          ui.openDocForm(vehicle.id, kind);
        }}
        className="rounded-lg border border-dashed border-line-strong px-2.5 py-1 text-xs font-medium text-ink-3 transition-colors hover:border-accent hover:text-accent"
      >
        + Add
      </button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusPill status={s.status}>{describeDays(s.days)}</StatusPill>
      <span className="pl-1 text-xs text-ink-3 tabular">{formatDate(s.doc.expiryDate)}</span>
    </div>
  );
}

function MiniDoc({ vehicle, kind }: { vehicle: Vehicle; kind: DocKind }) {
  const s = useDocState(vehicle, kind);
  const label = kind === "permit" ? "Permit" : "FC";
  if (!s) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-3 py-2">
        <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
        <p className="mt-0.5 text-xs text-ink-3">Not added</p>
      </div>
    );
  }
  const m = STATUS_META[s.status];
  return (
    <div className={cn("rounded-xl px-3 py-2", m.bg)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
        <span className={cn("size-1.5 rounded-full", m.dot)} />
        {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-semibold tabular", m.text)}>{describeDays(s.days)}</p>
      <p className="text-[11px] text-ink-3 tabular">{formatDate(s.doc.expiryDate)}</p>
    </div>
  );
}
