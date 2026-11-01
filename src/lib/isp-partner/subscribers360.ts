/** Pure helpers for the Subscriber 360 / directory screens (ADDENDUM_05
 * JAZE-1). No React, no API: `scripts/test-isp-partner-sub360.mjs` runs them. */
import type { DisplayState } from "@/services/isp-partner/subscribers360-types";

export const STATE_LABEL: Record<DisplayState, string> = {
  active: "Active",
  grace: "In grace",
  expired: "Expired",
  blocked: "Blocked",
  permanently_blocked: "Permanently blocked",
  frozen: "Frozen",
  suspended: "Customer suspended",
  scheduled: "Scheduled",
  disabled: "Disabled",
};

/** MTag tone keys (MasterKit TAG_STYLES). */
export function stateTone(state: string): string {
  switch (state) {
    case "active":
      return "active";
    case "grace":
    case "scheduled":
    case "frozen":
      return "pending";
    case "blocked":
    case "permanently_blocked":
    case "suspended":
      return "suspended";
    default:
      return "normal";
  }
}

export function stateLabel(state: string): string {
  return (STATE_LABEL as Record<string, string>)[state] ?? state;
}

const EVENT_LABEL: Record<string, string> = {
  created: "Created",
  profile_updated: "Profile updated",
  renewed: "Renewed",
  reverted: "Renewal reverted",
  grace: "Grace given",
  blocked: "Blocked",
  unblocked: "Unblocked",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  disconnected: "Disconnected",
  moved: "Moved",
  note: "Note",
  ticket: "Ticket",
  plan_sync: "Plan change applied",
  activated: "Activated",
};

export function eventLabel(kind: string): string {
  return EVENT_LABEL[kind] ?? kind.replace(/_/g, " ");
}

/** "1,234.50" / "1234.5" / "₹ 400" -> paise; null when blank or invalid. */
export function rupeesToPaise(input: string): number | null {
  const t = input.replace(/[₹,\s]/g, "");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [r, p = ""] = t.split(".");
  return Number(r) * 100 + Number((p + "00").slice(0, 2));
}

export function paiseToRupeesInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return p ? `${r}.${String(p).padStart(2, "0")}` : String(r);
}

/** Which header actions make sense in each state (the API re-checks). */
export function allowedActions(state: string, canRevert: boolean) {
  const held = state === "blocked" || state === "permanently_blocked" || state === "frozen";
  return {
    renew: !held,
    revert: canRevert && !held,
    grace: !held && state !== "grace",
    block: state !== "permanently_blocked",
    unblock: state === "blocked" || state === "permanently_blocked",
    freeze: state === "active" || state === "grace",
    unfreeze: state === "frozen",
    disconnect: true,
    move: true,
  };
}

export function idempotencyKey(): string {
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `s360-${r.slice(0, 24)}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** API ISO timestamp (UTC) -> `<input type="datetime-local">` value in the
 * browser's zone. Slicing the ISO string would show UTC wall-clock and shift
 * the time by the zone offset on every save. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

/** API ISO timestamp -> `<input type="date">` value (local calendar day). */
export function isoToLocalDate(iso: string | null | undefined): string {
  return isoToLocalInput(iso).slice(0, 10);
}

/** Lat/long text inputs -> numbers (or null), range-checked. */
export function parseCoord(v: string, kind: "lat" | "lon"): number | null | "invalid" {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return "invalid";
  const lim = kind === "lat" ? 90 : 180;
  return Math.abs(n) <= lim ? n : "invalid";
}

/** ProfileFields draft (all strings) -> API body. Returns an error string
 * instead when a field is invalid, so the form can say which. */
export function draftToProfile(
  d: Record<string, string | boolean>,
): { body: Record<string, unknown> } | { error: string } {
  const str = (k: string) => {
    const v = String(d[k] ?? "").trim();
    return v === "" ? null : v;
  };
  const pin = (k: string, label: string) => {
    const v = str(k);
    if (v !== null && !/^[1-9][0-9]{5}$/.test(v)) throw new Error(`${label} is 6 digits.`);
    return v;
  };
  try {
    const lat = parseCoord(String(d.latitude ?? ""), "lat");
    const lon = parseCoord(String(d.longitude ?? ""), "lon");
    if (lat === "invalid") throw new Error("Latitude must be between -90 and 90.");
    if (lon === "invalid") throw new Error("Longitude must be between -180 and 180.");
    const priceText = String(d.override_price ?? "").trim();
    const price = priceText ? rupeesToPaise(priceText) : null;
    if (priceText && (price === null || price <= 0))
      throw new Error("Override price must be a rupee amount, e.g. 499 or 499.50.");
    const dayText = String(d.billing_anchor_day ?? "").trim();
    const day = dayText ? Number(dayText) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 28))
      throw new Error("Billing day must be 1 to 28.");
    const email = str("alt_email");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new Error("The alternate email looks wrong.");
    const same = d.install_same_as_billing !== false;
    const activation = str("activation_at");
    const installed = str("installed_at");
    return {
      body: {
        alt_email: email,
        gender: str("gender"),
        billing_city: str("billing_city"),
        billing_pincode: pin("billing_pincode", "Billing PIN code"),
        install_same_as_billing: same,
        install_address: same ? null : str("install_address"),
        install_area: same ? null : str("install_area"),
        install_building: same ? null : str("install_building"),
        install_city: same ? null : str("install_city"),
        install_pincode: same ? null : pin("install_pincode", "Installation PIN code"),
        latitude: lat,
        longitude: lon,
        installed_at: installed ? new Date(`${installed}T12:00:00`).toISOString() : null,
        user_type: str("user_type") ?? "home",
        connection_type: str("connection_type"),
        ont_serial: str("ont_serial"),
        stb_serial: str("stb_serial"),
        override_price_paise: price,
        billing_anchor_day: day,
        after_due_action: str("after_due_action") ?? "suspend",
        exclude_reminders: d.exclude_reminders === true,
        activation_at: activation ? new Date(activation).toISOString() : null,
        comments: str("comments"),
      },
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
