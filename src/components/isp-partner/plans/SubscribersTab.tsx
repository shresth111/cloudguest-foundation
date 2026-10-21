/**
 * Plans → Subscribers (ADDENDUM_02 §9): who holds which package, until when.
 * Identifiers arrive masked. Manual assign, extend validity, disable.
 *
 * Disabling a hotspot subscriber removes their package speed; it does not
 * block sign-in (§8 note). To stop a code, revoke the coupon.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Users, Wallet } from "lucide-react";
import {
  MButton,
  MDialog,
  MDrawer,
  MEmptyState,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  CustomerSelect,
  ErrorBlock,
  FormError,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { RechargeDialog } from "@/components/isp-partner/plans/RechargeDialog";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import {
  usePackages,
  usePlansMutation,
  useSpeedGroups,
  useSubscriber,
  useSubscribers,
} from "@/hooks/isp-partner/usePlans";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { plansService } from "@/services/isp-partner/plans";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import {
  formatAgo,
  formatBytes,
  formatDate,
  formatDateTime,
  isoDay,
} from "@/lib/isp-partner/format";
import { relativeValidity } from "@/lib/isp-partner/plans";
import type { Subscriber } from "@/services/isp-partner/plans-types";

function AssignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const customers = useIspCustomerOptions(open);
  const packages = usePackages({ status: "active", page_size: 100 }, open);
  const [customerId, setCustomerId] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [packageId, setPackageId] = useState("");
  const [from, setFrom] = useState(isoDay(new Date()));
  const [error, setError] = useState<string | null>(null);
  const create = usePlansMutation(plansService.createSubscriber);
  useEffect(() => {
    if (open) {
      setCustomerId("");
      setIdentifier("");
      setName("");
      setPackageId("");
      setFrom(isoDay(new Date()));
      setError(null);
    }
  }, [open]);
  return (
    <MDialog
      open={open}
      onClose={onClose}
      title="Assign a package by hand"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={create.isPending}
            onClick={async () => {
              if (!customerId || !identifier.trim() || !packageId)
                return setError("Customer, identifier and package are required.");
              setError(null);
              try {
                await create.mutateAsync({
                  isp_customer_id: customerId,
                  identifier: identifier.trim(),
                  display_name: name.trim() || null,
                  package_id: packageId,
                  valid_from: new Date(`${from}T00:00:00`).toISOString(),
                });
                toast.success("Subscriber added. The package speed applies at their next sign-in.");
                onClose();
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {create.isPending && <Spinner />} Assign
          </MButton>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Customer</span>
          <CustomerSelect
            value={customerId}
            onChange={setCustomerId}
            customers={customers.data}
            allLabel={null}
          />
        </label>
        <TextField
          label="Phone, email or username"
          required
          value={identifier}
          onChange={setIdentifier}
          hint="The same identity the guest signs in with at the portal."
        />
        <TextField label="Name (optional)" value={name} onChange={setName} />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Package</span>
          <select
            className={M_INPUT}
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
          >
            <option value="">Pick…</option>
            {(packages.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Valid from</span>
          <input
            type="date"
            className={M_INPUT}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function SubscriberDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = usePartner();
  const q = useSubscriber(id);
  const [extendTo, setExtendTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const patch = usePlansMutation((v: { id: string; valid_until: string }) =>
    plansService.updateSubscriber(v.id, { valid_until: v.valid_until }),
  );
  const toggle = usePlansMutation((v: { id: string; enabled: boolean }) =>
    plansService.setSubscriberEnabled(v.id, v.enabled),
  );
  const setZone = usePlansMutation((v: { id: string; zone_id: string | null }) =>
    plansService.updateSubscriber(v.id, { zone_id: v.zone_id }),
  );
  const zones = useZones(can("isp_zones.read"));
  const [recharging, setRecharging] = useState(false);
  useEffect(() => {
    setExtendTo(q.data?.valid_until ? q.data.valid_until.slice(0, 10) : "");
    setError(null);
  }, [q.data]);
  if (!id) return null;
  const s = q.data;
  return (
    <MDrawer
      open
      onClose={onClose}
      title={s ? (s.display_name ?? s.identifier) : "Subscriber"}
      subtitle={s?.identifier}
    >
      {q.isLoading ? (
        <Spinner />
      ) : q.error || !s ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this subscriber" />
      ) : (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted-foreground">Customer</dt>
            <dd>{s.customer_name ?? "–"}</dd>
            <dt className="text-muted-foreground">Package</dt>
            <dd>{s.package?.name ?? "–"}</dd>
            <dt className="text-muted-foreground">Valid until</dt>
            <dd>
              {formatDate(s.valid_until)} ({relativeValidity(s.valid_until)})
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{s.status}</dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd>{s.source === "coupon" ? "Coupon" : "Assigned by hand"}</dd>
            <dt className="text-muted-foreground">Circuit id</dt>
            <dd>{s.circuit_id ?? "–"}</dd>
            <dt className="text-muted-foreground">Zone</dt>
            <dd>
              {can("isp_subscribers.update") && can("isp_zones.read") ? (
                <select
                  className={`${M_INPUT} py-1`}
                  value={s.zone?.id ?? ""}
                  disabled={setZone.isPending}
                  aria-label="Zone"
                  onChange={async (e) => {
                    setError(null);
                    try {
                      await setZone.mutateAsync({ id: s.id, zone_id: e.target.value || null });
                      toast.success("Zone saved.");
                    } catch (err) {
                      setError(ispErrorMessage(err));
                    }
                  }}
                >
                  <option value="">No zone</option>
                  {(zones.data ?? []).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              ) : (
                (s.zone?.name ?? "–")
              )}
            </dd>
          </dl>
          {can("isp_invoices.create") && s.status !== "disabled" && (
            <MButton onClick={() => setRecharging(true)}>
              <Wallet /> Recharge
            </MButton>
          )}
          {recharging && <RechargeDialog subscriber={s} onClose={() => setRecharging(false)} />}
          {can("isp_subscribers.update") && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">Extend validity</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={M_INPUT}
                  value={extendTo}
                  onChange={(e) => setExtendTo(e.target.value)}
                />
                <MButton
                  disabled={patch.isPending || !extendTo}
                  onClick={async () => {
                    setError(null);
                    try {
                      await patch.mutateAsync({
                        id: s.id,
                        valid_until: new Date(`${extendTo}T23:59:59`).toISOString(),
                      });
                      toast.success("Validity updated.");
                    } catch (err) {
                      setError(ispErrorMessage(err));
                    }
                  }}
                >
                  {patch.isPending && <Spinner />} Save
                </MButton>
              </div>
              <MButton
                variant="outline"
                disabled={toggle.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    await toggle.mutateAsync({ id: s.id, enabled: s.status === "disabled" });
                    toast.success(
                      s.status === "disabled" ? "Subscriber enabled." : "Subscriber disabled.",
                    );
                  } catch (err) {
                    setError(ispErrorMessage(err));
                  }
                }}
              >
                {s.status === "disabled" ? "Enable" : "Disable"}
              </MButton>
              <p className="text-[11px] text-muted-foreground">
                Disabling removes the package speed; it does not stop hotspot sign-in. To stop a
                code, revoke the coupon.
              </p>
              <FormError message={error} />
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Coupon history</p>
            {(s.coupon_history ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {s.coupon_history?.map((h, i) => (
                  <li key={`${h.serial}-${i}`}>
                    <span className="font-mono">{h.serial}</span> · {h.package_name ?? ""} · used{" "}
                    {formatDateTime(h.activated_at)} · until {formatDateTime(h.expires_at)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Recent sessions</p>
            {(s.recent_sessions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {s.recent_sessions?.map((r) => (
                  <li key={r.id}>
                    {formatDateTime(r.started_at)} · {r.location_name ?? ""}
                    {r.bytes_downloaded !== undefined &&
                      ` · ${formatBytes(r.bytes_downloaded)} down`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </MDrawer>
  );
}

export function SubscribersTab({ groupFilter }: { groupFilter?: string }) {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const groups = useSpeedGroups({ page_size: 100 });
  const [customerId, setCustomerId] = useState("");
  const [groupId, setGroupId] = useState(groupFilter ?? "");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [assigning, setAssigning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useSubscribers({
    isp_customer_id: customerId || undefined,
    speed_group_id: groupId || undefined,
    status: status || undefined,
    search: debounced || undefined,
    page,
    page_size: 25,
  });
  const data = q.data;
  const reset = () => setPage(1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[220px]">
          <CustomerSelect
            value={customerId}
            onChange={(v) => {
              setCustomerId(v);
              reset();
            }}
            customers={customers.data}
          />
        </div>
        <select
          className={`${M_INPUT} w-auto`}
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            reset();
          }}
          aria-label="Speed group"
        >
          <option value="">All speeds</option>
          {(groups.data?.items ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          className={`${M_INPUT} w-auto`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            reset();
          }}
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="disabled">Disabled</option>
        </select>
        <input
          className={`${M_INPUT} w-full max-w-[200px]`}
          placeholder="Search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
        />
        {can("isp_subscribers.update") && (
          <MButton className="ml-auto" onClick={() => setAssigning(true)}>
            <Plus /> Assign by hand
          </MButton>
        )}
      </div>
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="subscribers" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState
          icon={Users}
          title="No subscribers"
          description="Guests appear here after their first coupon sign-in."
        />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Subscriber</MTh>
                <MTh className="text-right">Circuit</MTh>
                <MTh>Customer</MTh>
                <MTh>Package</MTh>
                <MTh>Valid until</MTh>
                <MTh>Status</MTh>
                <MTh>Last seen</MTh>
              </>
            }
          >
            {data?.items.map((s: Subscriber) => (
              <MTr key={s.id} onClick={() => setOpen(s.id)}>
                <MTd>
                  <p className="font-mono text-xs">{s.identifier}</p>
                  {s.display_name && (
                    <p className="text-[11px] text-muted-foreground">{s.display_name}</p>
                  )}
                </MTd>
                <MTd className="text-right text-xs tabular-nums">{s.circuit_id ?? "–"}</MTd>
                <MTd className="text-xs">{s.customer_name ?? "–"}</MTd>
                <MTd className="text-xs">
                  {s.package?.name ?? "–"}
                  {s.speed_group && <p className="text-muted-foreground">{s.speed_group.name}</p>}
                </MTd>
                <MTd className="text-xs">
                  {formatDate(s.valid_until)}
                  <p className="text-muted-foreground">{relativeValidity(s.valid_until)}</p>
                </MTd>
                <MTd>
                  <MTag
                    label={s.status}
                    tone={
                      s.status === "active"
                        ? "active"
                        : s.status === "disabled"
                          ? "suspended"
                          : "normal"
                    }
                  />
                </MTd>
                <MTd className="text-xs text-muted-foreground">{formatAgo(s.last_seen_at)}</MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
      <AssignDialog open={assigning} onClose={() => setAssigning(false)} />
      <SubscriberDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
