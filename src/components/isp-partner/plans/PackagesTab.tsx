/** Plans → Packages (ADDENDUM_02 §9): table, create/edit drawer,
 * "duplicate with a different validity" dialog, enable/disable, delete. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  Network,
  Package as PackageIcon,
  Pencil,
  Plus,
  Trash2,
  RefreshCcw,
} from "lucide-react";
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
import { PlanSyncDialog } from "@/components/isp-partner/subscribers/PlanSyncDialog";
import {
  usePackages,
  usePlanSettings,
  usePlansMutation,
  useSpeedGroups,
} from "@/hooks/isp-partner/usePlans";
import { plansService } from "@/services/isp-partner/plans";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { formatMbAsGb, mbToGbText, parseGbToMb } from "@/lib/isp-partner/data-units";
import { useGbDataLimits } from "@/hooks/isp-partner/useWorkflow";
import { DEFAULT_VALIDITY_DAYS, formatKbps, previewPackageName } from "@/lib/isp-partner/plans";
import type { IspPackage, PackageBody, PackageType } from "@/services/isp-partner/plans-types";
import { PackagePolicyDrawer } from "@/components/isp-partner/network/PackagePolicyDrawer";
import { PolicyFields, type PolicyErrors } from "@/components/isp-partner/network/PolicyFields";
import { GroupDrawer } from "@/components/isp-partner/plans/SpeedGroupsTab";
import { IspPlanDrawer } from "@/components/isp-partner/plans/IspPlanDrawer"; // RAKESH-P1
import { PlanSettingsButton } from "@/components/isp-partner/plans/PlanSettingsButton";
import { networkService } from "@/services/isp-partner/network";
import { networkKeys } from "@/hooks/isp-partner/useNetwork";
import { formToPolicyBody, policyToForm, type PolicyForm } from "@/lib/isp-partner/network";
import { packageMetaKeys, usePackageMetaMap } from "@/hooks/isp-partner/usePackageMeta";
import {
  CONNECTION_KIND_LABEL,
  PACKAGE_KIND_LABEL,
  packageMetaService,
  type ConnectionKind,
  type PackageKind,
} from "@/services/isp-partner/package-meta";
import { M_FILTER } from "@/components/isp-partner/ui/classes";
import { ispFormErrors } from "@/lib/isp-partner/form-errors";

/** Package fields that show their own error (the rest are named in the form message). */
const PACKAGE_FIELDS = [
  "speed_group_id",
  "validity_days",
  "price_paise",
  "data_cap_mb",
  "max_devices",
];

type NewGroupTarget = "speed" | "fup_fallback_speed_group_id" | "boost_speed_group_id";
type FollowUp = { pkg: IspPackage; failed: { step: "rules" | "labels"; message: string }[] };
const RULE_DEFAULTS = JSON.stringify(policyToForm(null));

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
  const qc = useQueryClient();
  const meta = usePackageMetaMap();
  const gb = useGbDataLimits(); // RAKESH-FS: data cap in GB (flag on)
  const [rules, setRules] = useState<PolicyForm>(() => policyToForm(null));
  const [ruleErrors, setRuleErrors] = useState<PolicyErrors>({});
  const [newGroupFor, setNewGroupFor] = useState<NewGroupTarget | null>(null);
  const [kind, setKind] = useState<PackageKind | "">("");
  const [conn, setConn] = useState<ConnectionKind | "">("");
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [retrying, setRetrying] = useState(false);
  const setRule = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) =>
    setRules((f) => ({ ...f, [k]: v }));
  const rulesTouched = !pkg && JSON.stringify(rules) !== RULE_DEFAULTS;

  useEffect(() => {
    if (!open) return;
    setGroupId(pkg?.speed_group.id ?? presetGroupId ?? "");
    setType((pkg?.type as PackageType) ?? "prepaid");
    setValidity(String(pkg?.validity_days ?? defaultValidity));
    setPrice(pkg ? paiseToInput(pkg.price_paise) : "");
    setGstIncl(pkg?.price_includes_gst ?? true);
    setCap(pkg?.data_cap_mb ? (gb ? mbToGbText(pkg.data_cap_mb) : String(pkg.data_cap_mb)) : "");
    setDevices(String(pkg?.max_devices ?? 1));
    setName(pkg?.name ?? "");
    setNameTouched(!!pkg);
    setError(null);
    setFieldErrors({});
    setRules(policyToForm(null));
    setRuleErrors({});
    setFollowUp(null);
    const m = pkg ? meta.map.get(pkg.id) : undefined;
    setKind(m?.package_type ?? "");
    setConn(m?.connection_type ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open, pkg, presetGroupId, defaultValidity, gb]);

  /** Steps after the package itself exists. Never re-creates the package. */
  const runFollowUps = async (
    saved: IspPackage,
    steps: ("rules" | "labels")[],
  ): Promise<FollowUp["failed"]> => {
    const failed: FollowUp["failed"] = [];
    for (const step of steps) {
      try {
        if (step === "rules") {
          const res = formToPolicyBody(rules, { gb });
          if (!res.ok) throw new Error("Fix the highlighted network rules.");
          const policy = await networkService.putPolicy(saved.id, res.body);
          qc.setQueryData(networkKeys.policy(saved.id), policy);
        } else {
          await packageMetaService.put(saved.id, {
            package_type: kind || null,
            connection_type: conn || null,
          });
          await qc.invalidateQueries({ queryKey: packageMetaKeys.all });
        }
      } catch (err) {
        failed.push({
          step,
          message: ispErrorMessage(
            err,
            step === "rules" ? "The network rules were not saved." : "The labels were not saved.",
          ),
        });
      }
    }
    return failed;
  };

  const labelsChanged = () => {
    if (!meta.available) return false;
    const m = pkg ? meta.map.get(pkg.id) : undefined;
    return (
      (kind || null) !== (m?.package_type ?? null) ||
      (conn || null) !== (m?.connection_type ?? null)
    );
  };

  const retryFollowUps = async () => {
    if (!followUp) return;
    setRetrying(true);
    const failed = await runFollowUps(
      followUp.pkg,
      followUp.failed.map((f) => f.step),
    );
    setRetrying(false);
    if (failed.length) setFollowUp({ ...followUp, failed });
    else {
      toast.success("Saved.");
      onClose();
    }
  };

  const group = (groups.data?.items ?? []).find((g) => g.id === groupId);
  const suggested =
    group && Number(validity) > 0 ? previewPackageName(group.name, type, Number(validity)) : "";
  const shownName = nameTouched ? name : suggested;

  const submit = async () => {
    const errs: Record<string, string> = {};
    const v = Number(validity);
    const p = parseRupeesToPaise(price || "0");
    const d = Number(devices);
    const capGb = gb ? parseGbToMb(cap) : null;
    const c = capGb ? (capGb.ok ? capGb.mb : NaN) : cap.trim() ? Number(cap) : null;
    if (!groupId) errs.speed_group_id = "Pick a speed group.";
    if (!Number.isInteger(v) || v < 1 || v > 3650) errs.validity_days = "1 to 3650 days.";
    if (p === null) errs.price_paise = "A rupee amount, like 499.";
    if (!Number.isInteger(d) || d < 1 || d > 50) errs.max_devices = "1 to 50.";
    if (capGb && !capGb.ok) errs.data_cap_mb = `${capGb.error} Empty for no cap.`;
    else if (c !== null && (!Number.isInteger(c) || c <= 0))
      errs.data_cap_mb = "Whole MB, or empty for no cap.";
    setFieldErrors(errs);
    // Rules are checked before the package is created, so a typo in them
    // never leaves a half-configured package behind.
    let rulesOk = true;
    if (rulesTouched) {
      const res = formToPolicyBody(rules, { gb });
      setRuleErrors(res.ok ? {} : res.errors);
      rulesOk = res.ok;
    }
    if (Object.keys(errs).length || p === null || !rulesOk) return;
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
    let saved: IspPackage;
    try {
      if (pkg && inUse) {
        // Group and validity are fixed once in use (409 otherwise): send the rest.
        saved = await save.mutateAsync({
          ...body,
          speed_group_id: pkg.speed_group.id,
          validity_days: pkg.validity_days,
        });
      } else {
        saved = await save.mutateAsync(body);
      }
    } catch (err) {
      const fe = ispFormErrors(err, {
        known: PACKAGE_FIELDS,
        labels: { name: "Name", description: "Description", gst_rate: "GST rate" },
      });
      setFieldErrors(fe.fields);
      setError(fe.form ?? ispErrorMessage(err, "Could not save the package."));
      return;
    }
    const steps: ("rules" | "labels")[] = [];
    if (rulesTouched) steps.push("rules");
    if (labelsChanged()) steps.push("labels");
    const failed = steps.length ? await runFollowUps(saved, steps) : [];
    toast.success(pkg ? "Package saved." : "Package created.");
    if (failed.length) setFollowUp({ pkg: saved, failed });
    else onClose();
  };

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={pkg ? `Edit ${pkg.name}` : "Add package"}
      subtitle="What you sell: a speed, a validity and a price."
      footer={
        followUp ? (
          <div className="flex justify-end gap-2">
            <MButton variant="outline" onClick={onClose}>
              Done, fix later
            </MButton>
            <MButton onClick={retryFollowUps} disabled={retrying}>
              {retrying && <Spinner />} Retry
            </MButton>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <MButton variant="outline" onClick={onClose}>
              Cancel
            </MButton>
            <MButton onClick={submit} disabled={save.isPending}>
              {save.isPending && <Spinner />} Save
            </MButton>
          </div>
        )
      }
    >
      {followUp && (
        <div
          role="alert"
          className="mb-3 space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs"
        >
          <p className="font-semibold text-foreground">
            {followUp.pkg.name} was {pkg ? "saved" : "created"}, but not everything was saved:
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {followUp.failed.map((f) => (
              <li key={f.step}>
                <span className="font-medium">
                  {f.step === "rules" ? "Network rules" : "Package and connection type"}:
                </span>{" "}
                {f.message}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Retry now, or close and set them later
            {followUp.failed.some((f) => f.step === "rules")
              ? " from the package's Network rules button"
              : ""}
            . The package itself is kept.
          </p>
        </div>
      )}
      <fieldset disabled={!!followUp} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Speed group</span>
            {!inUse && (
              <button
                type="button"
                onClick={() => setNewGroupFor("speed")}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> New speed template
              </button>
            )}
          </span>
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
            label={gb ? "Data cap (GB, optional)" : "Data cap (MB, optional)"}
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
        {meta.available && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Package type</span>
              <select
                className={M_INPUT}
                value={kind}
                onChange={(e) => setKind(e.target.value as PackageKind | "")}
              >
                <option value="">Not set</option>
                {(Object.keys(PACKAGE_KIND_LABEL) as PackageKind[]).map((k) => (
                  <option key={k} value={k}>
                    {PACKAGE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Connection type</span>
              <select
                className={M_INPUT}
                value={conn}
                onChange={(e) => setConn(e.target.value as ConnectionKind | "")}
              >
                <option value="">Not set</option>
                {(Object.keys(CONNECTION_KIND_LABEL) as ConnectionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {CONNECTION_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <p className="col-span-2 -mt-1 text-[11px] text-muted-foreground">
              Labels for filtering and reports. They do not change speeds or billing.
            </p>
          </div>
        )}
        {!pkg && (
          <details
            className="rounded-lg border border-border p-3"
            open={rulesTouched || Object.keys(ruleErrors).length > 0}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Network rules (optional)
            </summary>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Fair usage, night boost, device binding and timeouts. Leave closed to keep the
              defaults; you can change them later from Network rules.
            </p>
            <div className="mt-3 space-y-3">
              <PolicyFields
                gb={gb}
                form={rules}
                set={setRule}
                errors={ruleErrors}
                groups={groups.data?.items ?? []}
                onNewGroup={(field) => setNewGroupFor(field)}
              />
            </div>
          </details>
        )}
        <p className="text-[11px] text-muted-foreground">
          Billing plan and the base + GST = total preview are in{" "}
          <Link
            to="/partner/finance"
            search={{ tab: "packages" }}
            className="font-medium text-primary hover:underline"
          >
            Finance → Package billing
          </Link>
          .
        </p>
        <FormError message={error} />
      </fieldset>
      <GroupDrawer
        open={newGroupFor !== null}
        group={null}
        onClose={() => setNewGroupFor(null)}
        onSaved={(g) => {
          if (newGroupFor === "speed") setGroupId(g.id);
          else if (newGroupFor) setRule(newGroupFor, g.id);
        }}
      />
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
  // PKG-2 labels. The list API pages by 25; with a label filter on we read
  // the first 100 packages and filter all of them, so a filter never hides
  // a match that sits on another page.
  const meta = usePackageMetaMap();
  const gb = useGbDataLimits();
  const [kindFilter, setKindFilter] = useState<PackageKind | "">("");
  const [connFilter, setConnFilter] = useState<ConnectionKind | "">("");
  const labelFilter = meta.available && !!(kindFilter || connFilter);
  const q = usePackages({
    speed_group_id: groupId || undefined,
    status: status || undefined,
    page: labelFilter ? 1 : page,
    page_size: labelFilter ? 100 : 25,
  });
  const [editing, setEditing] = useState<IspPackage | null | "new">(null);
  const [planOpen, setPlanOpen] = useState(false); // RAKESH-P1: short ISP form (workflow flag)
  const [duplicating, setDuplicating] = useState<IspPackage | null>(null);
  const [rules, setRules] = useState<IspPackage | null>(null);
  const [deleting, setDeleting] = useState<IspPackage | null>(null);
  // ADDENDUM_05 J19: "apply to existing subscribers".
  const [syncing, setSyncing] = useState<{
    kind: "package" | "group";
    id: string;
    name: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toggle = usePlansMutation((v: { id: string; enabled: boolean }) =>
    plansService.setPackageEnabled(v.id, v.enabled),
  );
  const remove = usePlansMutation((id: string) => plansService.deletePackage(id));
  const raw = q.data;
  const data = useMemo(() => {
    if (!raw || !labelFilter) return raw;
    const items = raw.items.filter((p) => {
      const m = meta.map.get(p.id);
      return (
        (!kindFilter || m?.package_type === kindFilter) &&
        (!connFilter || m?.connection_type === connFilter)
      );
    });
    return { ...raw, items, total: items.length, page: 1, pages: 1 };
  }, [raw, labelFilter, kindFilter, connFilter, meta.map]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${M_FILTER}`}
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
          className={`${M_FILTER}`}
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
        {meta.available && (
          <>
            <select
              className={`${M_FILTER}`}
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as PackageKind | "")}
              aria-label="Package type"
            >
              <option value="">Any package type</option>
              {(Object.keys(PACKAGE_KIND_LABEL) as PackageKind[]).map((k) => (
                <option key={k} value={k}>
                  {PACKAGE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <select
              className={`${M_FILTER}`}
              value={connFilter}
              onChange={(e) => setConnFilter(e.target.value as ConnectionKind | "")}
              aria-label="Connection type"
            >
              <option value="">Any connection</option>
              {(Object.keys(CONNECTION_KIND_LABEL) as ConnectionKind[]).map((k) => (
                <option key={k} value={k}>
                  {CONNECTION_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="ml-auto">
          <PlanSettingsButton />
        </div>
        {can("isp_plans.create") && (
          <MButton onClick={() => (gb ? setPlanOpen(true) : setEditing("new"))}>
            <Plus /> Add package
          </MButton>
        )}
      </div>
      <FormError message={actionError} />
      {labelFilter && raw && raw.total > raw.items.length && (
        <p className="text-[11px] text-muted-foreground">
          Filtering the first {raw.items.length} of {raw.total} packages by label.
        </p>
      )}
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
                <MTd className="text-xs">
                  <span className="capitalize">{p.type}</span>
                  {(() => {
                    const m = meta.map.get(p.id);
                    const tags = [
                      m?.package_type && PACKAGE_KIND_LABEL[m.package_type],
                      m?.connection_type && CONNECTION_KIND_LABEL[m.connection_type],
                    ].filter(Boolean);
                    return tags.length ? (
                      <p className="text-xs text-muted-foreground">{tags.join(" · ")}</p>
                    ) : null;
                  })()}
                </MTd>
                <MTd className="text-right tabular-nums">{p.validity_days} d</MTd>
                <MTd className="text-right tabular-nums">
                  {formatRupees(p.price_paise)}
                  <p className="text-xs text-muted-foreground">
                    {p.price_includes_gst ? "incl. GST" : "+ GST"}
                  </p>
                </MTd>
                <MTd className="text-xs">
                  {gb
                    ? formatMbAsGb(p.data_cap_mb)
                    : p.data_cap_mb
                      ? `${p.data_cap_mb} MB`
                      : "None"}
                </MTd>
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
                    {can("isp_subscribers.read") && (
                      <MButton
                        variant="ghost"
                        title="Apply to existing subscribers"
                        aria-label={`Apply ${p.name} to existing subscribers`}
                        onClick={() => setSyncing({ kind: "package", id: p.id, name: p.name })}
                      >
                        <RefreshCcw />
                      </MButton>
                    )}
                    {can("isp_plans.read") && (
                      <MButton
                        variant="ghost"
                        title="Network rules (FUP, night boost, devices, timeouts)"
                        aria-label={`Network rules for ${p.name}`}
                        onClick={() => setRules(p)}
                      >
                        <Network />
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
                          className="px-2 text-xs text-muted-foreground"
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
      <IspPlanDrawer
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onFullForm={() => (setPlanOpen(false), setEditing("new"))}
      />
      <PlanSyncDialog target={syncing} onClose={() => setSyncing(null)} />
      <DuplicateDialog pkg={duplicating} onClose={() => setDuplicating(null)} />
      <PackagePolicyDrawer
        pkg={rules}
        onClose={() => setRules(null)}
        canEdit={can("isp_plans.update")}
      />
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
