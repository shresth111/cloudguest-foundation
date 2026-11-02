/**
 * Subscriber 360 action dialogs (ADDENDUM_05 J1/J11): renew, revert, grace,
 * block, freeze, move, note, edit profile. Each calls one JAZE-1 endpoint;
 * the API re-checks state and permission, so a stale button only errors.
 */
import { DiscountCodeField } from "@/components/isp-partner/discounts/DiscountCodeField";
import { discountField } from "@/lib/isp-partner/discount-apply";
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { CustomerSelect, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { ProfileFields, emptyDraft } from "@/components/isp-partner/subscribers/ProfileFields";
import { CyclesSelect } from "@/components/isp-partner/plans/CyclesSelect";
import { ReuploadDocs } from "@/components/isp-partner/subscribers/ReuploadDocs";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { useSub360Mutation } from "@/hooks/isp-partner/useSubscriber360";
import { ispFormMessage } from "@/lib/isp-partner/form-errors";
import { formatRupees, PAYMENT_MODE_LABEL } from "@/lib/isp-partner/money";
import { draftToProfile, idempotencyKey } from "@/lib/isp-partner/subscribers360";
import { subscribers360Service as svc } from "@/services/isp-partner/subscribers360";
import type { Subscriber360 } from "@/services/isp-partner/subscribers360-types";

/** Backend field -> label, for errors named in the form message. */
const RENEW_LABELS: Record<string, string> = {
  package_id: "Package",
  amount_paise: "Amount received",
  reference: "UTR / reference",
  mode: "Payment mode",
  po_number: "PO number",
  cycles: "Cycles",
  discount_code: "Discount code",
  received_at: "Received on",
};

export type ActionKind =
  | "renew"
  | "revert"
  | "grace"
  | "block"
  | "freeze"
  | "move"
  | "note"
  | "profile";

type Props = { s: Subscriber360; onClose: () => void; canPay: boolean; canManage: boolean };

function Footer({
  busy,
  onClose,
  onOk,
  label,
  danger,
}: {
  busy: boolean;
  onClose: () => void;
  onOk: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <>
      <MButton variant="outline" onClick={onClose}>
        Cancel
      </MButton>
      <MButton
        disabled={busy}
        onClick={onOk}
        className={danger ? "bg-rose-600 hover:bg-rose-700" : undefined}
      >
        {busy && <Spinner />} {label}
      </MButton>
    </>
  );
}

function useRun(onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    try {
      await fn();
      toast.success(ok);
      onClose();
    } catch (err) {
      setError(ispFormMessage(err, RENEW_LABELS));
    }
  };
  return { error, setError, run };
}

function RenewDialog({ s, onClose, canPay }: Props) {
  const packages = usePackages({ status: "active", page_size: 100 });
  const [pkg, setPkg] = useState(s.package?.id ?? "");
  const [paid, setPaid] = useState(false);
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [key] = useState(idempotencyKey);
  const [cycles, setCycles] = useState(1);
  const [code, setCode] = useState("");
  const m = useSub360Mutation(() =>
    svc.renew(s.id, {
      package_id: pkg || undefined,
      paid_now: paid,
      payment: paid ? { mode, reference: reference.trim() || null } : null,
      idempotency_key: key,
      ...(cycles > 1 ? { cycles } : {}),
      ...discountField(code),
    }),
  );
  const { error, run } = useRun(onClose);
  const override = s.profile.override_price_paise;
  const chosen = packages.data?.items.find((p) => p.id === pkg);
  return (
    <MDialog
      open
      onClose={onClose}
      title="Renew"
      footer={
        <Footer
          busy={m.isPending}
          onClose={onClose}
          label="Renew"
          onOk={() => run(() => m.mutateAsync(undefined), "Renewed. Invoice issued.")}
        />
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Package</span>
          <select className={M_INPUT} value={pkg} onChange={(e) => setPkg(e.target.value)}>
            {(packages.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          Price:{" "}
          {override !== null && override !== undefined
            ? `${formatRupees(override)} (this subscriber's override)`
            : chosen
              ? formatRupees(chosen.price_paise)
              : "–"}
          {cycles > 1 ? ` x ${cycles} cycles` : ""}. Validity extends from today or the current end
          date, whichever is later.
        </p>
        <CyclesSelect value={cycles} onChange={setCycles} validityDays={chosen?.validity_days} />
        <DiscountCodeField
          value={code}
          onChange={setCode}
          pricePaise={override ?? chosen?.price_paise}
          includesGst={!!chosen?.price_includes_gst}
          cycles={cycles}
          packageId={chosen?.id}
        />
        {canPay && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Payment received now
          </label>
        )}
        {paid && (
          <div className="grid grid-cols-2 gap-3">
            <select className={M_INPUT} value={mode} onChange={(e) => setMode(e.target.value)}>
              {["cash", "upi", "bank_transfer"].map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_MODE_LABEL[k]}
                </option>
              ))}
            </select>
            <TextField
              label="Reference"
              value={reference}
              onChange={setReference}
              hint={mode === "cash" ? "Optional for cash" : "UTR / transaction id"}
            />
          </div>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function ReasonDialog({
  title,
  label,
  hint,
  required,
  danger,
  onOk,
  onClose,
  busy,
  error,
  children,
}: {
  title: string;
  label: string;
  hint?: string;
  required?: boolean;
  danger?: boolean;
  onOk: (reason: string) => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  return (
    <MDialog
      open
      onClose={onClose}
      title={title}
      footer={
        <Footer
          busy={busy || (required === true && reason.trim().length < 3)}
          onClose={onClose}
          label={label}
          danger={danger}
          onOk={() => onOk(reason.trim())}
        />
      }
    >
      <div className="space-y-3 text-sm">
        {children}
        <TextField
          label={required ? "Reason" : "Reason (optional)"}
          value={reason}
          onChange={setReason}
          hint={hint}
        />
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function RevertDialog({ s, onClose }: Props) {
  const m = useSub360Mutation((reason: string) => svc.revert(s.id, reason));
  const { error, run } = useRun(onClose);
  return (
    <ReasonDialog
      title="Revert the last renewal"
      label="Revert"
      required
      danger
      busy={m.isPending}
      error={error}
      onClose={onClose}
      onOk={(r) => run(() => m.mutateAsync(r), "Renewal reverted. A credit note was issued.")}
    >
      <p className="text-xs text-muted-foreground">
        Restores the validity and package from before the last renewal and cancels its invoice with
        a credit note. If a payment was recorded on it, void that payment first.
      </p>
    </ReasonDialog>
  );
}

function GraceDialog({ s, onClose }: Props) {
  const [hours, setHours] = useState(24);
  const m = useSub360Mutation((note: string) => svc.grace(s.id, hours, note));
  const { error, run } = useRun(onClose);
  return (
    <ReasonDialog
      title="Give grace time"
      label="Give grace"
      busy={m.isPending}
      error={error}
      onClose={onClose}
      onOk={(r) => run(() => m.mutateAsync(r), `Grace of ${hours} h given.`)}
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">How long</span>
        <select
          className={M_INPUT}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {[6, 12, 24, 48, 72, 168].map((h) => (
            <option key={h} value={h}>
              {h < 24 ? `${h} hours` : `${h / 24} day${h > 24 ? "s" : ""}`}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        Extends validity without recording a payment. One grace at a time.
      </p>
    </ReasonDialog>
  );
}

function BlockDialog({ s, onClose, canManage }: Props) {
  const [kind, setKind] = useState<"temporary" | "permanent">("temporary");
  const m = useSub360Mutation((reason: string) => svc.block(s.id, kind, reason));
  const { error, run } = useRun(onClose);
  return (
    <ReasonDialog
      title="Block subscriber"
      label="Block"
      danger
      busy={m.isPending}
      error={error}
      onClose={onClose}
      onOk={(r) => run(() => m.mutateAsync(r), "Blocked. Live sessions were ended.")}
    >
      {canManage && (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Kind</span>
          <select
            className={M_INPUT}
            value={kind}
            onChange={(e) => setKind(e.target.value as "temporary" | "permanent")}
          >
            <option value="temporary">Temporary</option>
            <option value="permanent">Permanent (only an owner or admin can lift it)</option>
          </select>
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Ends live sessions and refuses new sign-ins until unblocked.
      </p>
    </ReasonDialog>
  );
}

function FreezeDialog({ s, onClose }: Props) {
  const m = useSub360Mutation((reason: string) => svc.freeze(s.id, reason));
  const { error, run } = useRun(onClose);
  return (
    <ReasonDialog
      title="Freeze service"
      label="Freeze"
      busy={m.isPending}
      error={error}
      onClose={onClose}
      onOk={(r) => run(() => m.mutateAsync(r), "Frozen. The remaining validity is kept.")}
      hint="e.g. away for two months"
    >
      <p className="text-xs text-muted-foreground">
        Pauses the remaining validity and stops access. Unfreeze gives the same time back.
      </p>
    </ReasonDialog>
  );
}

function MoveDialog({ s, onClose }: Props) {
  const customers = useIspCustomerOptions();
  const [target, setTarget] = useState("");
  const m = useSub360Mutation((reason: string) => svc.move(s.id, target, reason));
  const { error, setError, run } = useRun(onClose);
  const options = (customers.data ?? []).filter((c) => c.id !== s.isp_customer_id);
  return (
    <ReasonDialog
      title="Move to another customer"
      label="Move"
      busy={m.isPending || !target}
      error={error}
      onClose={onClose}
      onOk={(r) =>
        target ? run(() => m.mutateAsync(r), "Moved.") : setError("Pick the customer.")
      }
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">New customer</span>
        <CustomerSelect value={target} onChange={setTarget} customers={options} allLabel={null} />
      </label>
      <p className="text-xs text-muted-foreground">
        Live sessions at the current venue end. Invoices stay where they were issued.
      </p>
    </ReasonDialog>
  );
}

function NoteDialog({ s, onClose }: Props) {
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("phone");
  const [close, setClose] = useState(false);
  const m = useSub360Mutation(() =>
    svc.note(s.id, {
      body: body.trim(),
      subject: subject.trim() || null,
      ticket_type: (type || null) as never,
      source: source as never,
      close_after_raising: close,
    }),
  );
  const { error, run } = useRun(onClose);
  return (
    <MDialog
      open
      onClose={onClose}
      title="Log a complaint or note"
      footer={
        <Footer
          busy={m.isPending || !body.trim()}
          onClose={onClose}
          label="Save"
          onOk={() => run(() => m.mutateAsync(undefined), "Saved to the timeline.")}
        />
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <select className={M_INPUT} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Note (no complaint)</option>
            <option value="slow_speed">Slow speed</option>
            <option value="no_connection">No connection</option>
            <option value="frequent_disconnection">Frequent disconnection</option>
            <option value="billing">Billing question</option>
            <option value="other">Other complaint</option>
          </select>
          <select className={M_INPUT} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="phone">Phone call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="walk_in">Walk-in</option>
            <option value="email">Email</option>
            <option value="field">Field visit</option>
            <option value="other">Other</option>
          </select>
        </div>
        <TextField label="Subject" value={subject} onChange={setSubject} />
        <textarea
          className={`${M_INPUT} min-h-[96px]`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, what you checked, what you told them"
        />
        {type && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} />
            Solved on this call (log it as closed)
          </label>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function ProfileDialog({ s, onClose }: Props) {
  // Seeded once per open: a background refetch must not wipe edits.
  const [draft, setDraft] = useState(() => emptyDraft(s.profile));
  const m = useSub360Mutation((body: Record<string, unknown>) => svc.putProfile(s.id, body));
  const { error, setError, run } = useRun(onClose);
  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title="Edit profile"
      footer={
        <Footer
          busy={m.isPending}
          onClose={onClose}
          label="Save"
          onOk={() => {
            const p = draftToProfile(draft);
            if ("error" in p) return setError(p.error);
            run(() => m.mutateAsync(p.body), "Profile saved.");
          }}
        />
      }
    >
      <ProfileFields draft={draft} onChange={setDraft} />
      <div className="mt-3">
        <ReuploadDocs subscriberId={s.id} />
      </div>
      <FormError message={error} />
    </MDialog>
  );
}

export function SubscriberActionDialog({ kind, ...p }: Props & { kind: ActionKind | null }) {
  switch (kind) {
    case "renew":
      return <RenewDialog {...p} />;
    case "revert":
      return <RevertDialog {...p} />;
    case "grace":
      return <GraceDialog {...p} />;
    case "block":
      return <BlockDialog {...p} />;
    case "freeze":
      return <FreezeDialog {...p} />;
    case "move":
      return <MoveDialog {...p} />;
    case "note":
      return <NoteDialog {...p} />;
    case "profile":
      return <ProfileDialog {...p} />;
    default:
      return null;
  }
}
