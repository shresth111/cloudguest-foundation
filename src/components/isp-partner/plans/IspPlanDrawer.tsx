/** RAKESH-P1: "New plan", the short ISP form. Template first (create one in
 * place), Unlimited or FUP, validity (from first login), price, billing,
 * connection, and the device rules the template brings. Everything else stays
 * behind "More options" or in the full form. Saves with the existing APIs:
 * package -> network rules -> labels -> billing cycle basis. The package is
 * never created twice; a failed later step is shown and kept for later. */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MButton, MDrawer, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { GroupSelect } from "@/components/isp-partner/network/PolicyFields";
import { GroupDrawer } from "@/components/isp-partner/plans/SpeedGroupsTab";
import { usePlanSettings, usePlansMutation, useSpeedGroups } from "@/hooks/isp-partner/usePlans";
import { useGbDataLimits } from "@/hooks/isp-partner/useWorkflow";
import { packageMetaKeys, usePackageMetaMap } from "@/hooks/isp-partner/usePackageMeta";
import { networkKeys } from "@/hooks/isp-partner/useNetwork";
import { p1Keys, useCycleBasisMap, useTemplateRulesMap } from "@/hooks/isp-partner/useP1";
import { plansService } from "@/services/isp-partner/plans";
import { networkService } from "@/services/isp-partner/network";
import { packageMetaService, type ConnectionKind } from "@/services/isp-partner/package-meta";
import { CYCLE_BASIS_LABEL, p1Service, type CycleBasis } from "@/services/isp-partner/p1";
import type { IspPackage, PackageBody, PackageType } from "@/services/isp-partner/plans-types";
import type { FupReset } from "@/services/isp-partner/network-types";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { DEFAULT_VALIDITY_DAYS, previewPackageName } from "@/lib/isp-partner/plans";
import {
  deviceRulesSummary,
  emptyPlanForm,
  matchesTemplateRules,
  planToBodies,
  validitySummary,
  withTemplateRules,
  type PlanErrors,
  type PlanForm,
  type PlanKind,
} from "@/lib/isp-partner/p1-plan";

type NewFor = "plan" | "fallback" | "boost" | null;
type Step = "rules" | "labels" | "billing";
const STEP_LABEL: Record<Step, string> = {
  rules: "Network rules",
  labels: "Connection type",
  billing: "Billing cycle",
};

export function IspPlanDrawer({
  open,
  onClose,
  onFullForm,
}: {
  open: boolean;
  onClose: () => void;
  /** Opens the existing full package form instead. */
  onFullForm: () => void;
}) {
  const qc = useQueryClient();
  const gb = useGbDataLimits();
  const groups = useSpeedGroups({ status: "active", page_size: 100 }, open);
  const settings = usePlanSettings();
  const meta = usePackageMetaMap();
  const templateRules = useTemplateRulesMap(open);
  const cycleBasis = useCycleBasisMap(open);
  const defaultValidity = settings.data?.default_validity_days ?? DEFAULT_VALIDITY_DAYS;
  const [f, setF] = useState<PlanForm>(() => emptyPlanForm(DEFAULT_VALIDITY_DAYS));
  const [conn, setConn] = useState<ConnectionKind | "">("");
  const [basis, setBasis] = useState<CycleBasis>("package");
  const [nameTouched, setNameTouched] = useState(false);
  const [editDevices, setEditDevices] = useState(false);
  const [more, setMore] = useState(false);
  const [errors, setErrors] = useState<PlanErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [newFor, setNewFor] = useState<NewFor>(null);
  const [failed, setFailed] = useState<{
    pkg: IspPackage;
    steps: { step: Step; message: string }[];
  } | null>(null);
  const create = usePlansMutation((body: PackageBody) => plansService.createPackage(body));
  const items = groups.data?.items ?? [];
  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setRule = <K extends keyof PlanForm["rules"]>(k: K, v: PlanForm["rules"][K]) =>
    setF((x) => ({ ...x, rules: { ...x.rules, [k]: v } }));

  useEffect(() => {
    if (!open) return;
    setF(emptyPlanForm(defaultValidity));
    setConn("");
    setBasis("package");
    setNameTouched(false);
    setEditDevices(false);
    setMore(false);
    setErrors({});
    setError(null);
    setFailed(null);
  }, [open, defaultValidity]);

  const rules = templateRules.map.get(f.groupId);
  const fromTemplate = matchesTemplateRules(f, rules);
  const group = items.find((g) => g.id === f.groupId);
  const suggested =
    group && Number(f.validity) > 0
      ? previewPackageName(group.name, f.type, Number(f.validity))
      : "";

  const pickGroup = (id: string) => {
    setF((x) => withTemplateRules({ ...x, groupId: id }, templateRules.map.get(id)));
    setEditDevices(false);
  };

  const followUps = async (pkg: IspPackage, steps: Step[], policy: unknown) => {
    const out: { step: Step; message: string }[] = [];
    for (const step of steps) {
      try {
        if (step === "rules") {
          const p = await networkService.putPolicy(pkg.id, policy as never);
          qc.setQueryData(networkKeys.policy(pkg.id), p);
        } else if (step === "labels") {
          await packageMetaService.put(pkg.id, {
            package_type: null,
            connection_type: conn || null,
          });
          await qc.invalidateQueries({ queryKey: packageMetaKeys.all });
        } else {
          await p1Service.putCycleBasis(pkg.id, basis);
          await qc.invalidateQueries({ queryKey: p1Keys.cycleBasis });
        }
      } catch (err) {
        out.push({ step, message: ispErrorMessage(err, "Not saved.") });
      }
    }
    return out;
  };

  const submit = async () => {
    const res = planToBodies({ ...f, name: nameTouched ? f.name : "" }, { gb });
    setErrors(res.ok ? {} : res.errors);
    if (!res.ok) return;
    setError(null);
    let pkg: IspPackage;
    try {
      pkg = await create.mutateAsync(res.pkg);
    } catch (err) {
      setErrors(ispFieldErrors(err) as PlanErrors);
      setError(ispErrorMessage(err, "Could not create the plan."));
      return;
    }
    const steps: Step[] = ["rules"];
    if (meta.available && conn) steps.push("labels");
    if (cycleBasis.available && basis !== "package") steps.push("billing");
    const bad = await followUps(pkg, steps, res.policy);
    toast.success(`${pkg.name} created.`);
    if (bad.length) setFailed({ pkg, steps: bad });
    else onClose();
  };

  const retry = async () => {
    if (!failed) return;
    const res = planToBodies({ ...f, name: "" }, { gb });
    const bad = await followUps(
      failed.pkg,
      failed.steps.map((s) => s.step),
      res.ok ? res.policy : null,
    );
    if (bad.length) setFailed({ ...failed, steps: bad });
    else {
      toast.success("Saved.");
      onClose();
    }
  };

  const unit = gb ? "GB" : "MB";
  const resetOptions = useMemo<{ value: FupReset; label: string }[]>(
    () => [
      { value: "month", label: "Monthly" },
      { value: "day", label: "Daily" },
      { value: "cycle", label: "Each validity" },
    ],
    [],
  );

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title="New plan"
      subtitle="Speed template, data policy, validity and price."
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={onFullForm}
          >
            Use the full form
          </button>
          <div className="flex gap-2">
            <MButton variant="outline" onClick={onClose}>
              {failed ? "Done, fix later" : "Cancel"}
            </MButton>
            {failed ? (
              <MButton onClick={retry}>Retry</MButton>
            ) : (
              <MButton onClick={submit} disabled={create.isPending}>
                {create.isPending && <Spinner />} Create plan
              </MButton>
            )}
          </div>
        </div>
      }
    >
      {failed && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs"
        >
          <p className="font-semibold">
            {failed.pkg.name} was created, but not everything was saved:
          </p>
          <ul className="list-disc pl-4">
            {failed.steps.map((s) => (
              <li key={s.step}>
                {STEP_LABEL[s.step]}: {s.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={!!failed} className="space-y-4">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            1 · Speed
          </h3>
          <GroupSelect
            label="Speed template"
            value={f.groupId}
            onChange={pickGroup}
            groups={items}
            error={errors.groupId}
            noneLabel="Pick…"
            onNew={() => setNewFor("plan")}
          />
          {f.groupId && (
            <div className="rounded-lg border border-border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-muted-foreground">Devices: </span>
                  {deviceRulesSummary({
                    max_devices: Number(f.devices) || 1,
                    mac_bind_count: Number(f.rules.mac_bind_count) || 0,
                    mac_restriction: f.rules.mac_restriction,
                    max_simultaneous: f.rules.max_simultaneous.trim()
                      ? Number(f.rules.max_simultaneous)
                      : null,
                  })}
                  {fromTemplate && (
                    <span className="text-muted-foreground"> (from the template)</span>
                  )}
                </span>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setEditDevices((v) => !v)}
                >
                  {editDevices ? "Hide" : "Change"}
                </button>
              </div>
              {editDevices && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <TextField
                    label="Device limit"
                    value={f.devices}
                    onChange={(v) => set("devices", v)}
                    error={errors.devices}
                  />
                  <TextField
                    label="Online at once"
                    value={f.rules.max_simultaneous}
                    onChange={(v) => setRule("max_simultaneous", v)}
                    error={errors.max_simultaneous}
                    hint="Empty for no limit."
                  />
                  <TextField
                    label="Bind the first N devices"
                    value={f.rules.mac_bind_count}
                    onChange={(v) => setRule("mac_bind_count", v)}
                    error={errors.mac_bind_count}
                  />
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.rules.mac_restriction}
                      onChange={(e) => setRule("mac_restriction", e.target.checked)}
                    />
                    Bound devices only
                  </label>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            2 · Data
          </h3>
          <MSeg<PlanKind>
            value={f.kind}
            onChange={(v) => set("kind", v)}
            options={[
              { value: "unlimited", label: "Unlimited" },
              { value: "fup", label: "FUP" },
            ]}
          />
          {f.kind === "fup" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={`FUP limit (${unit})`}
                  value={f.rules.fup_limit_mb}
                  onChange={(v) => setRule("fup_limit_mb", v)}
                  error={errors.fup_limit_mb}
                />
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Resets</span>
                  <select
                    className={M_INPUT}
                    value={f.rules.fup_reset}
                    onChange={(e) => setRule("fup_reset", e.target.value as FupReset)}
                  >
                    {resetOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <GroupSelect
                label="Speed after the limit"
                value={f.rules.fup_fallback_speed_group_id}
                onChange={(v) => setRule("fup_fallback_speed_group_id", v)}
                groups={items}
                error={errors.fup_fallback_speed_group_id}
                noneLabel="Pick…"
                onNew={() => setNewFor("fallback")}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.rules.fup_exclude_upload}
                  onChange={(e) => setRule("fup_exclude_upload", e.target.checked)}
                />
                Count download only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.rules.fup_carry_forward}
                  onChange={(e) => setRule("fup_carry_forward", e.target.checked)}
                />
                Carry unused data into the next period
              </label>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            3 · Validity and price
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Validity (days)"
              value={f.validity}
              onChange={(v) => set("validity", v)}
              error={errors.validity}
            />
            <TextField
              label="Price (₹)"
              value={f.price}
              onChange={(v) => set("price", v)}
              error={errors.price}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.firstLogin}
              onChange={(e) => set("firstLogin", e.target.checked)}
            />
            Validity starts at first login
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.gstIncl}
              onChange={(e) => set("gstIncl", e.target.checked)}
            />
            Price includes GST
          </label>
          {Number(f.validity) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Shown to staff as: {validitySummary(Number(f.validity), f.firstLogin)}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            4 · Billing and connection
          </h3>
          <MSeg<PackageType>
            value={f.type}
            onChange={(v) => set("type", v)}
            options={[
              { value: "prepaid", label: "Prepaid" },
              { value: "postpaid", label: "Postpaid" },
            ]}
          />
          {cycleBasis.available && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Billing cycle</span>
              <select
                className={M_INPUT}
                value={basis}
                onChange={(e) => setBasis(e.target.value as CycleBasis)}
              >
                {(Object.keys(CYCLE_BASIS_LABEL) as CycleBasis[]).map((b) => (
                  <option key={b} value={b}>
                    {CYCLE_BASIS_LABEL[b]}
                  </option>
                ))}
              </select>
              {basis === "subscriber" && (
                <span className="block text-[11px] text-muted-foreground">
                  Renewals end on the billing day set on each subscriber (packages of 28 days or
                  more). Subscribers without a billing day renew by the validity.
                </span>
              )}
            </label>
          )}
          {meta.available && (
            <MSeg<ConnectionKind | "">
              value={conn}
              onChange={setConn}
              options={[
                { value: "", label: "Any connection" },
                { value: "wireless", label: "Wireless" },
                { value: "fiber", label: "Fiber" },
              ]}
            />
          )}
        </section>

        <TextField
          label="Name"
          value={nameTouched ? f.name : suggested}
          onChange={(v) => {
            setNameTouched(true);
            set("name", v);
          }}
          hint={nameTouched ? undefined : "Suggested. Edit to change."}
        />

        <details
          open={more}
          onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border border-border p-3"
        >
          <summary className="cursor-pointer text-sm font-medium">
            More options (night boost, priority)
          </summary>
          <div className="mt-3 space-y-3">
            <GroupSelect
              label="Night boost speed"
              value={f.rules.boost_speed_group_id}
              onChange={(v) => setRule("boost_speed_group_id", v)}
              groups={items}
              error={errors.boost_speed_group_id}
              onNew={() => setNewFor("boost")}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="From (HH:MM)"
                value={f.rules.boost_start}
                onChange={(v) => setRule("boost_start", v)}
                error={errors.boost_start}
              />
              <TextField
                label="Until (HH:MM)"
                value={f.rules.boost_end}
                onChange={(v) => setRule("boost_end", v)}
                error={errors.boost_end}
              />
            </div>
            <TextField
              label="Queue priority (1 highest … 8 lowest)"
              value={f.rules.queue_priority}
              onChange={(v) => setRule("queue_priority", v)}
              error={errors.queue_priority}
              hint="Empty = the template's priority."
            />
          </div>
        </details>
        <FormError message={error} />
      </fieldset>
      <GroupDrawer
        open={newFor !== null}
        group={null}
        onClose={() => setNewFor(null)}
        onSaved={(g) => {
          qc.invalidateQueries({ queryKey: p1Keys.templateRules });
          if (newFor === "plan") pickGroup(g.id);
          else if (newFor === "fallback") setRule("fup_fallback_speed_group_id", g.id);
          else if (newFor === "boost") setRule("boost_speed_group_id", g.id);
        }}
      />
    </MDrawer>
  );
}
