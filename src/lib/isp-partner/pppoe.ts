/** Pure helpers for the PPPoE screens (lane JAZE-6). No React, no API:
 * `scripts/test-isp-partner-pppoe.mjs` runs them. The validators mirror
 * `pppoe_service.py` / `pppoe_script.py` so the form can name the field
 * before the API refuses it; the API stays the authority. */
import type { PppoeCredentialBody, PppoeScriptParams } from "@/services/isp-partner/pppoe-types";

/** `_USERNAME_RE` in pppoe_service.py. */
const USERNAME_RE = /^[A-Za-z0-9._@-]{3,64}$/;
/** `_PASSWORD_BAD` in pppoe_service.py (plus anything outside 0x21-0x7e). */
const PASSWORD_BAD = new Set([" ", "\t", "\r", "\n", '"', "'", "\\", "$", "`"]);
const POOL_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;
const IFACE_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** Roles that may fetch the script (BE `SETUP_SCRIPT_ROLES`). */
export const PPPOE_SCRIPT_ROLES = ["isp-owner", "isp-admin", "isp-technician"] as const;

export function canGetPppoeScript(role: string | null | undefined): boolean {
  return (PPPOE_SCRIPT_ROLES as readonly string[]).includes(role ?? "");
}

export function usernameError(v: string): string | null {
  return USERNAME_RE.test(v.trim())
    ? null
    : "Username: 3-64 characters, letters, digits and . _ @ - only.";
}

export function passwordError(v: string): string | null {
  if (v.length < 8 || v.length > 64) return "Password: 8 to 64 characters.";
  for (const c of v) {
    const code = c.charCodeAt(0);
    if (PASSWORD_BAD.has(c) || code < 33 || code > 126)
      return "Password: printable characters only, no spaces, quotes, \\ $ or `.";
  }
  return null;
}

// --- IPv4 -----------------------------------------------------------------

export function parseIpv4(v: string): number | null {
  const parts = v.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const x = Number(p);
    if (x > 255) return null;
    n = n * 256 + x;
  }
  return n;
}

/** "a.b.c.d/nn" -> [network, broadcast] as numbers, or null. */
export function parseCidr(v: string): [number, number] | null {
  const [ip, bits, extra] = v.trim().split("/");
  if (extra !== undefined || bits === undefined || !/^\d{1,2}$/.test(bits)) return null;
  const n = parseIpv4(ip);
  const b = Number(bits);
  if (n === null || b > 32) return null;
  const size = 2 ** (32 - b);
  const net = Math.floor(n / size) * size;
  return [net, net + size - 1];
}

export function parseRange(v: string): [number, number] | null {
  const [lo, hi, extra] = v.split("-");
  if (extra !== undefined || hi === undefined) return null;
  const a = parseIpv4(lo);
  const b = parseIpv4(hi);
  if (a === null || b === null || b < a) return null;
  return [a, b];
}

/** Very small IPv6 shape check (the API normalises it). */
function looksIpv6(v: string): boolean {
  return /^[0-9a-fA-F:]+$/.test(v) && v.includes(":") && v.length <= 45;
}

export function isIp(v: string): boolean {
  return parseIpv4(v) !== null || looksIpv6(v.trim());
}

// --- credential form ----------------------------------------------------------

export interface CredentialDraft {
  username: string;
  /** "keep" = leave the password; "generate" = new random; "set" = typed. */
  passwordMode: "keep" | "generate" | "set";
  password: string;
  static_ip: string;
  ip_pool_name: string;
}

/** Draft -> PUT body. Only fields that changed against `current` are sent
 * (the API treats an omitted key as "leave it"). On first creation the API
 * defaults the username to the subscriber's login id and generates a
 * password when none is given. */
export function credentialBody(
  d: CredentialDraft,
  current: { username?: string; static_ip?: string | null; ip_pool_name?: string | null } | null,
): { body: PppoeCredentialBody } | { error: string } {
  const body: PppoeCredentialBody = {};
  const username = d.username.trim();
  if (username) {
    const e = usernameError(username);
    if (e) return { error: e };
    if (!current || current.username !== username) body.username = username;
  } else if (current) {
    return { error: "Username is required." };
  }
  if (d.passwordMode === "set") {
    const e = passwordError(d.password);
    if (e) return { error: e };
    body.password = d.password;
  } else if (d.passwordMode === "generate") {
    body.generate_password = true;
  }
  const ip = d.static_ip.trim();
  if (ip && !isIp(ip)) return { error: "Static IP is not an IP address." };
  if ((current?.static_ip ?? "") !== ip) body.static_ip = ip || null;
  const pool = d.ip_pool_name.trim();
  if (pool && !POOL_NAME_RE.test(pool))
    return { error: "IP pool name: letters, digits and . _ - only." };
  if ((current?.ip_pool_name ?? "") !== pool) body.ip_pool_name = pool || null;
  return { body };
}

// --- router script form -------------------------------------------------------

/** Same checks as `PppoeScriptParams.validated()`. Blank fields are dropped
 * (the API fills its defaults), so the checks run against `defaults`. */
export function scriptParams(
  f: Required<PppoeScriptParams>,
  defaults: { interface: string; local_address: string; pool_range: string; pool_cidr: string },
): { params: PppoeScriptParams } | { error: string } {
  const pick = (k: keyof typeof defaults) => f[k].trim() || defaults[k];
  if (!IFACE_RE.test(pick("interface")))
    return { error: "Interface name may use letters, digits, - _ . only." };
  const local = parseIpv4(pick("local_address"));
  if (local === null) return { error: "Local address must be an IPv4 address." };
  const cidr = parseCidr(pick("pool_cidr"));
  if (!cidr) return { error: "Pool network must be IPv4, e.g. 100.64.0.0/22." };
  const range = parseRange(pick("pool_range"));
  if (!range) return { error: "Pool range must be an IPv4 a-b range, low to high." };
  const inside = (n: number) => n >= cidr[0] && n <= cidr[1];
  if (!inside(range[0]) || !inside(range[1]))
    return { error: "The pool range must sit inside the pool network." };
  if (!inside(local)) return { error: "The local address must sit inside the pool network." };
  if (local >= range[0] && local <= range[1])
    return { error: "The local address must not be inside the pool range." };
  const dns = f.dns_servers
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (dns.some((x) => !isIp(x))) return { error: "DNS servers: IP addresses, comma separated." };
  const params: PppoeScriptParams = {};
  for (const k of ["interface", "local_address", "pool_range", "pool_cidr"] as const) {
    const v = f[k].trim();
    if (v) params[k] = v;
  }
  if (dns.length) params.dns_servers = dns.join(",");
  return { params };
}

// --- labels -------------------------------------------------------------------

export const AUTH_RESULT_LABEL: Record<string, string> = {
  accepted: "Accepted",
  feature_off: "Refused: PPPoE is off",
  not_isp_nas: "Refused: router is not one of yours",
  isp_suspended: "Refused: ISP account suspended",
  customer_suspended: "Refused: customer suspended",
  unknown_user: "Refused: unknown username",
  login_disabled: "Refused: login disabled",
  subscriber_disabled: "Refused: subscriber disabled",
  expired: "Refused: validity expired",
  secret_unreadable: "Refused: stored password unreadable, set a new one",
};

export function authResultLabel(r: string | null | undefined): string {
  if (!r) return "Never signed in";
  return AUTH_RESULT_LABEL[r] ?? `Refused: ${r.replace(/_/g, " ")}`;
}

export function authResultTone(r: string | null | undefined): string {
  if (!r) return "normal";
  return r === "accepted" ? "active" : "failed";
}

/** "AABBCCDDEEFF" / "aa-bb-.." -> "AA:BB:CC:DD:EE:FF"; other text unchanged. */
export function formatMac(v: string | null | undefined): string {
  if (!v) return "–";
  const hex = v.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  return hex.length === 12 ? hex.match(/.{2}/g)!.join(":") : v;
}

/** Seconds between two ISO stamps (end defaults to now), or null. */
export function sessionSeconds(
  start: string | null,
  end: string | null,
  now: number = Date.now(),
): number | null {
  if (!start) return null;
  const a = Date.parse(start);
  const b = end ? Date.parse(end) : now;
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 1000));
}

/** Summary of a disconnect / disable call's router-side results. */
export function kickSummary(results: { ended: boolean }[]): string {
  if (results.length === 0) return "No live PPPoE session.";
  const ended = results.filter((r) => r.ended).length;
  const left = results.length - ended;
  return left === 0
    ? `${ended} session${ended === 1 ? "" : "s"} ended.`
    : `${ended} ended, ${left} not confirmed by the router (it ends at the next accounting update or timeout).`;
}
