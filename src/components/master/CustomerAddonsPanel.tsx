import { useState } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { toast } from "sonner";
import { Loader2, Puzzle, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MButton, MTag } from "@/components/master/MasterKit";
import { useOperatorCaps } from "@/components/master/MasterShell";
import {
  useClearOrganizationAddon,
  useOrgMarketingProviders,
  useOrganizationAddons,
  useSetOrganizationAddon,
} from "@/hooks/useMarketing";
import { marketingErrorCode } from "@/services/marketing.service";
import { requestErrorOf } from "@/services/api";
import type { OrganizationAddon } from "@/types/marketing";
import { providerLabel } from "@/lib/marketing-providers";

/**
 * Master console -> Customers drawer -> "Add-ons".
 *
 * Lock / unlock a customer's paid add-ons (today only Guest Marketing) per
 * wyfy-specs/guest-marketing-campaigns.md §3.4 / §5.9. Every row is what
 * `GET /platform/organizations/{id}/addons` returned -- nothing here is
 * invented, and before the backend ships that endpoint this panel shows the
 * server's own error, not placeholder rows.
 *
 * THE SWITCH NEVER LIES. It renders `addon.enabled` from the last server
 * answer. Flipping it opens a confirmation; the PUT goes out on confirm; the
 * switch is disabled while it is in flight; and the new position comes from
 * the refetch that follows the 2xx, not from the click. On an error the
 * switch simply stays where the server says it is, and the server's message
 * is shown.
 *
 * Writes are `billing.manage` at GLOBAL scope on the backend; without the
 * matching `addons` operator cap the rows render read-only.
 */

const ERROR_COPY: Record<string, string> = {
  organization_not_found: "This customer no longer exists.",
  addon_not_found: "This add-on is not known to the server.",
  permission_denied: "Your operator role cannot change add-ons.",
  forbidden: "Your operator role cannot change add-ons.",
};

function errorText(err: unknown, fallback: string): string {
  const code = marketingErrorCode(err);
  if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  return requestErrorOf(err)?.message || fallback;
}

type Pending = { addon: OrganizationAddon; enable: boolean } | null;

export function CustomerAddonsPanel({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const caps = useOperatorCaps();
  const canWrite = caps.has("addons");
  const addons = useOrganizationAddons(organizationId);
  const setAddon = useSetOrganizationAddon(organizationId);
  const clearAddon = useClearOrganizationAddon(organizationId);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const busy = setAddon.isPending || clearAddon.isPending;

  const closeDialog = () => {
    if (setAddon.isPending) return;
    setPending(null);
    setReason("");
  };

  const confirm = async () => {
    if (!pending) return;
    const { addon, enable } = pending;
    try {
      const res = await setAddon.mutateAsync({
        key: addon.key,
        enabled: enable,
        reason: reason.trim() || null,
      });
      const n = res.cancelled_campaign_count;
      toast.success(
        res.addon.enabled
          ? `${res.addon.name} unlocked for ${organizationName}.`
          : `${res.addon.name} locked for ${organizationName}.` +
              (n > 0
                ? ` ${n} scheduled or sending campaign${n === 1 ? " was" : "s were"} cancelled.`
                : ""),
      );
      setPending(null);
      setReason("");
    } catch (err) {
      toast.error(errorText(err, "Could not change the add-on."));
    }
  };

  const reset = async (addon: OrganizationAddon) => {
    try {
      const res = await clearAddon.mutateAsync(addon.key);
      const n = res.cancelled_campaign_count;
      toast.success(
        `${res.addon.name} is back on the plan default (${res.addon.enabled ? "unlocked" : "locked"}).` +
          (n > 0
            ? ` ${n} scheduled or sending campaign${n === 1 ? " was" : "s were"} cancelled.`
            : ""),
      );
    } catch (err) {
      toast.error(errorText(err, "Could not reset the add-on."));
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="customer-addons-heading">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Puzzle className="h-4 w-4 text-primary" aria-hidden />
        <h4 id="customer-addons-heading" className="text-sm font-semibold">
          Add-ons
        </h4>
        {!canWrite && (
          <span className="ml-auto text-[11px] text-muted-foreground">Read-only for your role</span>
        )}
      </div>

      {addons.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : addons.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-foreground">Could not load add-ons.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {errorText(addons.error, "The server did not answer.")}
          </p>
          <MButton variant="outline" className="mt-2" onClick={() => void addons.refetch()}>
            Try again
          </MButton>
        </div>
      ) : !addons.data || addons.data.addons.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          No add-ons are available for this customer.
        </p>
      ) : (
        <ul className="space-y-2">
          {addons.data.addons.map((addon) => {
            const rowBusy = busy && (pending?.addon.key === addon.key || clearAddon.isPending);
            return (
              <li key={addon.key} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{addon.name}</p>
                      <MTag
                        label={addon.source === "override" ? "Override" : "Plan"}
                        tone={addon.source === "override" ? "brand" : "info"}
                      />
                      <MTag
                        label={addon.enabled ? "Unlocked" : "Locked"}
                        tone={addon.enabled ? "active" : "normal"}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{addon.description}</p>
                    {addon.source === "override" && addon.override && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Plan says {addon.plan_value ? "on" : "off"}; overridden
                        {addon.override.set_by?.name
                          ? ` by ${addon.override.set_by.name}`
                          : ""} on {new Date(addon.override.set_at).toLocaleDateString()}
                        {addon.override.reason ? ` — “${addon.override.reason}”` : ""}
                      </p>
                    )}
                    {addon.blocked_by && (
                      <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        Requires {addon.blocked_by === "guest_marketing" ? "Guest Marketing" : addon.blocked_by}
                        . Unlock that first.
                      </p>
                    )}
                    {addon.active_campaign_count > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {addon.active_campaign_count} campaign
                        {addon.active_campaign_count === 1 ? "" : "s"} scheduled or sending
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {rowBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={addon.enabled}
                      disabled={!canWrite || busy || !!addon.blocked_by}
                      aria-label={`${addon.enabled ? "Lock" : "Unlock"} ${addon.name}`}
                      onCheckedChange={(next) => {
                        setReason("");
                        setPending({ addon, enable: next });
                      }}
                    />
                  </div>
                </div>
                {canWrite && addon.source === "override" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reset(addon)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset to plan default
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CustomerProvidersList organizationId={organizationId} />

      {/* Radix primitive directly rather than ui/alert-dialog: the Customers
          drawer is an inline `z-[60]` layer, and the shared AlertDialog's
          overlay/content are `z-50`, which would open *behind* it. */}
      <AlertDialogPrimitive.Root
        open={!!pending}
        onOpenChange={(o) => {
          if (!o) closeDialog();
        }}
      >
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60" />
          <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[70] grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
            <AlertDialogPrimitive.Title className="text-base font-semibold">
              {pending?.enable
                ? `Unlock ${pending.addon.name} for ${organizationName}?`
                : `Lock ${pending?.addon.name ?? ""} for ${organizationName}?`}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              {pending?.enable
                ? "The customer's dashboard unlocks immediately. Nothing is sent until they build a campaign themselves."
                : pending?.addon.key === "guest_marketing_byo"
                  ? `Campaigns scheduled or sending through the customer's own provider will be cancelled (${pending.addon.active_campaign_count} active). Their provider settings are kept, and new campaigns send through Wyfy.`
                  : `${pending?.addon.active_campaign_count ?? 0} scheduled or sending campaign${
                      pending?.addon.active_campaign_count === 1 ? "" : "s"
                    } will be cancelled. Their templates, consents and logs are kept and come back on unlock.`}
            </AlertDialogPrimitive.Description>
            <div>
              <label
                htmlFor="addon-reason"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Reason (optional)
              </label>
              <Textarea
                id="addon-reason"
                value={reason}
                maxLength={500}
                rows={2}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Paid invoice #1042"
              />
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <MButton variant="outline" disabled={setAddon.isPending}>
                  Cancel
                </MButton>
              </AlertDialogPrimitive.Cancel>
              <MButton
                variant="primary"
                disabled={setAddon.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  void confirm();
                }}
              >
                {setAddon.isPending && <Loader2 className="animate-spin" />}
                {pending?.enable ? "Unlock" : "Lock"}
              </MButton>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </section>
  );
}

const PROVIDER_STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  unverified: "Not verified",
  failed: "Failed",
};

/**
 * §12.4/§12.6: which account sends each of the customer's channels. Read-only
 * -- Master can't edit a customer's provider, only lock the BYO add-on --
 * and the endpoint carries no secrets and no hints at all.
 */
function CustomerProvidersList({ organizationId }: { organizationId: string }) {
  const q = useOrgMarketingProviders(organizationId);
  return (
    <div className="space-y-1.5" data-testid="master-providers">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Marketing providers
      </p>
      {q.isLoading ? (
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      ) : q.isError ? (
        <p className="text-xs text-muted-foreground">
          Couldn't load providers: {errorText(q.error, "the server did not answer.")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-xs">
          {q.data?.channels.map((c) => (
            <li key={c.channel} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="font-medium">{PROVIDER_CHANNEL_LABEL[c.channel] ?? c.channel}</span>
              <span className="text-muted-foreground">
                {c.own
                  ? `Own: ${providerLabel(c.own.provider_type)}${c.own.sender_label ? ` · ${c.own.sender_label}` : ""} · ${PROVIDER_STATUS_LABEL[c.own.status] ?? c.own.status}${c.own.enabled ? "" : " · off"}${c.effective_source === "own" ? "" : " (Wyfy sends)"}`
                  : "Wyfy default"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PROVIDER_CHANNEL_LABEL: Record<string, string> = { sms: "SMS", whatsapp: "WhatsApp", email: "Email" };
