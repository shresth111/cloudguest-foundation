/**
 * The subscriber's network block (ADDENDUM_05 J3/J8): FUP usage with reset
 * and top-up, bound device MACs, static IPs, and the enforcement events.
 *
 * Self-contained so it can sit in the Plans → Subscribers drawer today and in
 * JAZE-1's Subscriber 360 page (`<SubscriberNetworkPanel subscriber={s} />`)
 * without either owning the other's code.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { MButton, MDialog, MTag, M_INPUT } from "@/components/master/MasterKit";
import { ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspCustomerLocations } from "@/hooks/isp-partner/useIsp";
import {
  useAddIpBinding,
  useEnforcementEvents,
  useFupStatus,
  useIpBindings,
  useIpPools,
  useMacBindings,
  useSubscriberNetworkMutation,
} from "@/hooks/isp-partner/useNetwork";
import { networkService } from "@/services/isp-partner/network";
import { disconnectRemovedMac } from "@/services/isp-partner/workbench";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { formatBytes, formatDate, formatDateTime } from "@/lib/isp-partner/format";
import {
  enforcementEventDetail,
  enforcementEventLabel,
  fupUsedPercent,
  normaliseMac,
} from "@/lib/isp-partner/network";
import type { Subscriber } from "@/services/isp-partner/plans-types";

function Block({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{title}</p>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function FupBlock({ subscriberId, canEdit }: { subscriberId: string; canEdit: boolean }) {
  const q = useFupStatus(subscriberId);
  const [topup, setTopup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = useSubscriberNetworkMutation(subscriberId, () =>
    networkService.resetFup(subscriberId),
  );
  const add = useSubscriberNetworkMutation(subscriberId, (mb: number) =>
    networkService.topupFup(subscriberId, mb),
  );
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="data usage" />;
  const f = q.data;
  const pct = fupUsedPercent(f.used_bytes, f.allowance_bytes, f.carry_bytes, f.topup_bytes);

  return (
    <Block
      title="Data usage (FUP)"
      actions={
        f.throttled ? (
          <MTag label="Slowed" tone="pending" />
        ) : f.fup_enabled ? (
          <MTag label="Full speed" tone="online" />
        ) : null
      }
    >
      {!f.policy_configured || !f.fup_enabled ? (
        <p className="text-xs text-muted-foreground">
          This subscriber&apos;s package has no data limit.
        </p>
      ) : (
        <>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Data used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? 0}
          >
            <div
              className={f.throttled ? "h-full bg-amber-500" : "h-full bg-primary"}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Used</dt>
            <dd>
              {formatBytes(f.used_bytes)} of{" "}
              {formatBytes((f.allowance_bytes ?? 0) + f.carry_bytes + f.topup_bytes)}
              {pct !== null && ` (${pct}%)`}
              {f.exclude_upload && " · download only"}
            </dd>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd>{formatBytes(f.remaining_bytes)}</dd>
            {(f.carry_bytes > 0 || f.topup_bytes > 0) && (
              <>
                <dt className="text-muted-foreground">Extra</dt>
                <dd>
                  {f.carry_bytes > 0 && `${formatBytes(f.carry_bytes)} carried`}
                  {f.carry_bytes > 0 && f.topup_bytes > 0 && " · "}
                  {f.topup_bytes > 0 && `${formatBytes(f.topup_bytes)} top-up`}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Period</dt>
            <dd>
              {f.period_start
                ? `${formatDate(f.period_start)} – ${formatDate(f.period_end)}`
                : "Starts at the next usage check"}{" "}
              ({f.reset === "day" ? "daily" : f.reset === "month" ? "monthly" : "each validity"})
            </dd>
            {f.throttled && (
              <>
                <dt className="text-muted-foreground">Slowed since</dt>
                <dd>
                  {formatDateTime(f.throttled_at)}
                  {f.fallback_speed_group?.name && ` · ${f.fallback_speed_group.name}`}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Checked</dt>
            <dd>{f.computed_at ? formatDateTime(f.computed_at) : "Not yet"}</dd>
          </dl>
          {!f.enforcement_enabled && (
            <p className="text-[11px] text-muted-foreground">
              Enforcement is off: usage is shown, the speed is not changed.
            </p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <MButton variant="outline" onClick={() => setTopup("1024")}>
                <Plus /> Top up
              </MButton>
              <MButton
                variant="outline"
                disabled={reset.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    await reset.mutateAsync(undefined);
                    toast.success("Usage counter restarted.");
                  } catch (err) {
                    setError(ispErrorMessage(err));
                  }
                }}
              >
                {reset.isPending ? <Spinner /> : <RotateCcw />} Reset counter
              </MButton>
            </div>
          )}
          <FormError message={error} />
        </>
      )}
      <MDialog
        open={topup !== null}
        onClose={() => setTopup(null)}
        title="Add data for this period"
        footer={
          <>
            <MButton variant="outline" onClick={() => setTopup(null)}>
              Cancel
            </MButton>
            <MButton
              disabled={add.isPending}
              onClick={async () => {
                const mb = Number(topup);
                if (!Number.isInteger(mb) || mb < 1 || mb > 100_000_000)
                  return setError("Whole MB, at least 1.");
                setError(null);
                try {
                  await add.mutateAsync(mb);
                  toast.success("Top-up added.");
                  setTopup(null);
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {add.isPending && <Spinner />} Add
            </MButton>
          </>
        }
      >
        <TextField
          label="MB to add"
          value={topup ?? ""}
          onChange={setTopup}
          hint="1024 MB = 1 GB. Only this period; it does not carry forward."
        />
        <FormError message={error} />
      </MDialog>
    </Block>
  );
}

function MacBlock({ subscriberId, canEdit }: { subscriberId: string; canEdit: boolean }) {
  const { can } = usePartner();
  const canDisconnect = can("isp_subscribers.disconnect");
  const q = useMacBindings(subscriberId);
  const [mac, setMac] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useSubscriberNetworkMutation(subscriberId, (m: string) =>
    networkService.addMac(subscriberId, m),
  );
  const remove = useSubscriberNetworkMutation(subscriberId, (id: string) =>
    networkService.deleteMac(subscriberId, id),
  );
  return (
    <Block title="Bound devices (MAC)">
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="bound devices" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No device is bound.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {q.data?.map((b) => (
            <li key={b.id} className="flex items-center gap-2">
              <span className="font-mono">{b.mac}</span>
              <MTag label={b.source === "auto" ? "Auto" : "Manual"} />
              <span className="text-muted-foreground">{formatDateTime(b.bound_at)}</span>
              {canEdit && (
                <MButton
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Remove ${b.mac}`}
                  title="Remove (customer changed device)"
                  disabled={remove.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await remove.mutateAsync(b.id);
                      // SUB360-2: offer to end that device's live session now.
                      toast.success(`${b.mac} removed.`, {
                        // RBAC-FIX R1: only roles that may end sessions get the offer.
                        action: canDisconnect
                          ? {
                              label: "Disconnect now",
                              onClick: () => {
                                disconnectRemovedMac(subscriberId, b.mac).then(
                                  (msg) => toast.success(msg),
                                  (err) => ispToastError(err),
                                );
                              },
                            }
                          : undefined,
                      });
                    } catch (err) {
                      setError(ispErrorMessage(err));
                    }
                  }}
                >
                  <Trash2 />
                </MButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <input
            className={M_INPUT}
            placeholder="AA:BB:CC:DD:EE:FF"
            value={mac}
            aria-label="MAC address"
            onChange={(e) => setMac(e.target.value)}
          />
          <MButton
            disabled={add.isPending || !mac.trim()}
            onClick={async () => {
              const m = normaliseMac(mac);
              if (!m) return setError("Not a MAC address.");
              setError(null);
              try {
                await add.mutateAsync(m);
                setMac("");
                toast.success(`${m} bound.`);
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {add.isPending && <Spinner />} Bind
          </MButton>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Removing a MAC lets the next device bind automatically, if the package binds devices.
      </p>
      <FormError message={error} />
    </Block>
  );
}

function PinIpDialog({
  subscriber,
  onClose,
}: {
  subscriber: Pick<Subscriber, "id" | "isp_customer_id">;
  onClose: () => void;
}) {
  const locations = useIspCustomerLocations(subscriber.isp_customer_id);
  const [locationId, setLocationId] = useState("");
  const pools = useIpPools(locationId);
  const [poolId, setPoolId] = useState("");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useAddIpBinding(subscriber.id);
  const pool = (pools.data ?? []).find((p) => p.id === poolId);
  const locList = locations.data?.items ?? [];

  return (
    <MDialog
      open
      onClose={onClose}
      title="Pin a static IP"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={add.isPending || !locationId || !poolId}
            onClick={async () => {
              let m: string | null = null;
              if (mac.trim()) {
                m = normaliseMac(mac);
                if (!m) return setError("Not a MAC address.");
              }
              setError(null);
              try {
                const b = await add.mutateAsync({
                  isp_location_id: locationId,
                  pool_id: poolId,
                  ip: ip.trim() || null,
                  mac: m,
                });
                toast.success(`${b.ip} pinned.`);
                onClose();
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {add.isPending && <Spinner />} Pin IP
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Location</span>
          <select
            className={M_INPUT}
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setPoolId("");
            }}
          >
            <option value="">Pick…</option>
            {locList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {locationId && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Address pool</span>
            {pools.isLoading ? (
              <Spinner />
            ) : pools.error ? (
              <ErrorBlock error={pools.error} what="address pools" />
            ) : (pools.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This location has no DHCP pool yet. Add one under the customer&apos;s IP addresses.
              </p>
            ) : (
              <select
                className={M_INPUT}
                value={poolId}
                onChange={(e) => setPoolId(e.target.value)}
              >
                <option value="">Pick…</option>
                {(pools.data ?? []).map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.next_free}>
                    {p.name} · {p.range_start}–{p.range_end} · {p.pinned}
                    {p.size !== null ? `/${p.size}` : ""} pinned
                    {p.next_free ? "" : " · full"}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
        {pool && (
          <TextField
            label="IP address"
            value={ip}
            onChange={setIp}
            placeholder={pool.next_free ?? ""}
            hint={`Empty: the next free address${pool.next_free ? ` (${pool.next_free})` : ""}.`}
          />
        )}
        {pool && (
          <TextField
            label="Device MAC (optional)"
            value={mac}
            onChange={setMac}
            placeholder="AA:BB:CC:DD:EE:FF"
          />
        )}
        <p className="text-[11px] text-muted-foreground">
          The address is reserved for this subscriber in Wyfy Guest. The router queue is recorded,
          not pushed, until static-queue push is switched on.
        </p>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function StaticIpBlock({
  subscriber,
  canEdit,
}: {
  subscriber: Pick<Subscriber, "id" | "isp_customer_id">;
  canEdit: boolean;
}) {
  const q = useIpBindings(subscriber.id);
  const [pinning, setPinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useSubscriberNetworkMutation(subscriber.id, (id: string) =>
    networkService.deleteIpBinding(subscriber.id, id),
  );
  return (
    <Block
      title="Static IP"
      actions={
        canEdit && (
          <MButton variant="outline" onClick={() => setPinning(true)}>
            <Plus /> Pin IP
          </MButton>
        )
      }
    >
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="static IPs" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No static IP. The router assigns one.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {q.data?.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-medium">{b.ip}</span>
              {b.mac && <span className="font-mono text-muted-foreground">{b.mac}</span>}
              {b.static_queue && (
                <MTag
                  label={
                    b.queue_status === "active"
                      ? "Queue on router"
                      : b.queue_status === "failed"
                        ? "Queue failed"
                        : "Queue recorded"
                  }
                  tone={
                    b.queue_status === "active"
                      ? "online"
                      : b.queue_status === "failed"
                        ? "offline"
                        : undefined
                  }
                />
              )}
              {b.queue_error && <span className="text-destructive">{b.queue_error}</span>}
              {canEdit && (
                <MButton
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Release ${b.ip}`}
                  title="Release"
                  disabled={remove.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await remove.mutateAsync(b.id);
                      toast.success(`${b.ip} released.`);
                    } catch (err) {
                      setError(ispErrorMessage(err));
                    }
                  }}
                >
                  <Trash2 />
                </MButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormError message={error} />
      {pinning && <PinIpDialog subscriber={subscriber} onClose={() => setPinning(false)} />}
    </Block>
  );
}

export function EnforcementEventsList({
  subscriberId,
  limit = 20,
}: {
  subscriberId: string;
  limit?: number;
}) {
  const q = useEnforcementEvents(subscriberId, limit);
  return (
    <Block title="Network events">
      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="network events" />
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {q.data?.map((e) => {
            const detail = enforcementEventDetail(e.detail);
            return (
              <li key={e.id}>
                <span className="text-muted-foreground">{formatDateTime(e.occurred_at)}</span> ·{" "}
                {enforcementEventLabel(e)}
                {detail && <span className="block text-muted-foreground">{detail}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}

export function SubscriberNetworkPanel({
  subscriber,
}: {
  subscriber: Pick<Subscriber, "id" | "isp_customer_id">;
}) {
  const { can } = usePartner();
  const canEdit = can("isp_subscribers.update");
  return (
    <div className="space-y-3">
      <FupBlock subscriberId={subscriber.id} canEdit={canEdit} />
      <MacBlock subscriberId={subscriber.id} canEdit={canEdit} />
      <StaticIpBlock subscriber={subscriber} canEdit={canEdit} />
      <EnforcementEventsList subscriberId={subscriber.id} />
    </div>
  );
}
