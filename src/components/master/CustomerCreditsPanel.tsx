import { useEffect, useState } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MButton } from "@/components/master/MasterKit";
import { useOperatorCaps } from "@/components/master/MasterShell";
import {
  useAdjustOrgCredits,
  useOrgCredits,
  useSetOrgCreditThreshold,
  useSetOrgPrices,
} from "@/hooks/useMarketing";
import { marketingErrorCode } from "@/services/marketing.service";
import { requestErrorOf } from "@/services/api";
import { formatCredits, formatSignedCredits, parseCreditsInput } from "@/lib/marketing-credits";
import { MARKETING_CHANNELS, type MarketingChannel } from "@/types/marketing";

const CHANNEL: Record<MarketingChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};
const ERROR_COPY: Record<string, string> = {
  adjustment_exceeds_available:
    "That would take the available balance below zero (credits held for campaigns can't be touched).",
  billing_profile_missing:
    "This customer has no billing profile, so no GST invoice can be issued. Untick the invoice or add a profile first.",
  organization_not_found: "This customer no longer exists.",
  permission_denied: "Your operator role can't change credits.",
  forbidden: "Your operator role can't change credits.",
};
function errorText(err: unknown, fallback: string) {
  const code = marketingErrorCode(err);
  return (code && ERROR_COPY[code]) || requestErrorOf(err)?.message || fallback;
}
const TYPE_LABEL: Record<string, string> = {
  topup: "Top-up",
  reserve: "Held",
  release: "Returned",
  debit: "Charged",
  refund: "Refund",
  adjustment: "Adjustment",
};

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Master -> Customers drawer -> Marketing credits (spec §13.10).
 *
 * Balance, held, low-balance threshold, the customer's price overrides, the
 * last 20 ledger rows, and "Add credits / Adjust". Every figure is the
 * server's and is re-read after each write -- nothing optimistic. Controls
 * render only with the `addons` cap (billing.manage); the rest is read-only.
 */
export function CustomerCreditsPanel({ organizationId }: { organizationId: string }) {
  const caps = useOperatorCaps();
  const canWrite = caps.has("addons");
  const q = useOrgCredits(organizationId);
  const adjust = useAdjustOrgCredits(organizationId);
  const setThreshold = useSetOrgCreditThreshold(organizationId);
  const setPrices = useSetOrgPrices(organizationId);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"topup" | "adjustment" | "refund">("topup");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [invoice, setInvoice] = useState(false);
  const [paid, setPaid] = useState("");
  const [key, setKey] = useState("");
  const [threshold, setThresholdText] = useState("");
  const [prices, setPriceText] = useState<Record<MarketingChannel, string>>({
    sms: "",
    whatsapp: "",
    email: "",
  });

  useEffect(() => {
    if (!q.data) return;
    setThresholdText(formatCredits(q.data.wallet.low_balance_threshold_minor));
    const p = { sms: "", whatsapp: "", email: "" } as Record<MarketingChannel, string>;
    for (const ch of MARKETING_CHANNELS) {
      const r = q.data.prices[ch];
      p[ch] = r?.source === "org_override" ? formatCredits(r.unit_price_minor) : "";
    }
    setPriceText(p);
  }, [q.data]);

  const openDialog = () => {
    setType("topup");
    setAmount("");
    setNote("");
    setReference("");
    setInvoice(false);
    setPaid("");
    // One key per opening: a double submit or a retried request after a
    // timeout posts the SAME entry once (§13.2 idempotency).
    setKey(newKey());
    setOpen(true);
  };

  const minor = parseCreditsInput(amount);
  const paidMinor = parseCreditsInput(paid);
  const amountOk = minor !== null && (type === "adjustment" ? minor !== 0 : minor > 0);
  const noteOk = note.trim().length >= 5 && note.trim().length <= 500;
  const paidOk = !invoice || (paidMinor !== null && paidMinor > 0);
  const canSubmit = amountOk && noteOk && paidOk && !adjust.isPending;

  const submit = async () => {
    try {
      const r = await adjust.mutateAsync({
        entry_type: type,
        amount_minor: minor!,
        note: note.trim(),
        reference: reference.trim() || null,
        campaign_id: null,
        issue_invoice: type === "topup" && invoice,
        ...(type === "topup" && invoice ? { amount_paid_minor_inr: paidMinor! } : {}),
        idempotency_key: key,
      });
      toast.success(
        `${TYPE_LABEL[type]} posted: available is now ${formatCredits(r.wallet.available_minor)} credits.` +
          (r.invoice ? ` Invoice ${r.invoice.invoice_number} issued.` : ""),
      );
      setOpen(false);
    } catch (err) {
      toast.error(errorText(err, "Couldn't post the entry."));
    }
  };

  const saveThreshold = async () => {
    const m = parseCreditsInput(threshold);
    if (m === null || m < 0) return toast.error("Enter a threshold in credits, 0 or more.");
    try {
      await setThreshold.mutateAsync(m);
      toast.success("Low-balance threshold saved.");
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the threshold."));
    }
  };

  const savePrices = async () => {
    if (!q.data) return;
    const body: { channel: MarketingChannel; unit_price_minor: number | null }[] = [];
    for (const ch of MARKETING_CHANNELS) {
      const text = prices[ch].trim();
      const wasOverride = q.data.prices[ch]?.source === "org_override";
      if (!text) {
        if (wasOverride) body.push({ channel: ch, unit_price_minor: null });
        continue;
      }
      const m = parseCreditsInput(text);
      if (m === null || m < 0 || m > 10_000)
        return toast.error(`${CHANNEL[ch]}: enter credits between 0 and 100.`);
      if (!wasOverride || m !== q.data.prices[ch].unit_price_minor)
        body.push({ channel: ch, unit_price_minor: m });
    }
    if (body.length === 0) return toast.message("Nothing changed.");
    try {
      await setPrices.mutateAsync({ prices: body, note: null });
      toast.success("Customer prices saved. They apply to campaigns scheduled from now on.");
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the prices."));
    }
  };

  return (
    <section
      className="space-y-3"
      aria-labelledby="customer-credits-heading"
      data-testid="master-credits"
    >
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Coins className="h-4 w-4 text-primary" aria-hidden />
        <h4 id="customer-credits-heading" className="text-sm font-semibold">
          Marketing credits
        </h4>
        {canWrite && q.data && (
          <MButton variant="outline" className="ml-auto" onClick={openDialog}>
            Add credits / Adjust
          </MButton>
        )}
      </div>

      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : q.isError || !q.data ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">Couldn't load credits.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {errorText(q.error, "The server did not answer.")}
          </p>
          <MButton variant="outline" className="mt-2" onClick={() => void q.refetch()}>
            Try again
          </MButton>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border p-2">
              <p className="text-[11px] text-muted-foreground">Available</p>
              <p
                className={`text-lg font-semibold tabular-nums ${q.data.wallet.is_low ? "text-amber-600" : ""}`}
              >
                {formatCredits(q.data.wallet.available_minor)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-2">
              <p className="text-[11px] text-muted-foreground">Held</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCredits(q.data.wallet.reserved_minor)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-2">
              <p className="text-[11px] text-muted-foreground">Low below</p>
              {canWrite ? (
                <div className="mt-0.5 flex items-center gap-1">
                  <Input
                    aria-label="Low-balance threshold in credits"
                    className="h-7 text-center text-sm tabular-nums"
                    value={threshold}
                    onChange={(e) => setThresholdText(e.target.value)}
                  />
                  <MButton
                    variant="ghost"
                    disabled={setThreshold.isPending}
                    onClick={() => void saveThreshold()}
                  >
                    Save
                  </MButton>
                </div>
              ) : (
                <p className="text-lg font-semibold tabular-nums">
                  {formatCredits(q.data.wallet.low_balance_threshold_minor)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Prices for this customer</p>
            <ul className="divide-y divide-border rounded-lg border border-border text-xs">
              {MARKETING_CHANNELS.map((ch) => {
                const p = q.data!.prices[ch];
                return (
                  <li key={ch} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="font-medium">{CHANNEL[ch]}</span>
                    {canWrite ? (
                      <span className="flex items-center gap-1.5">
                        <Input
                          aria-label={`${CHANNEL[ch]} override in credits`}
                          className="h-7 w-24 text-right tabular-nums"
                          placeholder={`${formatCredits(p?.platform_unit_price_minor ?? p?.unit_price_minor ?? 0)} (platform)`}
                          value={prices[ch]}
                          onChange={(e) => setPriceText((x) => ({ ...x, [ch]: e.target.value }))}
                        />
                      </span>
                    ) : (
                      <span className="tabular-nums">
                        {p ? formatCredits(p.unit_price_minor) : "—"}
                        {p?.source === "org_override" ? " (override)" : " (platform)"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {canWrite && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to use the platform price.
                </p>
                <MButton
                  variant="outline"
                  disabled={setPrices.isPending}
                  onClick={() => void savePrices()}
                >
                  Save prices
                </MButton>
              </div>
            )}
          </div>

          {q.data.active_campaign_reservations.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Held for:{" "}
              {q.data.active_campaign_reservations
                .map((r) => `${r.name} (${formatCredits(r.reserved_minor - r.debited_minor)})`)
                .join(", ")}
            </p>
          )}

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Recent entries</p>
            {q.data.recent_entries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No entries yet.</p>
            ) : (
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border text-xs">
                {q.data.recent_entries.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {TYPE_LABEL[r.entry_type] ?? r.entry_type}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                        {r.campaign ? ` · ${r.campaign.name}` : ""}
                        {r.reference ? ` · ${r.reference}` : ""}
                        {r.note ? ` · ${r.note}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {r.delta_available_minor !== 0
                        ? formatSignedCredits(r.delta_available_minor)
                        : `held ${formatSignedCredits(r.delta_reserved_minor)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Radix primitive directly: the drawer is z-[60] (see CustomerAddonsPanel). */}
      <AlertDialogPrimitive.Root open={open} onOpenChange={(o) => !adjust.isPending && setOpen(o)}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60" />
          <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[70] grid max-h-[92vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl">
            <AlertDialogPrimitive.Title className="text-base font-semibold">
              Add credits / Adjust
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-xs text-muted-foreground">
              Posted to the ledger and the audit log. It can't be edited afterwards; correct it with
              another entry.
            </AlertDialogPrimitive.Description>
            <div className="flex gap-1">
              {(["topup", "adjustment", "refund"] as const).map((t) => (
                <MButton
                  key={t}
                  variant={type === t ? "primary" : "outline"}
                  onClick={() => setType(t)}
                >
                  {TYPE_LABEL[t]}
                </MButton>
              ))}
            </div>
            <label className="text-xs">
              Credits {type === "adjustment" ? "(negative to deduct)" : ""}
              <Input
                className="mt-1 tabular-nums"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Note (required, 5–500 characters)
              <Textarea
                className="mt-1"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Reference (UTR, cheque, PO; optional)
              <Input
                className="mt-1"
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            {type === "topup" && (
              <>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={invoice} onCheckedChange={(v) => setInvoice(!!v)} />
                  Issue a GST invoice
                </label>
                {invoice && (
                  <label className="text-xs">
                    Amount paid, before GST (₹)
                    <Input
                      className="mt-1 tabular-nums"
                      inputMode="decimal"
                      value={paid}
                      onChange={(e) => setPaid(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <MButton variant="outline" disabled={adjust.isPending}>
                  Cancel
                </MButton>
              </AlertDialogPrimitive.Cancel>
              <MButton
                variant="primary"
                disabled={!canSubmit}
                onClick={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {adjust.isPending && <Loader2 className="animate-spin" />}
                Post {TYPE_LABEL[type].toLowerCase()}
              </MButton>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </section>
  );
}
