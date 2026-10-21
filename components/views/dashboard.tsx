"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Bus, CalendarClock, ChevronDown, Clock, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { formatDate, monthKey, monthLabel } from "@/lib/dates";
import { dueEntries, type DueEntry } from "@/lib/fleet";
import { DOC_LABEL, type DocKind, type Status, type VehicleType } from "@/lib/types";
import { useFleet, useUI } from "../fleet-context";
import { Button, Card, cn, DaysPill, DaysRing, EmptyState, Plate, Segmented, STATUS_META } from "../ui";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type Focus = "all" | "expired" | "critical" | "soon";

export function Dashboard() {
  const { data, today } = useFleet();
  const ui = useUI();
  const entries = useMemo(() => dueEntries(data, today), [data, today]);
  const [focus, setFocus] = useState<Focus>("all");

  const counts = useMemo(() => {
    const c: Record<Status, number> = { expired: 0, critical: 0, soon: 0, valid: 0 };
    entries.forEach((e) => c[e.status]++);
    return c;
  }, [entries]);

  const buses = data.vehicles.filter((v) => v.type === "bus").length;
  const lorries = data.vehicles.length - buses;

  if (data.vehicles.length === 0) {
    return (
      <>
        <Header today={today} />
        <Card>
          <EmptyState
            icon={<Truck className="size-6" />}
            title="Add your first vehicle"
            body="Register a bus or lorry with its Permit and FC. FleetDue will count down to each renewal and surface what's due first."
            action={<Button onClick={() => ui.openVehicleForm()}>Add vehicle</Button>}
          />
        </Card>
      </>
    );
  }

  const tiles: { key: Focus; label: string; value: number; sub: string; icon: ReactNode; tone: string }[] = [
    {
      key: "expired",
      label: "Overdue",
      value: counts.expired,
      sub: counts.expired ? "Renew immediately" : "Nothing overdue",
      icon: <AlertTriangle className="size-[18px]" />,
      tone: "text-expired bg-expired-soft",
    },
    {
      key: "critical",
      label: "Due in 7 days",
      value: counts.critical,
      sub: "This week",
      icon: <Clock className="size-[18px]" />,
      tone: "text-critical bg-critical-soft",
    },
    {
      key: "soon",
      label: `Due in ${data.settings.alertDays} days`,
      value: counts.soon,
      sub: "Plan ahead",
      icon: <CalendarClock className="size-[18px]" />,
      tone: "text-soon bg-soon-soft",
    },
    {
      key: "all",
      label: "Vehicles",
      value: data.vehicles.length,
      sub: `${buses} bus${buses === 1 ? "" : "es"} · ${lorries} ${lorries === 1 ? "lorry" : "lorries"}`,
      icon: <Truck className="size-[18px]" />,
      tone: "text-accent bg-accent-soft",
    },
  ];

  return (
    <>
      <Header today={today} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tiles.map((t, i) => {
          const active = focus === t.key && t.key !== "all";
          return (
            <motion.button
              key={t.key}
              type="button"
              {...fadeUp}
              transition={{ delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFocus(focus === t.key ? "all" : t.key)}
              className={cn(
                "relative flex flex-col items-start rounded-2xl border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] hover:shadow-lift sm:p-5",
                active ? "border-ink/80 ring-4 ring-ink/5" : "border-line",
              )}
            >
              <span className={cn("grid size-9 place-items-center rounded-xl", t.tone)}>{t.icon}</span>
              <span className="mt-4 text-[28px] leading-none font-semibold tracking-tight text-ink tabular sm:text-[32px]">{t.value}</span>
              <span className="mt-2 text-[13px] font-medium text-ink">{t.label}</span>
              <span className="mt-0.5 text-xs text-ink-3">{t.sub}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <Upcoming entries={entries} focus={focus} setFocus={setFocus} />
        <div className="grid content-start gap-6 md:grid-cols-2 lg:grid-cols-1">
          <Forecast entries={entries} today={today} />
          <Health counts={counts} />
        </div>
      </div>
    </>
  );
}

function Header({ today }: { today: string }) {
  const ui = useUI();
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        <p className="text-sm font-medium text-ink-3">{formatDate(today)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{greeting()}</h1>
      </div>
      <div className="hidden sm:block md:hidden">
        <Button onClick={() => ui.openVehicleForm()}>Add vehicle</Button>
      </div>
    </div>
  );
}

const PAGE = 8;

function Upcoming({ entries, focus, setFocus }: { entries: DueEntry[]; focus: Focus; setFocus: (f: Focus) => void }) {
  const ui = useUI();
  const { data } = useFleet();
  const [kind, setKind] = useState<"all" | DocKind>("all");
  const [type, setType] = useState<"all" | VehicleType>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = entries.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (type === "all" || e.vehicle.type === type) &&
      (focus === "all" || e.status === focus),
  );
  const visible = expanded ? filtered : filtered.slice(0, PAGE);

  return (
    <Card className="min-w-0 self-start overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Upcoming renewals</h2>
            <p className="text-xs text-ink-3">Fewest days left first</p>
          </div>
          {focus !== "all" && (
            <button
              type="button"
              onClick={() => setFocus("all")}
              className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_META[focus].bg, STATUS_META[focus].text)}
            >
              {STATUS_META[focus].label} ✕
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All" },
              { value: "permit", label: "Permit" },
              { value: "fc", label: "FC" },
            ]}
          />
          <Segmented
            size="sm"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "All" },
              { value: "bus", label: <><Bus className="hidden size-3.5 sm:block" />Bus</> },
              { value: "lorry", label: <><Truck className="hidden size-3.5 sm:block" />Lorry</> },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-6" />}
          title="All clear"
          body="Nothing matches these filters. Everything here is up to date."
        />
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {visible.map((e, i) => (
              <motion.li
                key={`${e.vehicle.id}-${e.kind}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => ui.openDetail(e.vehicle.id)}
                  onKeyDown={(ev) => ev.key === "Enter" && ui.openDetail(e.vehicle.id)}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5"
                >
                  <DaysRing days={e.daysLeft} window={data.settings.alertDays} status={e.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Plate plate={e.vehicle.plate} size="sm" />
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
                        {e.vehicle.type === "bus" ? <Bus className="size-3.5" /> : <Truck className="size-3.5" />}
                        {DOC_LABEL[e.kind]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-3">
                      Valid till <span className="font-medium text-ink-2 tabular">{formatDate(e.doc.expiryDate)}</span>
                      {e.vehicle.ownerName && <> · {e.vehicle.ownerName}</>}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <DaysPill days={e.daysLeft} status={e.status} />
                  </div>
                  <Button
                    size="sm"
                    variant={e.status === "valid" ? "secondary" : "primary"}
                    className="shrink-0"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      ui.openRenew(e.vehicle.id, e.kind);
                    }}
                  >
                    Renew
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {filtered.length > PAGE && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {expanded ? "Show less" : `Show all ${filtered.length}`}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </Card>
  );
}

function Forecast({ entries, today }: { entries: DueEntry[]; today: string }) {
  const months = Array.from({ length: 6 }, (_, i) => monthKey(today, i));
  const buckets = months.map((m) => entries.filter((e) => e.daysLeft >= 0 && e.doc.expiryDate.startsWith(m)));
  const max = Math.max(1, ...buckets.map((b) => b.length));
  const total = buckets.reduce((s, b) => s + b.length, 0);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Next 6 months</h2>
          <p className="text-xs text-ink-3">{total} renewal{total === 1 ? "" : "s"} coming up</p>
        </div>
        <Link href="/vehicles" className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-ink/5 hover:text-ink" aria-label="View vehicles">
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div className="mt-5 flex h-36 items-end gap-2.5">
        {buckets.map((b, i) => {
          const permits = b.filter((e) => e.kind === "permit").length;
          const fcs = b.length - permits;
          return (
            <div key={months[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-semibold text-ink tabular">{b.length || ""}</span>
              <motion.div
                className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-lg bg-line/70"
                initial={{ height: 4 }}
                animate={{ height: `${Math.max(4, (b.length / max) * 100)}%` }}
                transition={{ delay: 0.15 + i * 0.05, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                title={`${permits} Permit · ${fcs} FC`}
              >
                {b.length > 0 && (
                  <>
                    <div className="w-full bg-accent" style={{ flexGrow: permits }} />
                    <div className="w-full bg-[#9fa3ff]" style={{ flexGrow: fcs }} />
                  </>
                )}
              </motion.div>
              <span className={cn("text-[11px] font-medium", i === 0 ? "text-ink" : "text-ink-3")}>{monthLabel(months[i])}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-accent" /> Permit</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#9fa3ff]" /> FC</span>
      </div>
    </Card>
  );
}

function Health({ counts }: { counts: Record<Status, number> }) {
  const order: Status[] = ["valid", "soon", "critical", "expired"];
  const total = order.reduce((s, k) => s + counts[k], 0);
  const healthy = total ? Math.round((counts.valid / total) * 100) : 0;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-ink">Document health</h2>
        <span className="text-xs text-ink-3">{total} documents</span>
      </div>
      <p className="mt-3 text-[32px] leading-none font-semibold tracking-tight text-ink tabular">
        {healthy}
        <span className="text-lg text-ink-3">%</span>
      </p>
      <p className="mt-1 text-xs text-ink-3">valid beyond the alert window</p>
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line">
        {total > 0 &&
          order.map(
            (k, i) =>
              counts[k] > 0 && (
                <motion.div
                  key={k}
                  className={STATUS_META[k].dot}
                  initial={{ width: 0 }}
                  animate={{ width: `${(counts[k] / total) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              ),
          )}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {order.map((k) => (
          <li key={k} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className={cn("size-2 rounded-full", STATUS_META[k].dot)} />
              {STATUS_META[k].label}
            </span>
            <span className="font-semibold text-ink tabular">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
