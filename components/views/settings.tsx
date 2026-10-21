"use client";

import { BellRing, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { downloadBackup, downloadCSV, readBackup } from "@/lib/export";
import { emptyData, setData, updateData } from "@/lib/store";
import { useFleet, useUI } from "../fleet-context";
import { useToast } from "../toast";
import { Button, Card, cn, Input, PageHeader } from "../ui";

const PRESETS = [15, 30, 45, 60, 90];

export function SettingsView() {
  const { data, today } = useFleet();
  const ui = useUI();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [days, setDays] = useState(String(data.settings.alertDays));

  const saveDays = (value: number) => {
    if (!Number.isFinite(value) || value < 1 || value > 365) {
      toast("Alert window must be 1–365 days", "error");
      setDays(String(data.settings.alertDays));
      return;
    }
    setDays(String(value));
    if (value === data.settings.alertDays) return;
    updateData((d) => ({ ...d, settings: { ...d.settings, alertDays: value } }));
    toast(`Alert window set to ${value} days`);
  };

  const onRestore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const restored = await readBackup(file);
      ui.askConfirm({
        title: "Restore backup?",
        message: `This replaces everything on this device with ${restored.vehicles.length} vehicle${restored.vehicles.length === 1 ? "" : "s"} from “${file.name}”.`,
        confirmLabel: "Replace data",
        onConfirm: () => {
          setData(restored);
          setDays(String(restored.settings.alertDays));
          toast("Backup restored");
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't read that file", "error");
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Alerts and your data on this device." />
      <div className="flex flex-col gap-4 lg:gap-6">
        <Section
          icon={<BellRing className="size-5" />}
          title="Due-soon alert window"
          body="Documents expiring within this many days are flagged as due soon. Seven days or fewer is always shown as urgent."
        >
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => saveDays(p)}
                className={cn(
                  "h-10 rounded-xl border px-4 text-sm font-medium transition-colors tabular",
                  data.settings.alertDays === p
                    ? "border-ink bg-ink text-white"
                    : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
                )}
              >
                {p} days
              </button>
            ))}
            <div className="flex items-center gap-2">
              <Input
                aria-label="Custom alert window in days"
                inputMode="numeric"
                className="w-20 text-center tabular"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
                onBlur={() => saveDays(Number(days))}
                onKeyDown={(e) => e.key === "Enter" && saveDays(Number(days))}
              />
              <span className="text-sm text-ink-3">custom</span>
            </div>
          </div>
        </Section>

        <Section
          icon={<Download className="size-5" />}
          title="Backup & restore"
          body="Everything is stored in this browser only. Download a backup regularly, and restore it on another device or after clearing browser data."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              icon={<Download className="size-4" />}
              onClick={() => {
                downloadBackup(data, today);
                toast("Backup downloaded");
              }}
            >
              Download backup
            </Button>
            <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
              Restore from file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                onRestore(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </Section>

        <Section
          icon={<FileSpreadsheet className="size-5" />}
          title="Export to Excel"
          body="A CSV of every vehicle with Permit and FC dates, days left, status and total paid. Opens in Excel or Google Sheets."
        >
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="size-4" />}
            disabled={data.vehicles.length === 0}
            onClick={() => {
              downloadCSV(data, today);
              toast("CSV exported");
            }}
          >
            Export {data.vehicles.length} vehicle{data.vehicles.length === 1 ? "" : "s"}
          </Button>
        </Section>

        <Section
          icon={<RotateCcw className="size-5" />}
          title="Reset all data"
          body="Delete every vehicle, payment and master setting on this device. Download a backup first if you might need it."
          danger
        >
          <Button
            variant="danger"
            onClick={() =>
              ui.askConfirm({
                title: "Erase all data?",
                message: `All ${data.vehicles.length} vehicles, their payment logs and your masters will be permanently deleted from this browser.`,
                confirmLabel: "Erase everything",
                onConfirm: () => {
                  setData(emptyData());
                  setDays("30");
                  toast("All data erased");
                },
              })
            }
          >
            Reset all data
          </Button>
        </Section>
      </div>
    </>
  );
}

function Section({
  icon,
  title,
  body,
  children,
  danger,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Card className={cn("p-5 sm:p-6", danger && "border-expired/25")}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex gap-4">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              danger ? "bg-expired-soft text-expired" : "bg-accent-soft text-accent",
            )}
          >
            {icon}
          </span>
          <div className="max-w-xl">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
          </div>
        </div>
        <div className="shrink-0 lg:max-w-md">{children}</div>
      </div>
    </Card>
  );
}
