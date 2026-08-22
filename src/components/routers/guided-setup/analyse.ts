/**
 * Guided Setup -- pasted-output analyser and secret redactor.
 *
 * Pure functions. No React, no app imports, no I/O. Everything here is
 * exercised by `scripts/test-output-analyser.mjs`.
 *
 * =====================================================================
 * WHY THIS FILE EXISTS
 * =====================================================================
 * Until now the flow asked the installer "did it work? Haan / Nahi".
 * That is self-reporting, and every incident in
 * `wyfy-router-provisioning` / `wyfy-radius-captive-portal-incident` is a
 * variation of the same theme: the router printed something that looked
 * fine while it was broken, and a human read it as fine.
 *
 * So this module reads the terminal text instead. Its whole job is to be
 * harder to fool than a tired installer at 11pm in a hotel basement.
 *
 * =====================================================================
 * THE FOUR THINGS THAT MUST NEVER HAPPEN
 * =====================================================================
 * 1. A gateway of `0.0.0.0` scoring PASS.
 *    A default route with `gateway=0.0.0.0` and flag `Is` prints
 *    perfectly normally. `"0.0.0.0" != ""` is why the obvious guard lets
 *    it through, and it ate a live provisioning session on 2026-08-21.
 *    There is a live instance of that same shape in the backend
 *    (`mikrotik_adapter.py::_get_dynamic_default_gateway_sync` ->
 *    `str(gateway) if gateway else None`). `isIpv4` with
 *    `allowUnspecified: false` is the fix, and it is the ONLY way this
 *    module is allowed to accept an address.
 *
 * 2. Absence of an error scoring as evidence.
 *    RouterOS `set [find ...]` against an empty match succeeds and prints
 *    nothing. So does a paste the installer forgot to make. Zero
 *    non-blank lines is INCOMPLETE, never PASS and never FAIL. An empty
 *    result is only trusted when the output carries positive proof that
 *    the command ran and matched nothing -- a `Flags:` legend, a column
 *    header, or the echoed prompt line.
 *
 * 3. The wrong command scoring as the right one.
 *    Every assertion carries a discriminator. See `Identify`.
 *
 * 4. Watching three of the four RADIUS counters.
 *    `/radius monitor 0 once` prints accepts, rejects, timeouts AND
 *    bad-replies. bad-replies means a reply arrived and failed
 *    validation -- it is neither a reject nor a timeout, and it is what
 *    cost 2026-08-18. It is checked FIRST, before the other two.
 *
 * =====================================================================
 * NO BRITTLE STRING MATCHING
 * =====================================================================
 * All of these pairs mean the same thing and any exact-string rule over
 * them will one day say FAIL on a healthy router or PASS on a broken one:
 *
 *   idle-timeout=00:05:00      idle-timeout=5m
 *   login-by=https,http-pap    login-by=http-pap,https
 *   flags " 0 A S "  (v6)      flags "0  As "  (v7)
 *   date=aug/22/2026 (<=7.9)   date=2026-08-22 (>=7.10)
 *   status=bound               status: bound
 *   running=true               running: yes
 *
 * Hence: durations are compared in seconds, comma lists as sets, flags by
 * MEANING resolved against the legend the device itself printed, dates by
 * distance from the APP's clock (the app knows real time; a battery-less
 * hEX does not), booleans by token table.
 */

// =====================================================================
// Public vocabulary
// =====================================================================

/**
 * PASS         -- the evidence positively shows the healthy state.
 * WARNING      -- healthy enough to continue, but something recorded will
 *                 bite later (a portal IP that is not the expected one, a
 *                 shared-users that is not the fleet value).
 * FAIL         -- the evidence contradicts the healthy state. Actionable:
 *                 a `failFix` branch is selected.
 * UNKNOWN      -- the right command, parsed, but the facts do not decide.
 *                 A counter with no baseline. A check only a phone can
 *                 settle. NEVER collapsed into PASS.
 * INCOMPLETE   -- the right command, not all of its output. Re-paste.
 * WRONG_OUTPUT -- a different command's output. Never scores as anything
 *                 else, and specifically never as PASS.
 */
export type Verdict = "PASS" | "WARNING" | "FAIL" | "UNKNOWN" | "INCOMPLETE" | "WRONG_OUTPUT";

/** Where a value is read from. Document scope unless noted. */
export type Ref =
  /** The `RESULT: <token> -- <prose>` line a paste-block prints itself.
   * Resolves to `<token>`. Last occurrence wins: if the installer pasted
   * a before-fix and an after-fix run, the later one is current. */
  | { from: "result" }
  /** A `label : value` line, e.g. `dhcp gateway : 192.168.1.1`. Matched by
   * case-insensitive prefix on the label, so `resolve portal` finds
   * `resolve portal.wyfy...  : false`. Last occurrence wins. */
  | { from: "label"; label: string }
  /** A `key=value` pair anywhere in the paste. Last occurrence wins. */
  | { from: "kv"; key: string }
  /** A `key=value` pair inside the record currently being tested. Only
   * meaningful inside `someRecord` / `recordCount`; absent elsewhere. */
  | { from: "field"; key: string }
  /** The raw text of the current record, or of the whole paste at
   * document scope. */
  | { from: "raw" };

export type Cond =
  | { op: "all"; of: Cond[] }
  | { op: "any"; of: Cond[] }
  | { op: "not"; of: Cond }
  | { op: "present"; ref: Ref }
  | { op: "absent"; ref: Ref }
  /** Case-insensitive, trimmed, quotes stripped. */
  | { op: "textIs"; ref: Ref; value: string }
  | { op: "textIn"; ref: Ref; values: string[] }
  /** Substring. The escape hatch -- used only for RouterOS error strings
   * and for literal template markers like `$(link-login-only)`. */
  | { op: "textIncludes"; ref: Ref; value: string }
  /** Set membership over a comma/space separated value. Order-independent,
   * which is the point: `login-by=https,http-pap` and
   * `login-by=http-pap,https` are the same fact. */
  | { op: "memberOf"; ref: Ref; value: string }
  | { op: "isBool"; ref: Ref; value: boolean }
  | { op: "intBetween"; ref: Ref; min?: number; max?: number }
  /** Seconds. `none` parses to Infinity and therefore fails any finite
   * `maxSeconds` -- which is exactly what "keepalive is off and nothing
   * closes sessions" should do. */
  | { op: "durationBetween"; ref: Ref; minSeconds?: number; maxSeconds?: number }
  /** THE guard. `allowUnspecified` defaults to false, so `0.0.0.0` is a
   * failure unless a rule deliberately opts in. */
  | { op: "isIpv4"; ref: Ref; allowUnspecified?: boolean; inSubnet?: string }
  /** Parsed router date within `days` of the app's own clock. */
  | { op: "dateWithinDays"; ref: Ref; days: number }
  /** Flag by MEANING ("active", "inactive", "disabled"), resolved against
   * the `Flags:` legend the device printed. Record scope. When the paste
   * carried no legend and the menu has no fallback letters, this is
   * neither true nor false -- it makes the enclosing rule not match, so
   * the verdict lands on the assertion's UNKNOWN fallback rather than on
   * an optimistic guess. */
  | { op: "hasFlag"; meaning: string }
  | { op: "someRecord"; where?: Cond; then?: Cond }
  | { op: "recordCount"; where?: Cond; min?: number; max?: number }
  /** Positive proof that the command ran at all: a `Flags:` legend, an
   * ALL-CAPS column header, or the echoed prompt line for this menu.
   * This is what separates "the router matched nothing" from "the
   * installer pasted nothing". */
  | { op: "outputFramePresent" };

export type VerdictRule = {
  when: Cond;
  verdict: Verdict;
  /** Shown to the installer. Hinglish, same register as the content. */
  why: string;
  /** Must be character-identical to one of this check's `failFix[].when`.
   * `scripts/test-output-analyser.mjs` asserts that for every rule, so a
   * reworded fix can never silently detach from its selector. */
  fix?: string;
};

/**
 * How we prove the paste is this command's output and not another's.
 *
 * `banner` -- the paste-blocks in `phases.content.ts` already print their
 *   own `==== TITLE ====` line and close with a bare `====================`
 *   line. That pairing is a begin/end sentinel that already exists in the
 *   content; nothing had to be invented or retrofitted. No other RouterOS
 *   command can print it, so it is the strongest discriminator available
 *   and it doubles as the truncation detector (banner without closer =>
 *   INCOMPLETE).
 *
 * `menu` -- for checks whose command is a raw `print`. Matched on keys and
 *   column headers that essentially only that menu emits, plus `neverKeys`
 *   that prove it is NOT that menu. This is the case the brief names: the
 *   installer is asked for `/ip dhcp-client print detail` and pastes
 *   `/interface print`. Both are tabular, both mention `ether1`. The
 *   discriminator is that dhcp-client has `status=bound|searching|stopped`
 *   and `add-default-route=` and never `actual-mtu`/`l2mtu`.
 */
export type Identify =
  | { kind: "banner"; banner: string; expectsResult?: boolean }
  | { kind: "menu"; menu: MenuId }
  | { kind: "either"; of: Identify[] };

export type OutputAssertion = {
  identify: Identify;
  /** Refs that must be present before any PASS/WARNING/FAIL is possible.
   * A truncated table that happens to contain the token you were
   * grepping for fails here and lands on INCOMPLETE. */
  requires?: Ref[];
  /** First match wins. */
  rules: VerdictRule[];
  /** Verdict when no rule matched. Always UNKNOWN -- never the optimistic
   * reading. */
  fallback: string;
};

export type RedactionReport = {
  /** Key names whose values were removed, deduped, in encounter order. */
  keys: string[];
  /** Number of values replaced. */
  count: number;
  /** A secret-bearing table column was detected but could not be sliced
   * safely (it was not the last column). The caller must warn rather than
   * pretend the text is clean. */
  columnSecretSuspected: boolean;
};

export type AnalysisResult = {
  verdict: Verdict;
  /** Hinglish one-liner for the operator. */
  reason: string;
  /** Index into `check.failFix`, or null. */
  fixIndex: number | null;
  /** What the analyser actually read, for the "yeh dikha" panel. */
  evidence: { label: string; value: string }[];
  /** No assertion exists for this check -- it is human-confirmed only and
   * the UI must say so rather than imply verification. */
  unverifiable: boolean;
  /** The text with secrets already stripped. Callers must display and
   * store THIS, never their own copy of the raw paste. */
  redactedText: string;
  redaction: RedactionReport;
};

// =====================================================================
// 1. THE REDACTOR
// =====================================================================
//
// `phases.content.ts` and `diagnostics.content.ts` both instruct the
// operator to run `/interface wireguard print detail` and
// `/radius print detail`. Those print the WireGuard PRIVATE KEY and the
// RADIUS SHARED SECRET. Under this feature the operator pastes that into
// the app, so it is stripped here, on the way in, before anything can
// store it, log it, or put it in a support ticket.
//
// `app/common/masking.py` is not the tool for this: it masks PII at
// serialisation time and its own docstring says the database always holds
// the raw value. That is the opposite of what is needed.
//
// Constraints this satisfies:
//   - Idempotent. Running it on already-redacted text is a no-op.
//   - Structure-preserving. `secret="x"` becomes `secret="[REDACTED]"`, so
//     the record parser downstream still sees a well-formed key=value and
//     the analyser can still read every non-secret field on the line.
//   - `public-key=` is NOT redacted. It is public, it appears on every
//     `/interface wireguard peers print detail`, and blanking it would
//     destroy evidence for no gain.
//   - `secret=""` stays `secret=""`. Replacing an empty value with a
//     redaction marker would fabricate a secret that does not exist.

export const REDACTION_MARKER = "[REDACTED]";

/**
 * Longest-first. `shared-secret` must be tried before `secret`, otherwise
 * the boundary guard sees the `-` and skips the match entirely.
 */
const SECRET_KEYS = [
  "wpa2-pre-shared-key",
  "wpa-pre-shared-key",
  "pre-shared-key",
  "preshared-key",
  "shared-secret",
  "backend-secret",
  "private-key",
  "auth-password",
  "enc-password",
  "old-password",
  "new-password",
  "confirm-password",
  "authorization",
  "passphrase",
  "password",
  "api-key",
  "secret",
  "token",
  "psk",
] as const;

const SECRET_KEY_ALTERNATION = SECRET_KEYS.join("|");

/** `key=value`, value quoted (single or double, with escapes) or bare. */
const RE_SECRET_EQ = new RegExp(
  `(^|[^\\w-])(${SECRET_KEY_ALTERNATION})(\\s*=\\s*)("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s;,]+)`,
  "gi",
);

/** `key: value` -- the `print` form some menus use. Value runs to EOL. */
const RE_SECRET_COLON = new RegExp(`(^\\s*)(${SECRET_KEY_ALTERNATION})(\\s*:\\s+)(\\S.*)$`, "gim");

/** Secret-bearing column headers, for the tabular `print` case. */
const SECRET_COLUMNS = ["SECRET", "PASSWORD", "PRIVATE-KEY", "PRE-SHARED-KEY"];

function isEmptyQuoted(value: string): boolean {
  return value === '""' || value === "''";
}

function replaceSecretValue(value: string): string {
  if (isEmptyQuoted(value)) return value;
  if (value.startsWith('"')) return `"${REDACTION_MARKER}"`;
  if (value.startsWith("'")) return `'${REDACTION_MARKER}'`;
  return REDACTION_MARKER;
}

/**
 * Strip every secret value from pasted terminal text.
 *
 * Returns the cleaned text plus a report, so the UI can tell the operator
 * what was removed instead of silently altering what he pasted.
 */
export function redactSecrets(raw: string): { text: string; report: RedactionReport } {
  const keys: string[] = [];
  const noteKey = (k: string) => {
    const lower = k.toLowerCase();
    if (!keys.includes(lower)) keys.push(lower);
  };
  let count = 0;

  let text = raw.replace(RE_SECRET_EQ, (_m, lead: string, key: string, eq: string, val: string) => {
    const next = replaceSecretValue(val);
    if (next !== val) {
      noteKey(key);
      count += 1;
    }
    return `${lead}${key}${eq}${next}`;
  });

  text = text.replace(
    RE_SECRET_COLON,
    (_m, lead: string, key: string, sep: string, val: string) => {
      const trimmed = val.trim();
      if (trimmed === REDACTION_MARKER) return `${lead}${key}${sep}${val}`;
      noteKey(key);
      count += 1;
      return `${lead}${key}${sep}${REDACTION_MARKER}`;
    },
  );

  // --- tabular form -------------------------------------------------
  // `/radius print` (no `detail`) puts the shared secret in a SECRET
  // column with no `key=` anywhere. There is nothing to key off, so the
  // column offset from the header line is used -- but ONLY when the
  // secret column is the last one, because only then is "everything from
  // this offset to end of line" unambiguously the secret. If it is not
  // last, nothing is cut and the caller is told to warn instead. Guessing
  // a column width here would either leak a secret or shred a field the
  // analyser needs.
  let columnSecretSuspected = false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i];
    if (!isHeaderLine(header)) continue;
    for (const col of SECRET_COLUMNS) {
      const at = header.indexOf(col);
      if (at === -1) continue;
      const isLast = header.slice(at + col.length).trim() === "";
      if (!isLast) {
        columnSecretSuspected = true;
        continue;
      }
      for (let j = i + 1; j < lines.length; j += 1) {
        const row = lines[j];
        if (row.trim() === "") break;
        if (isHeaderLine(row)) break;
        if (row.length <= at) continue;
        const tail = row.slice(at);
        if (tail.trim() === "" || tail.trim() === REDACTION_MARKER) continue;
        lines[j] = row.slice(0, at) + REDACTION_MARKER;
        noteKey(col.toLowerCase());
        count += 1;
      }
    }
  }
  text = lines.join("\n");

  return { text, report: { keys, count, columnSecretSuspected } };
}

// =====================================================================
// 2. CLEANING AND PARSING
// =====================================================================

// eslint-disable-next-line no-control-regex
const RE_ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
// eslint-disable-next-line no-control-regex
const RE_BACKSPACE_RUN = /[^\n]\u0008/g;
/** NULs and vertical tabs some serial consoles interleave. */
// eslint-disable-next-line no-control-regex
const RE_STRAY_CONTROL = /[\u0000\u000b\u000c]/g;

/** RouterOS terminal pager. Wording varies; the bracketed key list does not. */
const RE_PAGING_PROMPT = /--\s*\[Q quit\|/i;

/** `[admin@MikroTik] > /ip route print`  and  `[admin@box] /ip route> print` */
const RE_PROMPT_COMMAND = /^\s*\[[^\]\n]+\]\s*(\/[^>\n]*)?>\s?(.*)$/;

const RE_FLAGS_LEGEND = /^\s*Flags:\s*(.+)$/;
const RE_FLAGS_LEGEND_PAIR = /([A-Za-z])\s*-\s*([A-Za-z][A-Za-z -]*)/g;
const RE_COLUMNS_HINT = /^\s*Columns:\s/;
const RE_SEMI_COMMENT = /^\s*;;;\s?(.*)$/;
const RE_KV_EQ = /([a-zA-Z][a-zA-Z0-9._-]*)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]*)/g;
/** Left side may contain spaces (`ping 8.8.8.8 : true`) but never `=`,
 * so a detail line's `interface=bridge  idle-timeout=5m` is never read as
 * a labelled line. Split on the first `: ` so `time: 09:14:02` keeps its
 * value intact. */
const RE_LABELLED = /^\s*([^:=]{1,48}?)\s*:\s+(\S.*)$/;
const RE_RESULT = /^\s*RESULT:\s*(.+)$/;
/** A bare rule of `=` -- every paste-block in the content closes with one. */
const RE_BLOCK_CLOSER = /^\s*={8,}\s*$/;

const RE_IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const RE_DATE_LEGACY = /^([a-zA-Z]{3})\/(\d{1,2})\/(\d{4})$/;
const RE_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_DURATION_CLOCK = /^(\d+):([0-5]?\d):([0-5]?\d)$/;
const RE_DURATION_UNITS = /^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

const BOOL_TRUE = new Set(["true", "yes", "y", "enabled", "up", "1", "running", "ok", "bound"]);
const BOOL_FALSE = new Set(["false", "no", "n", "disabled", "down", "0", "not-running", ""]);
const DURATION_NONE = new Set(["none", "never", "forever"]);

/** RouterOS errors that mean "the command did not run", not "the state is bad". */
const ROUTEROS_ERRORS = [
  "bad command name",
  "expected end of command",
  "syntax error",
  "no such item",
  "input does not match any value of",
  "invalid value",
  "failure:",
  "cannot find",
];

/** Two or more ALL-CAPS column tokens and no `=`. */
export function isHeaderLine(line: string): boolean {
  if (line.includes("=")) return false;
  const body = line.replace(/^\s*#?\s*/, "");
  const tokens = body
    .trim()
    .split(/\s{1,}/)
    .filter(Boolean);
  if (tokens.length < 2) return false;
  const caps = tokens.filter((t) => /^[A-Z][A-Z0-9-]*$/.test(t));
  return caps.length >= 2 && caps.length === tokens.length;
}

function stripQuotes(v: string): string {
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

const normLabel = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export type ParsedRecord = {
  index: number;
  /** Raw flag letters as printed, e.g. `As` or `A S`. */
  flagLetters: string;
  /** Flag meanings resolved against the legend, lowercased. */
  flagMeanings: string[];
  /** True when no legend and no fallback letters were available, so flags
   * could not be resolved at all. Rules that need a flag must not match. */
  flagsUnresolved: boolean;
  kv: Record<string, string>;
  comment: string | null;
  raw: string;
};

export type ParsedOutput = {
  text: string;
  lines: string[];
  nonBlankLines: number;
  paged: boolean;
  /** Commands recovered from echoed prompt lines, e.g. `/ip route print`. */
  echoedCommands: string[];
  legend: Record<string, string>;
  hasLegend: boolean;
  hasHeader: boolean;
  hasBlockCloser: boolean;
  /** Banner titles seen, upper-cased, e.g. `INTERNET GATE`. */
  banners: string[];
  /** `RESULT:` token, last occurrence, upper-cased. */
  result: string | null;
  labels: Record<string, string>;
  kv: Record<string, string>;
  records: ParsedRecord[];
  /** Every key-ish token seen, for menu fingerprinting. */
  keySet: Set<string>;
  errors: string[];
};

function cleanText(raw: string): string {
  let t = raw.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
  t = t.replace(RE_ANSI, "");
  // Backspace overstrike from WinBox redrawing a line. Bounded loop: each
  // pass removes at least one character, so it terminates.
  for (let i = 0; i < 8; i += 1) {
    const next = t.replace(RE_BACKSPACE_RUN, "");
    if (next === t) break;
    t = next;
  }
  return t.replace(RE_STRAY_CONTROL, "");
}

function parseLegend(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  RE_FLAGS_LEGEND_PAIR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_FLAGS_LEGEND_PAIR.exec(body)) !== null) {
    out[m[1]] = m[2].trim().toLowerCase();
  }
  return out;
}

/**
 * Flag letters printed for menus that ship no legend in some versions.
 * Only ever consulted when the paste itself carried no `Flags:` line.
 */
const FLAG_FALLBACK: Record<string, Record<string, string>> = {
  "/ip route": {
    A: "active",
    a: "active",
    I: "inactive",
    i: "inactive",
    D: "dynamic",
    d: "dhcp",
    X: "disabled",
    S: "static",
    s: "static",
    C: "connect",
    c: "connect",
    B: "blackhole",
    U: "unreachable",
    P: "prohibit",
  },
  "/ip address": { D: "dynamic", X: "disabled", I: "invalid" },
  "/ip hotspot user": { X: "disabled", D: "dynamic" },
  "/user": { X: "disabled" },
  "/radius": { X: "disabled" },
  "/ip hotspot walled-garden": { X: "disabled", D: "dynamic" },
  "/ip hotspot walled-garden ip": { X: "disabled", D: "dynamic" },
  "/certificate": {
    K: "private-key",
    A: "authority",
    T: "trusted",
    I: "issued",
    E: "expired",
    R: "revoked",
    L: "crl",
  },
};

/**
 * Split a record's leading `<index> <flags>` off the payload.
 *
 * The hard case is `/ip hotspot user print`, where the row reads
 * ` 0 X all      guest ...` -- `all` is a three-letter SERVER value that a
 * naive "consume short alpha tokens as flags" rule would eat. So a token
 * is only taken as flags when every one of its letters is a letter the
 * device's own legend (or this menu's fallback) actually defines.
 */
function splitFlags(
  payload: string,
  letters: Record<string, string> | null,
): { flagLetters: string; rest: string } {
  if (!letters) return { flagLetters: "", rest: payload };
  let rest = payload;
  const taken: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const m = /^([A-Za-z]{1,4})(\s+)(.*)$/s.exec(rest);
    if (!m) break;
    const token = m[1];
    if (![...token].every((ch) => Object.prototype.hasOwnProperty.call(letters, ch))) break;
    taken.push(token);
    rest = m[3];
  }
  return { flagLetters: taken.join(""), rest };
}

const RE_CIDR_TOKEN = /\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/g;
const RE_IPV4_TOKEN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const DHCP_STATUS_TOKENS = [
  "bound",
  "searching",
  "stopped",
  "error",
  "requesting",
  "renewing",
  "rebinding",
];

/**
 * Fields a `print` TABLE row implies but does not spell out as `key=`.
 *
 * `print detail` gives every value as `key=value` and needs none of this.
 * A plain `print` gives columns, and the checks in this content use plain
 * `print` for the two most safety-critical reads there are.
 *
 * Column-offset slicing was rejected: RouterOS right-aligns numeric
 * columns, v6 and v7 disagree on column sets (v6's `/ip route` has a
 * PREF-SRC column v7 does not), and an off-by-one slice yields a
 * plausible-looking wrong value -- the exact failure mode this module
 * exists to prevent. Token derivation instead, kept deliberately narrow,
 * and never the sole basis for a PASS: the route check additionally
 * requires the ACTIVE flag, so a mis-derived gateway cannot on its own
 * turn a dead route green.
 */
function deriveTableFields(record: ParsedRecord, menu: MenuId | undefined): void {
  const kv = record.kv;
  const cidrs = record.raw.match(RE_CIDR_TOKEN) ?? [];
  const withoutCidrs = record.raw.replace(RE_CIDR_TOKEN, " ");
  const ips = withoutCidrs.match(RE_IPV4_TOKEN) ?? [];

  // `0.0.0.0` appearing as a value in its own right -- not as part of the
  // `0.0.0.0/0` destination. This is the 2026-08-21 bug's fingerprint and
  // it is derived independently of any column guess, so the route rule
  // that uses it holds even if the column layout is unfamiliar.
  kv["has-unspecified-ipv4"] = ips.some((ip) => ip === "0.0.0.0" || ip.startsWith("0."))
    ? "true"
    : "false";
  const firstIp: string | undefined = ips[0];
  const firstCidr: string | undefined = cidrs[0];
  if (firstIp !== undefined && kv["first-ipv4"] === undefined) kv["first-ipv4"] = firstIp;

  if (menu === "/ip route") {
    if (kv["dst-address"] === undefined && firstCidr !== undefined) kv["dst-address"] = firstCidr;
    if (kv.gateway === undefined && firstIp !== undefined) kv.gateway = firstIp;
  }
  if (menu === "/ip hotspot walled-garden ip") {
    if (kv["dst-address"] === undefined && firstIp !== undefined) kv["dst-address"] = firstIp;
  }
  if (menu === "/ip dhcp-client") {
    if (kv.status === undefined) {
      const tokens = record.raw.toLowerCase().split(/\s+/);
      const hit = DHCP_STATUS_TOKENS.find((t) =>
        tokens.some((tok) => tok.replace(/\.+$/, "") === t),
      );
      if (hit) kv.status = hit;
    }
  }
  if (menu === "/file" && kv.name === undefined) {
    const first = record.raw.trim().split(/\s+/)[0];
    if (first) kv.name = first;
  }
}

function extractKv(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  RE_KV_EQ.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_KV_EQ.exec(line)) !== null) {
    out[m[1].toLowerCase()] = stripQuotes(m[2]);
  }
  return out;
}

export function parseOutput(rawInput: string, menuHint?: MenuId): ParsedOutput {
  const text = cleanText(rawInput);
  const allLines = text.split("\n");

  const paged = allLines.some((l) => RE_PAGING_PROMPT.test(l));
  const echoedCommands: string[] = [];
  const kept: string[] = [];

  for (const line of allLines) {
    const pm = RE_PROMPT_COMMAND.exec(line);
    if (pm) {
      const menuPath = (pm[1] ?? "").trim();
      const typed = (pm[2] ?? "").trim();
      const joined = `${menuPath} ${typed}`.replace(/\s+/g, " ").trim();
      if (joined) echoedCommands.push(joined);
      const tail = typed;
      // A prompt line can carry output after the command on the same line
      // in some clients; keep nothing, the command is recorded above.
      if (tail && !tail.startsWith("/") && !tail.startsWith(":")) kept.push(tail);
      continue;
    }
    if (RE_PAGING_PROMPT.test(line)) continue;
    if (RE_COLUMNS_HINT.test(line)) continue;
    kept.push(line);
  }

  let legend: Record<string, string> = {};
  let hasLegend = false;
  let hasHeader = false;
  let hasBlockCloser = false;
  const banners: string[] = [];
  const labels: Record<string, string> = {};
  const docKv: Record<string, string> = {};
  const errors: string[] = [];
  let result: string | null = null;

  for (const line of kept) {
    const lm = RE_FLAGS_LEGEND.exec(line);
    if (lm) {
      legend = { ...legend, ...parseLegend(lm[1]) };
      hasLegend = true;
      continue;
    }
    if (isHeaderLine(line)) hasHeader = true;
    if (RE_BLOCK_CLOSER.test(line)) {
      hasBlockCloser = true;
      continue;
    }
    const bm = /^\s*=+\s*(.+?)\s*=+\s*$/.exec(line);
    if (bm && bm[1].trim() !== "") banners.push(bm[1].trim().toUpperCase());

    const rm = RE_RESULT.exec(line);
    if (rm) {
      const token = rm[1].split(/\s+--\s+|\s+--$/)[0].trim();
      if (token) result = token.toUpperCase();
      continue;
    }

    const low = line.toLowerCase();
    for (const e of ROUTEROS_ERRORS) if (low.includes(e)) errors.push(line.trim());

    Object.assign(docKv, extractKv(line));

    const labm = RE_LABELLED.exec(line);
    if (labm && !RE_BLOCK_CLOSER.test(line)) {
      labels[normLabel(labm[1])] = labm[2].trim();
    }
  }

  // ---- records -----------------------------------------------------
  const letters: Record<string, string> | null = hasLegend
    ? legend
    : menuHint && FLAG_FALLBACK[menuHint]
      ? FLAG_FALLBACK[menuHint]
      : null;

  const records: ParsedRecord[] = [];
  let pendingComment: string | null = null;
  let current: ParsedRecord | null = null;

  const flushCurrent = () => {
    if (current) {
      Object.assign(current.kv, extractKv(current.raw));
      if (!current.kv.comment && current.comment) current.kv.comment = current.comment;
      deriveTableFields(current, menuHint);
      records.push(current);
      current = null;
    }
  };

  for (const line of kept) {
    if (RE_FLAGS_LEGEND.test(line) || RE_BLOCK_CLOSER.test(line)) continue;
    const cm = RE_SEMI_COMMENT.exec(line);
    if (cm) {
      pendingComment = cm[1].trim();
      continue;
    }
    const start = /^\s*(\d+)\s+(\S.*)$/s.exec(line);
    if (start && !isHeaderLine(line)) {
      flushCurrent();
      const { flagLetters, rest } = splitFlags(start[2], letters);
      const meanings = letters
        ? [...flagLetters].map((ch) => letters[ch]).filter((x): x is string => Boolean(x))
        : [];
      current = {
        index: Number(start[1]),
        flagLetters,
        flagMeanings: meanings,
        flagsUnresolved: letters === null,
        kv: {},
        comment: pendingComment,
        raw: rest,
      };
      pendingComment = null;
      continue;
    }
    if (current && line.trim() !== "" && !isHeaderLine(line)) {
      // Continuation of a wrapped record.
      current.raw += ` ${line.trim()}`;
      continue;
    }
    if (line.trim() === "") flushCurrent();
  }
  flushCurrent();

  const keySet = new Set<string>();
  for (const k of Object.keys(docKv)) keySet.add(k);
  for (const k of Object.keys(labels)) keySet.add(k);
  for (const r of records) for (const k of Object.keys(r.kv)) keySet.add(k);
  for (const line of kept) {
    if (!isHeaderLine(line)) continue;
    for (const t of line.trim().split(/\s+/)) {
      if (/^[A-Z][A-Z0-9-]*$/.test(t)) keySet.add(t.toLowerCase());
    }
  }

  return {
    text,
    lines: kept,
    nonBlankLines: kept.filter((l) => l.trim() !== "").length,
    paged,
    echoedCommands,
    legend,
    hasLegend,
    hasHeader,
    hasBlockCloser,
    banners,
    result,
    labels,
    kv: docKv,
    records,
    keySet,
    errors,
  };
}

// =====================================================================
// 3. MENU FINGERPRINTS -- the WRONG_OUTPUT registry
// =====================================================================
//
// `uniqueKeys` -- keys essentially only this menu emits.
// `neverKeys`  -- keys that, if present, prove it is NOT this menu.
//
// The decoy menus (`/interface`, `/ip address`, `/ip hotspot`, ...) are
// here even though no check asks for them, because their whole job is to
// let the app say "you ran `/interface print`" instead of "try again".

export type MenuId =
  | "/ip dhcp-client"
  | "/ip route"
  | "/ip address"
  | "/ip dns"
  | "/interface"
  | "/interface ethernet"
  | "/interface wireguard"
  | "/interface wireguard peers"
  | "/ip hotspot"
  | "/ip hotspot profile"
  | "/ip hotspot user"
  | "/ip hotspot active"
  | "/ip hotspot walled-garden"
  | "/ip hotspot walled-garden ip"
  | "/radius"
  | "/radius monitor"
  | "/user"
  | "/file"
  | "/certificate"
  | "/system clock"
  | "/system routerboard"
  | "/system resource";

type Fingerprint = { menu: MenuId; uniqueKeys: string[]; neverKeys: string[] };

export const MENU_FINGERPRINTS: Fingerprint[] = [
  {
    menu: "/ip dhcp-client",
    uniqueKeys: ["add-default-route", "use-peer-dns", "dhcp-server", "expires-after", "status"],
    neverKeys: ["actual-mtu", "l2mtu", "dst-address", "address-pool", "dst-host"],
  },
  {
    menu: "/ip route",
    uniqueKeys: ["dst-address", "distance", "check-gateway", "routing-mark", "gateway-status"],
    neverKeys: ["add-default-route", "address-pool", "dst-host", "actual-mtu"],
  },
  {
    menu: "/ip address",
    uniqueKeys: ["network", "actual-interface"],
    neverKeys: ["add-default-route", "distance", "dst-host", "actual-mtu"],
  },
  {
    menu: "/ip dns",
    uniqueKeys: ["allow-remote-requests", "cache-size", "cache-used", "dynamic-servers"],
    neverKeys: ["distance", "add-default-route", "dst-host"],
  },
  {
    menu: "/interface",
    uniqueKeys: ["actual-mtu", "l2mtu", "link-downs", "last-link-up-time"],
    neverKeys: ["add-default-route", "gateway", "address-pool", "dst-host"],
  },
  {
    menu: "/interface ethernet",
    uniqueKeys: ["auto-negotiation", "advertise", "orig-mac-address"],
    neverKeys: ["add-default-route", "address-pool", "dst-host"],
  },
  {
    menu: "/interface wireguard",
    uniqueKeys: ["private-key", "listen-port"],
    neverKeys: ["endpoint-address", "allowed-address", "last-handshake", "add-default-route"],
  },
  {
    menu: "/interface wireguard peers",
    uniqueKeys: ["endpoint-address", "endpoint-port", "allowed-address", "last-handshake"],
    neverKeys: ["listen-port", "add-default-route"],
  },
  {
    menu: "/ip hotspot",
    uniqueKeys: ["address-pool", "idle-timeout", "keepalive-timeout", "addresses-per-mac"],
    neverKeys: ["ranges", "check-gateway", "dst-host", "actual-mtu"],
  },
  {
    menu: "/ip hotspot profile",
    uniqueKeys: ["hotspot-address", "html-directory", "login-by", "use-radius", "dns-name"],
    neverKeys: ["ranges", "check-gateway", "add-default-route"],
  },
  {
    menu: "/ip hotspot user",
    uniqueKeys: ["server", "profile", "limit-uptime", "bytes-in", "bytes-out"],
    neverKeys: ["dst-host", "dst-address", "add-default-route", "actual-mtu"],
  },
  {
    menu: "/ip hotspot active",
    uniqueKeys: ["session-time-left", "idle-time", "login-by"],
    neverKeys: ["dst-host", "add-default-route"],
  },
  {
    menu: "/ip hotspot walled-garden",
    uniqueKeys: ["dst-host", "path", "method"],
    neverKeys: ["dst-address-list", "address-pool", "distance"],
  },
  {
    menu: "/ip hotspot walled-garden ip",
    uniqueKeys: ["dst-address", "dst-address-list", "dst-port"],
    neverKeys: ["dst-host", "check-gateway", "distance"],
  },
  {
    menu: "/radius",
    uniqueKeys: ["accounting-port", "authentication-port", "called-id", "realm", "secret"],
    neverKeys: ["address-pool", "check-gateway", "dst-host"],
  },
  {
    menu: "/radius monitor",
    uniqueKeys: ["pending", "requests", "accepts", "rejects", "resends", "timeouts", "bad-replies"],
    neverKeys: ["address-pool", "dst-address", "dst-host"],
  },
  {
    menu: "/user",
    uniqueKeys: ["group", "last-logged-in"],
    neverKeys: ["dst-host", "dst-address", "add-default-route", "actual-mtu"],
  },
  {
    menu: "/file",
    uniqueKeys: ["contents", "creation-time", "package-version"],
    neverKeys: ["gateway", "address-pool", "dst-host"],
  },
  {
    menu: "/certificate",
    uniqueKeys: ["common-name", "key-usage", "invalid-before", "invalid-after", "fingerprint"],
    neverKeys: ["address-pool", "gateway", "dst-host"],
  },
  {
    menu: "/system clock",
    uniqueKeys: ["time-zone-name", "gmt-offset", "dst-active", "time-zone-autodetect"],
    neverKeys: ["gateway", "address-pool", "dst-host"],
  },
  {
    menu: "/system routerboard",
    uniqueKeys: ["routerboard", "current-firmware", "factory-firmware", "upgrade-firmware"],
    neverKeys: ["gateway", "address-pool", "dst-host"],
  },
  {
    menu: "/system resource",
    uniqueKeys: ["board-name", "architecture-name", "free-memory", "cpu-load"],
    neverKeys: ["gateway", "address-pool", "dst-host"],
  },
];

function fingerprintScore(p: ParsedOutput, fp: Fingerprint): number {
  if (fp.neverKeys.some((k) => p.keySet.has(k))) return -1;
  return fp.uniqueKeys.filter((k) => p.keySet.has(k)).length;
}

/** Best-matching menu for a paste, or null. */
export function identifyMenu(p: ParsedOutput): { menu: MenuId; score: number } | null {
  let best: { menu: MenuId; score: number } | null = null;
  for (const fp of MENU_FINGERPRINTS) {
    const score = fingerprintScore(p, fp);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { menu: fp.menu, score };
  }
  return best;
}

// =====================================================================
// 4. COERCION
// =====================================================================

export function parseDurationSeconds(v: string): number | null {
  const s = stripQuotes(v).trim().toLowerCase();
  if (s === "") return null;
  if (DURATION_NONE.has(s)) return Number.POSITIVE_INFINITY;
  // `/radius print detail` ships `timeout=300ms` by default. Must parse,
  // because 300ms over a WireGuard tunnel is a real cause of RADIUS
  // timeouts and the content asks for 3s.
  const ms = /^(\d+)ms$/.exec(s);
  if (ms) return Number(ms[1]) / 1000;
  const clock = RE_DURATION_CLOCK.exec(s);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  if (/^\d+$/.test(s)) return Number(s);
  const u = RE_DURATION_UNITS.exec(s);
  if (u && u.slice(1).some((x) => x !== undefined)) {
    const [w, d, h, m, sec] = u.slice(1).map((x) => (x ? Number(x) : 0));
    return w * 604800 + d * 86400 + h * 3600 + m * 60 + sec;
  }
  return null;
}

export function parseBool(v: string): boolean | null {
  const s = stripQuotes(v).trim().toLowerCase();
  if (BOOL_TRUE.has(s)) return true;
  if (BOOL_FALSE.has(s)) return false;
  return null;
}

export function parseRouterDate(v: string): Date | null {
  const s = stripQuotes(v).trim().toLowerCase();
  const iso = RE_DATE_ISO.exec(s);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const legacy = RE_DATE_LEGACY.exec(s);
  if (legacy) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const mi = months.indexOf(legacy[1].toLowerCase());
    if (mi === -1) return null;
    return new Date(Date.UTC(Number(legacy[3]), mi, Number(legacy[2])));
  }
  return null;
}

/**
 * Dotted quad, and NOT the unspecified address unless explicitly allowed.
 *
 * This is the single most important function in the file. `0.0.0.0` is a
 * value, not an absence: a default route carrying it prints normally, is
 * flagged `Is`, and passes every truthiness check written against it --
 * including the one live in `mikrotik_adapter.py` today.
 */
export function isUsableIpv4(v: string, allowUnspecified = false): boolean {
  const s = stripQuotes(v).trim();
  if (!RE_IPV4.test(s)) return false;
  if (allowUnspecified) return true;
  if (s === "0.0.0.0") return false;
  if (s.startsWith("0.")) return false;
  return true;
}

function ipToInt(ip: string): number | null {
  if (!RE_IPV4.test(ip)) return null;
  return ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0);
}

export function ipInSubnet(ip: string, cidr: string): boolean {
  const [net, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const a = ipToInt(stripQuotes(ip).trim());
  const b = ipToInt(net);
  if (a === null || b === null || !Number.isFinite(bits)) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) >>> 0 === (b & mask) >>> 0;
}

function toSet(v: string): string[] {
  return stripQuotes(v)
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

// =====================================================================
// 5. THE CONDITION ENGINE
// =====================================================================

type Scope = { doc: ParsedOutput; record: ParsedRecord | null };

function resolve(ref: Ref, scope: Scope): string | undefined {
  const { doc, record } = scope;
  switch (ref.from) {
    case "result":
      return doc.result ?? undefined;
    case "label": {
      const want = normLabel(ref.label);
      const exact = doc.labels[want];
      if (exact !== undefined) return exact;
      for (const k of Object.keys(doc.labels)) if (k.startsWith(want)) return doc.labels[k];
      return undefined;
    }
    case "kv":
      return doc.kv[ref.key.toLowerCase()];
    case "field":
      return record ? record.kv[ref.key.toLowerCase()] : undefined;
    case "raw":
      return record ? record.raw : doc.text;
  }
}

/**
 * Three-valued: true / false / null.
 *
 * `null` means "cannot be determined from this paste" -- an unresolvable
 * flag, a duration that did not parse. A rule containing a null never
 * matches, so an undecidable check lands on the assertion's UNKNOWN
 * fallback instead of on whichever verdict happened to be listed first.
 */
function evaluate(cond: Cond, scope: Scope): boolean | null {
  switch (cond.op) {
    case "all": {
      let sawNull = false;
      for (const c of cond.of) {
        const r = evaluate(c, scope);
        if (r === false) return false;
        if (r === null) sawNull = true;
      }
      return sawNull ? null : true;
    }
    case "any": {
      let sawNull = false;
      for (const c of cond.of) {
        const r = evaluate(c, scope);
        if (r === true) return true;
        if (r === null) sawNull = true;
      }
      return sawNull ? null : false;
    }
    case "not": {
      const r = evaluate(cond.of, scope);
      return r === null ? null : !r;
    }
    case "present":
      return resolve(cond.ref, scope) !== undefined;
    case "absent":
      return resolve(cond.ref, scope) === undefined;
    case "textIs": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      return stripQuotes(v).trim().toLowerCase() === cond.value.trim().toLowerCase();
    }
    case "textIn": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      const s = stripQuotes(v).trim().toLowerCase();
      return cond.values.some((x) => x.trim().toLowerCase() === s);
    }
    case "textIncludes": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      return v.toLowerCase().includes(cond.value.toLowerCase());
    }
    case "memberOf": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      return toSet(v).includes(cond.value.trim().toLowerCase());
    }
    case "isBool": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      const b = parseBool(v);
      return b === null ? null : b === cond.value;
    }
    case "intBetween": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      const n = Number(stripQuotes(v).trim());
      if (!Number.isFinite(n)) return null;
      if (cond.min !== undefined && n < cond.min) return false;
      if (cond.max !== undefined && n > cond.max) return false;
      return true;
    }
    case "durationBetween": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      const s = parseDurationSeconds(v);
      if (s === null) return null;
      if (cond.minSeconds !== undefined && s < cond.minSeconds) return false;
      if (cond.maxSeconds !== undefined && s > cond.maxSeconds) return false;
      return true;
    }
    case "isIpv4": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      if (!isUsableIpv4(v, cond.allowUnspecified ?? false)) return false;
      if (cond.inSubnet && !ipInSubnet(v, cond.inSubnet)) return false;
      return true;
    }
    case "dateWithinDays": {
      const v = resolve(cond.ref, scope);
      if (v === undefined) return false;
      const d = parseRouterDate(v);
      if (d === null) return null;
      const diff = Math.abs(Date.now() - d.getTime()) / 86400000;
      return diff <= cond.days;
    }
    case "hasFlag": {
      const rec = scope.record;
      if (!rec) return null;
      if (rec.flagsUnresolved) return null;
      return rec.flagMeanings.some((m) => m.includes(cond.meaning.toLowerCase()));
    }
    case "someRecord": {
      let sawNull = false;
      for (const rec of scope.doc.records) {
        const inner: Scope = { doc: scope.doc, record: rec };
        if (cond.where) {
          const w = evaluate(cond.where, inner);
          if (w !== true) {
            if (w === null) sawNull = true;
            continue;
          }
        }
        if (!cond.then) return true;
        const t = evaluate(cond.then, inner);
        if (t === true) return true;
        if (t === null) sawNull = true;
      }
      return sawNull ? null : false;
    }
    case "recordCount": {
      let n = 0;
      let sawNull = false;
      for (const rec of scope.doc.records) {
        const inner: Scope = { doc: scope.doc, record: rec };
        if (!cond.where) {
          n += 1;
          continue;
        }
        const w = evaluate(cond.where, inner);
        if (w === true) n += 1;
        else if (w === null) sawNull = true;
      }
      if (sawNull) return null;
      if (cond.min !== undefined && n < cond.min) return false;
      if (cond.max !== undefined && n > cond.max) return false;
      return true;
    }
    case "outputFramePresent": {
      const d = scope.doc;
      return d.hasLegend || d.hasHeader || d.echoedCommands.length > 0 || d.hasBlockCloser;
    }
  }
}

// =====================================================================
// 6. IDENTIFICATION
// =====================================================================

function bannerMatches(p: ParsedOutput, banner: string): boolean {
  const want = banner.replace(/=/g, "").trim().toUpperCase();
  return p.banners.some((b) => b === want);
}

function menusIn(id: Identify): MenuId[] {
  if (id.kind === "menu") return [id.menu];
  if (id.kind === "either") return id.of.flatMap(menusIn);
  return [];
}

function bannersIn(id: Identify): string[] {
  if (id.kind === "banner") return [id.banner];
  if (id.kind === "either") return id.of.flatMap(bannersIn);
  return [];
}

type IdOutcome =
  | { ok: true; via: "banner" | "menu" }
  | { ok: false; verdict: "WRONG_OUTPUT" | "INCOMPLETE"; reason: string };

function identify(p: ParsedOutput, id: Identify): IdOutcome {
  // 1. Banner. Strongest, and it doubles as the truncation detector: the
  //    content's blocks all open with `==== TITLE ====` and close with a
  //    bare `====================`. Banner present without the closer means
  //    the installer stopped copying partway.
  for (const banner of bannersIn(id)) {
    if (!bannerMatches(p, banner)) continue;
    if (!p.hasBlockCloser) {
      return {
        ok: false,
        verdict: "INCOMPLETE",
        reason:
          "Block ka output adhoora hai -- shuruaat ki line to hai par aakhir wali `====================` line nahi. Poora output copy karo.",
      };
    }
    return { ok: true, via: "banner" };
  }

  // 2. Menu fingerprint.
  const wanted = menusIn(id);
  if (wanted.length > 0) {
    for (const menu of wanted) {
      const fp = MENU_FINGERPRINTS.find((f) => f.menu === menu);
      if (fp && fingerprintScore(p, fp) > 0) return { ok: true, via: "menu" };
    }
    // The echoed prompt line is signal 2: many installers copy it.
    for (const cmd of p.echoedCommands) {
      const norm = cmd.toLowerCase();
      if (wanted.some((m) => norm.includes(m))) {
        // Right command echoed but no fingerprint keys -> the output
        // itself never got copied.
        return {
          ok: false,
          verdict: "INCOMPLETE",
          reason:
            "Command to sahi hai, par uska output paste nahi hua -- sirf command wali line aayi hai. Command ke neeche ka poora output copy karo.",
        };
      }
    }
    const other = identifyMenu(p);
    if (other && !wanted.includes(other.menu)) {
      return {
        ok: false,
        verdict: "WRONG_OUTPUT",
        reason: `Yeh \`${other.menu} print\` ka output lag raha hai, is step ki command ka nahi. Upar wali command chalao.`,
      };
    }
  }

  // 3. Nothing matched. If some other block's banner is present, name it.
  if (p.banners.length > 0) {
    return {
      ok: false,
      verdict: "WRONG_OUTPUT",
      reason: `Yeh kisi doosre block (\`${p.banners[0]}\`) ka output hai. Is step wala block chalao.`,
    };
  }
  return {
    ok: false,
    verdict: "WRONG_OUTPUT",
    reason:
      "Yeh is step ki command ka output nahi hai. Upar wali command dobara chalao aur uska poora output paste karo.",
  };
}

// =====================================================================
// 7. THE ANALYSER
// =====================================================================

const MAX_PASTE_BYTES = 512 * 1024;
const MAX_EVIDENCE = 12;

function collectEvidence(p: ParsedOutput): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (p.result) out.push({ label: "RESULT", value: p.result });
  for (const [k, v] of Object.entries(p.labels)) {
    if (out.length >= MAX_EVIDENCE) break;
    if (k === "flags") continue;
    out.push({ label: k, value: v });
  }
  return out;
}

function fixIndexFor(
  fixWhen: string | undefined,
  failFix: { when: string }[] | undefined,
): number | null {
  if (!fixWhen || !failFix) return null;
  const i = failFix.findIndex((f) => f.when === fixWhen);
  return i === -1 ? null : i;
}

/**
 * Turn a paste into a verdict.
 *
 * `assertion` is undefined for the five phase-7 phone checks. Those are
 * not parseable by anything -- "the portal opened on my phone" is not a
 * fact a router prints -- so they come back `unverifiable: true` and the
 * UI must say the app did not verify them, rather than dressing a
 * self-report up as a check.
 */
export function analyseOutput(input: {
  raw: string;
  assertion?: OutputAssertion;
  failFix?: { when: string }[];
}): AnalysisResult {
  const { text: redactedText, report: redaction } = redactSecrets(input.raw ?? "");
  const base = { fixIndex: null, evidence: [], unverifiable: false, redactedText, redaction };

  if (!input.assertion) {
    return {
      ...base,
      verdict: "UNKNOWN",
      reason:
        "Is step ko app verify nahi kar sakti -- ise sirf phone pe dekh kar hi bataya ja sakta hai.",
      unverifiable: true,
    };
  }

  if (redactedText.length > MAX_PASTE_BYTES) {
    return {
      ...base,
      verdict: "INCOMPLETE",
      reason: "Itna bada output expect nahi tha. Sirf is step ki command ka output paste karo.",
    };
  }

  const menuHint = menusIn(input.assertion.identify)[0];
  const p = parseOutput(redactedText, menuHint);
  const evidence = collectEvidence(p);

  if (p.nonBlankLines === 0) {
    return {
      ...base,
      evidence,
      verdict: "INCOMPLETE",
      reason:
        "Kuch paste nahi hua. Agar router ne sach me kuch print nahi kiya, to command wali line (`[admin@...] > ...`) bhi saath me copy karo -- tabhi app samajh payegi ki output khaali tha.",
    };
  }

  if (p.paged) {
    return {
      ...base,
      evidence,
      verdict: "INCOMPLETE",
      reason:
        "Output adhoora hai -- terminal ne page rok diya tha. Space dabakar poora output dikhao, phir sab copy karo.",
    };
  }

  const idr = identify(p, input.assertion.identify);
  if (!idr.ok) {
    return { ...base, evidence, verdict: idr.verdict, reason: idr.reason };
  }

  const docScope: Scope = { doc: p, record: null };

  for (const ref of input.assertion.requires ?? []) {
    if (resolve(ref, docScope) === undefined) {
      return {
        ...base,
        evidence,
        verdict: "INCOMPLETE",
        reason:
          "Command sahi hai par output adhoora hai -- jo line se pata chalta ki sab theek hai, wo hi missing hai. Poora output dobara copy karo.",
      };
    }
  }

  for (const rule of input.assertion.rules) {
    if (evaluate(rule.when, docScope) === true) {
      return {
        ...base,
        evidence,
        verdict: rule.verdict,
        reason: rule.why,
        fixIndex: fixIndexFor(rule.fix, input.failFix),
      };
    }
  }

  return { ...base, evidence, verdict: "UNKNOWN", reason: input.assertion.fallback };
}
