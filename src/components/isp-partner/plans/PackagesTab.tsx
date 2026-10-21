/** Plans → Packages (ADDENDUM_02 §9): table, create/edit drawer,
 * "duplicate with a different validity" dialog, enable/disable, delete. */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Package as PackageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import {
  MButton,
  MDialog,
  MDrawer,
  MEmptyState,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, FormError, Pager, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  usePackages,
  usePlanSettings,
  usePlansMutation,
  useSpeedGroups,
} from "@/hooks/isp-partner/usePlans";
import { plansService } from "@/services/isp-partner/plans";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { DEFAULT_VALIDITY_DAYS, formatKbps, previewPackageName } from "@/lib/isp-partner/plans";
import type { IspPackage, PackageBody, PackageType } from "@/services/isp-partner/plans-types";

function PackageDrawer({
  open,
  onClose,
  pkg,
  presetGroupId,
}: {
  open: boolean;
  onClose: () => void;
  pkg: IspPackage | null;
  presetGroupId?: string;
}) {
  const groups = useSpeedGroups({ status: "active", page_size: 100 }, open);
  const settings = usePlanSettings();
  const defaultValidity = settings.data?.default_validity_days ?? DEFAULT_VALIDITY_DAYS;
  const inUse = !!pkg && !pkg.can_delete;
  const [groupId, setGroupId] = useState("");
  const [type, setType] = useState<PackageType>("prepaid");
  const [validity, setValidity] = useState(String(DEFAULT_VALIDITY_DAYS));
  const [price, setPrice] = useState("");
  const [gstIncl, setGstIncl] = useState(true);
  const [cap, setCap] = useState("");
  const [devices, setDevices] = useState("1");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const save = usePlansMutation((body: PackageBody) =>
    pkg ? plansService.updatePackage(pkg.id, body) : plansService.createPackage(body),
  );

  useEffect(() => {
    if (!open) return;
    setGroupId(pkg?.speed_group.id ?? presetGroupId ?? "");
    setType((pkg?.type as PackageType) ?? "prepaid");
    setValidity(String(pkg?.validity_days ?? defaultValidity));
    setPrice(pkg ? paiseToInput(pkg.price_paise) : "");
    setGstIncl(pkg?.price_includes_gst ?? true);
    setCap(pkg?.data_cap_mb ? String(pkg.data_cap_mb) : "");
    setDevices(String(pkg?.max_devices ?? 1));
    setName(pkg?.name ?? "");
    setNameTouched(!!pkg);
    setError(null);
    setFieldErrors({});
  }, [open, pkg, presetGroupId, defaultValidity]);

  const group = (groups.data?.items ?? []).find((g) => g.id === groupId);
  const suggested =
    group && Number(validity) > 0 ? previewPackageName(group.name, type, Number(validity)) : "";
  const shownName = nameTouched ? name : suggested;

  const submit = async () => {
    const errs: Record<string, string> = {};
    const v = Number(validity);
    const p = parseRupeesToPaise(price || "0");
    const d = Number(devices);
    const c = cap.trim() ? Number(cap) : null;
    if (!groupId) errs.speed_group_id = "Pick a speed group.";
    if (!Number.isInteger(v) || v < 1 || v > 3650) errs.validity_days = "1 to 3650 days.";
    if (p === null) errs.price_paise = "A rupee amount, like 499.";
    if (!Number.isInteger(d) || d < 1 || d > 50) errs.max_devices = "1 to 50.";
    if (c !== null && (!Number.isInteger(c) || c <= 0))
      errs.data_cap_mb = "Whole MB, or empty for no cap.";
    setFieldErrors(errs);
    if (Object.keys(errs).length || p === null) return;
    setError(null);
    const body: PackageBody = {
      speed_group_id: groupId,
      type,
      validity_days: v,
      price_paise: p,
      price_includes_gst: gstIncl,
      data_cap_mb: c,
      max_devices: d,
      name: nameTouched && name.trim() ? name.trim() : null,
    };
    try {
      if (pkg && inUse) {
        // Group and validity are fixed once in use (409 otherwise): send the rest.
        await save.mutateAsync({
          ...body,
          speed_group_id: pkg.speed_group.id,
          validity_days: pkg.validity_days,
        });
      } else {
        await save.mutateAsync(body);
      }
      toast.success(pkg ? "Package saved." : "Package created.");
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not save the package."));
    }
  };

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={pkg ? `Edit ${pkg.name}` : "Add package"}
      subtitle="What you sell: a speed, a validity and a price."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton onClick={submit} disabled={save.isPending}>
            {save.isPending && <Spinner />} Save
          </MButton>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Speed group</span>
          <select
            className={M_INPUT}
            value={groupId}
            disabled={inUse}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Pick…</option>
            {(groups.data?.items ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} (↓{formatKbps(g.download_kbps)})
              </option>
            ))}
          </select>
          {fieldErrors.speed_group_id && (
            <span className="block text-[11px] text-destructive">{fieldErrors.speed_group_id}</span>
          )}
        </label>
        <MSeg<PackageType>
          value={type}
          onChange={setType}
          options={[
            { value: "prepaid", label: "Prepaid" },
            { value: "postpaid", label: "Postpaid" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Validity (days)"
            value={validity}
            onChange={setValidity}
            disabled={inUse}
            error={fieldErrors.validity_days}
            hint={inUse ? "In use: duplicate the package for another validity." : undefined}
          />
          <TextField
            label="Price (₹)"
            value={price}
            onChange={setPrice}
            error={fieldErrors.price_paise}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gstIncl} onChange={(e) => setGstIncl(e.target.checked)} />
          Price includes GST
        </label>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Data cap (MB, optional)"
            value={cap}
            onChange={setCap}
            error={fieldErrors.data_cap_mb}
          />
          <TextField
            label="Devices per coupon"
            value={devices}
            onChange={setDevices}
            error={fieldErrors.max_devices}
          />
        </div>
        <TextField
          label="Name"
          value={shownName}
          onChange={(v) => {
            setNameTouched(true);
            setName(v);
          }}
          hint={
            nameTouched ? undefined : "Suggested from the group, type and validity. Edit to change."
          }
        />
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}

function DuplicateDialog({ pkg, onClose }: { pkg: IspPackage | null; onClose: () => void }) {
  const [validity, setValidity] = useState("90");
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dup = usePlansMutation(
    (v: {
      id: string;
      body: { validity_days: number; price_paise: number; name: string | null };
    }) => plansService.duplicatePackage(v.id, v.body),
  );
  useEffect(() => {
    if (pkg) {
      setValidity(pkg.validity_days === 90 ? "30" : "90");
      setPrice("");
      setName("");
      setError(null);
    }
  }, [pkg]);
  const preview = useMemo(
    () =>
      pkg && Number(validity) > 0
        ? previewPackageName(pkg.speed_group.name, pkg.type, Number(validity))
        : "",
    [pkg, validity],
  );
  if (!pkg) return null;
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Duplicate ${pkg.name}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={dup.isPending}
            onClick={async () => {
              const v = Number(validity);
              const p = parseRupeesToPaise(price || "0");
              if (!Number.isInteger(v) || v < 1 || v > 3650)
                return setError("Validity is 1 to 3650 days.");
              if (p === null) return setError("Price is a rupee amount.");
              setError(null);
              try {
                const created = await dup.mutateAsync({
                  id: pkg.id,
                  body: { validity_days: v, price_paise: p, name: name.trim() || null },
                });
                toast.success(`${created.name} created.`);
                onClose();
              } catch (err) {
                setError(ispErrorMessage(err));
              }
            }}
          >
            {dup.isPending && <Spinner />} Create package
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Same speed ({pkg.speed_group.name}), type, data cap and devices. Only the validity and
          price change.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Validity (days)" value={validity} onChange={setValidity} />
          <TextField label="Price (₹)" value={price} onChange={setPrice} />
        </div>
        <TextField
          label="Name (optional)"
          value={name}
          onChange={setName}
          placeholder={preview}
          hint={`Preview: ${name.trim() || preview}`}
        />
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function PackagesTab({ groupFilter }: { groupFilter?: string }) {
  const { can } = usePartner();
  const groups = useSpeedGroups({ page_size: 100 });
  const [groupId, setGroupId] = useState(groupFilter ?? "");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = usePackages({
    speed_group_id: groupId || undefined,
    status: status || undefined,
    page,
    page_size: 25,
  });
  const [editing, setEditing] = useState<IspPackage | null | "new">(null);
  const [duplicating, setDuplicating] = useState<IspPackage | null>(null);
  const [deleting, setDeleting] = useState<IspPackage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toggle = usePlansMutation((v: { id: string; enabled: boolean }) =>
    plansService.setPackageEnabled(v.id, v.enabled),
  );
  const remove = usePlansMutation((id: string) => plansService.deletePackage(id));
  const data = q.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${M_INPUT} w-auto`}
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setPage(1);
          }}
          aria-label="Speed group"
        >
          <option value="">All speed groups</option>
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
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        {can("isp_plans.create") && (
          <MButton className="ml-auto" onClick={() => setEditing("new")}>
            <Plus /> Add package
          </MButton>
        )}
      </div>
      <FormError message={actionError} />
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="packages" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState
          icon={PackageIcon}
          title="No packages"
          description="Create a speed group first, then a package on it."
        />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Package</MTh>
                <MTh>Speed</MTh>
                <MTh>Type</MTh>
                <MTh className="text-right">Validity</MTh>
                <MTh className="text-right">Price</MTh>
                <MTh>Cap</MTh>
                <MTh className="text-right">Coupons unused / in use</MTh>
                <MTh className="text-right">Subscribers</MTh>
                <MTh>Status</MTh>
                <MTh className="text-right">Actions</MTh>
              </>
            }
          >
            {data?.items.map((p) => (
              <MTr key={p.id}>
                <MTd className="font-medium">{p.name}</MTd>
                <MTd className="text-xs">
                  ↓{formatKbps(p.speed_group.download_kbps)} / ↑
                  {formatKbps(p.speed_group.upload_kbps)}
                </MTd>
                <MTd className="text-xs capitalize">{p.type}</MTd>
                <MTd className="text-right tabular-nums">{p.validity_days} d</MTd>
                <MTd className="text-right tabular-nums">
                  {formatRupees(p.price_paise)}
                  <p className="text-[10px] text-muted-foreground">
                    {p.price_includes_gst ? "incl. GST" : "+ GST"}
                  </p>
                </MTd>
                <MTd className="text-xs">{p.data_cap_mb ? `${p.data_cap_mb} MB` : "None"}</MTd>
                <MTd className="text-right tabular-nums">
                  {p.coupons.unused} / {p.coupons.active}
                </MTd>
                <MTd className="text-right tabular-nums">{p.subscribers}</MTd>
                <MTd>
                  <MTag
                    label={p.needs_price ? "Needs price" : p.status}
                    tone={p.needs_price ? "pending" : undefined}
                  />
                </MTd>
                <MTd className="text-right">
                  <div className="flex flex-wrap justify-end gap-0.5">
                    {can("isp_plans.update") && (
                      <MButton
                        variant="ghost"
                        title="Edit"
                        aria-label={`Edit ${p.name}`}
                        onClick={() => setEditing(p)}
                      >
                        <Pencil />
                      </MButton>
                    )}
                    {can("isp_plans.create") && (
                      <MButton
                        variant="ghost"
                        title="Duplicate with different validity"
                        aria-label={`Duplicate ${p.name}`}
                        onClick={() => setDuplicating(p)}
                      >
                        <Copy />
                      </MButton>
                    )}
                    {can("isp_plans.update") && (
                      <MButton
                        variant="ghost"
                        disabled={toggle.isPending}
                        onClick={async () => {
                          setActionError(null);
                          try {
                            await toggle.mutateAsync({ id: p.id, enabled: p.status !== "active" });
                          } catch (err) {
                            setActionError(ispErrorMessage(err));
                          }
                        }}
                      >
                        {p.status === "active" ? "Disable" : "Enable"}
                      </MButton>
                    )}
                    {can("isp_plans.delete") &&
                      (p.can_delete ? (
                        <MButton
                          variant="ghost"
                          title="Delete"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 />
                        </MButton>
                      ) : (
                        <span
                          className="px-2 text-[10px] text-muted-foreground"
                          title="In use: disable it instead"
                        >
                          In use
                        </span>
                      ))}
                  </div>
                </MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
      <PackageDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        pkg={editing === "new" ? null : editing}
        presetGroupId={groupId || undefined}
      />
      <DuplicateDialog pkg={duplicating} onClose={() => setDuplicating(null)} />
      <MDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        footer={
          <>
            <MButton variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </MButton>
            <MButton
              className="bg-destructive text-destructive-foreground"
              disabled={remove.isPending}
              onClick={async () => {
                if (!deleting) return;
                setActionError(null);
                try {
                  await remove.mutateAsync(deleting.id);
                  toast.success(`${deleting.name} deleted.`);
                } catch (err) {
                  setActionError(ispErrorMessage(err));
                }
                setDeleting(null);
              }}
            >
              {remove.isPending && <Spinner />} Delete
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          No coupon of this package was ever used and nobody holds it. Its unused coupons are
          revoked.
        </p>
      </MDialog>
    </div>
  );
}
