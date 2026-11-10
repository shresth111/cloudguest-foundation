/**
 * RAKESH-P1: the ISP "New plan" form (template first). Pure functions, no
 * React: tested by scripts/test-isp-partner-p1.mjs.
 *
 * A plan is a speed template + validity + price, and is either Unlimited (no
 * FUP) or FUP (limit, reset daily/monthly/each cycle, a slower template after
 * the limit). The device rules come from the picked template when it has
 * any, and can be changed for this plan.
 */
import type { PackagePolicyBody, FupReset } from "@/services/isp-partner/network-types";
import type { PackageBody, PackageType } from "@/services/isp-partner/plans-types";
import type { TemplateDeviceRules, TemplateDeviceRulesBody } from "@/services/isp-partner/p1";
import { formToPolicyBody, policyToForm, type PolicyForm } from "@/lib/isp-partner/network";
import { formatMbAsGb } from "@/lib/isp-partner/data-units";
import { parseRupeesToPaise } from "@/lib/isp-partner/money";

export type PlanKind = "unlimited" | "fup";

export interface PlanForm {
  groupId: string;
  kind: PlanKind;
  type: PackageType;
  validity: string;
  firstLogin: boolean;
  price: string;
  gstIncl: boolean;
  /** devices per login / coupon (package max_devices) */
  devices: string;
  name: string;
  /** network rules; the FUP fields are used only for kind = "fup" */
  rules: PolicyForm;
}

export function emptyPlanForm(validityDays: number): PlanForm {
  return {
    groupId: "",
    kind: "unlimited",
    type: "prepaid",
    validity: String(validityDays),
    firstLogin: false,
    price: "",
    gstIncl: true,
    devices: "1",
    name: "",
    rules: { ...policyToForm(null), fup_reset: "month" },
  };
}

/** Copy a template's device rules into the plan form. */
export function withTemplateRules(f: PlanForm, r: TemplateDeviceRules | undefined): PlanForm {
  if (!r || !r.configured) return f;
  return {
    ...f,
    devices: String(r.max_devices),
    rules: {
      ...f.rules,
      mac_bind_count: String(r.mac_bind_count),
      mac_restriction: r.mac_restriction,
      max_simultaneous: r.max_simultaneous === null ? "" : String(r.max_simultaneous),
    },
  };
}

/** True when the plan's device fields still equal the template's rules. */
export function matchesTemplateRules(f: PlanForm, r: TemplateDeviceRules | undefined): boolean {
  if (!r || !r.configured) return false;
  return (
    f.devices.trim() === String(r.max_devices) &&
    f.rules.mac_bind_count.trim() === String(r.mac_bind_count) &&
    f.rules.mac_restriction === r.mac_restriction &&
    f.rules.max_simultaneous.trim() ===
      (r.max_simultaneous === null ? "" : String(r.max_simultaneous))
  );
}

export type PlanErrors = Partial<Record<string, string>>;

export type PlanResult =
  | { ok: true; pkg: PackageBody; policy: PackagePolicyBody }
  | { ok: false; errors: PlanErrors };

/** Validate; on success, the package body and the full policy body. */
export function planToBodies(f: PlanForm, opts: { gb: boolean }): PlanResult {
  const errors: PlanErrors = {};
  const v = Number(f.validity);
  const p = parseRupeesToPaise(f.price || "0");
  const d = Number(f.devices);
  if (!f.groupId) errors.groupId = "Pick a speed template.";
  if (!Number.isInteger(v) || v < 1 || v > 3650) errors.validity = "1 to 3650 days.";
  if (p === null) errors.price = "A rupee amount, like 499.";
  if (!Number.isInteger(d) || d < 1 || d > 50) errors.devices = "1 to 50.";

  const rules: PolicyForm = {
    ...f.rules,
    validity_starts: f.firstLogin ? "first_login" : "activation",
  };
  if (f.kind === "unlimited") {
    rules.fup_limit_mb = "";
    rules.fup_fallback_speed_group_id = "";
    rules.fup_exclude_upload = false;
    rules.fup_carry_forward = false;
  } else {
    if (!rules.fup_limit_mb.trim()) errors.fup_limit_mb = "Enter the FUP limit.";
    if (!rules.fup_fallback_speed_group_id)
      errors.fup_fallback_speed_group_id = "Pick the speed after the limit.";
    else if (rules.fup_fallback_speed_group_id === f.groupId)
      errors.fup_fallback_speed_group_id = "Pick a slower template than the plan's own.";
  }
  const sim = Number(rules.max_simultaneous);
  if (rules.max_simultaneous.trim() && Number.isInteger(sim) && Number.isInteger(d) && sim > d)
    errors.max_simultaneous = "Cannot be more than the device limit.";

  const res = formToPolicyBody(rules, { gb: opts.gb });
  if (!res.ok) Object.assign(errors, res.errors);
  if (Object.keys(errors).length || !res.ok || p === null) return { ok: false, errors };
  return {
    ok: true,
    pkg: {
      speed_group_id: f.groupId,
      type: f.type,
      validity_days: v,
      price_paise: p,
      price_includes_gst: f.gstIncl,
      // the hotspot voucher data cap stays empty: the FUP slows down, never cuts off
      data_cap_mb: null,
      max_devices: d,
      name: f.name.trim() || null,
    },
    policy: res.body,
  };
}

const RESET_WORD: Record<FupReset, string> = {
  day: "day",
  month: "month",
  cycle: "billing cycle",
};

/** "Unlimited" or "FUP 100 GB a month, then 2 Mbps". */
export function planKindSummary(
  policy: Pick<PackagePolicyBody, "fup_limit_mb" | "fup_reset"> | null | undefined,
  fallbackName?: string | null,
): string {
  if (!policy?.fup_limit_mb) return "Unlimited";
  const then = fallbackName ? `, then ${fallbackName}` : "";
  return `FUP ${formatMbAsGb(policy.fup_limit_mb)} a ${RESET_WORD[policy.fup_reset] ?? "cycle"}${then}`;
}

/** "30 days" / "30 days · from first login". */
export function validitySummary(days: number, firstLogin: boolean): string {
  const base = `${days} day${days === 1 ? "" : "s"}`;
  return firstLogin ? `${base} · from first login` : base;
}

/** Device rules in words, e.g. "3 devices · first 2 bound · bound only · 2 online". */
export function deviceRulesSummary(r: TemplateDeviceRulesBody): string {
  const parts = [`${r.max_devices} device${r.max_devices === 1 ? "" : "s"}`];
  if (r.mac_bind_count > 0) parts.push(`first ${r.mac_bind_count} bound`);
  if (r.mac_restriction) parts.push("bound devices only");
  if (r.max_simultaneous !== null) parts.push(`${r.max_simultaneous} online at once`);
  return parts.join(" · ");
}

export type RulesFormResult =
  | { ok: true; body: TemplateDeviceRulesBody }
  | { ok: false; errors: PlanErrors };

/** The template device-rules dialog's validation (same bounds as the BE). */
export function rulesFormToBody(f: {
  max_devices: string;
  mac_bind_count: string;
  mac_restriction: boolean;
  max_simultaneous: string;
}): RulesFormResult {
  const errors: PlanErrors = {};
  const d = Number(f.max_devices);
  const b = Number(f.mac_bind_count || "0");
  const s = f.max_simultaneous.trim() ? Number(f.max_simultaneous) : null;
  if (!Number.isInteger(d) || d < 1 || d > 50) errors.max_devices = "1 to 50.";
  if (!Number.isInteger(b) || b < 0 || b > 16) errors.mac_bind_count = "0 to 16.";
  if (s !== null && (!Number.isInteger(s) || s < 1 || s > 64))
    errors.max_simultaneous = "1 to 64, or empty for no limit.";
  if (f.mac_restriction && b === 0)
    errors.mac_bind_count = "Bound devices only needs at least 1 bound device.";
  if (s !== null && Number.isInteger(d) && s > d)
    errors.max_simultaneous = "Cannot be more than the device limit.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    body: {
      max_devices: d,
      mac_bind_count: b,
      mac_restriction: f.mac_restriction,
      max_simultaneous: s,
    },
  };
}
