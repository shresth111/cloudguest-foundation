/** Plans → Speed groups (ADDENDUM_02 §9): table, form drawer, ladder dialog. */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Gauge, Pencil, Plus, Ticket, Trash2, Users } from "lucide-react";
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
import { ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { usePlansMutation, useSpeedGroups } from "@/hooks/isp-partner/usePlans";
import { plansService } from "@/services/isp-partner/plans";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { formatNumber } from "@/lib/isp-partner/format";
import { parseRupeesToPaise } from "@/lib/isp-partner/money";
import {
  DEFAULT_LADDER_SPEEDS,
  DEFAULT_LADDER_VALIDITIES,
  formatKbps,
  mbpsToKbps,
} from "@/lib/isp-partner/plans";
import type { PackageType, SpeedGroup, SpeedGroupBody } from "@/services/isp-partner/plans-types";

type Unit = "mbps" | "kbps";

function toUnit(kbps: number, unit: Unit): string {
  return unit === "mbps" ? String(Math.round((kbps / 1024) * 100) / 100) : String(kbps);
}
function fromUnit(v: string, unit: Unit): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return unit === "mbps" ? mbpsToKbps(n) : Math.round(n);
}

export function GroupDrawer({
  open,
  onClose,
  group,
}: {
  open: boolean;
  onClose: () => void;
  group: SpeedGroup | null;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("mbps");
  const [down, setDown] = useState("");
  const [up, setUp] = useState("");
  const [same, setSame] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [burstDown, setBurstDown] = useState("");
  const [burstUp, setBurstUp] = useState("");
  const [threshold, setThreshold] = useState("");
  const [burstTime, setBurstTime] = useState("");
  const [priority, setPriority] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const save = usePlansMutation((body: SpeedGroupBody) =>
    group ? plansService.updateGroup(group.id, body) : plansService.createGroup(body),
  );

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setUnit("mbps");
    setDown(group ? toUnit(group.download_kbps, "mbps") : "");
    setUp(group ? toUnit(group.upload_kbps, "mbps") : "");
    setSame(group ? group.download_kbps === group.upload_kbps : true);
    const b = group?.burst;
    const hasBurst = !!b && b.download_kbps !== null;
    setAdvanced(hasBurst);
    setBurstDown(hasBurst && b?.download_kbps ? toUnit(b.download_kbps, "mbps") : "");
    setBurstUp(hasBurst && b?.upload_kbps ? toUnit(b.upload_kbps, "mbps") : "");
    setThreshold(hasBurst && b?.threshold_kbps ? toUnit(b.threshold_kbps, "mbps") : "");
    setBurstTime(hasBurst && b?.time_seconds ? String(b.time_seconds) : "");
    setPriority(String(group?.priority ?? 8));
    setError(null);
    setFieldErrors({});
  }, [open, group]);

  const switchUnit = (next: Unit) => {
    const conv = (v: string) => {
      const k = fromUnit(v, unit);
      return k === null || v === "" ? v : toUnit(k, next);
    };
    setDown(conv(down));
    setUp(conv(up));
    setBurstDown(conv(burstDown));
    setBurstUp(conv(burstUp));
    setThreshold(conv(threshold));
    setUnit(next);
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    const d = fromUnit(down, unit);
    const u = same ? d : fromUnit(up, unit);
    if (!name.trim()) errs.name = "Required, e.g. 15 Mbps.";
    if (d === null || d < 64 || d > 10_000_000) errs.download_kbps = "64 Kbps to 10 Gbps.";
    if (u === null || u < 64 || u > 10_000_000) errs.upload_kbps = "64 Kbps to 10 Gbps.";
    let burst: SpeedGroupBody["burst"] = null;
    if (advanced) {
      const bd = fromUnit(burstDown, unit);
      const bu = fromUnit(burstUp, unit);
      const th = fromUnit(threshold, unit);
      const t = Number(burstTime);
      if (
        bd === null ||
        bu === null ||
        th === null ||
        !Number.isInteger(t) ||
        t <= 0 ||
        !burstDown ||
        !burstUp ||
        !threshold
      )
        errs.burst = "Fill every burst field, or switch burst off.";
      else if (d !== null && u !== null && (bd <= d || bu <= u))
        errs.burst = "The burst rate must be higher than the normal rate.";
      else burst = { download_kbps: bd, upload_kbps: bu, threshold_kbps: th, time_seconds: t };
    }
    const p = Number(priority);
    if (!Number.isInteger(p) || p < 1 || p > 8) errs.priority = "1 (highest) to 8.";
    setFieldErrors(errs);
    if (Object.keys(errs).length || d === null || u === null) return;
    setError(null);
    try {
      await save.mutateAsync({
        name: name.trim(),
        download_kbps: d,
        upload_kbps: u,
        burst,
        priority: p,
      });
      toast.success(
        group
          ? "Speed group saved. New speeds apply at each guest's next login."
          : `${name.trim()} added.`,
      );
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not save the speed group."));
    }
  };

  const unitLabel = unit === "mbps" ? "Mbps" : "Kbps";
  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={group ? `Edit ${group.name}` : "Add speed group"}
      subtitle="A speed profile your packages use."
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
        <TextField label="Name" required value={name} onChange={setName} error={fieldErrors.name} />
        <MSeg<Unit>
          value={unit}
          onChange={switchUnit}
          options={[
            { value: "mbps", label: "Mbps" },
            { value: "kbps", label: "Kbps" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={`Download (${unitLabel})`}
            required
            value={down}
            onChange={setDown}
            error={fieldErrors.download_kbps}
          />
          <TextField
            label={`Upload (${unitLabel})`}
            required
            value={same ? down : up}
            onChange={setUp}
            disabled={same}
            error={fieldErrors.upload_kbps}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} />
          Upload same as download
        </label>
        <TextField
          label="Priority (1 highest, 8 lowest)"
          value={priority}
          onChange={setPriority}
          error={fieldErrors.priority}
        />
        <details
          open={advanced}
          onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Advanced: burst
          </summary>
          <div className="mt-2 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Burst lets a guest run faster for a short time (for example while a page loads) as
              long as their average stays under the threshold. Leave it off unless you need it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={`Burst download (${unitLabel})`}
                value={burstDown}
                onChange={setBurstDown}
              />
              <TextField
                label={`Burst upload (${unitLabel})`}
                value={burstUp}
                onChange={setBurstUp}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={`Threshold (${unitLabel})`}
                value={threshold}
                onChange={setThreshold}
              />
              <TextField label="Burst time (seconds)" value={burstTime} onChange={setBurstTime} />
            </div>
            {fieldErrors.burst && (
              <p className="text-[11px] text-destructive">{fieldErrors.burst}</p>
            )}
          </div>
        </details>
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}

export function LadderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [speeds, setSpeeds] = useState<number[]>(DEFAULT_LADDER_SPEEDS);
  const [validities, setValidities] = useState<number[]>(DEFAULT_LADDER_VALIDITIES);
  const [customValidity, setCustomValidity] = useState("");
  const [type, setType] = useState<PackageType>("prepaid");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const run = usePlansMutation(plansService.ladder);
  const allSpeeds = useMemo(
    () => Array.from(new Set([...DEFAULT_LADDER_SPEEDS, ...speeds])).sort((a, b) => a - b),
    [speeds],
  );
  const toggle = (list: number[], v: number) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b);

  useEffect(() => {
    if (open) {
      setSpeeds(DEFAULT_LADDER_SPEEDS);
      setValidities(DEFAULT_LADDER_VALIDITIES);
      setPrices({});
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!speeds.length || !validities.length)
      return setError("Pick at least one speed and one validity.");
    const prices_paise: Record<string, number> = {};
    for (const [k, v] of Object.entries(prices)) {
      if (!v.trim()) continue;
      const p = parseRupeesToPaise(v);
      if (p === null)
        return setError(`Price for ${k.replace(":", " Mbps · ")} days is not a rupee amount.`);
      prices_paise[k] = p;
    }
    setError(null);
    try {
      const res = await run.mutateAsync({
        speeds_mbps: speeds,
        validities_days: validities,
        type,
        upload_equals_download: true,
        prices_paise,
      });
      toast.success(
        `Created ${res.created_groups} speed groups and ${res.created_packages} packages${res.skipped.length ? ` (${res.skipped.length} already existed)` : ""}. Packages without a price were created disabled.`,
      );
      onClose();
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`;

  return (
    <MDialog
      open={open}
      onClose={onClose}
      wide
      title="Create a standard speed ladder"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton onClick={submit} disabled={run.isPending}>
            {run.isPending && <Spinner />} Create {speeds.length} groups,{" "}
            {speeds.length * validities.length} packages
          </MButton>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Speeds (Mbps, upload = download)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allSpeeds.map((s) => (
              <button
                key={s}
                type="button"
                className={chip(speeds.includes(s))}
                onClick={() => setSpeeds(toggle(speeds, s))}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Validities (days)</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from(new Set([...DEFAULT_LADDER_VALIDITIES, ...validities])).map((v) => (
              <button
                key={v}
                type="button"
                className={chip(validities.includes(v))}
                onClick={() => setValidities(toggle(validities, v))}
              >
                {v} d
              </button>
            ))}
            <input
              className={`${M_INPUT} w-24`}
              placeholder="Custom"
              inputMode="numeric"
              value={customValidity}
              onChange={(e) => setCustomValidity(e.target.value)}
            />
            <MButton
              variant="outline"
              onClick={() => {
                const n = Number(customValidity);
                if (Number.isInteger(n) && n >= 1 && n <= 3650 && !validities.includes(n)) {
                  setValidities(toggle(validities, n));
                  setCustomValidity("");
                }
              }}
            >
              Add
            </MButton>
          </div>
        </div>
        <MSeg<PackageType>
          value={type}
          onChange={setType}
          options={[
            { value: "prepaid", label: "Prepaid" },
            { value: "postpaid", label: "Postpaid" },
          ]}
        />
        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Prices (optional, ₹). Packages left without a price are created disabled.
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-1.5">Speed</th>
                  {validities.map((v) => (
                    <th key={v} className="px-2 py-1.5">
                      {v} d
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {speeds.map((s) => (
                  <tr key={s} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-1">{s} Mbps</td>
                    {validities.map((v) => (
                      <td key={v} className="px-2 py-1">
                        <input
                          className="w-24 rounded border border-input bg-background px-1.5 py-0.5"
                          value={prices[`${s}:${v}`] ?? ""}
                          aria-label={`Price ${s} Mbps ${v} days`}
                          onChange={(e) =>
                            setPrices((pr) => ({ ...pr, [`${s}:${v}`]: e.target.value }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-xs text-muted-foreground">
          Groups that already exist by name are reused, and packages that already exist are skipped,
          so running this twice changes nothing.
        </p>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function SpeedGroupsTab({
  onShowSubscribers,
  onGenerateCoupons,
}: {
  onShowSubscribers: (groupId: string) => void;
  onGenerateCoupons: (groupId: string) => void;
}) {
  const { can } = usePartner();
  const [status, setStatus] = useState<"" | "active" | "disabled">("");
  const q = useSpeedGroups({ status: status || undefined, page_size: 100 });
  const [editing, setEditing] = useState<SpeedGroup | null | "new">(null);
  const [ladder, setLadder] = useState(false);
  const [deleting, setDeleting] = useState<SpeedGroup | null>(null);
  const toggle = usePlansMutation((v: { id: string; enabled: boolean }) =>
    plansService.setGroupEnabled(v.id, v.enabled),
  );
  const remove = usePlansMutation((id: string) => plansService.deleteGroup(id));
  const [actionError, setActionError] = useState<string | null>(null);
  const items = useMemo(
    () => [...(q.data?.items ?? [])].sort((a, b) => a.download_kbps - b.download_kbps),
    [q.data],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MSeg<"" | "active" | "disabled">
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ]}
        />
        {can("isp_plans.create") && (
          <div className="ml-auto flex gap-2">
            <MButton variant="outline" onClick={() => setLadder(true)}>
              <Gauge /> Standard ladder
            </MButton>
            <MButton onClick={() => setEditing("new")}>
              <Plus /> Add speed group
            </MButton>
          </div>
        )}
      </div>
      <FormError message={actionError} />
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="speed groups" />
      ) : q.data && items.length === 0 ? (
        <MEmptyState
          icon={Gauge}
          title={status ? "No speed groups match" : "No speed groups yet"}
          description="A speed group is a rate (say 15 Mbps). Packages put a validity and price on it."
          action={
            can("isp_plans.create") && !status ? (
              <div className="flex flex-wrap justify-center gap-2">
                <MButton onClick={() => setLadder(true)}>Create a standard speed ladder</MButton>
                <MButton variant="outline" onClick={() => setEditing("new")}>
                  Add speed group
                </MButton>
              </div>
            ) : undefined
          }
        />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Group</MTh>
              <MTh>Packages</MTh>
              <MTh className="text-right">Online now</MTh>
              <MTh className="text-right">Subscribers</MTh>
              <MTh>Status</MTh>
              <MTh className="text-right">Actions</MTh>
            </>
          }
        >
          {items.map((g) => (
            <MTr key={g.id}>
              <MTd>
                <p className="font-medium">{g.name}</p>
                <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  ↓{formatKbps(g.download_kbps)} / ↑{formatKbps(g.upload_kbps)}
                  {g.burst?.download_kbps ? " · burst" : ""}
                </span>
              </MTd>
              <MTd>
                <div className="flex flex-wrap gap-1">
                  {g.packages.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : (
                    g.packages.map((p) => (
                      <span
                        key={p.id}
                        title={p.name}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${p.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground line-through"}`}
                      >
                        {p.validity_days} d
                      </span>
                    ))
                  )}
                </div>
              </MTd>
              <MTd className="text-right tabular-nums">{formatNumber(g.active_users)}</MTd>
              <MTd className="text-right tabular-nums">{formatNumber(g.total_users)}</MTd>
              <MTd>
                <MTag label={g.status} />
              </MTd>
              <MTd className="text-right">
                <div className="flex flex-wrap justify-end gap-0.5">
                  {can("isp_plans.update") && (
                    <MButton
                      variant="ghost"
                      title="Edit"
                      aria-label={`Edit ${g.name}`}
                      onClick={() => setEditing(g)}
                    >
                      <Pencil />
                    </MButton>
                  )}
                  <MButton
                    variant="ghost"
                    title="View subscribers"
                    aria-label={`Subscribers of ${g.name}`}
                    onClick={() => onShowSubscribers(g.id)}
                  >
                    <Users />
                  </MButton>
                  {can("isp_coupons.create") && g.status === "active" && (
                    <MButton
                      variant="ghost"
                      title="Generate coupons"
                      aria-label={`Generate coupons for ${g.name}`}
                      onClick={() => onGenerateCoupons(g.id)}
                    >
                      <Ticket />
                    </MButton>
                  )}
                  {can("isp_plans.update") && (
                    <MButton
                      variant="ghost"
                      disabled={toggle.isPending}
                      onClick={async () => {
                        setActionError(null);
                        try {
                          await toggle.mutateAsync({ id: g.id, enabled: g.status !== "active" });
                          toast.success(
                            g.status === "active" ? `${g.name} disabled.` : `${g.name} enabled.`,
                          );
                        } catch (err) {
                          setActionError(ispErrorMessage(err));
                        }
                      }}
                    >
                      {g.status === "active" ? "Disable" : "Enable"}
                    </MButton>
                  )}
                  {can("isp_plans.delete") && g.can_delete && (
                    <MButton
                      variant="ghost"
                      title="Delete"
                      aria-label={`Delete ${g.name}`}
                      onClick={() => setDeleting(g)}
                    >
                      <Trash2 />
                    </MButton>
                  )}
                </div>
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      <GroupDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        group={editing === "new" ? null : editing}
      />
      <LadderDialog open={ladder} onClose={() => setLadder(false)} />
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
          It has no subscribers and no packages left. This cannot be undone.
        </p>
      </MDialog>
    </div>
  );
}
