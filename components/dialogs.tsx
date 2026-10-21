"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bus, CalendarClock, IndianRupee, RotateCcw, Truck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { computeExpiry, daysBetween, formatDate, formatDuration, isValidISO } from "@/lib/dates";
import {
  addVehicle,
  cleanPlate,
  plateKey,
  renewDoc,
  saveDoc,
  updateVehicle,
  type DocInput,
} from "@/lib/fleet";
import { DOC_LABEL, TYPE_LABEL, type DocKind, type VehicleType } from "@/lib/types";
import { useFleet, useUI } from "./fleet-context";
import { Overlay, OverlayBody, OverlayFooter } from "./overlay";
import { useToast } from "./toast";
import { Button, cn, Field, Input, Plate, Segmented } from "./ui";

export function AppDialogs() {
  return (
    <>
      <VehicleFormDialog />
      <DocFormDialog />
      <RenewDialog />
      <ConfirmDialog />
    </>
  );
}

/* ----------------------------- shared pieces ----------------------------- */

export const TYPE_OPTIONS: { value: VehicleType; label: ReactNode }[] = [
  { value: "bus", label: <><Bus className="size-4" /> Bus</> },
  { value: "lorry", label: <><Truck className="size-4" /> Lorry</> },
];

function AmountInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="relative">
      <IndianRupee className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        className="pl-9 tabular"
      />
    </div>
  );
}

function parseAmount(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

interface DocDraft {
  start: string;
  expiryOverride: string | null;
  amount: string;
}

/** Start date + auto-calculated (but overridable) expiry, with optional amount. */
function DocFields({
  idPrefix,
  draft,
  setDraft,
  type,
  kind,
  startLabel,
  showAmount,
  errors,
}: {
  idPrefix: string;
  draft: DocDraft;
  setDraft: (d: DocDraft) => void;
  type: VehicleType;
  kind: DocKind;
  startLabel: string;
  showAmount: boolean;
  errors: { start?: string; expiry?: string };
}) {
  const { data } = useFleet();
  const duration = data.masters[type][kind];
  const auto = isValidISO(draft.start) ? computeExpiry(draft.start, duration) : "";
  const expiry = draft.expiryOverride ?? auto;
  const overridden = draft.expiryOverride !== null && draft.expiryOverride !== auto;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={startLabel} htmlFor={`${idPrefix}-start`} error={errors.start}>
        <Input
          id={`${idPrefix}-start`}
          type="date"
          value={draft.start}
          invalid={!!errors.start}
          onChange={(e) => setDraft({ ...draft, start: e.target.value })}
        />
      </Field>
      <Field
        label="Valid till"
        htmlFor={`${idPrefix}-expiry`}
        error={errors.expiry}
        hint={
          overridden ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              onClick={() => setDraft({ ...draft, expiryOverride: null })}
            >
              <RotateCcw className="size-3" /> Reset to {formatDuration(duration)} from master
            </button>
          ) : (
            <>Auto: {TYPE_LABEL[type]} {DOC_LABEL[kind]} · {formatDuration(duration)}</>
          )
        }
      >
        <Input
          id={`${idPrefix}-expiry`}
          type="date"
          value={expiry}
          invalid={!!errors.expiry}
          onChange={(e) => setDraft({ ...draft, expiryOverride: e.target.value })}
          className={cn(!overridden && "bg-accent-soft/40")}
        />
      </Field>
      {showAmount && (
        <div className="sm:col-span-2">
          <Field label="Amount paid (optional)" htmlFor={`${idPrefix}-amount`} hint="Recorded in the payment log.">
            <AmountInput id={`${idPrefix}-amount`} value={draft.amount} onChange={(amount) => setDraft({ ...draft, amount })} />
          </Field>
        </div>
      )}
    </div>
  );
}

function resolveDoc(draft: DocDraft, type: VehicleType, kind: DocKind, masters: ReturnType<typeof useFleet>["data"]["masters"]) {
  const errors: { start?: string; expiry?: string } = {};
  if (!isValidISO(draft.start)) errors.start = "Pick a valid date";
  const expiry = draft.expiryOverride ?? (isValidISO(draft.start) ? computeExpiry(draft.start, masters[type][kind]) : "");
  if (!isValidISO(expiry)) errors.expiry = "Pick a valid date";
  else if (isValidISO(draft.start) && daysBetween(draft.start, expiry) < 0) errors.expiry = "Must be after the start date";
  const input: DocInput = { issueDate: draft.start, expiryDate: expiry, amount: parseAmount(draft.amount) };
  return { errors, input, ok: !errors.start && !errors.expiry };
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <motion.span
        className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)]"
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
      />
    </button>
  );
}

/* ------------------------------ vehicle form ------------------------------ */

function VehicleFormDialog() {
  const ui = useUI();
  const { data } = useFleet();
  const target = ui.vehicleForm;
  const editing = target?.id ? data.vehicles.find((v) => v.id === target.id) : undefined;
  return (
    <Overlay
      open={!!target}
      onClose={() => ui.close("vehicleForm")}
      title={editing ? "Edit vehicle" : "Add vehicle"}
      description={editing ? <Plate plate={editing.plate} size="sm" /> : "Register a bus or lorry and its documents."}
      width="max-w-xl"
    >
      {target && <VehicleFormBody key={target.id ?? "new"} editingId={editing?.id} />}
    </Overlay>
  );
}

function VehicleFormBody({ editingId }: { editingId?: string }) {
  const ui = useUI();
  const { data, today } = useFleet();
  const toast = useToast();
  const editing = editingId ? data.vehicles.find((v) => v.id === editingId) : undefined;

  const [plate, setPlate] = useState(editing?.plate ?? "");
  const [type, setType] = useState<VehicleType>(editing?.type ?? "bus");
  const [ownerName, setOwnerName] = useState(editing?.ownerName ?? "");
  const [ownerPhone, setOwnerPhone] = useState(editing?.ownerPhone ?? "");
  const [include, setInclude] = useState<Record<DocKind, boolean>>({ permit: true, fc: true });
  const [docs, setDocs] = useState<Record<DocKind, DocDraft>>({
    permit: { start: today, expiryOverride: null, amount: "" },
    fc: { start: today, expiryOverride: null, amount: "" },
  });
  const [submitted, setSubmitted] = useState(false);

  const key = plateKey(plate);
  const duplicate = !!key && data.vehicles.some((v) => v.id !== editing?.id && plateKey(v.plate) === key);
  const phoneDigits = ownerPhone.replace(/\D/g, "");
  const errors = {
    plate: !key
      ? "Enter the number plate"
      : key.length < 4
        ? "That plate looks too short"
        : duplicate
          ? "This vehicle already exists"
          : undefined,
    phone: ownerPhone && (phoneDigits.length < 7 || phoneDigits.length > 15) ? "Enter a valid phone number" : undefined,
  };
  const resolved = {
    permit: resolveDoc(docs.permit, type, "permit", data.masters),
    fc: resolveDoc(docs.fc, type, "fc", data.masters),
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const docsOk = editing || (["permit", "fc"] as const).every((k) => !include[k] || resolved[k].ok);
    if (errors.plate || errors.phone || !docsOk) return;
    const input = { plate, type, ownerName: ownerName.trim(), ownerPhone: ownerPhone.trim() };
    if (editing) {
      updateVehicle(editing.id, input);
      toast(`${cleanPlate(plate)} updated`);
    } else {
      const id = addVehicle(input, {
        permit: include.permit ? resolved.permit.input : undefined,
        fc: include.fc ? resolved.fc.input : undefined,
      });
      toast(`${cleanPlate(plate)} added`);
      ui.openDetail(id);
    }
    ui.close("vehicleForm");
  };

  return (
    <>
      <OverlayBody>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Number plate" htmlFor="vf-plate" error={submitted || duplicate ? errors.plate : undefined}>
              <Input
                id="vf-plate"
                data-autofocus
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="TN 01 AB 1234"
                value={plate}
                invalid={(submitted && !!errors.plate) || duplicate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="font-mono text-base font-semibold tracking-wider uppercase"
              />
            </Field>
            <Field label="Vehicle type">
              <Segmented value={type} onChange={setType} options={TYPE_OPTIONS} className="w-full sm:w-auto" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name" htmlFor="vf-owner">
              <Input
                id="vf-owner"
                placeholder="Optional"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Owner phone" htmlFor="vf-phone" error={submitted ? errors.phone : undefined}>
              <Input
                id="vf-phone"
                type="tel"
                inputMode="tel"
                placeholder="Optional"
                value={ownerPhone}
                invalid={submitted && !!errors.phone}
                onChange={(e) => setOwnerPhone(e.target.value)}
              />
            </Field>
          </div>

          {!editing &&
            (["permit", "fc"] as const).map((kind) => (
              <div
                key={kind}
                className={cn(
                  "rounded-2xl border transition-colors",
                  include[kind] ? "border-line bg-surface-2/70" : "border-dashed border-line-strong",
                )}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{DOC_LABEL[kind]}</p>
                    <p className="text-xs text-ink-3">
                      {include[kind] ? `Master: ${formatDuration(data.masters[type][kind])}` : "You can add it later"}
                    </p>
                  </div>
                  <Switch
                    label={`Add ${DOC_LABEL[kind]} now`}
                    checked={include[kind]}
                    onChange={(v) => setInclude({ ...include, [kind]: v })}
                  />
                </div>
                <AnimatePresence initial={false}>
                  {include[kind] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <DocFields
                          idPrefix={`vf-${kind}`}
                          draft={docs[kind]}
                          setDraft={(d) => setDocs({ ...docs, [kind]: d })}
                          type={type}
                          kind={kind}
                          startLabel="Issue date"
                          showAmount
                          errors={submitted ? resolved[kind].errors : {}}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          <button type="submit" hidden />
        </form>
      </OverlayBody>
      <OverlayFooter>
        <Button variant="secondary" onClick={() => ui.close("vehicleForm")}>
          Cancel
        </Button>
        <Button onClick={() => submit()}>{editing ? "Save changes" : "Add vehicle"}</Button>
      </OverlayFooter>
    </>
  );
}

/* ------------------------- add / correct a document ------------------------ */

function DocFormDialog() {
  const ui = useUI();
  const { data } = useFleet();
  const target = ui.docForm;
  const vehicle = target ? data.vehicles.find((v) => v.id === target.vehicleId) : undefined;
  const existing = vehicle && target ? vehicle[target.kind] : undefined;
  const label = target ? DOC_LABEL[target.kind] : "";
  return (
    <Overlay
      open={!!(target && vehicle)}
      onClose={() => ui.close("docForm")}
      title={existing ? `Edit ${label} dates` : `Add ${label}`}
      description={
        vehicle && (
          <span className="flex flex-wrap items-center gap-2">
            <Plate plate={vehicle.plate} size="sm" />
            {existing && <span className="text-xs">For corrections. Use Renew for a new term.</span>}
          </span>
        )
      }
    >
      {target && vehicle && (
        <DocFormBody key={`${vehicle.id}-${target.kind}`} vehicleId={vehicle.id} kind={target.kind} />
      )}
    </Overlay>
  );
}

function DocFormBody({ vehicleId, kind }: { vehicleId: string; kind: DocKind }) {
  const ui = useUI();
  const { data, today } = useFleet();
  const toast = useToast();
  const vehicle = data.vehicles.find((v) => v.id === vehicleId)!;
  const existing = vehicle[kind];
  const [draft, setDraft] = useState<DocDraft>({
    start: existing?.issueDate ?? today,
    expiryOverride: existing?.expiryDate ?? null,
    amount: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const resolved = resolveDoc(draft, vehicle.type, kind, data.masters);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    if (!resolved.ok) return;
    saveDoc(vehicle.id, kind, resolved.input);
    toast(existing ? `${DOC_LABEL[kind]} dates updated` : `${DOC_LABEL[kind]} added`);
    ui.close("docForm");
  };

  return (
    <>
      <OverlayBody>
        <form onSubmit={submit} noValidate>
          <DocFields
            idPrefix="df"
            draft={draft}
            setDraft={setDraft}
            type={vehicle.type}
            kind={kind}
            startLabel="Issue date"
            showAmount={!existing}
            errors={submitted ? resolved.errors : {}}
          />
          <button type="submit" hidden />
        </form>
      </OverlayBody>
      <OverlayFooter>
        <Button variant="secondary" onClick={() => ui.close("docForm")}>
          Cancel
        </Button>
        <Button onClick={() => submit()}>{existing ? "Save dates" : `Add ${DOC_LABEL[kind]}`}</Button>
      </OverlayFooter>
    </>
  );
}

/* --------------------------------- renew --------------------------------- */

function RenewDialog() {
  const ui = useUI();
  const { data } = useFleet();
  const target = ui.renew;
  const vehicle = target ? data.vehicles.find((v) => v.id === target.vehicleId) : undefined;
  return (
    <Overlay
      open={!!(target && vehicle)}
      onClose={() => ui.close("renew")}
      title={`Renew ${target ? DOC_LABEL[target.kind] : ""}`}
      description={vehicle && <Plate plate={vehicle.plate} size="sm" />}
    >
      {target && vehicle && <RenewBody key={`${vehicle.id}-${target.kind}`} vehicleId={vehicle.id} kind={target.kind} />}
    </Overlay>
  );
}

function RenewBody({ vehicleId, kind }: { vehicleId: string; kind: DocKind }) {
  const ui = useUI();
  const { data, today } = useFleet();
  const toast = useToast();
  const vehicle = data.vehicles.find((v) => v.id === vehicleId)!;
  const current = vehicle[kind];
  const [draft, setDraft] = useState<DocDraft>({ start: today, expiryOverride: null, amount: "" });
  const [submitted, setSubmitted] = useState(false);
  const resolved = resolveDoc(draft, vehicle.type, kind, data.masters);
  const label = DOC_LABEL[kind];

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    if (!resolved.ok) return;
    renewDoc(vehicle.id, kind, resolved.input.issueDate, resolved.input.expiryDate, resolved.input.amount);
    toast(`${label} renewed till ${formatDate(resolved.input.expiryDate)}`);
    ui.close("renew");
  };

  return (
    <>
      <OverlayBody>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Current</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-ink tabular">
                {current ? formatDate(current.expiryDate) : "Not on record"}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1 text-right">
              <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">New validity</p>
              <motion.p
                key={resolved.input.expiryDate}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-0.5 truncate text-sm font-semibold text-ink tabular"
              >
                {isValidISO(resolved.input.expiryDate) ? formatDate(resolved.input.expiryDate) : "—"}
              </motion.p>
            </div>
          </div>
          <DocFields
            idPrefix="rn"
            draft={draft}
            setDraft={setDraft}
            type={vehicle.type}
            kind={kind}
            startLabel="Renewal date"
            showAmount
            errors={submitted ? resolved.errors : {}}
          />
          <button type="submit" hidden />
        </form>
      </OverlayBody>
      <OverlayFooter>
        <Button variant="secondary" onClick={() => ui.close("renew")}>
          Cancel
        </Button>
        <Button onClick={() => submit()} icon={<CalendarClock className="size-4" />}>
          Confirm renewal
        </Button>
      </OverlayFooter>
    </>
  );
}

/* -------------------------------- confirm -------------------------------- */

function ConfirmDialog() {
  const ui = useUI();
  const c = ui.confirm;
  return (
    <Overlay open={!!c} onClose={() => ui.close("confirm")} title={c?.title ?? ""} width="max-w-md">
      {c && (
        <>
          <OverlayBody>
            <div className="text-sm leading-relaxed text-ink-2">{c.message}</div>
          </OverlayBody>
          <OverlayFooter>
            <Button variant="secondary" onClick={() => ui.close("confirm")}>
              Cancel
            </Button>
            <Button
              variant="danger"
              data-autofocus
              onClick={() => {
                c.onConfirm();
                ui.close("confirm");
              }}
            >
              {c.confirmLabel}
            </Button>
          </OverlayFooter>
        </>
      )}
    </Overlay>
  );
}

