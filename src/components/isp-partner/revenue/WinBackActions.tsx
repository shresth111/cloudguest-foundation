/**
 * CHURN-RISK win-back actions. Only existing endpoints:
 * - Renew at an offer price: JAZE-1 360 profile `override_price_paise` +
 *   `/renew` (+ putting the previous override back unless it should stay);
 *   the steps come from `offerRenewalSteps`.
 * - Raise a ticket: the SUB360-2 dialog on JAZE-5 `/apps/tickets` (only while
 *   Apps is on).
 * - WhatsApp: the existing wa.me share (DIR-2 / §9) with the JAZE-4 pay link
 *   for the open invoice when automation answers; a plain renewal note when
 *   there is no open invoice. Staff open the link themselves; nothing is sent
 *   by the server.
 */
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, RefreshCw, TicketPlus } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { RaiseTicketDialog } from "@/components/isp-partner/subscribers/workbench/Workbench";
import { useAppsEnabled } from "@/hooks/isp-partner/useApps";
import { useSub360Mutation, useSubscriber360 } from "@/hooks/isp-partner/useSubscriber360";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { whatsappShareUrl, waNumber } from "@/lib/isp-partner/invoices";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { offerRenewalSteps, winbackText } from "@/lib/isp-partner/revenue";
import { idempotencyKey } from "@/lib/isp-partner/subscribers360";
import { financeService } from "@/services/isp-partner/finance";
import { subscribers360Service as svc } from "@/services/isp-partner/subscribers360";
import type { Subscriber360, SubscriberProfile } from "@/services/isp-partner/subscribers360-types";
import type { RiskItem } from "@/services/isp-partner/revenue-types";

function OfferRenewDialog({ item, onClose }: { item: RiskItem; onClose: () => void }) {
  const sub = useSubscriber360(item.id);
  const current = sub.data?.profile.override_price_paise ?? null;
  const [price, setPrice] = useState<string | null>(null);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(idempotencyKey);
  const shown = price ?? paiseToInput(current);
  const offer = shown.trim() === "" ? null : parseRupeesToPaise(shown);
  const bad = shown.trim() !== "" && (offer === null || offer <= 0);
  const run = useSub360Mutation(async () => {
    let overrideSet = false;
    let renewed = false;
    try {
      for (const st of offerRenewalSteps(current, offer, keep)) {
        if (st.kind === "renew") {
          await svc.renew(item.id, { idempotency_key: key });
          renewed = true;
        } else {
          const body: SubscriberProfile = { override_price_paise: st.price_paise };
          await svc.putProfile(item.id, body);
          overrideSet = st.kind === "set_override";
        }
      }
    } catch (e) {
      // the offer price must not outlive a failed renewal, nor a renewal
      // whose "back to the usual price" step failed (unless it should stay)
      if (overrideSet && (!renewed || !keep)) {
        await svc
          .putProfile(item.id, { override_price_paise: current })
          .catch(() => toast.error("Put the subscriber's usual price back on their profile."));
      }
      if (renewed) return;
      throw e;
    }
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Renew ${item.display_name || item.identifier || ""}`.trim()}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={run.isPending || bad || sub.isLoading}
            onClick={async () => {
              setError(null);
              try {
                await run.mutateAsync(undefined);
                toast.success("Renewed. Invoice issued.");
                onClose();
              } catch (e) {
                setError(ispErrorMessage(e));
              }
            }}
          >
            {run.isPending ? <Spinner /> : "Renew"}
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {item.package_name ?? "No package"}
          {current !== null ? ` · usual price on this subscriber: ${formatRupees(current)}` : ""}.
          Leave the price empty to renew at the package price.
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Price for this renewal (₹, as the package is priced)
          </span>
          <input
            className={M_INPUT}
            inputMode="decimal"
            value={shown}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={bad}
          />
        </label>
        {bad && <p className="text-xs text-destructive">Enter an amount above ₹0.</p>}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep this price for future renewals (otherwise the usual price comes back right after)
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function WinBackActions({ item }: { item: RiskItem }) {
  const { can, me } = usePartner();
  const apps = useAppsEnabled();
  const [dialog, setDialog] = useState<"renew" | "ticket" | null>(null);
  const [busy, setBusy] = useState(false);
  const canRenew = can("isp_invoices.create") && can("isp_subscribers.update");
  const canTicket = apps.enabled && can("isp_apps.create");

  const whatsapp = async () => {
    setBusy(true);
    try {
      const inv = item.open_invoice;
      let url: string;
      if (inv) {
        url = whatsappShareUrl({
          phone: item.phone,
          name: item.display_name,
          invoiceNumber: inv.number,
          totalPaise: inv.total_paise,
          balancePaise: inv.balance_paise,
          ispName: me.isp.name,
          supportPhone: me.isp.support_phone,
        });
        try {
          const link = await financeService.payLink(inv.id);
          url += encodeURIComponent(`\nPay here: ${link.url}`);
        } catch {
          // automation off (404): the plain reminder, no pay link
        }
      } else {
        const text = encodeURIComponent(
          winbackText({
            name: item.display_name,
            ispName: me.isp.name,
            validUntil: item.valid_until,
            supportPhone: me.isp.support_phone,
          }),
        );
        const n = waNumber(item.phone);
        url = n ? `https://wa.me/${n}?text=${text}` : `https://wa.me/?text=${text}`;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      ispToastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {canRenew && (
        <MButton
          variant="outline"
          title="Renew, optionally at an offer price"
          onClick={() => setDialog("renew")}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Renew
        </MButton>
      )}
      {canTicket && (
        <MButton
          variant="outline"
          title="Raise a helpdesk ticket"
          onClick={() => setDialog("ticket")}
        >
          <TicketPlus className="h-3.5 w-3.5" /> Ticket
        </MButton>
      )}
      <MButton
        variant="ghost"
        title={item.open_invoice ? "WhatsApp the pay link" : "WhatsApp a renewal note"}
        aria-label={`WhatsApp ${item.display_name || item.identifier || "subscriber"}`}
        disabled={busy}
        onClick={whatsapp}
      >
        {busy ? <Spinner /> : <MessageCircle className="h-4 w-4" />}
      </MButton>
      {dialog === "renew" && <OfferRenewDialog item={item} onClose={() => setDialog(null)} />}
      {dialog === "ticket" && (
        <RaiseTicketDialog
          s={{ id: item.id, isp_customer_id: item.isp_customer_id } as Subscriber360}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
