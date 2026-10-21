"use client";

import { motion } from "motion/react";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { describeDays } from "@/lib/dates";
import type { Status } from "@/lib/types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white shadow-[0_1px_2px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-[#1c2333]",
  secondary: "bg-surface text-ink border border-line-strong shadow-card hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-ink/5 hover:text-ink",
  danger: "bg-expired text-white hover:bg-[#c4323a] shadow-[0_1px_2px_rgb(0_0_0/0.15)]",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: ReactNode }
>(function Button({ variant = "primary", size = "md", icon, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,box-shadow,transform,color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "grid size-9 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-expired">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={cn(
          "h-11 w-full min-w-0 rounded-xl border bg-surface px-3.5 text-[15px] text-ink shadow-[inset_0_1px_2px_rgb(16_24_40/0.04)] outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 sm:h-10 sm:text-sm",
          invalid
            ? "border-expired focus:ring-4 focus:ring-expired/15"
            : "border-line-strong focus:border-accent focus:ring-4 focus:ring-accent/12",
          className,
        )}
      />
    );
  },
);

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      className={cn("inline-flex rounded-xl bg-ink/[0.055] p-1", size === "md" ? "h-10" : "h-9", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_2px_rgb(16_24_40/0.08),0_1px_1px_rgb(16_24_40/0.04)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Styled like an Indian registration plate. */
export function Plate({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border-[1.5px] border-ink/85 bg-white font-mono font-semibold uppercase tracking-wider text-ink shadow-[inset_0_0_0_1.5px_white,0_1px_1px_rgb(0_0_0/0.06)]",
        size === "sm" && "px-1.5 py-0.5 text-[11px]",
        size === "md" && "px-2 py-0.5 text-[13px]",
        size === "lg" && "px-3 py-1 text-lg",
      )}
    >
      {plate}
    </span>
  );
}

export const STATUS_META: Record<Status, { label: string; text: string; bg: string; dot: string; stroke: string }> = {
  expired: { label: "Expired", text: "text-expired", bg: "bg-expired-soft", dot: "bg-expired", stroke: "var(--expired)" },
  critical: { label: "Due this week", text: "text-critical", bg: "bg-critical-soft", dot: "bg-critical", stroke: "var(--critical)" },
  soon: { label: "Due soon", text: "text-soon", bg: "bg-soon-soft", dot: "bg-soon", stroke: "var(--soon)" },
  valid: { label: "Valid", text: "text-valid", bg: "bg-valid-soft", dot: "bg-valid", stroke: "var(--valid)" },
};

export function StatusPill({ status, children }: { status: Status; children?: ReactNode }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular",
        m.bg,
        m.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot, status !== "valid" && "animate-pulse")} />
      {children ?? m.label}
    </span>
  );
}

export function DaysPill({ days, status }: { days: number; status: Status }) {
  return <StatusPill status={status}>{describeDays(days)}</StatusPill>;
}

/** Circular gauge: how much of the alert window remains. */
export function DaysRing({ days, window, status, size = 44 }: { days: number; window: number; status: Status; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = days < 0 ? 1 : Math.min(1, Math.max(0.04, days / Math.max(window, 1)));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STATUS_META[status].stroke}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className={cn("absolute text-[11px] font-bold tabular", STATUS_META[status].text)}>
        {days < 0 ? "!" : days > 999 ? "999+" : days}
      </span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  actionsClassName,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className={cn("flex shrink-0 flex-wrap items-center gap-2", actionsClassName)}>{actions}</div>}
    </div>
  );
}
