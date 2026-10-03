/**
 * Aruba Instant On: the guest portal's half of "the AP is the NAS".
 *
 * Instant On is managed only from Aruba's own cloud, and this platform has no
 * API to it (see ~/wyfy-ops/aruba-ap21/DESIGN.md §2). So, unlike Omada, our
 * backend cannot open the gate for a guest: the access point sits on the
 * guest's LAN and is unreachable from our servers. What does work is the
 * MikroTik `link-login-only` shape with Aruba's field names -- after OTP the
 * guest's own BROWSER form-POSTs the verified identifier to the AP's login
 * URL, the AP turns it into a RADIUS Access-Request to our hub, and the hub
 * answers from the unchanged `/radius/authorize` session lookup.
 *
 * This module is the single place that knows the Aruba wire names. It is
 * pure (no React, no DOM) so `scripts/test-portal-aruba.mjs` can bundle and
 * exercise it directly.
 *
 * ## What is measured and what is not (2026-10-02)
 *
 * NOT YET MEASURED ON HARDWARE. The redirect parameters and the login POST
 * below are Aruba Instant (IAP) documentation and third-party field reports
 * (RECON.md §3); Instant On runs IAP code, so they are expected to match.
 * Each assumption is one constant here, so the hardware test changes one
 * line, not a flow:
 *
 *   - redirect params:  ARUBA_REDIRECT_KEYS
 *   - login path:       ARUBA_LOGIN_PATH
 *   - login fields:     buildArubaLoginFields
 *   - trusted hosts:    isTrustedArubaLoginHost
 *   - `?` vs `&` join:  splitSwallowedQuery
 *
 * ## The one safety rule
 *
 * `switchip` comes off a query string anyone can type. POSTing a guest's
 * verified phone number or email to whatever host it names would hand that
 * identifier (which, on this contract, IS the RADIUS credential) to an
 * arbitrary server. So the target host is allowlisted to the names Aruba's
 * own firmware answers on, and anything else is REFUSED -- the guest sees a
 * real failure screen, never a spinner and never a POST to an unknown host.
 */

/** The value the backend stamps into the portal URL for this vendor
 * (`build_external_portal_url(provider=router.vendor)`), and the
 * `routers.vendor` value. One vocabulary. */
export const ARUBA_INSTANT_ON_PROVIDER = "aruba_instant_on" as const;

/**
 * The parameters Aruba Instant appends when it 302s an unauthenticated guest
 * to the external portal (IAP documentation; RECON.md §3 item 2):
 *
 *   cmd=login&mac=<client mac>&essid=<ssid>&ip=<client ip>&apname=<ap name>
 *   &apmac=<ap mac>&vcname=<virtual controller>&switchip=<captive host>
 *   &url=<original url>
 *
 * `mac` and `ip` are NOT re-declared here: the portal search schema already
 * carries them (RouterOS's `$(mac)`/`$(ip)`), and on Aruba they mean the same
 * thing -- the client's MAC and LAN address -- so they flow through the
 * existing `deviceMac`/`deviceIp` path unchanged.
 */
export const ARUBA_REDIRECT_KEYS = [
  "cmd",
  "essid",
  "apname",
  "apmac",
  "vcname",
  "switchip",
  "url",
] as const;

export type ArubaRedirectKey = (typeof ARUBA_REDIRECT_KEYS)[number];

/** Aruba's own redirect, captured verbatim. Values may arrive as numbers
 * (TanStack's search parser JSON.parses every raw value -- an SSID spelled
 * "5" becomes the number 5), which `arubaText` renders back to text. */
export type ArubaPortalRedirect = Partial<Record<ArubaRedirectKey, string | number>> & {
  /** Our own switch, not Aruba's -- see `parseArubaLoginVariant`. */
  arubaLogin?: string | number;
};

/**
 * Where the guest's browser submits the login: `POST https://<host>/swarm.cgi`
 * with `cmd=authenticate&user&password&url` -- the Aruba Instant external
 * portal form (flomain.de, "Aruba Instant with External Captive Portal").
 * Instant On 3.4.2 redirects with `post=captive-2022.aio.cloudauth.net`
 * (measured 2026-10-03); the AP intercepts that name and turns the POST into
 * a RADIUS Access-Request. `/cgi-bin/login` also reaches RADIUS on the AP21
 * (staging log 2026-10-03) and stays selectable via `arubaLogin=cgi`.
 */
// Default path. Both this and /cgi-bin/login made the AP21 send an Access-Request
// (staging RADIUS log, 2026-10-03); switch per test with `arubaLogin`.
export const ARUBA_LOGIN_PATH = "/swarm.cgi" as const;

/**
 * WHICH LOGIN CONTRACT, SWITCHABLE PER TEST WITHOUT A REDEPLOY.
 *
 * The AP login contract has three unmeasured axes (path, method, the verb
 * field), so the portal URL configured in Instant On may carry
 * `&arubaLogin=<tokens>` to pick one, e.g. `cgi-post`, `cgi-get`,
 * `swarm-post-opcode`. Tokens (any order, `-`, `.` or `,` separated):
 *
 *   path:   `swarm` -> /swarm.cgi (default) | `cgi` -> /cgi-bin/login
 *   method: `post` (default) | `get`
 *   verb:   `cmd` -> cmd=authenticate (default) | `opcode` -> opcode=cp_auth
 *
 * A closed set: any unknown token, or two tokens on the same axis, discards
 * the WHOLE value and the default applies -- a typo can never produce a
 * half-applied contract. The variant only picks among these fixed paths; the
 * HOST still comes from `arubaLoginTarget`'s allowlist, so this cannot widen
 * where a guest identifier is sent.
 *
 * Measured 2026-10-03 (staging FreeRADIUS log): BOTH `cgi-post` and
 * `swarm-post` made the AP21 send an Access-Request. The earlier "login
 * error" was the RADIUS server dropping an unknown client IP, not the path.
 */
export type ArubaLoginVariant = {
  path: "/cgi-bin/login" | "/swarm.cgi";
  method: "POST" | "GET";
  fields: "cmd" | "opcode";
};

export const DEFAULT_ARUBA_LOGIN_VARIANT: ArubaLoginVariant = {
  path: ARUBA_LOGIN_PATH,
  method: "POST",
  fields: "cmd",
};

const VARIANT_TOKENS: Record<string, Partial<ArubaLoginVariant>> = {
  cgi: { path: "/cgi-bin/login" },
  swarm: { path: "/swarm.cgi" },
  post: { method: "POST" },
  get: { method: "GET" },
  cmd: { fields: "cmd" },
  opcode: { fields: "opcode" },
};

export function parseArubaLoginVariant(raw: string | number | null | undefined): ArubaLoginVariant {
  const text = arubaText(raw);
  if (!text) return DEFAULT_ARUBA_LOGIN_VARIANT;
  const out: Partial<ArubaLoginVariant> = {};
  for (const token of text
    .toLowerCase()
    .split(/[-.,\s]+/)
    .filter(Boolean)) {
    const patch = VARIANT_TOKENS[token];
    if (!patch) return DEFAULT_ARUBA_LOGIN_VARIANT;
    for (const [k, v] of Object.entries(patch)) {
      const key = k as keyof ArubaLoginVariant;
      if (out[key] !== undefined && out[key] !== v) return DEFAULT_ARUBA_LOGIN_VARIANT;
      (out as Record<string, string>)[key] = v;
    }
  }
  return { ...DEFAULT_ARUBA_LOGIN_VARIANT, ...out };
}

/** A GET login: the same fields as a query string on the allowlisted URL. */
export function arubaLoginGetUrl(url: string, fields: Array<[string, string]>): string {
  return `${url}?${new URLSearchParams(fields).toString()}`;
}

/**
 * The hosts the AP's own captive-portal virtual host answers on. The name is
 * the AP's factory certificate CN, so the browser can only POST to it over
 * HTTPS without a certificate error if we use exactly that name -- which is
 * why it comes from the redirect's `switchip` and is never hardcoded.
 *
 *  - `securelogin.arubanetworks.com`: Aruba Instant / older Instant On.
 *  - `captiveportal-login.arubainstanton.com`: Instant On (DESIGN.md §3).
 *  - `captive-YYYY.aio.cloudauth.net`: current Instant On generations,
 *    captured in the field 2026-09-24 as `captive-2022.aio.cloudauth.net`
 *    (RECON.md §3 item 1). The year changes by firmware generation.
 *
 * Deliberately NOT accepted: an IP literal. An IAP can be configured to
 * report its virtual-controller IP here; we refuse it until that is seen on
 * real Instant On hardware, because a private address cannot carry a valid
 * certificate and a public one is anybody's server.
 */
const TRUSTED_ARUBA_LOGIN_HOSTS: ReadonlySet<string> = new Set([
  "securelogin.arubanetworks.com",
  "captiveportal-login.arubainstanton.com",
]);
const TRUSTED_ARUBA_LOGIN_HOST_PATTERNS: readonly RegExp[] = [
  /^captive-\d{4}\.aio\.cloudauth\.net$/,
];

export function isTrustedArubaLoginHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  return (
    TRUSTED_ARUBA_LOGIN_HOSTS.has(h) || TRUSTED_ARUBA_LOGIN_HOST_PATTERNS.some((re) => re.test(h))
  );
}

/** Render a captured value as text, or `undefined` for absent/blank. */
export function arubaText(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = typeof value === "number" ? String(value) : value;
  const trimmed = s.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * THE `?` vs `&` QUESTION, and the narrow way it is handled.
 *
 * The portal URL the operator pastes already has a query string
 * (`/portal?organizationId=..&routerId=..&netProvider=aruba_instant_on`).
 * Omada joins its parameters with `&` (measured 2026-09-11). Whether Instant
 * On does is unmeasured; if it joins with a second `?`, the first appended
 * parameter is swallowed into the value of our LAST parameter, which the
 * backend always writes as `netProvider`:
 *
 *   ...&netProvider=aruba_instant_on?cmd=login&mac=..&switchip=..
 *      -> netProvider = "aruba_instant_on?cmd=login"
 *
 * Every later parameter still parses normally (they are `&`-separated), so
 * the only thing to recover is that one swallowed `key=value`. This splits
 * it back out. It touches only a value that contains a `?`, which no
 * MikroTik or Omada `netProvider` ever does, so those paths are unchanged.
 */
export function splitSwallowedQuery(value: string | undefined): {
  value: string | undefined;
  recovered: Record<string, string>;
} {
  if (!value) return { value, recovered: {} };
  const at = value.indexOf("?");
  if (at < 0) return { value, recovered: {} };
  const head = value.slice(0, at);
  const recovered: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(value.slice(at + 1))) {
    if (k && !(k in recovered)) recovered[k] = v;
  }
  return { value: head || undefined, recovered };
}

/**
 * The redirect as this page will use it: the parsed search params first, and
 * a parameter swallowed by a second `?` (see `splitSwallowedQuery`) only as a
 * gap-filler. The parsed value always wins.
 */
export function captureArubaRedirect(
  search: Partial<Record<string, unknown>>,
  recovered: Record<string, string> = {},
): ArubaPortalRedirect {
  const out: ArubaPortalRedirect = {};
  for (const key of ARUBA_REDIRECT_KEYS) {
    const raw = search[key];
    if (typeof raw === "string" || typeof raw === "number") {
      out[key] = raw;
    } else if (recovered[key] !== undefined) {
      out[key] = recovered[key];
    }
  }
  // Instant On 3.4.2 sends the AP login host as `post`, never `switchip`
  // (measured 2026-10-03). Same allowlist applies downstream
  // (`arubaLoginTarget`), so this only renames, never trusts.
  if (out.switchip === undefined) {
    const post = search.post ?? recovered.post;
    if (typeof post === "string" || typeof post === "number") out.switchip = post;
  }
  const variant = search.arubaLogin ?? recovered.arubaLogin;
  if (typeof variant === "string" || typeof variant === "number") out.arubaLogin = variant;
  return out;
}

export type ArubaLoginRefusal =
  /** The redirect carried no `switchip`: nowhere to submit. A bookmark or a
   * QR code into the portal, or a firmware that stopped sending it. */
  | "no-switchip"
  /** `switchip` names a host Aruba's firmware does not answer on. */
  | "untrusted-host";

/**
 * The URL the guest's browser POSTs to, or a refusal. Accepts `switchip` as
 * the bare host IAP documents, and tolerates an `https://host/...` spelling
 * by taking only its hostname -- the path and scheme are always ours.
 */
export function arubaLoginTarget(
  switchip: string | number | null | undefined,
  variant: ArubaLoginVariant = DEFAULT_ARUBA_LOGIN_VARIANT,
): { url: string } | { refused: ArubaLoginRefusal } {
  const raw = arubaText(switchip);
  if (!raw) return { refused: "no-switchip" };
  let host = raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      host = new URL(raw).hostname;
    } catch {
      return { refused: "untrusted-host" };
    }
  }
  // A bare host only: no port, path, credentials or whitespace smuggled in.
  if (!/^[A-Za-z0-9.-]+$/.test(host)) return { refused: "untrusted-host" };
  if (!isTrustedArubaLoginHost(host)) return { refused: "untrusted-host" };
  return { url: `https://${host.toLowerCase().replace(/\.$/, "")}${variant.path}` };
}

/**
 * The form fields of the login POST (IAP documentation): `cmd=authenticate`,
 * `user`, `password`, and `url` -- where the AP sends the browser once it has
 * authorized the client, the same job RouterOS's `dst` does.
 *
 * `user` is the guest's verified identifier, which our FreeRADIUS looks up
 * as `User-Name`. `password` is not checked by `/radius/authorize` (it is a
 * session lookup); the caller passes the same fixed value the MikroTik POST
 * sends, because PAP requires one to be present.
 */
export function buildArubaLoginFields(
  input: {
    identifier: string;
    password: string;
    destination: string;
  },
  variant: ArubaLoginVariant = DEFAULT_ARUBA_LOGIN_VARIANT,
): Array<[string, string]> {
  return [
    variant.fields === "opcode" ? ["opcode", "cp_auth"] : ["cmd", "authenticate"],
    ["user", input.identifier],
    ["password", input.password],
    ["url", input.destination],
  ];
}

/** Is this the Aruba Instant On contract? Read from the stored provider the
 * backend stamped into the URL -- never inferred from which Aruba-shaped
 * parameters happen to be present. */
export function isArubaInstantOnProvider(netProvider: string | null | undefined): boolean {
  return netProvider === ARUBA_INSTANT_ON_PROVIDER;
}
