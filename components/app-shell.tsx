"use client";

import { motion } from "motion/react";
import { LayoutDashboard, Plus, Settings2, SlidersHorizontal, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { todayISO } from "@/lib/dates";
import { dueEntries } from "@/lib/fleet";
import { useData } from "@/lib/store";
import { AppDialogs } from "./dialogs";
import { FleetGate, UIProvider, useUI } from "./fleet-context";
import { ToastProvider } from "./toast";
import { cn } from "./ui";
import { VehicleSheet } from "./vehicle-sheet";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
  { href: "/masters", label: "Masters", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-white shadow-[0_4px_12px_-2px_rgb(13_19_33/0.35),inset_0_1px_0_rgb(255_255_255/0.15)]">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h11l5 5v5H4z" />
          <circle cx="8" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="16" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
        </svg>
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-[#6e72ff]" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">FleetDue</span>
          <span className="block text-[11px] font-medium text-ink-3">Permit &amp; FC tracker</span>
        </span>
      )}
    </Link>
  );
}

/** Count of documents that are expired or inside the alert window. */
function useAttentionCount(): number | null {
  const data = useData();
  if (!data) return null;
  return dueEntries(data, todayISO()).filter((e) => e.status !== "valid").length;
}

function CountBadge({ className }: { className?: string }) {
  const count = useAttentionCount();
  if (!count) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-expired px-1.5 text-[11px] font-bold text-white tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function AddButton({ className, compact }: { className?: string; compact?: boolean }) {
  const ui = useUI();
  return (
    <button
      type="button"
      onClick={() => ui.openVehicleForm()}
      aria-label="Add vehicle"
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl bg-ink font-medium text-white shadow-[0_6px_16px_-4px_rgb(13_19_33/0.4),inset_0_1px_0_rgb(255_255_255/0.12)] transition-transform active:scale-95",
        className,
      )}
    >
      <Plus className="size-[18px]" strokeWidth={2.4} />
      {!compact && <span className="text-sm">Add vehicle</span>}
    </button>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-line bg-surface/80 backdrop-blur-xl md:flex lg:w-64">
      <div className="flex h-16 items-center justify-center px-4 lg:justify-start lg:px-5">
        <span className="lg:hidden"><Logo compact /></span>
        <span className="hidden lg:block"><Logo /></span>
      </div>
      <div className="px-3 pt-2 pb-4 lg:px-4">
        <div className="hidden lg:block">
          <AddButton className="h-10 w-full" />
        </div>
        <div className="lg:hidden">
          <AddButton compact className="mx-auto size-11" />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 lg:px-4">
        <p className="mb-1 hidden px-3 text-[11px] font-semibold tracking-wider text-ink-3 uppercase lg:block">Menu</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors lg:h-10 lg:justify-start",
                active ? "text-ink" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="side-active"
                  className="absolute inset-0 rounded-xl bg-ink/[0.06]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn("relative size-[18px] shrink-0", active && "text-accent")} strokeWidth={active ? 2.3 : 2} />
              <span className="relative hidden lg:inline">{label}</span>
              {href === "/" && <CountBadge className="absolute top-1 right-1 lg:static lg:ml-auto" />}
            </Link>
          );
        })}
      </nav>
      <div className="hidden p-4 lg:block">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-accent-soft to-surface p-4">
          <p className="text-xs font-semibold text-ink">Stored on this device</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            Data lives in this browser. Take a backup from Settings regularly.
          </p>
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-bg/80 px-4 backdrop-blur-xl md:hidden">
      <Logo />
      <AddButton compact className="size-10" />
    </header>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid h-16 grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className="relative flex flex-col items-center justify-center gap-1">
              {active && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">
                <Icon className={cn("size-[22px] transition-colors", active ? "text-accent" : "text-ink-3")} strokeWidth={active ? 2.3 : 1.9} />
                {href === "/" && <CountBadge className="absolute -top-1.5 -right-3 h-4 min-w-4 px-1 text-[10px]" />}
              </span>
              <span className={cn("text-[11px] font-medium transition-colors", active ? "text-ink" : "text-ink-3")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-56 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <UIProvider>
        <Sidebar />
        <div className="flex min-h-dvh flex-col md:pl-20 lg:pl-64">
          <MobileTopBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-12 lg:px-10 lg:pt-10">
            <FleetGate fallback={<ShellSkeleton />}>
              {children}
              <VehicleSheet />
              <AppDialogs />
            </FleetGate>
          </main>
        </div>
        <MobileTabBar />
      </UIProvider>
    </ToastProvider>
  );
}
