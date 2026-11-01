/** Inventory admin (APPS-2): vendors, stock locations (warehouse / office /
 * technician bag) and the checkout approval queue. Managers write; the
 * queue's approve / reject is isp_apps.manage. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import {
  AssigneeSelect,
  Select,
  appsKeys,
  useAppsMutation,
} from "@/components/isp-partner/apps/appsKit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { STOCK_KIND_LABEL, humanize } from "@/lib/isp-partner/apps";
import { EditLocationDialog } from "@/components/isp-partner/apps/InventoryEdit";
import { appsService } from "@/services/isp-partner/apps";
import { STOCK_LOCATION_KINDS, type StockLocation } from "@/services/isp-partner/apps-types";
import { ClipboardCheck } from "lucide-react";

export function VendorsCard({ canManage }: { canManage: boolean }) {
  const q = useQuery({
    queryKey: appsKeys.list("vendors"),
    queryFn: () => appsService.vendors(),
    retry: false,
  });
  const [f, setF] = useState({ name: "", contact_name: "", phone: "", gstin: "" });
  const [err, setErr] = useState<string | null>(null);
  const create = useAppsMutation(() =>
    appsService.createVendor({
      name: f.name.trim(),
      contact_name: f.contact_name.trim() || null,
      phone: f.phone.trim() || null,
      gstin: f.gstin.trim().toUpperCase() || null,
    }),
  );
  const toggle = useAppsMutation((v: { id: string; active: boolean }) =>
    appsService.patchVendor(v.id, { active: v.active }),
  );
  if (q.error) return <ErrorBlock error={q.error} what="vendors" />;
  return (
    <Card title="Vendors">
      <MTable
        loading={q.isLoading}
        head={
          <>
            <MTh>Vendor</MTh>
            <MTh>Contact</MTh>
            <MTh>GSTIN</MTh>
            <MTh>Active</MTh>
          </>
        }
      >
        {(q.data ?? []).map((v) => (
          <MTr key={v.id}>
            <MTd>{v.name}</MTd>
            <MTd className="text-xs">
              {[v.contact_name, v.phone, v.email].filter(Boolean).join(" · ") || "–"}
            </MTd>
            <MTd className="font-mono text-xs">{v.gstin ?? "–"}</MTd>
            <MTd>
              <input
                type="checkbox"
                aria-label={`${v.name} active`}
                checked={v.active}
                disabled={!canManage}
                onChange={(e) => toggle.mutate({ id: v.id, active: e.target.checked })}
              />
            </MTd>
          </MTr>
        ))}
      </MTable>
      {canManage && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            className={`${M_INPUT} w-48`}
            placeholder="Vendor name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            aria-label="Vendor name"
          />
          <input
            className={`${M_INPUT} w-40`}
            placeholder="Contact person"
            value={f.contact_name}
            onChange={(e) => setF({ ...f, contact_name: e.target.value })}
            aria-label="Contact person"
          />
          <input
            className={`${M_INPUT} w-36`}
            placeholder="Phone"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            aria-label="Phone"
          />
          <input
            className={`${M_INPUT} w-44`}
            placeholder="GSTIN (optional)"
            value={f.gstin}
            onChange={(e) => setF({ ...f, gstin: e.target.value })}
            aria-label="GSTIN"
          />
          <MButton
            disabled={create.isPending || !f.name.trim()}
            onClick={async () => {
              setErr(null);
              try {
                await create.mutateAsync(undefined);
                setF({ name: "", contact_name: "", phone: "", gstin: "" });
                toast.success("Vendor added.");
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {create.isPending && <Spinner />} Add vendor
          </MButton>
        </div>
      )}
      <FormError message={err} />
    </Card>
  );
}

export function LocationsCard({ canManage }: { canManage: boolean }) {
  const q = useQuery({
    queryKey: appsKeys.list("stock-locations"),
    queryFn: () => appsService.locations(),
    retry: false,
  });
  const [f, setF] = useState({ name: "", kind: "warehouse", holder: "", address: "" });
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<StockLocation | null>(null);
  const create = useAppsMutation(() =>
    appsService.createLocation({
      name: f.name.trim(),
      kind: f.kind,
      holder_user_id: f.holder || null,
      address: f.address.trim() || null,
    }),
  );
  if (q.error) return <ErrorBlock error={q.error} what="stock locations" />;
  return (
    <Card title="Stock locations">
      <MTable
        loading={q.isLoading}
        head={
          <>
            <MTh>Location</MTh>
            <MTh>Kind</MTh>
            <MTh>Carried by</MTh>
            {canManage && <MTh />}
          </>
        }
      >
        {(q.data ?? []).map((l) => (
          <MTr key={l.id}>
            <MTd>
              {l.name}
              {!l.active && (
                <span className="ml-2">
                  <MTag label="Not in use" tone="normal" />
                </span>
              )}
              {l.address && <p className="text-[11px] text-muted-foreground">{l.address}</p>}
            </MTd>
            <MTd className="text-xs">{STOCK_KIND_LABEL[l.kind] ?? humanize(l.kind)}</MTd>
            <MTd className="text-xs">{l.holder_name ?? "–"}</MTd>
            {canManage && (
              <MTd className="text-right">
                <MButton
                  variant="ghost"
                  onClick={() => setEditing(l)}
                  aria-label={`Edit ${l.name}`}
                >
                  Edit
                </MButton>
              </MTd>
            )}
          </MTr>
        ))}
      </MTable>
      {canManage && (
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <input
            className={M_INPUT}
            placeholder="Name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            aria-label="Location name"
          />
          <Select
            ariaLabel="Kind"
            value={f.kind}
            onChange={(v) => setF({ ...f, kind: v })}
            options={STOCK_LOCATION_KINDS.map((k) => [k, STOCK_KIND_LABEL[k]] as [string, string])}
          />
          {f.kind === "technician_bag" ? (
            <AssigneeSelect
              value={f.holder}
              onChange={(v) => setF({ ...f, holder: v })}
              allowNone={false}
              ariaLabel="Technician"
            />
          ) : (
            <input
              className={M_INPUT}
              placeholder="Address (optional)"
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
              aria-label="Address"
            />
          )}
          <MButton
            disabled={create.isPending || !f.name.trim()}
            onClick={async () => {
              setErr(null);
              if (f.kind === "technician_bag" && !f.holder)
                return setErr("Pick the technician who carries the bag.");
              try {
                await create.mutateAsync(undefined);
                setF({ name: "", kind: f.kind, holder: "", address: "" });
                toast.success("Location added.");
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {create.isPending && <Spinner />} Add location
          </MButton>
        </div>
      )}
      <FormError message={err} />
      {editing && <EditLocationDialog location={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const CHECKOUT_LABEL: Record<string, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function CheckoutsCard({ canDecide }: { canDecide: boolean }) {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const q = useQuery({
    queryKey: appsKeys.list("checkouts", { status }),
    queryFn: () => appsService.checkouts(status === "pending" ? "pending" : undefined),
    retry: false,
    refetchInterval: 60_000,
  });
  const approve = useAppsMutation((id: string) => appsService.approveCheckout(id));
  // P3-SWEEP (GAP #20): the reject reason is asked in a dialog, not window.prompt.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const reject = useAppsMutation((v: { id: string; note: string }) =>
    appsService.rejectCheckout(v.id, v.note),
  );
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(ispErrorMessage(e));
    }
  };
  return (
    <Card title="Checkout requests">
      <MSeg<"pending" | "all">
        value={status}
        onChange={setStatus}
        options={[
          { value: "pending", label: "Waiting" },
          { value: "all", label: "All" },
        ]}
      />
      {q.error ? (
        <ErrorBlock error={q.error} what="checkout requests" />
      ) : q.data && q.data.length === 0 ? (
        <MEmptyState
          icon={ClipboardCheck}
          title="Nothing waiting"
          description="Technicians request a checkout before a unit goes to an install."
        />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Unit</MTh>
              <MTh>For</MTh>
              <MTh>Requested</MTh>
              <MTh>Status</MTh>
              <MTh />
            </>
          }
        >
          {(q.data ?? []).map((r) => (
            <MTr key={r.id}>
              <MTd className="font-mono text-xs">{r.serial ?? "–"}</MTd>
              <MTd className="text-xs">
                {r.customer_name ?? "–"}
                {r.note && <p className="text-muted-foreground">{r.note}</p>}
              </MTd>
              <MTd className="text-xs">
                {r.requested_by_name ?? "–"}
                <p className="text-muted-foreground">{formatDateTime(r.requested_at)}</p>
              </MTd>
              <MTd>
                <MTag
                  label={CHECKOUT_LABEL[r.status] ?? r.status}
                  tone={
                    r.status === "pending"
                      ? "pending"
                      : r.status === "approved"
                        ? "active"
                        : "normal"
                  }
                />
              </MTd>
              <MTd className="text-right">
                {canDecide && r.status === "pending" && (
                  <>
                    <MButton
                      variant="outline"
                      disabled={approve.isPending}
                      onClick={() =>
                        act(() => approve.mutateAsync(r.id), "Approved; the unit is checked out.")
                      }
                    >
                      Approve
                    </MButton>
                    <MButton
                      variant="ghost"
                      disabled={reject.isPending}
                      onClick={() => setRejecting(r.id)}
                    >
                      Reject
                    </MButton>
                  </>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {rejecting && (
        <RejectCheckoutDialog
          busy={reject.isPending}
          onClose={() => setRejecting(null)}
          onReject={(note) =>
            act(async () => {
              await reject.mutateAsync({ id: rejecting, note });
              setRejecting(null);
            }, "Rejected.")
          }
        />
      )}
    </Card>
  );
}

function RejectCheckoutDialog({
  busy,
  onClose,
  onReject,
}: {
  busy: boolean;
  onClose: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <MDialog
      open
      onClose={onClose}
      title="Reject the checkout"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Keep it waiting
          </MButton>
          <MButton disabled={busy || !note.trim()} onClick={() => onReject(note.trim())}>
            {busy && <Spinner />} Reject
          </MButton>
        </>
      }
    >
      <label className="block space-y-1.5 text-sm">
        <span className="text-xs font-medium text-muted-foreground">
          Why is it rejected?<span className="text-destructive"> *</span>
        </span>
        <textarea
          className={`${M_INPUT} min-h-20`}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Reason"
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        The reason is saved on the request; the unit is not checked out.
      </p>
    </MDialog>
  );
}
