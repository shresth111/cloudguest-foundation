/**
 * Manual MikroTik Configuration Wizard — parsing rules.
 *
 * Pure data + regex constants. No React, no runtime logic beyond the
 * documented algorithm a builder implements against these constants.
 *
 * ---------------------------------------------------------------------
 * WHY NOT JUST MATCH STRINGS
 * ---------------------------------------------------------------------
 * The same true fact prints differently depending on RouterOS major
 * version, terminal width, whether a value was ever explicitly set, and
 * whether the installer is in WinBox's terminal, SSH, or the serial
 * console. Every one of the following pairs means THE SAME THING:
 *
 *   idle-timeout=00:05:00        idle-timeout=5m
 *   login-by=https,http-pap      login-by=http-pap,https
 *   flags " 0 A S "  (v6)        flags " 0  As "  (v7)
 *   date=aug/22/2026 (<=7.9)     date=2026-08-22  (>=7.10)
 *   status=bound                 status: bound
 *   running=true                 running: yes
 *
 * An exact-string rule over any of those is a rule that will one day say
 * FAIL on a healthy router, or — far worse — PASS on a broken one.
 *
 * ---------------------------------------------------------------------
 * THE PIPELINE
 * ---------------------------------------------------------------------
 * Run in this order. Each stage is separately testable.
 *
 *  0. GUARD          reject > MAX_PASTE_BYTES; reject binary.
 *  1. DECODE         normalise CRLF/CR -> LF; strip BOM; strip ANSI CSI
 *                    and OSC sequences (RE_ANSI); strip backspace-overstrike
 *                    runs WinBox emits while redrawing (RE_BACKSPACE_RUN).
 *  2. DEPAGE         if RE_PAGING_PROMPT matches anywhere -> the paste is
 *                    a paged screen. Verdict INCOMPLETE_OUTPUT with the
 *                    specific instruction: re-run the command with
 *                    `without-paging` appended (every probe in this module
 *                    already includes it; this catches hand-typed reruns).
 *                    Remove the marker lines before continuing so a partial
 *                    parse is still available for the UI's context panel.
 *  3. STRIP PROMPTS  remove lines matching RE_PROMPT_LINE, but FIRST record
 *                    every echoed command they contain (RE_PROMPT_COMMAND)
 *                    into `echoedCommands` — signal 2 of WRONG_OUTPUT.
 *  3b. BANNER PAIR   every probe in this module is additionally wrapped in
 *                    the `==== TITLE ====` / `====================` pair the
 *                    existing analyser already relies on. It carries two
 *                    jobs and both are load-bearing:
 *                      - TRUNCATION: an opening banner with no closing one
 *                        means the paste was cut short -> INCOMPLETE_OUTPUT,
 *                        checked BEFORE any fact is read.
 *                      - DISCRIMINATION: the banner title names what was
 *                        actually run, so an operator who pasted a different
 *                        command's output can be told which one they ran.
 *                    The banner is the shared contract with the legacy
 *                    9-phase blocks; the `WYFY-*` sentinels sit inside it and
 *                    add the one thing the banner cannot carry — the step id,
 *                    which is what catches a paste from the RIGHT command at
 *                    the WRONG step. Both are checked; neither replaces the
 *                    other.
 *  4. SENTINEL SLICE find the LAST `WYFY-BEGIN <id>` and the FIRST
 *                    `WYFY-END <id>` after it (RE_SENTINEL_BEGIN /
 *                    RE_SENTINEL_END). Last-BEGIN, because a terminal that
 *                    echoes the pasted script prints the sentinel line
 *                    twice — once as echo, once as output.
 *                      begin missing && end missing -> fall through to
 *                        fingerprint-only scoring (installer may have run a
 *                        raw print from the resolver rather than a probe).
 *                      begin present, end missing  -> INCOMPLETE_OUTPUT.
 *                      id mismatch                 -> WRONG_OUTPUT
 *                        ("this is step N's output").
 *  5. UNWRAP         re-join soft-wrapped lines: a line is a CONTINUATION
 *                    when it does not match RE_RECORD_START, does not match
 *                    RE_KV_LINE, and the previous line did not end a record.
 *                    Join with a single space. See WRAP_HAZARD below.
 *  6. LEGEND         if RE_FLAGS_LEGEND matches, parse it into
 *                    letter -> meaning. USE THE DEVICE'S OWN LEGEND, not a
 *                    hard-coded table. FLAG_LETTER_FALLBACK is only for
 *                    output that carried no legend.
 *  7. RECORDS        split `print` / `print detail` output on
 *                    RE_RECORD_START. Attach a preceding `;;; text` line
 *                    (RE_SEMI_COMMENT) as that record's `comment` when the
 *                    record has no explicit `comment=`.
 *  8. KV             within each record and each free line, extract pairs:
 *                      - if the line contains `=`, use RE_KV_EQ (repeated).
 *                      - else if it matches RE_KV_COLON, use that.
 *                    Never both on one line. `=` wins, because a duration
 *                    value (`00:05:00`) contains colons and a naive colon
 *                    split shreds it.
 *  9. COERCE         apply FactType per `Fact.type`. See COERCION.
 * 10. SCORE          fingerprint -> required facts -> pass predicate ->
 *                    outcomes in order, first match wins.
 *
 * ---------------------------------------------------------------------
 * WRAP_HAZARD — the one thing the parser cannot fully fix
 * ---------------------------------------------------------------------
 * A terminal narrower than the output wraps mid-line. RouterOS wraps at
 * whitespace in practice, so `key=value` tokens usually survive intact and
 * stage 5 recovers them. It is NOT guaranteed: a single very long value (a
 * WireGuard public key, a `contents=` blob) can be split mid-token, which
 * produces a corrupt value that still looks like a value.
 *
 * The mitigation is structural, not textual: EVERY PASS-CRITICAL SCALAR IN
 * THIS WIZARD IS EMITTED BY A `:put` OF ONE SHORT `key=value` LINE, not
 * read out of a wide table. Tables appear only as `contextCommands`, whose
 * output is displayed and attached to tickets but never scored. If you find
 * yourself scoring a column, you have introduced this bug.
 *
 * Secondary defence: any coerced value longer than MAX_SANE_VALUE_LEN for
 * its type, or an `ipv4` that fails RE_IPV4, is treated as
 * INCOMPLETE_OUTPUT rather than FAIL.
 */

import type { Confidence, FactType, Lit, T } from "./types";

// ---------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------

export const MAX_PASTE_BYTES = 512 * 1024;
export const MAX_SANE_VALUE_LEN: Record<FactType, number> = {
  string: 512,
  int: 20,
  bool: 12,
  ipv4: 15,
  ipv4cidr: 18,
  duration: 24,
  csv: 256,
  flags: 12,
  datetime: 24,
  version: 32,
};

// ---------------------------------------------------------------------
// Regexes. All JS-flavoured, all anchored where it matters.
// ---------------------------------------------------------------------

/** ANSI CSI + OSC. WinBox's terminal and SSH clients both emit these. */
// eslint-disable-next-line no-control-regex
export const RE_ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

/** `x\b` overstrike runs from line redraw. */
// eslint-disable-next-line no-control-regex
export const RE_BACKSPACE_RUN = /.\x08/g;

/**
 * RouterOS terminal paging prompt. Wording differs between versions and
 * between `print` and `print detail`; match on the bracketed key list,
 * which is stable.
 * confidence: standard-routeros
 */
export const RE_PAGING_PROMPT = /--\s*\[Q quit\|.*?\]|-- \[Q quit\|D dump\|down\]/i;

/**
 * A prompt line, e.g.
 *   `[admin@MikroTik] > /ip dhcp-client print detail`
 *   `[admin@wyfy-gurgaon-01] /ip dhcp-client> print detail`
 * The second form is what you get after `cd`-ing into a menu — note the
 * menu path sits BEFORE the `>`.
 */
export const RE_PROMPT_LINE = /^\s*\[[^\]\n]+\]\s*(\/[^>\n]*)?>\s?/;

/** Capture group 1 = menu path from the prompt (may be empty),
 *  group 2 = the rest of the typed command. */
export const RE_PROMPT_COMMAND = /^\s*\[[^\]\n]+\]\s*(\/[^>\n]*)?>\s?(.*)$/;

/** Sentinels. Group 1 = step id. */
export const RE_SENTINEL_BEGIN = /^\s*WYFY-BEGIN\s+([A-Za-z0-9_-]+)\s*$/;
export const RE_SENTINEL_END = /^\s*WYFY-END\s+([A-Za-z0-9_-]+)\s*$/;

/**
 * The banner pair shared with the existing 9-phase blocks. Group 1 of the
 * opening banner is the title, which names what was actually run.
 * An opening banner with no closing one is a truncated paste.
 */
export const RE_BANNER_OPEN = /^\s*={3,}\s*(.+?)\s*={3,}\s*$/;
export const RE_BANNER_CLOSE = /^\s*={8,}\s*$/;

/**
 * Start of a printed record. Index, optional flag letters.
 *   v6:  ` 0 A S  0.0.0.0/0 ...`
 *   v7:  `0  As  0.0.0.0/0 ...`
 *   detail: ` 0   interface=ether1 ...`
 * Group 1 = index, group 2 = raw flag text (may be empty).
 */
export const RE_RECORD_START = /^\s*(\d+)\s+((?:[A-Za-z](?:\s|$)){0,6}|[A-Za-z]{1,6}\s)?/;

/** `;;; a comment` line printed above a record in `print detail`. */
export const RE_SEMI_COMMENT = /^\s*;;;\s?(.*)$/;

/**
 * `Flags: X - disabled, I - invalid, D - dynamic`
 * v7 also uses `;` between groups and UPPERCASE meanings:
 * `Flags: D - DYNAMIC; X - DISABLED, I - INACTIVE, A - ACTIVE; c - CONNECT`
 */
export const RE_FLAGS_LEGEND = /^\s*Flags:\s*(.+)$/;
/** Applied repeatedly to the legend body. G1 = letter, G2 = meaning. */
export const RE_FLAGS_LEGEND_PAIR = /([A-Za-z])\s*-\s*([A-Za-z][A-Za-z -]*)/g;

/** `Columns: ADDRESS, NETWORK, INTERFACE` — v7 narrow-terminal hint. Drop. */
export const RE_COLUMNS_HINT = /^\s*Columns:\s/;

/**
 * `key=value` where value is either quoted or runs to the next whitespace.
 * Use with /g and iterate — one line carries many pairs.
 */
export const RE_KV_EQ = /([a-zA-Z][a-zA-Z0-9._-]*)=("(?:[^"\\]|\\.)*"|[^\s]*)/g;

/**
 * `key: value` — `/system clock print`, `/radius monitor once`,
 * `/interface ethernet monitor once`, `/tool fetch` progress.
 * Splits on the FIRST `:` followed by whitespace, so `time: 09:14:02`
 * yields `time` -> `09:14:02`, not `time` -> `09`.
 */
export const RE_KV_COLON = /^\s*([a-zA-Z][a-zA-Z0-9._-]*)\s*:\s+(.*)$/;

/** Multi-valued probe rows: `route=1.2.3.4;active=true;distance=1`. */
export const RE_SUBFIELD_SPLIT = /;/;

export const RE_IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
export const RE_IPV4_CIDR =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/(?:3[0-2]|[12]?\d)$/;

/** `7.23.3 (stable)`, `6.49.10 (long-term)`, `7.16beta5`. */
export const RE_VERSION = /^(\d+)\.(\d+)(?:\.(\d+))?/;

/** `aug/22/2026` and `2026-08-22`. Both must be accepted. */
export const RE_DATE_LEGACY = /^([a-zA-Z]{3})\/(\d{1,2})\/(\d{4})$/;
export const RE_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `1d2h3m4s`, `5m`, `00:05:00`, `none`, `0s`. */
export const RE_DURATION_CLOCK = /^(\d+):([0-5]?\d):([0-5]?\d)$/;
export const RE_DURATION_UNITS = /^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

// ---------------------------------------------------------------------
// Coercion tables
// ---------------------------------------------------------------------

export const BOOL_TRUE: Lit[] = ["true", "yes", "y", "enabled", "up", "1", "running"];
export const BOOL_FALSE: Lit[] = ["false", "no", "n", "disabled", "down", "0", "not-running", ""];

/** `none` on a timeout means "never" -> Infinity, so any finite max fails. */
export const DURATION_NONE_TOKENS: Lit[] = ["none", "never", "0s", "00:00:00"];

/**
 * Fallback flag letters, used ONLY when the pasted output carried no
 * `Flags:` legend. Prefer the device's own legend in every other case.
 * confidence: standard-routeros — letter meanings are stable across v6/v7
 * for these menus, but v7 renders some of them lowercase.
 */
export const FLAG_LETTER_FALLBACK: Record<Lit, Record<Lit, Lit>> = {
  "/ip route": {
    A: "active",
    I: "inactive",
    D: "dynamic",
    X: "disabled",
    S: "static",
    C: "connect",
    s: "static",
    c: "connect",
  },
  "/ip address": { D: "dynamic", X: "disabled", I: "invalid" },
  "/interface": { R: "running", X: "disabled", D: "dynamic", S: "slave" },
  "/ip firewall filter": { X: "disabled", I: "invalid", D: "dynamic" },
  "/ip hotspot user": { X: "disabled", D: "dynamic" },
  "/certificate": {
    K: "private-key",
    A: "authority",
    T: "trusted",
    I: "issued",
    E: "expired",
    R: "revoked",
  },
};

// ---------------------------------------------------------------------
// Menu fingerprints — the WRONG_OUTPUT registry
// ---------------------------------------------------------------------

/**
 * What each menu's output looks like, so the app can NAME the wrong command
 * the installer ran instead of just rejecting the paste.
 *
 * `uniqueKeys` — keys that essentially only this menu produces.
 * `neverKeys`  — keys that, if present, prove it is NOT this menu.
 *
 * The canonical failure this exists for: the installer is asked for
 * `/ip dhcp-client print detail` and pastes `/interface print`. Both are
 * tabular, both mention `ether1`, both are plausible at a glance. The
 * discriminator is that `/interface print` has `type=` / an `MTU` column
 * and NO `status=bound|searching|stopped`; `/ip dhcp-client print detail`
 * has `status=` and `add-default-route=` and no `type=ether`.
 */
export const MENU_FINGERPRINTS: {
  menu: Lit;
  uniqueKeys: Lit[];
  neverKeys: Lit[];
  headerTokens: Lit[];
  confidence: Confidence;
}[] = [
  {
    menu: "/ip dhcp-client",
    uniqueKeys: ["add-default-route", "use-peer-dns", "dhcp-server", "expires-after"],
    neverKeys: ["actual-mtu", "l2mtu", "type", "ssl-certificate"],
    headerTokens: ["INTERFACE", "USE-PEER-DNS", "ADD-DEFAULT-ROUTE", "STATUS", "ADDRESS"],
    confidence: "standard-routeros",
  },
  {
    menu: "/interface",
    uniqueKeys: ["actual-mtu", "l2mtu", "link-downs", "last-link-up-time"],
    neverKeys: ["add-default-route", "gateway", "address-pool"],
    headerTokens: ["NAME", "TYPE", "ACTUAL-MTU", "L2MTU"],
    confidence: "standard-routeros",
  },
  {
    menu: "/interface ethernet",
    uniqueKeys: ["auto-negotiation", "advertise", "mac-address", "orig-mac-address"],
    neverKeys: ["add-default-route", "address-pool"],
    headerTokens: ["NAME", "MTU", "MAC-ADDRESS", "ARP"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip address",
    uniqueKeys: ["network", "actual-interface"],
    neverKeys: ["add-default-route", "distance", "check-gateway"],
    headerTokens: ["ADDRESS", "NETWORK", "INTERFACE"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip route",
    uniqueKeys: ["dst-address", "distance", "check-gateway", "routing-mark", "gateway-status"],
    neverKeys: ["add-default-route", "address-pool", "ssl-certificate"],
    headerTokens: ["DST-ADDRESS", "GATEWAY", "DISTANCE"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip dns",
    uniqueKeys: ["allow-remote-requests", "cache-size", "cache-used", "dynamic-servers"],
    neverKeys: ["distance", "add-default-route"],
    headerTokens: [],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip pool",
    uniqueKeys: ["ranges", "next-pool"],
    neverKeys: ["address-pool", "lease-time"],
    headerTokens: ["NAME", "RANGES", "NEXT-POOL"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip dhcp-server",
    uniqueKeys: ["address-pool", "lease-time", "authoritative"],
    neverKeys: ["ranges", "add-default-route"],
    headerTokens: ["NAME", "INTERFACE", "ADDRESS-POOL", "LEASE-TIME"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip hotspot",
    uniqueKeys: [
      "address-pool",
      "profile",
      "idle-timeout",
      "keepalive-timeout",
      "addresses-per-mac",
    ],
    neverKeys: ["ranges", "check-gateway"],
    headerTokens: ["NAME", "INTERFACE", "ADDRESS-POOL", "PROFILE"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip hotspot profile",
    uniqueKeys: ["hotspot-address", "html-directory", "login-by", "use-radius", "dns-name"],
    neverKeys: ["ranges", "check-gateway", "add-default-route"],
    headerTokens: ["NAME", "HOTSPOT-ADDRESS", "DNS-NAME", "HTML-DIRECTORY"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip hotspot walled-garden",
    uniqueKeys: ["dst-host", "server", "path"],
    neverKeys: ["dst-address-list", "address-pool"],
    headerTokens: ["ACTION", "SRC-ADDRESS", "DST-HOST", "DST-PORT"],
    confidence: "standard-routeros",
  },
  {
    menu: "/ip hotspot walled-garden ip",
    uniqueKeys: ["dst-address", "dst-address-list"],
    neverKeys: ["dst-host", "check-gateway"],
    headerTokens: ["ACTION", "SRC-ADDRESS", "DST-ADDRESS", "PROTOCOL"],
    confidence: "standard-routeros",
  },
  {
    menu: "/radius",
    uniqueKeys: ["accounting-port", "authentication-port", "called-id", "domain", "realm"],
    neverKeys: ["address-pool", "check-gateway"],
    headerTokens: ["SERVICE", "CALLED-ID", "DOMAIN", "ADDRESS", "SECRET"],
    confidence: "standard-routeros",
  },
  {
    menu: "/radius monitor",
    uniqueKeys: ["pending", "requests", "accepts", "rejects", "resends", "timeouts", "bad-replies"],
    neverKeys: ["address-pool", "dst-address"],
    headerTokens: [],
    confidence: "field",
  },
  {
    menu: "/interface wireguard",
    uniqueKeys: ["private-key", "public-key", "listen-port"],
    neverKeys: ["endpoint-address", "allowed-address", "last-handshake"],
    headerTokens: ["NAME", "MTU", "LISTEN-PORT"],
    confidence: "standard-routeros",
  },
  {
    menu: "/interface wireguard peers",
    uniqueKeys: [
      "endpoint-address",
      "endpoint-port",
      "allowed-address",
      "last-handshake",
      "persistent-keepalive",
    ],
    neverKeys: ["private-key", "listen-port"],
    headerTokens: ["INTERFACE", "PUBLIC-KEY", "ENDPOINT-ADDRESS", "ALLOWED-ADDRESS"],
    confidence: "standard-routeros",
  },
  {
    menu: "/certificate",
    uniqueKeys: [
      "common-name",
      "key-usage",
      "invalid-before",
      "invalid-after",
      "fingerprint",
      "serial-number",
    ],
    neverKeys: ["address-pool", "gateway"],
    headerTokens: ["NAME", "COMMON-NAME", "SUBJECT-ALT-NAME"],
    confidence: "standard-routeros",
  },
  {
    menu: "/system resource",
    uniqueKeys: ["board-name", "architecture-name", "free-memory", "cpu-load", "version"],
    neverKeys: ["gateway", "address-pool"],
    headerTokens: [],
    confidence: "standard-routeros",
  },
  {
    menu: "/system clock",
    uniqueKeys: ["time-zone-name", "gmt-offset", "dst-active"],
    neverKeys: ["gateway", "address-pool"],
    headerTokens: [],
    confidence: "standard-routeros",
  },
  {
    menu: "/system scheduler",
    uniqueKeys: ["on-event", "run-count", "next-run", "start-time"],
    neverKeys: ["gateway", "address-pool"],
    headerTokens: ["NAME", "START-TIME", "INTERVAL", "ON-EVENT", "RUN-COUNT"],
    confidence: "standard-routeros",
  },
  {
    menu: "/file",
    uniqueKeys: ["contents", "creation-time", "package-version"],
    neverKeys: ["gateway", "address-pool"],
    headerTokens: ["NAME", "TYPE", "SIZE", "CREATION-TIME"],
    confidence: "standard-routeros",
  },
];

// ---------------------------------------------------------------------
// Emptiness — the rule that stops "no output" scoring as PASS
// ---------------------------------------------------------------------

/**
 * A `print` that matched nothing and a paste the installer forgot to make
 * look almost identical: both are blank. They are NOT the same verdict.
 *
 *  - ZERO non-blank lines after stage 3, and no sentinel at all
 *      -> INCOMPLETE_OUTPUT. Never FAIL. Ask again, and ask specifically
 *         for the prompt line to be included.
 *  - Sentinels present, but a `count=` fact is `0`
 *      -> a REAL, TRUSTWORTHY empty set. Score it per the step's outcomes
 *         (usually FAIL — the config was never created).
 *  - Sentinels present and every fact present
 *      -> normal scoring.
 *  - No sentinel, but a `Flags:` legend or a column header line is present
 *    with zero records
 *      -> a real empty set from a hand-typed raw print. UNKNOWN, and ask
 *         for the sentinel-bracketed probe instead.
 *
 * This is the direct defence against `set [find ...]` silent success:
 * the wizard never infers existence from the absence of an error.
 */
export const EMPTINESS_RULES: { condition: Lit; verdict: Lit; why: T }[] = [
  {
    condition: "bannerOpen && !bannerClose",
    verdict: "INCOMPLETE_OUTPUT",
    why: "The output starts but never finishes. Checked before any value is read, so a half-pasted screen can never be scored as a result.",
  },
  {
    condition: "bannerOpen && bannerTitle !== expectedBannerTitle",
    verdict: "WRONG_OUTPUT",
    why: "The banner names a different check than the one this step asked for. Tell the operator which one they ran.",
  },
  {
    condition: "legacySelfReport && evidenceContradictsIt",
    verdict: "FAIL",
    why: "A block that printed its own result is only believed when the evidence lines above it agree. A claimed success sitting above contradicting evidence is a failure, not a success.",
  },
  {
    condition: "nonBlankLines === 0",
    verdict: "INCOMPLETE_OUTPUT",
    why: "Nothing was pasted, or the copy missed the output. This is not proof that the router printed nothing.",
  },
  {
    condition: "sentinelBegin && !sentinelEnd",
    verdict: "INCOMPLETE_OUTPUT",
    why: "The copy started but did not reach the end of the output. Select down to the WYFY-END line and paste again.",
  },
  {
    condition: "sentinelBegin && sentinelId !== expectedSentinelId",
    verdict: "WRONG_OUTPUT",
    why: "This is another step's output. Run the command shown on this step.",
  },
  {
    condition: "sentinels ok && fact('count') === 0",
    verdict: "per-step outcome",
    why: "A trustworthy empty result: the router really has no matching item. This almost always means a configuration command silently did nothing.",
  },
  {
    condition: "!sentinelBegin && (flagsLegend || headerLine) && records === 0",
    verdict: "UNKNOWN",
    why: "A raw print that matched nothing. Re-run the step's own check command so the result can be scored properly.",
  },
  {
    condition: "!sentinelBegin && !flagsLegend && !headerLine && nonBlankLines > 0",
    verdict: "WRONG_OUTPUT",
    why: "Text was pasted, but it is not the output of the command this step asked for.",
  },
];

// ---------------------------------------------------------------------
// Version-dependent syntax
// ---------------------------------------------------------------------

/**
 * Places where v6 and v7 genuinely differ and the wizard must branch on the
 * parsed `version` fact from step 1. Anything not listed here is assumed
 * identical — and that assumption is itself flagged `unverified` for any
 * v6 box, because this fleet is 7.23.3 and no v6 device was available.
 */
export const VERSION_BRANCHES: {
  topic: Lit;
  v7: Lit;
  v6: Lit;
  note: T;
  confidence: Confidence;
}[] = [
  {
    topic: "ntp-client",
    v7: "/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1",
    v6: "/system ntp client set enabled=yes primary-ntp=216.239.35.0 secondary-ntp=162.159.200.1",
    note: "The servers= form does not exist on RouterOS 6. Sending it there returns an unknown-parameter error, and the clock is never set — which then breaks the heartbeat scheduler silently.",
    confidence: "standard-routeros",
  },
  {
    topic: "wireguard",
    v7: "/interface wireguard add name=wg-cloudguest ...",
    v6: "(not available)",
    note: "WireGuard does not exist on RouterOS 6 at all. On a v6 device the tunnel step returns a bad-command-name error and the router cannot be onboarded until it is upgraded.",
    confidence: "standard-routeros",
  },
  {
    topic: "date-format",
    v7: "2026-08-22",
    v6: "aug/22/2026",
    note: "RouterOS switched the printed date format around 7.10. Both forms must parse; neither may be string-compared.",
    confidence: "standard-routeros",
  },
  {
    topic: "route-flags",
    v7: "0  As  0.0.0.0/0",
    v6: " 0 A S  0.0.0.0/0",
    note: "Flag letters are adjacent on 7 and space-separated on 6, and 7 lowercases some of them. Always resolve letters against the Flags: legend the device printed.",
    confidence: "standard-routeros",
  },
  {
    topic: "print-without-paging",
    v7: "/ip route print without-paging",
    v6: "/ip route print without-paging",
    note: "Same on both. Every command this wizard emits includes it, so a long output is never truncated by the terminal pager.",
    confidence: "standard-routeros",
  },
];

// ---------------------------------------------------------------------
// Notes a builder must not lose
// ---------------------------------------------------------------------

export const PARSER_INVARIANTS: T[] = [
  "Probes emit evidence; verdicts are derived in code. A probe written for this module prints facts and never computes its own PASS or FAIL, because a verdict computed in RouterOS script cannot be unit-tested, cannot be varied by version, and cannot be corrected without an operator re-pasting a new block.",
  "Where a legacy block does self-report a result, that result is treated as a claim and never as an authority: it is accepted only when the evidence lines printed above it agree with it, and it is scored as a failure when they contradict it.",
  "A missing required fact is INCOMPLETE_OUTPUT, never PASS and never FAIL.",
  "An empty match reported by an explicit count is trustworthy. An empty paste is not.",
  "0.0.0.0 is a value, not an absence. Any gateway check must reject it explicitly.",
  "Never compare a duration, a comma list, or a flag column as a string.",
  "Never score a value read out of a wide table. Score only values a probe printed on their own short line.",
  "When two readings disagree, the verdict is UNKNOWN and the wizard asks for one more command. It never picks the more optimistic reading.",
];
