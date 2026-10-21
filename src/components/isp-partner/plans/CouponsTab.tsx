/**
 * Plans → Coupons (ADDENDUM_02 §9): batch list and the generator drawer.
 * Coupons are code-only (founder decision): one high-entropy code plus a
 * printed, non-secret serial.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Plus, Printer, Ticket } from "lucide-react";
import {
  MButton,
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
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useCouponBatches, usePackages, usePlansMutation } from "@/hooks/isp-partner/usePlans";
import { useIspCustomerLocations, useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { plansService } from "@/services/isp-partner/plans";
import { ispService } from "@/services/isp-partner/isp";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { formatDate } from "@/lib/isp-partner/format";
import { LAYOUT_LABEL, formatKbps } from "@/lib/isp-partner/plans";
import type { CouponBatch, CouponLayout } from "@/services/isp-partner/plans-types";

export function BatchDownloads({ batchId }: { batchId: string }) {
  const [layout, setLayout] = useState<CouponLayout>("a4-24");
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<{ blob: Blob; filename: string }>) => {
    setBusy(key);
    try {
      const { blob, filename } = await fn();
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(ispErrorMessage(err, "The download failed."));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MButton
        variant="outline"
        disabled={busy !== null}
        onClick={() => run("csv", () => plansService.exportBatchCsv(batchId))}
      >
        {busy === "csv" ? <Spinner /> : <Download />} Download CSV
      </MButton>
      <select
        className={`${M_INPUT} w-auto`}
        value={layout}
        onChange={(e) => setLayout(e.target.value as CouponLayout)}
        aria-label="Print layout"
      >
        {(Object.keys(LAYOUT_LABEL) as CouponLayout[]).map((l) => (
          <option key={l} value={l}>
            {LAYOUT_LABEL[l]}
          </option>
        ))}
      </select>
      <MButton
        variant="outline"
        disabled={busy !== null}
        onClick={() => run("pdf", () => plansService.printBatch(batchId, layout))}
      >
        {busy === "pdf" ? <Spinner /> : <Printer />} Print sheet (PDF)
      </MButton>
    </div>
  );
}

function disabledLocationIds(batch: CouponBatch): string[] {
  return (batch.coupon_login_disabled_at_locations ?? []).map((l) =>
    typeof l === "string" ? l : l.isp_location_id,
  );
}

/** FE-P6: switch on the voucher (coupon) sign-in method on each location's
 * active portal, through the existing portal twin. */
async function enableCouponLogin(locationIds: string[]): Promise<number> {
  let done = 0;
  for (const id of locationIds) {
    const list = await ispService.listPortalConfigs(id);
    const own = list.items.filter((c) => c.location_id === id);
    const cfg = (own.length ? own : list.items).find((c) => c.is_active) ?? own[0] ?? list.items[0];
    if (!cfg) continue;
    await ispService.updatePortalConfig(cfg.id, { voucher_enabled: true });
    done += 1;
  }
  return done;
}

export function CouponGeneratorDrawer({
  open,
  onClose,
  presetGroupId,
}: {
  open: boolean;
  onClose: () => void;
  presetGroupId?: string;
}) {
  const packages = usePackages(
    { status: "active", speed_group_id: presetGroupId, page_size: 100 },
    open,
  );
  const customers = useIspCustomerOptions(open);
  const [packageId, setPackageId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const locations = useIspCustomerLocations(customerId, open && !!customerId);
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [codeLength, setCodeLength] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [shelf, setShelf] = useState("365");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CouponBatch | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixedCount, setFixedCount] = useState<number | null>(null);
  const create = usePlansMutation(plansService.createBatch);

  useEffect(() => {
    if (open) {
      setPackageId("");
      setCustomerId("");
      setLocationId("");
      setQuantity("100");
      setCodeLength("10");
      setPrefix("");
      setShelf("365");
      setError(null);
      setFieldErrors({});
      setCreated(null);
      setFixedCount(null);
    }
  }, [open]);

  const pkg = (packages.data?.items ?? []).find((p) => p.id === packageId);
  const customer = (customers.data ?? []).find((c) => c.id === customerId);
  const location = (locations.data?.items ?? []).find((l) => l.id === locationId);
  const n = Number(quantity);

  const submit = async () => {
    const errs: Record<string, string> = {};
    const len = Number(codeLength);
    const s = Number(shelf);
    if (!packageId) errs.package_id = "Pick a package.";
    if (!customerId) errs.isp_customer_id = "Pick a customer.";
    if (!Number.isInteger(n) || n < 1 || n > 5000) errs.quantity = "1 to 5000.";
    if (!Number.isInteger(len) || len < 8 || len > 16) errs.code_length = "8 to 16 characters.";
    if (prefix.length > 6 || /[^A-Za-z0-9]/.test(prefix))
      errs.code_prefix = "Up to 6 letters or digits.";
    if (!Number.isInteger(s) || s < 1 || s > 3650) errs.shelf_life_days = "1 to 3650 days.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    try {
      const batch = await create.mutateAsync({
        package_id: packageId,
        isp_customer_id: customerId,
        isp_location_id: locationId || null,
        quantity: n,
        code_length: len,
        code_prefix: prefix.trim() || null,
        shelf_life_days: s,
      });
      setCreated(batch);
      toast.success(`${batch.quantity} coupons created.`);
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not create the coupons."));
    }
  };

  const disabledAt = created ? disabledLocationIds(created) : [];

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={created ? "Coupons ready" : "Generate coupons"}
      subtitle="One code per coupon, no PIN. Each coupon also gets a printed serial for stock."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            {created ? "Done" : "Cancel"}
          </MButton>
          {!created && (
            <MButton onClick={submit} disabled={create.isPending}>
              {create.isPending && <Spinner />} Generate
            </MButton>
          )}
        </div>
      }
    >
      {created ? (
        <div className="space-y-4 text-sm">
          <p>
            {created.quantity} coupons · {created.package?.name ?? pkg?.name} ·{" "}
            {created.customer_name ?? customer?.name}
            {created.location_name ? ` · ${created.location_name}` : ""}
          </p>
          {disabledAt.length > 0 && fixedCount === null && (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
              <p>
                Coupon sign-in is switched off on the portal at {disabledAt.length} location
                {disabledAt.length === 1 ? "" : "s"}, so these coupons cannot be used there yet.
              </p>
              <MButton
                disabled={fixing}
                onClick={async () => {
                  setFixing(true);
                  try {
                    const count = await enableCouponLogin(disabledAt);
                    setFixedCount(count);
                    toast.success(`Coupon sign-in turned on at ${count} location(s).`);
                  } catch (err) {
                    toast.error(ispErrorMessage(err, "Could not turn on coupon sign-in."));
                  } finally {
                    setFixing(false);
                  }
                }}
              >
                {fixing && <Spinner />} Turn on coupon sign-in
              </MButton>
            </div>
          )}
          {fixedCount !== null && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Coupon sign-in is on at {fixedCount} location(s).
            </p>
          )}
          <BatchDownloads batchId={created.id} />
          <Link
            to="/partner/plans/coupons/$couponBatchId"
            params={{ couponBatchId: created.id }}
            className="text-xs text-primary hover:underline"
          >
            Open the batch
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Package</span>
            <select
              className={M_INPUT}
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">Pick…</option>
              {(packages.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id} disabled={p.needs_price}>
                  {p.name}
                  {p.needs_price ? " (needs a price)" : ""}
                </option>
              ))}
            </select>
            {fieldErrors.package_id && (
              <span className="block text-[11px] text-destructive">{fieldErrors.package_id}</span>
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Customer (where the coupons work)
            </span>
            <CustomerSelect
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                setLocationId("");
              }}
              customers={customers.data}
              allLabel={null}
            />
            {fieldErrors.isp_customer_id && (
              <span className="block text-[11px] text-destructive">
                {fieldErrors.isp_customer_id}
              </span>
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Location (optional)</span>
            <select
              className={M_INPUT}
              value={locationId}
              disabled={!customerId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Every location of this customer</option>
              {(locations.data?.items ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              error={fieldErrors.quantity}
            />
            <TextField
              label="Code length"
              value={codeLength}
              onChange={setCodeLength}
              error={fieldErrors.code_length}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Prefix (optional)"
              value={prefix}
              onChange={setPrefix}
              error={fieldErrors.code_prefix}
            />
            <TextField
              label="Unused codes expire after (days)"
              value={shelf}
              onChange={setShelf}
              error={fieldErrors.shelf_life_days}
            />
          </div>
          {pkg && customer && Number.isInteger(n) && n > 0 && (
            <Card>
              <p className="text-sm font-medium">
                {n} coupon{n === 1 ? "" : "s"} · {formatKbps(pkg.speed_group.download_kbps)} ·{" "}
                {pkg.validity_days} days
              </p>
              <p className="text-xs text-muted-foreground">
                Valid at {location ? location.name : `every location of ${customer.name}`}. Validity
                starts at first use.
              </p>
            </Card>
          )}
          <FormError message={error} />
        </div>
      )}
    </MDrawer>
  );
}

export function CouponsTab({
  generateForGroup,
  onGeneratorClosed,
}: {
  generateForGroup?: string;
  onGeneratorClosed?: () => void;
}) {
  const { can } = usePartner();
  const navigate = useNavigate();
  const customers = useIspCustomerOptions();
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const [generating, setGenerating] = useState(!!generateForGroup);
  const q = useCouponBatches({ isp_customer_id: customerId || undefined, page, page_size: 25 });
  const data = q.data;

  useEffect(() => {
    if (generateForGroup) setGenerating(true);
  }, [generateForGroup]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[240px]">
          <CustomerSelect
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              setPage(1);
            }}
            customers={customers.data}
          />
        </div>
        {can("isp_coupons.create") && (
          <MButton className="ml-auto" onClick={() => setGenerating(true)}>
            <Plus /> Generate coupons
          </MButton>
        )}
      </div>
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="coupon batches" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState
          icon={Ticket}
          title="No coupons yet"
          description="Generate a batch for a customer's venue, then print or export it."
        />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Batch</MTh>
                <MTh>Customer</MTh>
                <MTh className="text-right">Coupons</MTh>
                <MTh className="text-right">Unused / in use</MTh>
                <MTh>Unused expire</MTh>
                <MTh>Status</MTh>
              </>
            }
          >
            {data?.items.map((b) => (
              <MTr
                key={b.id}
                onClick={() =>
                  navigate({
                    to: "/partner/plans/coupons/$couponBatchId",
                    params: { couponBatchId: b.id },
                  })
                }
              >
                <MTd>
                  <p className="font-medium">{b.package?.name ?? "Package"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.serial_prefix ? `${b.serial_prefix} · ` : ""}
                    {formatDate(b.created_at)}
                  </p>
                </MTd>
                <MTd className="text-xs">
                  {b.customer_name ?? "–"}
                  {b.location_name && <p className="text-muted-foreground">{b.location_name}</p>}
                </MTd>
                <MTd className="text-right tabular-nums">{b.quantity}</MTd>
                <MTd className="text-right tabular-nums">
                  {b.counts ? `${b.counts.unused} / ${b.counts.active}` : "–"}
                </MTd>
                <MTd className="text-xs">{formatDate(b.shelf_life_until)}</MTd>
                <MTd>
                  <MTag label={b.status} />
                </MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
      <CouponGeneratorDrawer
        open={generating}
        presetGroupId={generateForGroup}
        onClose={() => {
          setGenerating(false);
          onGeneratorClosed?.();
        }}
      />
    </div>
  );
}
