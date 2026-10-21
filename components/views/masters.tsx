"use client";

import { motion } from "motion/react";
import { Bus, Info, Minus, Plus, Truck } from "lucide-react";
import { computeExpiry, formatDate, formatDuration } from "@/lib/dates";
import { updateData } from "@/lib/store";
import { DOC_LABEL, TYPE_LABEL, type DocKind, type Duration, type VehicleType } from "@/lib/types";
import { useFleet } from "../fleet-context";
import { useToast } from "../toast";
import { Card, cn, PageHeader } from "../ui";

export function MastersView() {
  const { data, today } = useFleet();

  return (
    <>
      <PageHeader
        title="Masters"
        subtitle="Validity period used to calculate expiry when adding or renewing a Permit or FC."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
        {(["bus", "lorry"] as const).map((type, i) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-xl",
                    type === "bus" ? "bg-accent-soft text-accent" : "bg-[#fff4e5] text-[#c26a00]",
                  )}
                >
                  {type === "bus" ? <Bus className="size-5" /> : <Truck className="size-5" />}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">{TYPE_LABEL[type]}</h2>
                  <p className="text-xs text-ink-3">
                    {data.vehicles.filter((v) => v.type === type).length} vehicles use these periods
                  </p>
                </div>
              </div>
              <div className="divide-y divide-line">
                {(["permit", "fc"] as const).map((kind) => (
                  <MasterRow key={kind} type={type} kind={kind} duration={data.masters[type][kind]} today={today} />
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>
          Changes apply to new entries and renewals. Existing expiry dates stay as they are. Use <b>Edit dates</b> on a
          vehicle to correct one.
        </p>
      </div>
    </>
  );
}

function MasterRow({ type, kind, duration, today }: { type: VehicleType; kind: DocKind; duration: Duration; today: string }) {
  const toast = useToast();

  const set = (next: Duration) => {
    if (next.years * 12 + next.months < 1) return;
    updateData((d) => ({ ...d, masters: { ...d.masters, [type]: { ...d.masters[type], [kind]: next } } }));
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          {TYPE_LABEL[type]} {DOC_LABEL[kind]}
        </p>
        <motion.p key={formatDuration(duration)} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="mt-0.5 text-xs text-ink-3">
          {formatDuration(duration)} · issued today → valid till {formatDate(computeExpiry(today, duration))}
        </motion.p>
      </div>
      <div className="flex gap-3">
        <Stepper
          label="Years"
          value={duration.years}
          max={30}
          onChange={(years) => {
            set({ ...duration, years });
            toast(`${TYPE_LABEL[type]} ${DOC_LABEL[kind]} set to ${formatDuration({ ...duration, years })}`);
          }}
        />
        <Stepper
          label="Months"
          value={duration.months}
          max={11}
          onChange={(months) => {
            set({ ...duration, months });
            toast(`${TYPE_LABEL[type]} ${DOC_LABEL[kind]} set to ${formatDuration({ ...duration, months })}`);
          }}
        />
      </div>
    </div>
  );
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-1 sm:flex-none">
      <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</span>
      <div className="flex h-10 items-center rounded-xl border border-line-strong bg-surface shadow-card">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
          className="grid h-full w-10 place-items-center rounded-l-xl text-ink-2 transition-colors hover:bg-ink/5 disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
        <motion.span
          key={value}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="min-w-8 flex-1 text-center text-base font-semibold text-ink tabular"
        >
          {value}
        </motion.span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="grid h-full w-10 place-items-center rounded-r-xl text-ink-2 transition-colors hover:bg-ink/5 disabled:opacity-30"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
