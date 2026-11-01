/**
 * Plans → Packages → "Network rules" (ADDENDUM_05 J3): FUP, night boost,
 * validity start, queue priority, MAC binding, simultaneous logins and
 * timeouts for one package. `PUT /isp/packages/{id}/policy`.
 *
 * While `ISP_PARTNER_ENFORCEMENT_ENABLED` is off the rules are stored and
 * shown but never applied; the drawer says so instead of implying otherwise.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { MButton, MDrawer, MSeg, M_INPUT } from "@/components/master/MasterKit";
import { ErrorBlock, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { useSpeedGroups } from "@/hooks/isp-partner/usePlans";
import { usePackagePolicy, useSavePackagePolicy } from "@/hooks/isp-partner/useNetwork";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { formatKbps } from "@/lib/isp-partner/plans";
import {
  boostWindowLabel,
  clockToMinute,
  formToPolicyBody,
  policyToForm,
  type PolicyForm,
} from "@/lib/isp-partner/network";
import type { FupReset, ValidityStarts } from "@/services/isp-partner/network-types";
import type { IspPackage } from "@/services/isp-partner/plans-types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function GroupSelect({
  label,
  value,
  onChange,
  groups,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  groups: { id: string; name: string; download_kbps: number; upload_kbps: number }[];
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        className={M_INPUT}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      >
        <option value="">None</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} (↓{formatKbps(g.download_kbps)} / ↑{formatKbps(g.upload_kbps)})
          </option>
        ))}
      </select>
      {error && <span className="block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}

export function PackagePolicyDrawer({
  pkg,
  onClose,
  canEdit,
}: {
  pkg: IspPackage | null;
  onClose: () => void;
  canEdit: boolean;
}) {
  const q = usePackagePolicy(pkg?.id ?? null);
  const groups = useSpeedGroups({ status: "active", page_size: 100 }, !!pkg);
  const save = useSavePackagePolicy(pkg?.id ?? "");
  const [form, setForm] = useState<PolicyForm>(() => policyToForm(null));
  const [errors, setErrors] = useState<Partial<Record<keyof PolicyForm, string>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) setForm(policyToForm(q.data));
    setErrors({});
    setError(null);
  }, [q.data]);

  if (!pkg) return null;
  const set = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const groupList = groups.data?.items ?? [];
  const readOnly = !canEdit;
  const p = q.data;

  const submit = async () => {
    const res = formToPolicyBody(form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setError(null);
    try {
      await save.mutateAsync(res.body);
      toast.success("Network rules saved.");
      onClose();
    } catch (err) {
      setErrors(ispFieldErrors(err) as Partial<Record<keyof PolicyForm, string>>);
      setError(ispErrorMessage(err, "Could not save the network rules."));
    }
  };

  return (
    <MDrawer
      open
      onClose={onClose}
      title={`Network rules · ${pkg.name}`}
      subtitle="Fair usage, night boost, device binding and session limits for everyone on this package."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </MButton>
          {!readOnly && (
            <MButton onClick={submit} disabled={save.isPending || q.isLoading || !!q.error}>
              {save.isPending && <Spinner />} Save rules
            </MButton>
          )}
        </div>
      }
    >
      {q.isLoading ? (
        <Spinner />
      ) : q.error || !p ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this package's rules" />
      ) : (
        <div className="space-y-3">
          {!p.enforcement_enabled && (
            <div
              role="note"
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Enforcement is switched off for your account. These rules are saved and shown, but
                speeds, device limits and timeouts are not applied yet.
              </span>
            </div>
          )}
          {p.enforcement_enabled && (
            <p className="text-[11px] text-muted-foreground">
              {p.live_mode === "reauth"
                ? "A changed speed applies at once: the guest's session is ended and they sign in again."
                : "A changed speed applies at the guest's next sign-in."}
            </p>
          )}

          <Section title="Fair usage (FUP)">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Data limit (MB)"
                value={form.fup_limit_mb}
                onChange={(v) => set("fup_limit_mb", v)}
                disabled={readOnly}
                error={errors.fup_limit_mb}
                hint="Empty: no limit. 1024 MB = 1 GB."
              />
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Counter resets</span>
                <MSeg<FupReset>
                  value={form.fup_reset}
                  onChange={(v) => !readOnly && set("fup_reset", v)}
                  options={[
                    { value: "cycle", label: "Each validity" },
                    { value: "day", label: "Daily" },
                    { value: "month", label: "Monthly" },
                  ]}
                />
              </label>
            </div>
            <GroupSelect
              label="Speed after the limit"
              value={form.fup_fallback_speed_group_id}
              onChange={(v) => set("fup_fallback_speed_group_id", v)}
              groups={groupList}
              disabled={readOnly}
              error={errors.fup_fallback_speed_group_id}
            />
            <Check
              label="Count download only (upload does not use the limit)"
              checked={form.fup_exclude_upload}
              onChange={(v) => set("fup_exclude_upload", v)}
              disabled={readOnly}
            />
            <Check
              label="Carry unused data into the next period"
              checked={form.fup_carry_forward}
              onChange={(v) => set("fup_carry_forward", v)}
              disabled={readOnly}
            />
          </Section>

          <Section title="Night boost">
            <GroupSelect
              label="Boost speed"
              value={form.boost_speed_group_id}
              onChange={(v) => set("boost_speed_group_id", v)}
              groups={groupList}
              disabled={readOnly}
              error={errors.boost_speed_group_id}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="From"
                type="time"
                value={form.boost_start}
                onChange={(v) => set("boost_start", v)}
                disabled={readOnly}
                error={errors.boost_start}
              />
              <TextField
                label="Until"
                type="time"
                value={form.boost_end}
                onChange={(v) => set("boost_end", v)}
                disabled={readOnly}
                error={errors.boost_end}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Window:{" "}
              {boostWindowLabel(clockToMinute(form.boost_start), clockToMinute(form.boost_end))}.
              Local time of the customer&apos;s venue. A guest over the FUP limit stays on the
              slower speed during the boost.
            </p>
          </Section>

          <Section title="Validity and priority">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Validity starts</span>
              <MSeg<ValidityStarts>
                value={form.validity_starts}
                onChange={(v) => !readOnly && set("validity_starts", v)}
                options={[
                  { value: "activation", label: "When assigned" },
                  { value: "first_login", label: "At first sign-in" },
                ]}
              />
            </label>
            <TextField
              label="Queue priority (1 highest … 8 lowest)"
              value={form.queue_priority}
              onChange={(v) => set("queue_priority", v)}
              disabled={readOnly}
              error={errors.queue_priority}
              hint="Empty: the speed group's own priority."
            />
          </Section>

          <Section title="Devices">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Bind the first N devices"
                value={form.mac_bind_count}
                onChange={(v) => set("mac_bind_count", v)}
                disabled={readOnly}
                error={errors.mac_bind_count}
                hint="0 to 16. 0: no automatic binding."
              />
              <TextField
                label="Devices online at once"
                value={form.max_simultaneous}
                onChange={(v) => set("max_simultaneous", v)}
                disabled={readOnly}
                error={errors.max_simultaneous}
                hint="Empty: no limit."
              />
            </div>
            <Check
              label="Only bound devices may connect (MAC restriction)"
              checked={form.mac_restriction}
              onChange={(v) => set("mac_restriction", v)}
              disabled={readOnly}
            />
            <Check
              label="Only the subscriber's static IP may connect (IP restriction)"
              checked={form.ip_restriction}
              onChange={(v) => set("ip_restriction", v)}
              disabled={readOnly}
            />
          </Section>

          <Section title="Timeouts">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Idle timeout (minutes)"
                value={form.idle_timeout_min}
                onChange={(v) => set("idle_timeout_min", v)}
                disabled={readOnly}
                error={errors.idle_timeout_min}
                hint="Empty: none."
              />
              <TextField
                label="Session time limit (hours)"
                value={form.hard_timeout_h}
                onChange={(v) => set("hard_timeout_h", v)}
                disabled={readOnly}
                error={errors.hard_timeout_h}
                hint="Empty: none."
              />
            </div>
          </Section>
          <FormError message={error} />
        </div>
      )}
    </MDrawer>
  );
}
