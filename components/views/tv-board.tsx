"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bus, CircleCheck, Maximize2, Minimize2, Phone, Truck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatDate, monthKey, monthLabel, todayISO } from "@/lib/dates";
import { dueEntries, type DueEntry } from "@/lib/fleet";
import { useData } from "@/lib/store";
import { DOC_LABEL, type Status } from "@/lib/types";
import { cn } from "../ui";

const PER_PAGE = 7;
const PAGE_MS = 12_000;
const IDLE_MS = 3_000;
const ease = [0.22, 1, 0.36, 1] as const;

const TONE: Record<Status, { text: string; bar: string; soft: string }> = {
  expired: { text: "text-expired", bar: "bg-expired", soft: "bg-expired-soft" },
  critical: { text: "text-critical", bar: "bg-critical", soft: "bg-critical-soft" },
  soon: { text: "text-soon", bar: "bg-soon", soft: "bg-soon-soft" },
  valid: { text: "text-valid", bar: "bg-valid", soft: "bg-valid-soft" },
};

function subscribeMinute(listener: () => void) {
  const id = setInterval(listener, 60_000);
  return () => clearInterval(id);
}

/** Re-checks the date every minute so a board left running rolls over at midnight (null during prerender). */
function useToday(): string | null {
  return useSyncExternalStore(subscribeMinute, todayISO, () => null);
}

/** Keeps the screen from sleeping while the board is visible (where supported). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        lock = null;
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => {});
    };
  }, []);
}

function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  return [on, toggle] as const;
}

/** True once the pointer has been still for a while, so controls and cursor can get out of the way. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);
  return idle;
}

export function TvBoard() {
  const data = useData();
  const today = useToday();
  const idle = useIdle();
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const [page, setPage] = useState(0);
  useWakeLock();

  const entries = useMemo(() => (data && today ? dueEntries(data, today) : []), [data, today]);
  const attention = useMemo(() => entries.filter((e) => e.status !== "valid"), [entries]);
  const pages = Math.max(1, Math.ceil(attention.length / PER_PAGE));
  const current = page % pages;

  // Restarting on every page change means a manual skip also gets the full dwell time.
  useEffect(() => {
    if (pages <= 1) return;
    const id = setTimeout(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearTimeout(id);
  }, [page, pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setPage((p) => (p + 1) % pages);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") setPage((p) => (p - 1 + pages) % pages);
      else if (e.key === "f" || e.key === "F" || e.key === "Enter") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages, toggleFullscreen]);

  if (!data || !today) return <div className="tv h-dvh bg-bg" />;

  const counts: Record<Status, number> = { expired: 0, critical: 0, soon: 0, valid: 0 };
  entries.forEach((e) => counts[e.status]++);
  const alertDays = data.settings.alertDays;
  const slice = attention.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  return (
    <div className={cn("tv flex h-dvh flex-col overflow-hidden bg-bg text-ink select-none", idle && "cursor-none")}>
      <header className="flex items-center justify-between px-10 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-ink text-bg">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h11l5 5v5H4z" />
              <circle cx="8" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="16" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <p className="text-3xl font-semibold tracking-tight">Renewal board</p>
            <p className="mt-0.5 flex items-center gap-2 text-base text-ink-3">
              <span className="relative flex size-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-valid opacity-60" />
                <span className="relative size-2.5 rounded-full bg-valid" />
              </span>
              Live · FleetDue Permit &amp; FC tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div
            className={cn(
              "flex items-center gap-2 transition-opacity duration-500",
              idle ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <Link
              href="/"
              className="flex h-12 items-center gap-2 rounded-xl border border-line-strong px-4 text-base font-medium text-ink-2 hover:bg-ink/5 hover:text-ink"
            >
              <ArrowLeft className="size-5" /> Exit
            </Link>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-12 items-center gap-2 rounded-xl bg-ink px-4 text-base font-medium text-bg"
            >
              {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
          </div>
          <Clock />
        </div>
      </header>

      <section className="grid grid-cols-4 gap-5 px-10">
        <Stat status="expired" label="Overdue" value={counts.expired} sub={counts.expired ? "Renew immediately" : "Nothing overdue"} />
        <Stat status="critical" label="Due in 7 days" value={counts.critical} sub="This week" />
        <Stat status="soon" label={`Due in ${alertDays} days`} value={counts.soon} sub="Plan ahead" />
        <Stat
          status="valid"
          label="Vehicles"
          value={data.vehicles.length}
          sub={`${entries.length} document${entries.length === 1 ? "" : "s"} tracked`}
        />
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_27rem] gap-5 px-10 pt-5 pb-4">
        <section className="flex min-h-0 flex-col rounded-3xl border border-line bg-surface p-6">
          <div className="mb-5 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-[1.75rem] font-semibold tracking-tight">Renewals due</h1>
              <p className="mt-1 text-base text-ink-3">
                Overdue first, then soonest · {attention.length} document{attention.length === 1 ? "" : "s"} within {alertDays} days
              </p>
            </div>
            {pages > 1 && <Pager pages={pages} current={current} page={page} />}
          </div>

          <div className="relative min-h-0 flex-1">
            {attention.length === 0 ? (
              <AllClear entries={entries} hasVehicles={data.vehicles.length > 0} alertDays={alertDays} />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  className="absolute inset-0 grid grid-rows-[repeat(7,minmax(0,1fr))] gap-3"
                  exit={{ opacity: 0, transition: { duration: 0.3 } }}
                >
                  {slice.map((e, i) => (
                    <motion.div
                      key={`${e.vehicle.id}-${e.kind}`}
                      className="min-h-0"
                      initial={{ opacity: 0, x: 32 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.55, ease }}
                    >
                      <Row entry={e} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-5">
          <InForce counts={counts} total={entries.length} />
          <Forecast entries={entries} today={today} />
        </aside>
      </div>

      <footer className="flex items-center justify-between px-10 pb-6 text-sm text-ink-3">
        <span>Alert window {alertDays} days{pages > 1 && ` · Pages change every ${PAGE_MS / 1000} s`}</span>
        <span className={cn("transition-opacity duration-500", idle && "opacity-0")}>
          ← → change page · F full screen
        </span>
      </footer>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="text-right">
      <p className="text-5xl leading-none font-semibold tracking-tight tabular">
        {h}
        <span className={cn("transition-opacity duration-300", now.getSeconds() % 2 === 1 && "opacity-30")}>:</span>
        {m}
        <span className="ml-2 text-xl font-medium text-ink-3">{now.getHours() < 12 ? "AM" : "PM"}</span>
      </p>
      <p className="mt-2 text-base text-ink-3">
        {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>
    </div>
  );
}

function Stat({ status, label, value, sub }: { status: Status; label: string; value: number; sub: string }) {
  const t = TONE[status];
  const lit = value > 0;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-7 py-5">
      {lit && <span className={cn("pointer-events-none absolute -top-16 -right-16 size-48 rounded-full opacity-25 blur-3xl", t.bar)} />}
      <div className="flex items-center gap-3">
        <span className={cn("size-3 rounded-full", lit ? t.bar : "bg-ink-3", lit && status !== "valid" && "animate-pulse")} />
        <span className="text-lg font-medium text-ink-2">{label}</span>
      </div>
      <p className={cn("mt-2 text-6xl font-semibold tracking-tight tabular", lit ? t.text : "text-ink-3")}>{value}</p>
      <p className="mt-1 text-base text-ink-3">{sub}</p>
    </div>
  );
}

function Pager({ pages, current, page }: { pages: number; current: number; page: number }) {
  return (
    <div className="flex shrink-0 items-center gap-4">
      <span className="text-base text-ink-3 tabular">
        Page {current + 1} of {pages}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: pages }, (_, i) => (
          <span key={i} className="relative h-2 w-10 overflow-hidden rounded-full bg-ink/10">
            {i < current && <span className="absolute inset-0 bg-ink/50" />}
            {i === current && (
              <motion.span
                key={page}
                className="absolute inset-y-0 left-0 bg-ink/80"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: PAGE_MS / 1000, ease: "linear" }}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Indian transport vehicles carry yellow plates, so the board mirrors that. */
function TvPlate({ plate }: { plate: string }) {
  return (
    <span className="inline-flex items-center rounded-lg border-2 border-black/85 bg-[#f6c945] px-3 py-1 font-mono text-xl font-bold tracking-wider whitespace-nowrap text-black shadow-[inset_0_0_0_2px_#f6c945,inset_0_0_0_3px_rgb(0_0_0/0.35)]">
      {plate}
    </span>
  );
}

function Row({ entry: e }: { entry: DueEntry }) {
  const t = TONE[e.status];
  const TypeIcon = e.vehicle.type === "bus" ? Bus : Truck;
  const n = Math.abs(e.daysLeft);
  const unit = e.daysLeft < 0 ? (n === 1 ? "day overdue" : "days overdue") : e.daysLeft === 0 ? "renew now" : n === 1 ? "day left" : "days left";
  return (
    <div
      className={cn(
        "relative grid h-full grid-cols-[19rem_7rem_minmax(0,1fr)_11rem_10rem] items-center gap-6 overflow-hidden rounded-2xl border border-line pr-7 pl-7",
        e.status === "expired" ? t.soft : "bg-surface-2",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", t.bar)} />
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink-2">
          <TypeIcon className="size-6" />
        </span>
        <TvPlate plate={e.vehicle.plate} />
      </div>
      <span className="justify-self-start rounded-lg border border-line-strong px-3 py-1 text-lg font-semibold text-ink-2">
        {DOC_LABEL[e.kind]}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xl font-medium">{e.vehicle.ownerName || "—"}</p>
        {e.vehicle.ownerPhone && (
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-ink-3 tabular">
            <Phone className="size-4" /> {e.vehicle.ownerPhone}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold tracking-wider text-ink-3 uppercase">{e.daysLeft < 0 ? "Expired on" : "Expires"}</p>
        <p className="mt-0.5 text-xl font-medium tabular">{formatDate(e.doc.expiryDate)}</p>
      </div>
      <div className={cn("text-right", t.text)}>
        <p className="text-5xl leading-none font-semibold tracking-tight tabular">{e.daysLeft === 0 ? "Today" : n}</p>
        <p className="mt-1 text-xs font-semibold tracking-wider uppercase">{unit}</p>
      </div>
    </div>
  );
}

function AllClear({ entries, hasVehicles, alertDays }: { entries: DueEntry[]; hasVehicles: boolean; alertDays: number }) {
  const next = entries[0];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease }}
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
    >
      <span className="grid size-28 place-items-center rounded-full bg-valid-soft text-valid">
        <CircleCheck className="size-14" strokeWidth={1.8} />
      </span>
      <p className="mt-8 text-5xl font-semibold tracking-tight">{hasVehicles ? "All clear" : "No vehicles yet"}</p>
      <p className="mt-3 text-xl text-ink-2">
        {hasVehicles
          ? `No Permit or FC is due in the next ${alertDays} days.`
          : "Add vehicles from the dashboard and their renewals will appear here."}
      </p>
      {next && (
        <div className="mt-10 flex items-center gap-5 rounded-2xl border border-line bg-surface-2 px-7 py-5">
          <span className="text-base font-semibold tracking-wider text-ink-3 uppercase">Next up</span>
          <TvPlate plate={next.vehicle.plate} />
          <span className="text-xl font-medium">{DOC_LABEL[next.kind]}</span>
          <span className="text-xl text-ink-2 tabular">
            {formatDate(next.doc.expiryDate)} · in {next.daysLeft} days
          </span>
        </div>
      )}
    </motion.div>
  );
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-line bg-surface p-6", className)}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function InForce({ counts, total }: { counts: Record<Status, number>; total: number }) {
  const inForce = total - counts.expired;
  const pct = total ? inForce / total : 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const rows: { status: Status; label: string }[] = [
    { status: "valid", label: "Valid" },
    { status: "soon", label: "Due soon" },
    { status: "critical", label: "This week" },
    { status: "expired", label: "Overdue" },
  ];
  return (
    <Panel title="Documents in force">
      <div className="mt-5 flex items-center gap-7">
        <div className="relative grid size-36 shrink-0 place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line-strong)" strokeWidth={10} />
            <motion.circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={pct === 1 ? "var(--valid)" : pct >= 0.9 ? "var(--soon)" : "var(--expired)"}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c * (1 - pct) }}
              transition={{ duration: 1.2, ease }}
            />
          </svg>
          <span className="text-4xl font-semibold tracking-tight tabular">
            {Math.round(pct * 100)}
            <span className="text-xl text-ink-3">%</span>
          </span>
        </div>
        <ul className="flex flex-1 flex-col gap-2.5">
          {rows.map(({ status, label }) => (
            <li key={status} className="flex items-center gap-3 text-lg">
              <span className={cn("size-2.5 rounded-full", TONE[status].bar)} />
              <span className="flex-1 text-ink-2">{label}</span>
              <span className="font-semibold tabular">{counts[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function Forecast({ entries, today }: { entries: DueEntry[]; today: string }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const key = monthKey(today, i);
    const due = entries.filter((e) => e.daysLeft >= 0 && e.doc.expiryDate.startsWith(key));
    return { key, permit: due.filter((e) => e.kind === "permit").length, fc: due.filter((e) => e.kind === "fc").length };
  });
  const max = Math.max(1, ...months.map((m) => m.permit + m.fc));
  return (
    <Panel title="Next 6 months" className="flex min-h-0 flex-1 flex-col">
      <div className="mt-1 flex gap-5 text-sm text-ink-3">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-accent" />Permit</span>
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-accent/40" />FC</span>
      </div>
      <ul className="mt-4 flex flex-1 flex-col justify-around gap-2">
        {months.map((m, i) => {
          const total = m.permit + m.fc;
          return (
            <li key={m.key} className="flex items-center gap-4">
              <span className={cn("w-16 text-lg tabular", i === 0 ? "font-semibold text-ink" : "text-ink-2")}>
                {i === 0 ? "Now" : monthLabel(m.key)}
              </span>
              <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-ink/5">
                <motion.span
                  className="h-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${(m.permit / max) * 100}%` }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.9, ease }}
                />
                <motion.span
                  className="h-full bg-accent/40"
                  initial={{ width: 0 }}
                  animate={{ width: `${(m.fc / max) * 100}%` }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.9, ease }}
                />
              </div>
              <span className={cn("w-8 text-right text-xl font-semibold tabular", !total && "text-ink-3")}>{total}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
