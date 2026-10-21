/** `/partner/plans/coupons/$couponBatchId` (ADDENDUM_02 §9): stat strip,
 * searchable coupon table (redeemer masked by the backend), revoke, export. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import {
  MButton,
  MDialog,
  MSectionHeader,
  MStat,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Pager,
  Spinner,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { BatchDownloads } from "@/components/isp-partner/plans/CouponsTab";
import { useCouponBatch, useCoupons, usePlansMutation } from "@/hooks/isp-partner/usePlans";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { plansService } from "@/services/isp-partner/plans";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate, formatDateTime } from "@/lib/isp-partner/format";
import { COUPON_STATUS_LABEL, couponTone } from "@/lib/isp-partner/plans";

export function CouponBatchPage({ batchId }: { batchId: string }) {
  const { can } = usePartner();
  const b = useCouponBatch(batchId);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const coupons = useCoupons(batchId, {
    status: status || undefined,
    search: debounced || undefined,
    page,
    page_size: 50,
  });
  const [confirm, setConfirm] = useState<
    null | { kind: "batch" } | { kind: "one"; id: string; serial: string }
  >(null);
  const [error, setError] = useState<string | null>(null);
  const revokeBatch = usePlansMutation(() => plansService.revokeBatch(batchId));
  const revokeOne = usePlansMutation((id: string) => plansService.revokeCoupon(id));

  if (b.isLoading) return <LoadingBlock />;
  if (b.error || !b.data)
    return <ErrorBlock error={b.error} onRetry={() => b.refetch()} what="this coupon batch" />;
  const batch = b.data;
  const c = batch.counts;
  const canRevoke = can("isp_coupons.update");

  return (
    <>
      <p className="text-xs">
        <Link
          to="/partner/plans"
          search={{ tab: "coupons" }}
          className="text-primary hover:underline"
        >
          ← Coupons
        </Link>
      </p>
      <MSectionHeader
        eyebrow="Coupon batch"
        title={batch.package?.name ?? "Coupons"}
        description={`${batch.customer_name ?? ""}${batch.location_name ? ` · ${batch.location_name}` : ""} · created ${formatDate(batch.created_at)} · unused codes expire ${formatDate(batch.shelf_life_until)}`}
        actions={
          <>
            <MTag label={batch.status} />
            {canRevoke && batch.status === "active" && (
              <MButton variant="outline" onClick={() => setConfirm({ kind: "batch" })}>
                <Ban /> Revoke unused
              </MButton>
            )}
          </>
        }
      />
      {c && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MStat label="Unused" value={c.unused} />
          <MStat label="In use" value={c.active} tone="success" />
          <MStat label="Used up" value={c.used_up} />
          <MStat label="Expired" value={c.expired} />
          <MStat label="Revoked" value={c.revoked} />
        </div>
      )}
      {can("isp_coupons.export") && (
        <Card title="Export">
          <BatchDownloads batchId={batchId} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            The CSV and print sheet contain the codes. Keep them like cash.
          </p>
        </Card>
      )}
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <input
          className={`${M_INPUT} max-w-xs`}
          placeholder="Search serial or code"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={`${M_INPUT} w-auto`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="">Any status</option>
          {Object.entries(COUPON_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {coupons.error && !coupons.data ? (
        <ErrorBlock error={coupons.error} onRetry={() => coupons.refetch()} what="coupons" />
      ) : (
        <>
          <MTable
            loading={coupons.isLoading}
            head={
              <>
                <MTh>Serial</MTh>
                <MTh>Code</MTh>
                <MTh>Status</MTh>
                <MTh>Used by</MTh>
                <MTh>First used</MTh>
                <MTh>Valid until</MTh>
                {canRevoke && <MTh className="text-right">Actions</MTh>}
              </>
            }
          >
            {coupons.data?.items.map((cp) => (
              <MTr key={cp.id}>
                <MTd className="font-mono text-xs">{cp.serial}</MTd>
                <MTd className="font-mono text-xs">{cp.code}</MTd>
                <MTd>
                  <MTag
                    label={COUPON_STATUS_LABEL[cp.status] ?? cp.status}
                    tone={couponTone(cp.status)}
                  />
                </MTd>
                <MTd className="font-mono text-xs">{cp.redeemed_by ?? "–"}</MTd>
                <MTd className="text-xs">{formatDateTime(cp.activated_at)}</MTd>
                <MTd className="text-xs">{formatDateTime(cp.expires_at)}</MTd>
                {canRevoke && (
                  <MTd className="text-right">
                    {(cp.status === "unused" || cp.status === "active") && (
                      <MButton
                        variant="ghost"
                        onClick={() => setConfirm({ kind: "one", id: cp.id, serial: cp.serial })}
                      >
                        Revoke
                      </MButton>
                    )}
                  </MTd>
                )}
              </MTr>
            ))}
          </MTable>
          {coupons.data && (
            <Pager
              page={coupons.data.page}
              pages={coupons.data.pages}
              total={coupons.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}
      <MDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "batch"
            ? "Revoke every unused coupon in this batch?"
            : `Revoke coupon ${confirm?.kind === "one" ? confirm.serial : ""}?`
        }
        footer={
          <>
            <MButton variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </MButton>
            <MButton
              className="bg-destructive text-destructive-foreground"
              disabled={revokeBatch.isPending || revokeOne.isPending}
              onClick={async () => {
                if (!confirm) return;
                setError(null);
                try {
                  if (confirm.kind === "batch") await revokeBatch.mutateAsync(undefined);
                  else await revokeOne.mutateAsync(confirm.id);
                  toast.success("Revoked.");
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
                setConfirm(null);
              }}
            >
              {(revokeBatch.isPending || revokeOne.isPending) && <Spinner />} Revoke
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirm?.kind === "batch"
            ? "Codes nobody has used yet stop working. Coupons already in use keep running until their validity ends."
            : "This code stops working. If someone is using it, they cannot sign in with it again."}
        </p>
      </MDialog>
    </>
  );
}
