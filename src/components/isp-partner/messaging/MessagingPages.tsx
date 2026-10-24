/**
 * F1/F3 (ADDENDUM_04, coordinator defaults) in the partner console.
 *
 *  - `MessagingPage` (`/partner/messaging`, ISP level): the ISP's ONE credit
 *    wallet (Master tops it up; every customer send draws from it), the
 *    ISP-level BYO sender per channel (copied to every customer not on its
 *    own sender), and the owner/admin switch that allows per-customer senders.
 *  - `GuestMessagingPage` (workspace slot `marketing`): the customer's own
 *    Marketing page mounted unchanged, under a small "whose sender" card.
 *
 * Secrets follow the customer form's rule (`lib/marketing-providers`): never
 * prefilled, never echoed; a blank secret keeps the stored one. SMS DLT
 * registration stays the ISP's responsibility, and the page says so.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { M_INPUT, MButton, MStat, MTag } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";
import { setShimLocallyDenied } from "@/lib/isp-partner/api-shim";
import { isNetworkHost } from "@/lib/isp-partner/network-host";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import {
  buildProviderPut,
  initialProviderValues,
  providerTypeDef,
  providerTypesFor,
  type Channel,
} from "@/lib/marketing-providers";
import {
  credits,
  messagingService as svc,
  type ProviderChannel,
} from "@/services/isp-partner/messaging";

const K = ["isp-messaging"];

const MarketingView = lazy(() =>
  import("@/components/marketing/MarketingView").then((m) => ({ default: m.MarketingView })),
);

const CHANNEL_LABEL: Record<Channel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

// -- wallet ------------------------------------------------------------------

export function WalletCard() {
  const q = useQuery({ queryKey: [...K, "wallet"], queryFn: svc.wallet });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the credit wallet" />;
  const w = q.data;
  return (
    <Card title="Messaging credit wallet">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MStat
          label="Available (credits)"
          value={credits(w.pool.available_minor, w.minor_per_credit)}
        />
        <MStat label="Held by customers" value={credits(w.held_total_minor, w.minor_per_credit)} />
        <MStat label="Status" value={w.pool.is_low ? "Low" : "OK"} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        One wallet for all your customers. Wyfy tops it up; each send moves only what it needs to
        the customer, and anything unspent stays with that customer for the next send. At zero,
        sends stop with a clear error.
      </p>
    </Card>
  );
}

// -- ISP-level sender -------------------------------------------------------------

function ProviderForm({ channel, row }: { channel: Channel; row: ProviderChannel["own"] }) {
  const qc = useQueryClient();
  const types = providerTypesFor(channel).filter((t) => t.available);
  const [type, setType] = useState(row?.provider_type ?? types[0]?.type ?? "");
  const def = providerTypeDef(type);
  const [values, setValues] = useState<Record<string, string>>(() =>
    def ? initialProviderValues(def, row?.display) : {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: [...K, "providers"] });
  const save = useMutation({
    mutationFn: (body: Parameters<typeof svc.putProvider>[1]) => svc.putProvider(channel, body),
    onSuccess: () => {
      toast.success("Sender saved and copied to your customers. Verify it before it sends.");
      refresh();
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const verify = useMutation({
    mutationFn: () => svc.verifyProvider(channel, testTo.trim() || null),
    onSuccess: () => {
      toast.success("Verification requested.");
      refresh();
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => svc.deleteProvider(channel),
    onSuccess: () => {
      toast.success("Sender removed from you and your customers.");
      refresh();
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  if (!def) return <p className="text-sm text-muted-foreground">No provider available.</p>;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const built = buildProviderPut(
          def,
          values,
          row ? { provider_type: row.provider_type, display: row.display } : null,
        );
        setErrors(built.errors);
        if (built.body) save.mutate(built.body);
      }}
    >
      <select
        className={`${M_INPUT} w-auto`}
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          const d = providerTypeDef(e.target.value);
          if (d) setValues(initialProviderValues(d, null));
        }}
        aria-label="Provider"
      >
        {types.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        {def.fields.map((f) => (
          <label key={f.key} className="text-xs">
            <span className="text-muted-foreground">
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.kind === "select" && f.options ? (
              <select
                className={M_INPUT}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={M_INPUT}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                placeholder={f.secret && row ? "Saved. Leave blank to keep." : ""}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
            {errors[f.key] && <span className="text-destructive">{errors[f.key]}</span>}
          </label>
        ))}
      </div>
      {channel === "sms" && (
        <p className="text-[11px] text-muted-foreground">
          DLT registration (entity, sender id, templates) is yours, as your own SMS account.
        </p>
      )}
      <FormError message={error} />
      <div className="flex flex-wrap items-center gap-2">
        <MButton type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />} Save
        </MButton>
        {row && (
          <>
            <input
              className={`${M_INPUT} w-48`}
              placeholder="Send a test to (optional)"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              aria-label="Test address"
            />
            <MButton
              type="button"
              variant="outline"
              disabled={verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verify
            </MButton>
            <MButton
              type="button"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove
            </MButton>
          </>
        )}
      </div>
    </form>
  );
}

function IspSenders() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...K, "providers"], queryFn: svc.providers });
  const sync = useMutation({
    mutationFn: svc.syncAll,
    onSuccess: () => {
      toast.success("Sender copied to every customer that uses yours.");
      qc.invalidateQueries({ queryKey: [...K, "providers"] });
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const manage = can("isp_engage.manage");
  return (
    <Card
      title="Your sender (all customers)"
      actions={
        manage && (
          <MButton variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
            Copy to new customers
          </MButton>
        )
      }
    >
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="senders" />
      ) : (
        <div className="space-y-4">
          {q.data.map((c) => (
            <div key={c.channel} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">{CHANNEL_LABEL[c.channel]}</span>
                {c.own ? (
                  <>
                    <MTag label={c.own.status} />
                    {c.own.last_error && (
                      <span className="text-xs text-destructive">{c.own.last_error}</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Not set: customers send through Wyfy and use wallet credits.
                  </span>
                )}
              </div>
              {manage ? (
                <ProviderForm channel={c.channel} row={c.own} />
              ) : (
                <p className="text-xs text-muted-foreground">Your role can view senders only.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OverrideSwitch() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...K, "settings"], queryFn: svc.settings });
  const set = useMutation({
    mutationFn: (v: boolean) => svc.setOverride(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: K }),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  if (!q.data) return null;
  return (
    <Card title="Per-customer senders">
      <p className="text-sm text-muted-foreground">
        {q.data.byo_customer_override_enabled
          ? "On: you can switch a customer to its own sender in that customer's Guest Messaging."
          : "Off: every customer uses your sender."}
      </p>
      {can("isp_engage.manage") && (
        <MButton
          className="mt-2"
          variant="outline"
          disabled={set.isPending}
          onClick={() => set.mutate(!q.data.byo_customer_override_enabled)}
        >
          {q.data.byo_customer_override_enabled ? "Turn off" : "Turn on"}
        </MButton>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Guest identifiers:{" "}
        {q.data.pii_unmasked_for_me
          ? "shown in full to you (owner/admin; Wyfy enabled it). Every view is recorded."
          : "masked."}
      </p>
    </Card>
  );
}

export function MessagingPage() {
  return (
    <div className="space-y-4">
      <WalletCard />
      <OverrideSwitch />
      <IspSenders />
    </div>
  );
}

// -- workspace slot: the customer's own Marketing page -------------------------------

function CustomerSenderCard({ customerId }: { customerId: string }) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...K, "customer", customerId],
    queryFn: () => svc.customerSender(customerId),
  });
  const set = useMutation({
    mutationFn: (own: boolean) => svc.setCustomerSender(customerId, own),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...K, "customer", customerId] }),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  if (!q.data) return null;
  const own = q.data.own_sender;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
      <span className="text-muted-foreground">Sender:</span>
      <MTag label={own ? "customer's own" : "your ISP sender"} />
      {can("isp_engage.manage") && (q.data.override_allowed || own) && (
        <MButton variant="ghost" disabled={set.isPending} onClick={() => set.mutate(!own)}>
          {own ? "Use my ISP sender" : "Use the customer's own sender"}
        </MButton>
      )}
    </div>
  );
}

export function GuestMessagingPage({ customerId, locationId }: PartnerSlotProps) {
  const { can } = usePartner();
  const mayReadSessions = can("isp_access.read");
  // The mounted customer page's venue picker asks /guest-sessions for online
  // counts. A role without isp_access.read (isp-billing) would 403 on it, and
  // every 403 is audited; refuse it in the shim instead (the picker already
  // degrades to "counts unavailable").
  useEffect(() => {
    if (mayReadSessions) return;
    // Same guard every shim-touching component carries: the shim exists
    // only on the network host.
    if (typeof window === "undefined" || !isNetworkHost(window.location.hostname)) return;
    setShimLocallyDenied([/^\/guest-sessions(\/|$)/]);
    return () => setShimLocallyDenied([]);
  }, [mayReadSessions]);
  return (
    <div className="space-y-3">
      <CustomerSenderCard customerId={customerId} />
      <Suspense fallback={<LoadingBlock />}>
        <MarketingView locationId={locationId as string} />
      </Suspense>
    </div>
  );
}
