/**
 * The package "Network rules" field set (ADDENDUM_05 J3), shared by the
 * Network rules drawer and the package create form (PKG-2). Pure fields:
 * the caller owns the form state, validation (`formToPolicyBody`) and save.
 */
import { Plus } from "lucide-react";
import { MSeg, M_INPUT } from "@/components/master/MasterKit";
import { TextField } from "@/components/isp-partner/kit";
import { formatKbps } from "@/lib/isp-partner/plans";
import { boostWindowLabel, clockToMinute, type PolicyForm } from "@/lib/isp-partner/network";
import type { FupReset, ValidityStarts } from "@/services/isp-partner/network-types";

type Group = { id: string; name: string; download_kbps: number; upload_kbps: number };

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
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

export function GroupSelect({
  label,
  value,
  onChange,
  groups,
  error,
  disabled,
  noneLabel = "None",
  onNew,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  groups: Group[];
  error?: string;
  disabled?: boolean;
  noneLabel?: string;
  /** Shows a "New speed template" button next to the select. */
  onNew?: () => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {onNew && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onNew();
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> New speed template
          </button>
        )}
      </span>
      <select
        className={M_INPUT}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      >
        <option value="">{noneLabel}</option>
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

export type PolicyErrors = Partial<Record<keyof PolicyForm, string>>;

export function PolicyFields({
  form,
  set,
  errors,
  groups,
  readOnly = false,
  onNewGroup,
}: {
  form: PolicyForm;
  set: <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) => void;
  errors: PolicyErrors;
  groups: Group[];
  readOnly?: boolean;
  /** Opens "New speed template"; the callback receives which select asked. */
  onNewGroup?: (field: "fup_fallback_speed_group_id" | "boost_speed_group_id") => void;
}) {
  return (
    <>
      <PolicySection title="Fair usage (FUP)">
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
          groups={groups}
          disabled={readOnly}
          error={errors.fup_fallback_speed_group_id}
          onNew={onNewGroup ? () => onNewGroup("fup_fallback_speed_group_id") : undefined}
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
      </PolicySection>

      <PolicySection title="Night boost">
        <GroupSelect
          label="Boost speed"
          value={form.boost_speed_group_id}
          onChange={(v) => set("boost_speed_group_id", v)}
          groups={groups}
          disabled={readOnly}
          error={errors.boost_speed_group_id}
          onNew={onNewGroup ? () => onNewGroup("boost_speed_group_id") : undefined}
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
          Window: {boostWindowLabel(clockToMinute(form.boost_start), clockToMinute(form.boost_end))}
          . Local time of the customer&apos;s venue. A guest over the FUP limit stays on the slower
          speed during the boost.
        </p>
      </PolicySection>

      <PolicySection title="Validity and priority">
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
      </PolicySection>

      <PolicySection title="Devices">
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
      </PolicySection>

      <PolicySection title="Timeouts">
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
      </PolicySection>
    </>
  );
}
