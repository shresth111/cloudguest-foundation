/**
 * Speed tiers by WiFi network (SSID) at Aruba Instant On venues -- the pure
 * half (types, wire mapping, copy, and the portal's decision). Pure so
 * `scripts/test-aruba-ssid-tiers.mjs` can bundle and exercise it.
 *
 * WHY: Instant On has no per-guest speed on any path Wyfy can reach. It has
 * ONE per-client cap per WiFi network. So a venue that sells faster WiFi runs
 * two guest networks (e.g. WYFY_FREE at 5 Mbps, WYFY_PREMIUM at 50 Mbps), and
 * Wyfy decides who may join which: the RADIUS hub refuses a guest without a
 * voucher pass / Access Tier on the paid network (backend
 * `app/domains/guest/ssid_tiers.py`), and the portal says why before the AP
 * ever gets the chance to show its generic "Login error".
 */

/** The one sentence every surface repeats. Never promise per-guest speed. */
export const ONE_SPEED_PER_NETWORK =
  "Each WiFi network has one speed for all its guests. Aruba Instant On can't give one " +
  "guest a different speed from another on the same network.";

export const SSID_TIERS_TITLE = "Speed tiers by WiFi network";

export const SSID_TIERS_INTRO =
  "Run a free and a paid guest network side by side. Guests with a voucher (or mapped " +
  "into the network's Access Tier) can join the paid network; everyone else stays on " +
  "the free one.";

/** Shown under a row whose network is paid-only. */
export const PAID_ROW_HINT =
  "Guests without a voucher or this Access Tier are turned away from this network and " +
  "shown how to get a voucher.";

export const MAX_SSID_LENGTH = 32;
export const MIN_TIER_MBPS = 1;
export const MAX_TIER_MBPS = 1000;
export const MAX_SSID_TIERS = 8;

export interface SsidTier {
  ssid: string;
  tierName: string;
  /** false = every signed-in guest may join (the free network). */
  paidOnly: boolean;
  /** Access Tier (BANDWIDTH policy) whose mapped guests may join. */
  policyId: string | null;
  /** Voucher plans that unlock it; empty = any voucher. */
  voucherPlanIds: string[];
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export interface SsidTiersView {
  items: SsidTier[];
  note: string;
  manualSteps: string[];
  pushEnabled: boolean;
}

type Raw = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function toSsidTier(raw: Raw): SsidTier {
  return {
    ssid: String(raw.ssid ?? ""),
    tierName: String(raw.tier_name ?? ""),
    paidOnly: raw.requires_entitlement === true,
    policyId: str(raw.policy_id),
    voucherPlanIds: Array.isArray(raw.voucher_plan_ids)
      ? raw.voucher_plan_ids.filter((x): x is string => typeof x === "string")
      : [],
    downloadMbps: num(raw.download_mbps),
    uploadMbps: num(raw.upload_mbps),
  };
}

export function toSsidTiersView(raw: unknown): SsidTiersView {
  const r = (raw && typeof raw === "object" ? raw : {}) as Raw;
  return {
    items: Array.isArray(r.items) ? (r.items as Raw[]).map(toSsidTier) : [],
    note: typeof r.note === "string" ? r.note : ONE_SPEED_PER_NETWORK,
    manualSteps: Array.isArray(r.instant_on_manual_steps)
      ? r.instant_on_manual_steps.filter((x): x is string => typeof x === "string")
      : [],
    pushEnabled: r.instant_on_push_enabled === true,
  };
}

/** The PUT body. An open network never carries a tier or plans (the backend
 * refuses the contradiction), so they are dropped here rather than sent. */
export function toSsidTiersBody(items: SsidTier[]): { items: Raw[] } {
  return {
    items: items.map((t) => ({
      ssid: t.ssid.trim(),
      tier_name: t.tierName.trim(),
      requires_entitlement: t.paidOnly,
      policy_id: t.paidOnly ? t.policyId : null,
      voucher_plan_ids: t.paidOnly ? t.voucherPlanIds : [],
      download_mbps: t.downloadMbps,
      upload_mbps: t.uploadMbps,
    })),
  };
}

/** First problem with the draft, in words, or null. Mirrors the backend. */
export function ssidTiersProblem(items: SsidTier[]): string | null {
  if (items.length > MAX_SSID_TIERS) return `At most ${MAX_SSID_TIERS} WiFi networks.`;
  const seen = new Set<string>();
  for (const t of items) {
    const ssid = t.ssid.trim();
    if (!ssid) return "Each row needs a WiFi network name.";
    if (ssid.length > MAX_SSID_LENGTH)
      return `WiFi network names are at most ${MAX_SSID_LENGTH} characters.`;
    const key = ssid.toLowerCase();
    if (seen.has(key)) return `The WiFi network “${ssid}” is listed twice.`;
    seen.add(key);
    if (!t.tierName.trim()) return `Give the tier for “${ssid}” a name.`;
    for (const [label, v] of [
      ["Download", t.downloadMbps],
      ["Upload", t.uploadMbps],
    ] as const) {
      if (v === null) continue;
      if (!Number.isInteger(v) || v < MIN_TIER_MBPS || v > MAX_TIER_MBPS)
        return `${label} speed must be a whole number from ${MIN_TIER_MBPS} to ${MAX_TIER_MBPS} Mbps.`;
    }
  }
  return null;
}

/** "5 Mbps down / 2 Mbps up", "No speed cap", or one side only. */
export function formatTierSpeed(down: number | null, up: number | null): string {
  if (down === null && up === null) return "No speed cap";
  const parts: string[] = [];
  if (down !== null) parts.push(`${down} Mbps down`);
  if (up !== null) parts.push(`${up} Mbps up`);
  return parts.join(" / ");
}

export function emptySsidTier(): SsidTier {
  return {
    ssid: "",
    tierName: "",
    paidOnly: false,
    policyId: null,
    voucherPlanIds: [],
    downloadMbps: null,
    uploadMbps: null,
  };
}

// ---------------------------------------------------------------------------
// The guest portal
// ---------------------------------------------------------------------------

export interface PortalNetwork {
  ssid: string;
  tierName: string;
  downloadMbps: number | null;
}

export interface GuestSsidAccess {
  ssid: string | null;
  mapped: boolean;
  paidOnly: boolean;
  entitled: boolean;
  tierName: string | null;
  downloadMbps: number | null;
  upgradeNetworks: PortalNetwork[];
  paidNetworks: PortalNetwork[];
}

const toPortalNetwork = (raw: Raw): PortalNetwork => ({
  ssid: String(raw.ssid ?? ""),
  tierName: String(raw.tier_name ?? ""),
  downloadMbps: num(raw.download_mbps),
});

export function toGuestSsidAccess(raw: unknown): GuestSsidAccess | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  return {
    ssid: str(r.ssid),
    mapped: r.mapped === true,
    paidOnly: r.requires_entitlement === true,
    // Fail open on a malformed answer: the RADIUS hub still decides.
    entitled: r.entitled !== false,
    tierName: str(r.tier_name),
    downloadMbps: num(r.download_mbps),
    upgradeNetworks: Array.isArray(r.upgrade_networks)
      ? (r.upgrade_networks as Raw[]).map(toPortalNetwork)
      : [],
    paidNetworks: Array.isArray(r.paid_networks)
      ? (r.paid_networks as Raw[]).map(toPortalNetwork)
      : [],
  };
}

export type PortalSsidVerdict =
  /** Go ahead and POST the login to the AP. */
  | { kind: "proceed"; upgrade: PortalNetwork[] }
  /** Paid network, no pass: show the voucher path instead of the AP's error. */
  | { kind: "needs-pass"; network: PortalNetwork };

/**
 * What the success page does with the answer. `null` (no answer: old backend,
 * network error, unknown session) always proceeds -- the RADIUS hub is the
 * enforcement point, the portal only explains it.
 */
export function portalSsidVerdict(access: GuestSsidAccess | null): PortalSsidVerdict {
  if (!access) return { kind: "proceed", upgrade: [] };
  if (access.mapped && access.paidOnly && !access.entitled) {
    return {
      kind: "needs-pass",
      network: {
        ssid: access.ssid ?? "",
        tierName: access.tierName ?? "",
        downloadMbps: access.downloadMbps,
      },
    };
  }
  return { kind: "proceed", upgrade: access.upgradeNetworks };
}

export function needsPassTitle(network: PortalNetwork): string {
  return `“${network.ssid}” is for ${network.tierName || "paid"} guests`;
}

export function needsPassBody(network: PortalNetwork): string {
  const speed = network.downloadMbps ? ` (up to ${network.downloadMbps} Mbps)` : "";
  return (
    `This WiFi network${speed} needs a voucher. Enter your voucher code to use it, ` +
    "or join the venue's free WiFi network instead."
  );
}

/** The post-purchase hint on the free network. */
export function upgradeHint(networks: PortalNetwork[]): string | null {
  const first = networks[0];
  if (!first) return null;
  const speed = first.downloadMbps ? ` (up to ${first.downloadMbps} Mbps)` : "";
  return `Your voucher includes faster WiFi: join “${first.ssid}”${speed} in your WiFi settings and sign in again with the same number.`;
}
