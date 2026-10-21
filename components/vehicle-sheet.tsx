"use client";

import { motion } from "motion/react";
import { Bus, CalendarClock, FilePlus2, Pencil, Phone, Receipt, Trash2, Truck, User, X } from "lucide-react";
import { daysBetween, describeDays, formatDate, statusFor } from "@/lib/dates";
import { deletePayment, deleteVehicle, formatMoney, removeDoc, totalPaid } from "@/lib/fleet";
import { DOC_LABEL, TYPE_LABEL, type DocKind, type Vehicle } from "@/lib/types";
import { useFleet, useUI } from "./fleet-context";
import { Overlay, OverlayBody } from "./overlay";
import { useToast } from "./toast";
import { Button, cn, IconButton, Plate, STATUS_META, StatusPill } from "./ui";

export function VehicleSheet() {
  const ui = useUI();
  const { data } = useFleet();
  const vehicle = ui.detailId ? data.vehicles.find((v) => v.id === ui.detailId) : undefined;

  return (
    <Overlay
      open={!!vehicle}
      onClose={() => ui.close("detailId")}
      variant="drawer"
      title={vehicle && <Plate plate={vehicle.plate} size="lg" />}
      description={
        vehicle && (
          <span className="mt-2 flex items-center gap-1.5 font-medium">
            {vehicle.type === "bus" ? <Bus className="size-4" /> : <Truck className="size-4" />}
            {TYPE_LABEL[vehicle.type]}
          </span>
        )
      }
    >
      {vehicle && <SheetBody vehicle={vehicle} />}
    </Overlay>
  );
}

function SheetBody({ vehicle }: { vehicle: Vehicle }) {
  const ui = useUI();
  const toast = useToast();
  const paid = totalPaid(vehicle);

  return (
    <OverlayBody className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="flex items-center gap-2 text-ink">
            <User className="size-4 shrink-0 text-ink-3" />
            <span className="truncate font-medium">{vehicle.ownerName || "No owner name"}</span>
          </span>
          {vehicle.ownerPhone ? (
            <a href={`tel:${vehicle.ownerPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 text-accent hover:underline">
              <Phone className="size-4 shrink-0" />
              <span className="tabular">{vehicle.ownerPhone}</span>
            </a>
          ) : (
            <span className="flex items-center gap-2 text-ink-3">
              <Phone className="size-4 shrink-0" /> No phone
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => ui.openVehicleForm(vehicle.id)}>
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-expired"
            icon={<Trash2 className="size-3.5" />}
            onClick={() =>
              ui.askConfirm({
                title: "Delete vehicle?",
                message: (
                  <>
                    <Plate plate={vehicle.plate} size="sm" /> and its Permit, FC and payment log will be removed permanently.
                  </>
                ),
                confirmLabel: "Delete vehicle",
                onConfirm: () => {
                  ui.close("detailId");
                  deleteVehicle(vehicle.id);
                  toast(`${vehicle.plate} deleted`);
                },
              })
            }
          >
            Delete
          </Button>
        </div>
      </div>

      {(["permit", "fc"] as const).map((kind, i) => (
        <motion.div
          key={kind}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <DocCard vehicle={vehicle} kind={kind} />
        </motion.div>
      ))}

      <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white">
        <span className="flex items-center gap-2 text-sm text-white/70">
          <Receipt className="size-4" /> Total paid
        </span>
        <span className="text-lg font-semibold tabular">{formatMoney(paid)}</span>
      </div>
    </OverlayBody>
  );
}

function DocCard({ vehicle, kind }: { vehicle: Vehicle; kind: DocKind }) {
  const ui = useUI();
  const toast = useToast();
  const { data, today } = useFleet();
  const doc = vehicle[kind];
  const label = DOC_LABEL[kind];

  if (!doc) {
    return (
      <button
        type="button"
        onClick={() => ui.openDocForm(vehicle.id, kind)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-dashed border-line-strong p-5 text-left transition-colors hover:border-accent hover:bg-accent-soft/40"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-ink-3 transition-colors group-hover:bg-accent-soft group-hover:text-accent">
          <FilePlus2 className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">Add {label}</span>
          <span className="block text-xs text-ink-3">No {label} on record for this vehicle yet.</span>
        </span>
      </button>
    );
  }

  const daysLeft = daysBetween(today, doc.expiryDate);
  const status = statusFor(daysLeft, data.settings.alertDays);
  const term = Math.max(1, daysBetween(doc.issueDate, doc.expiryDate));
  const elapsed = Math.min(1, Math.max(0, daysBetween(doc.issueDate, today) / term));
  const meta = STATUS_META[status];
  const payments = [...doc.payments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular", status === "valid" ? "text-ink" : meta.text)}>
              {describeDays(daysLeft)}
            </p>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <motion.div
              className={cn("h-full rounded-full", meta.dot)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, elapsed * 100)}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-3 tabular">
            <span>
              Issued <span className="font-medium text-ink-2">{formatDate(doc.issueDate)}</span>
            </span>
            <span>
              Valid till <span className="font-medium text-ink-2">{formatDate(doc.expiryDate)}</span>
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" icon={<CalendarClock className="size-3.5" />} onClick={() => ui.openRenew(vehicle.id, kind)}>
            Renew
          </Button>
          <Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => ui.openDocForm(vehicle.id, kind)}>
            Edit dates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() =>
              ui.askConfirm({
                title: `Remove ${label}?`,
                message: `The ${label} record for ${vehicle.plate} and its payment log will be removed. The vehicle stays.`,
                confirmLabel: `Remove ${label}`,
                onConfirm: () => {
                  removeDoc(vehicle.id, kind);
                  toast(`${label} removed`);
                },
              })
            }
          >
            Remove
          </Button>
        </div>
      </div>

      <div className="border-t border-line bg-surface-2/60 px-5 py-3">
        <p className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
          Payments{payments.length > 0 && ` · ${formatMoney(payments.reduce((s, p) => s + p.amount, 0))}`}
        </p>
        {payments.length === 0 ? (
          <p className="py-1.5 text-sm text-ink-3">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {formatDate(p.date)}
                    <span className="ml-2 rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
                      {p.kind === "issue" ? "New" : "Renewal"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-ink-3 tabular">
                    {formatDate(p.validFrom)} – {formatDate(p.validTo)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink tabular">{formatMoney(p.amount)}</span>
                <IconButton
                  label="Delete payment"
                  className="size-8 opacity-60 group-hover:opacity-100 hover:text-expired"
                  onClick={() =>
                    ui.askConfirm({
                      title: "Delete payment?",
                      message: `${formatMoney(p.amount)} paid on ${formatDate(p.date)} will be removed from the log.`,
                      confirmLabel: "Delete payment",
                      onConfirm: () => {
                        deletePayment(vehicle.id, kind, p.id);
                        toast("Payment deleted");
                      },
                    })
                  }
                >
                  <X className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
