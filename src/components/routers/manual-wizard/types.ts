/**
 * Manual MikroTik Configuration Wizard — the contract.
 *
 * Loop this module describes:
 *   app shows a command -> installer runs it on the router ->
 *   installer pastes the RAW terminal output back ->
 *   app parses it and returns a Verdict -> app produces the next command
 *   or a fix.
 *
 * ---------------------------------------------------------------------
 * THE ONE RULE THAT MATTERS
 * ---------------------------------------------------------------------
 * The DEVICE prints EVIDENCE. The APP derives the VERDICT.
 *
 * A probe in this module prints a `count=`, a `status=`, a `gateway=` and
 * stops there. It never computes its own result, because a verdict computed
 * in RouterOS script cannot be unit-tested, cannot be varied by RouterOS
 * version, and cannot be corrected without sending an operator a new block
 * to paste.
 *
 * The existing `guided-setup/phases.content.ts` blocks DO print
 * `RESULT: PASS` themselves, and they stay as they are: they are field-
 * tested against real hardware, and the analyser already treats that line
 * as a CLAIM rather than an authority — accepting it only when the evidence
 * lines above it agree, and scoring it as a failure when they contradict
 * it. Corroborated evidence is not the same thing as a self-declared
 * verdict, and it is the corroboration that makes the difference.
 *
 * What this rule is really guarding against is the failure this product
 * actually had: a `:if` guard skipped a block, nothing errored, the block
 * printed PASS, and nobody found out for months. A result nobody checks
 * against evidence is not a result.
 *
 * Probes here are additionally wrapped in the `==== TITLE ====` /
 * `====================` banner pair the analyser uses to detect a
 * truncated paste and to name which command was actually run. The `WYFY-*`
 * sentinels sit inside that pair and add the step id, which is the only
 * thing that catches output from the right command pasted at the wrong
 * step. Both are required.
 *
 * Corollaries, all encoded in the types below:
 *  - Every probe that inspects a set emits an explicit `count=`.
 *    `set [find ...]` against an empty match SUCCEEDS AND REPORTS NOTHING;
 *    the only defence is a separate existence check that the app scores.
 *  - Absence of a required fact is INCOMPLETE_OUTPUT, never PASS and never
 *    FAIL. "I didn't see a problem" is not "there is no problem".
 *  - Every probe is bracketed by a sentinel naming the step. Output from
 *    the wrong command, or the right command for a different step, is
 *    WRONG_OUTPUT.
 *
 * ---------------------------------------------------------------------
 * BILINGUAL (English / Hindi)
 * ---------------------------------------------------------------------
 * Two string aliases carry the whole i18n contract:
 *   `T`   -> TRANSLATE. English is the source; Hindi translation required.
 *   `Lit` -> NEVER TRANSLATE. Commands, syntax, IPs, interface names,
 *            config values, RouterOS error text, key names.
 * `TRANSLATABLE_FIELD_PATHS` at the bottom is the machine-readable list an
 * extraction script consumes. If you add a field, add it there.
 *
 * A `T` string must never be interpolated into a command, and a `Lit`
 * string must never be sent to a translator. Where a sentence has to name
 * a command, the sentence is `T` and the command is a separate `Lit`
 * field the UI renders in a code span — never inline in the prose.
 */

/** TRANSLATE. English source text; Hindi translation required. */
export type T = string;

/** DO NOT TRANSLATE. Verbatim device/protocol text. */
export type Lit = string;

// ---------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------

/**
 * PASS              — every required fact present, pass predicate true.
 * WARNING           — pass predicate true, but something is off that will
 *                     bite later (unsynced NTP with a sane clock, portal IP
 *                     differs from the expected one, run-count still 0).
 *                     The wizard advances but records it.
 * FAIL              — a required fact contradicts the expected state.
 *                     Actionable: there is a fix or a next command.
 * UNKNOWN           — output parsed, fingerprint matched, but the facts do
 *                     not determine the answer (a counter with no baseline,
 *                     a step whose truth only a phone can establish).
 *                     NEVER collapse UNKNOWN into PASS.
 * INCOMPLETE_OUTPUT — the right command, but not all of it: missing END
 *                     sentinel, terminal paging marker, a required key
 *                     absent, zero non-blank lines. Ask for a re-paste.
 * WRONG_OUTPUT      — the installer ran a different command. Never scores
 *                     as anything else, and specifically never as PASS.
 */
export type Verdict =
  | "PASS"
  | "WARNING"
  | "FAIL"
  | "UNKNOWN"
  | "INCOMPLETE_OUTPUT"
  | "WRONG_OUTPUT";

/** How much a builder may trust a given rule. Anything not confirmable
 * from the repo or a recorded live session is labelled honestly. */
export type Confidence =
  /** Read out of the shipping generator in this repo. */
  | "generator"
  /** Confirmed on real hardware; recorded in a project memory. */
  | "field"
  /** Stated by the product owner for this feature. */
  | "briefed"
  /** Documented RouterOS behaviour, not re-tested on the fleet's 7.23.3. */
  | "standard-routeros"
  /** Best inference. MUST be confirmed on a device before shipping. */
  | "unverified";

// ---------------------------------------------------------------------
// Facts — what the app extracts from one paste
// ---------------------------------------------------------------------

/**
 * How a raw value is coerced before any comparison. Chosen so that NO rule
 * in this module ever does an exact-string compare on a device value.
 *
 * "bool"     — accepts yes/no/true/false/enabled/disabled, any case.
 * "duration" — accepts `HH:MM:SS`, `1d2h3m4s` in any combination, a bare
 *              integer (seconds), and the literal `none` (-> Infinity).
 *              `00:05:00` and `5m` are the SAME value; never string-match.
 * "csv"      — comma or semicolon separated -> a SET. Order is not stable
 *              across RouterOS versions (`login-by=https,http-pap` vs
 *              `http-pap,https`); compare by membership only.
 * "flags"    — the flag column of a `print` table, e.g. `As` / `A S` / `XI`.
 *              Resolved against the `Flags:` legend the device itself
 *              printed, not a hard-coded letter table. See parsing.rules.ts.
 * "datetime" — RouterOS prints `aug/22/2026` (<= 7.9) or `2026-08-22`
 *              (>= 7.10, ISO). Both must parse.
 * "version"  — `7.23.3 (stable)` -> {major:7, minor:23, patch:3}.
 */
export type FactType =
  | "string"
  | "int"
  | "bool"
  | "ipv4"
  | "ipv4cidr"
  | "duration"
  | "csv"
  | "flags"
  | "datetime"
  | "version";

export type Fact = {
  /** Key exactly as the probe emits it. NOT translated. */
  key: Lit;
  type: FactType;
  /** The same key may be emitted once per matched row (`eth=`, `route=`).
   * Repeated keys collect into an array; sub-fields inside one value are
   * `;`-separated `k=v` pairs. */
  multi?: boolean;
  /** Missing && required  => INCOMPLETE_OUTPUT.
   * Missing && !required  => the fact is simply absent, which some
   * predicates ("absent") legitimately test for. */
  required: boolean;
  /** TRANSLATE — shown next to the parsed value in the UI. */
  describe: T;
};

// ---------------------------------------------------------------------
// Predicates — how a verdict is computed from facts
// ---------------------------------------------------------------------

/**
 * A tiny declarative language so no scoring logic lives in prose. All
 * comparisons run on COERCED values (see FactType), never raw text.
 *
 * `key` may address a sub-field of a multi-valued fact with `fact[].sub`,
 * e.g. `route[].active`. The `some` / `every` ops quantify over rows.
 */
export type Predicate =
  | { op: "present"; key: Lit }
  | { op: "absent"; key: Lit }
  | { op: "eq"; key: Lit; value: Lit | number | boolean }
  | { op: "neq"; key: Lit; value: Lit | number | boolean }
  | { op: "gte"; key: Lit; value: number }
  | { op: "lte"; key: Lit; value: number }
  | { op: "in"; key: Lit; values: (Lit | number)[] }
  | { op: "notIn"; key: Lit; values: (Lit | number)[] }
  /** JS regex source, applied to the RAW string. Use sparingly — a regex
   * on device output is the brittle path this module exists to avoid. */
  | { op: "matches"; key: Lit; regex: Lit }
  /** Valid dotted-quad AND not 0.0.0.0 when `excludeUnspecified`.
   * `0.0.0.0 != ""` is exactly why the obvious guard let the dead route
   * through — this op is the fix. */
  | { op: "isIpv4"; key: Lit; excludeUnspecified: boolean }
  /** Set membership for "csv" and "flags". */
  | { op: "contains"; key: Lit; value: Lit }
  | { op: "notContains"; key: Lit; value: Lit }
  /** Duration in seconds, inclusive bounds. `none` parses to Infinity and
   * therefore fails any finite `max`. */
  | { op: "durationBetween"; key: Lit; minSeconds: number; maxSeconds: number }
  /** Parsed date within `days` of the APP's own clock. The app knows real
   * time; the router does not. */
  | { op: "dateNear"; key: Lit; days: number }
  /** Two CIDRs must not overlap (LAN vs. the WAN's leased subnet). */
  | { op: "noOverlap"; key: Lit; otherKey: Lit }
  /** Quantify over the rows of a multi-valued fact. */
  | { op: "some"; key: Lit; of: Predicate }
  | { op: "every"; key: Lit; of: Predicate }
  | { op: "countEq"; key: Lit; value: number }
  | { op: "all"; of: Predicate[] }
  | { op: "any"; of: Predicate[] }
  | { op: "not"; of: Predicate };

/**
 * CROSS-FACT COMPARISON. A `value` beginning with `$` is not a literal —
 * it names another fact from the SAME paste, and the comparison is made
 * against that fact's coerced value.
 *
 *   { op: "eq", key: "radius-src", value: "$tunnel-ip" }
 *
 * reads as "the address RADIUS sends from must equal the address this
 * router holds inside the tunnel". Writing the tunnel address as a literal
 * would be wrong — it differs per router.
 *
 * Rules the builder must implement:
 *  - If the referenced fact is absent, the predicate is neither true nor
 *    false: the result is INCOMPLETE_OUTPUT, not FAIL.
 *  - Only one level of indirection. A fact whose value itself starts with
 *    `$` is compared literally.
 *  - Inside `some` / `every`, `$name` still refers to a TOP-LEVEL fact,
 *    never to a sibling sub-field of the current row. Sub-fields are
 *    addressed as `fact[].sub`.
 */
export const CROSS_FACT_PREFIX = "$";

// ---------------------------------------------------------------------
// WRONG_OUTPUT detection
// ---------------------------------------------------------------------

/**
 * Three independent signals. Any ONE firing is enough for WRONG_OUTPUT;
 * the app reports whichever fired so the message is specific
 * ("this looks like `/interface print`") rather than "try again".
 *
 * 1. SENTINEL      — the probe's own `WYFY-BEGIN <stepId>` / `WYFY-END`.
 *                    Strongest. Wrong stepId in the sentinel means the
 *                    installer pasted a different step's output.
 * 2. ECHOED PROMPT — many installers copy the prompt line too
 *                    (`[admin@MikroTik] > /ip dhcp-client print detail`).
 *                    When present, the echoed menu path is compared to
 *                    `expectedMenu`.
 * 3. FINGERPRINT   — required/forbidden keys and table headers unique to
 *                    the asked-for menu.
 */
export type OutputFingerprint = {
  /** Value the probe brackets its output with, e.g. `step03-dhcp`. */
  sentinelId: Lit;
  /** RouterOS menu path the asked-for command lives under. */
  expectedMenu: Lit;
  /** All of these keys must appear between the sentinels. */
  requireAllKeys: Lit[];
  /** At least one of these must appear (version-dependent keys). */
  requireAnyKeys?: Lit[];
  /** Any of these appearing means a DIFFERENT menu's output was pasted. */
  forbidKeys?: Lit[];
  /** Column headers, for steps whose context output is a raw table. */
  tableHeaderTokens?: Lit[];
  /** TRANSLATE — one sentence the installer can act on. */
  discriminator: T;
  /** Named lookalikes, so the app can say which wrong command was run. */
  commonWrongPastes: {
    menu: Lit;
    /** Literal token that gives the wrong menu away. */
    tell: Lit;
    /** TRANSLATE. */
    sayInstead: T;
  }[];
};

// ---------------------------------------------------------------------
// Outcomes and fixes
// ---------------------------------------------------------------------

/**
 * A repair. `destructive` is a hard gate, not documentation: the UI may
 * not offer a `destructive: true` fix without an explicit typed
 * confirmation naming what will be lost.
 *
 * Global bans, enforced in `resolver.content.ts` -> `NEVER_AUTO_RUN`:
 *  - no `/system reset-configuration` without explicit operator confirmation
 *  - no `remove [find]` with an empty or absent `where` clause
 *  - never touch a row whose `comment` is not in FLEET_DEFAULTS.ownedComments
 */
export type FixAction = {
  command: Lit;
  /** TRANSLATE — what this does and why it is safe. */
  note: T;
  destructive: boolean;
  /** Required when `destructive`. TRANSLATE — names exactly what is lost. */
  confirmPrompt?: T;
  confidence: Confidence;
};

/**
 * One realistic non-pass reading. Evaluated in array order; FIRST MATCH
 * WINS, so order them most-specific first.
 *
 * `nextCommand` is a DIAGNOSTIC, not a repair — the whole point is that the
 * wizard never guesses. It asks for one more piece of evidence, says what
 * to look for in it, and only then offers `fix`.
 */
export type Outcome = {
  id: Lit;
  verdict: Exclude<Verdict, "PASS">;
  when: Predicate;
  /** TRANSLATE — what this actually means, in this product's context. */
  meaning: T;
  /** Diagnostic to run next. Omitted when the outcome is already conclusive. */
  nextCommand?: Lit;
  /** TRANSLATE — what to look for in `nextCommand`'s output. */
  lookFor?: T;
  fix?: FixAction[];
  /** Key into RESOLVER in `resolver.content.ts`. */
  resolverRef?: Lit;
  confidence: Confidence;
};

// ---------------------------------------------------------------------
// A step
// ---------------------------------------------------------------------

export type ManualStep = {
  id: Lit;
  /** 1..18. Several entries may share an `n` when they are variants. */
  n: number;
  /** Set when this step is one of several mutually exclusive forms
   * (WAN: dhcp | static | pppoe). The app picks one. */
  variant?: Lit;
  /** TRANSLATE — when this variant applies. */
  selectWhen?: T;

  /** TRANSLATE. */
  title: T;
  /** TRANSLATE — why this step exists at all. */
  why: T;
  /** Step ids that must be PASS/WARNING before this one is meaningful. */
  dependsOn: Lit[];
  estMinutes: number;
  /** Mints or consumes something that cannot be re-issued. */
  oncePerRouter: boolean;

  /** Commands that CONFIGURE. Empty when the per-router chunk comes from
   * Master console (WireGuard keys, RADIUS secret, portal URL). */
  configure: { label: T; script: Lit; oncePerRouter: boolean }[];

  /** The validation command. Exact, paste-able, sentinel-bracketed, and
   * emitting only facts — never a verdict. */
  probe: { command: Lit; emits: Fact[] };

  /** Raw commands whose output is shown to the installer for context and
   * attached to a support ticket, but NOT scored. */
  contextCommands?: { command: Lit; purpose: T }[];

  fingerprint: OutputFingerprint;

  pass: {
    when: Predicate;
    /** TRANSLATE. */
    means: T;
  };

  outcomes: Outcome[];

  /** TRANSLATE — set when the flow must not advance past a non-PASS here. */
  stopGate?: T;
};

// ---------------------------------------------------------------------
// Error resolver
// ---------------------------------------------------------------------

/** One rung of a diagnostic ladder: run this, look for that. */
export type DiagnosticStep = {
  command: Lit;
  /** TRANSLATE — what to look for. */
  lookFor: T;
  /** Readings of that output and where each one leads. */
  branches: {
    /** Literal token in the output that selects this branch. */
    tell: Lit;
    /** TRANSLATE. */
    means: T;
    /** Index of the next DiagnosticStep, or -1 to stop and apply `fix`. */
    thenStepIndex: number;
    fix?: FixAction[];
  }[];
};

export type ResolverEntry = {
  id: Lit;
  /** The RouterOS error text, verbatim. Matched case-insensitively on a
   * normalised substring — RouterOS appends context and numeric codes
   * (`no such item (4)`), and wording drifts between v6 and v7. */
  errorText: Lit;
  /** Extra literal variants of the same error. */
  aliases?: Lit[];
  /** TRANSLATE — what it means IN THIS PRODUCT, not in general. */
  meansHere: T;
  /** Steps this error realistically appears in. */
  seenInSteps: Lit[];
  /** The ladder. Never a guess, never a fix at rung 0. */
  sequence: DiagnosticStep[];
  /** TRANSLATE — what must never be done in response to this error. */
  doNot: T[];
  confidence: Confidence;
};

// ---------------------------------------------------------------------
// i18n extraction contract
// ---------------------------------------------------------------------

/**
 * Field paths whose values are English source strings needing a Hindi
 * translation. Everything not listed here is a device/protocol literal and
 * MUST be shipped byte-identical in both locales.
 *
 * Paths use `*` for array indices.
 */
export const TRANSLATABLE_FIELD_PATHS: Lit[] = [
  "MANUAL_STEPS.*.title",
  "MANUAL_STEPS.*.why",
  "MANUAL_STEPS.*.selectWhen",
  "MANUAL_STEPS.*.stopGate",
  "MANUAL_STEPS.*.configure.*.label",
  "MANUAL_STEPS.*.probe.emits.*.describe",
  "MANUAL_STEPS.*.contextCommands.*.purpose",
  "MANUAL_STEPS.*.fingerprint.discriminator",
  "MANUAL_STEPS.*.fingerprint.commonWrongPastes.*.sayInstead",
  "MANUAL_STEPS.*.pass.means",
  "MANUAL_STEPS.*.outcomes.*.meaning",
  "MANUAL_STEPS.*.outcomes.*.lookFor",
  "MANUAL_STEPS.*.outcomes.*.fix.*.note",
  "MANUAL_STEPS.*.outcomes.*.fix.*.confirmPrompt",
  "RESOLVER.*.meansHere",
  "RESOLVER.*.doNot.*",
  "RESOLVER.*.sequence.*.lookFor",
  "RESOLVER.*.sequence.*.branches.*.means",
  "RESOLVER.*.sequence.*.branches.*.fix.*.note",
  "RESOLVER.*.sequence.*.branches.*.fix.*.confirmPrompt",
  "VERDICT_COPY.*.headline",
  "VERDICT_COPY.*.body",
];

/**
 * Field paths that are DEVICE LITERALS. A translator must never see these,
 * and a test should assert the Hindi bundle's values are byte-identical to
 * the English bundle's for every path here.
 */
export const NEVER_TRANSLATE_FIELD_PATHS: Lit[] = [
  "MANUAL_STEPS.*.id",
  "MANUAL_STEPS.*.variant",
  "MANUAL_STEPS.*.configure.*.script",
  "MANUAL_STEPS.*.probe.command",
  "MANUAL_STEPS.*.probe.emits.*.key",
  "MANUAL_STEPS.*.contextCommands.*.command",
  "MANUAL_STEPS.*.fingerprint.sentinelId",
  "MANUAL_STEPS.*.fingerprint.expectedMenu",
  "MANUAL_STEPS.*.fingerprint.requireAllKeys.*",
  "MANUAL_STEPS.*.fingerprint.requireAnyKeys.*",
  "MANUAL_STEPS.*.fingerprint.forbidKeys.*",
  "MANUAL_STEPS.*.fingerprint.tableHeaderTokens.*",
  "MANUAL_STEPS.*.fingerprint.commonWrongPastes.*.menu",
  "MANUAL_STEPS.*.fingerprint.commonWrongPastes.*.tell",
  "MANUAL_STEPS.*.outcomes.*.nextCommand",
  "MANUAL_STEPS.*.outcomes.*.fix.*.command",
  "MANUAL_STEPS.*.pass.when",
  "MANUAL_STEPS.*.outcomes.*.when",
  "RESOLVER.*.errorText",
  "RESOLVER.*.aliases.*",
  "RESOLVER.*.sequence.*.command",
  "RESOLVER.*.sequence.*.branches.*.tell",
  "RESOLVER.*.sequence.*.branches.*.fix.*.command",
  "FLEET_DEFAULTS.*",
];

/**
 * DEVICE TOKENS INSIDE TRANSLATABLE PROSE — the sharpest i18n edge here.
 *
 * A `T` string is translated. But some `T` strings have to name a token the
 * operator will hunt for in real device output: the flag letters `As` and
 * `Is`, the status word `bound`, a timeout written `00:05:00`, an interface
 * called `ether1`. If a translator renders any of those into Hindi, the
 * operator searches the router's output for a word that will never appear
 * there. That is worse than shipping no Hindi at all, because it looks
 * authoritative and sends them somewhere with confidence.
 *
 * The rule: a device token appearing inside a `T` string is wrapped in
 * double braces and left untranslated.
 *
 *   lookFor: "Look at the flags. {{As}} means the route is carrying
 *             traffic; {{Is}} means it is dead."
 *
 * The translator's tooling must treat `{{...}}` as opaque. Two tests are
 * required, and neither is optional:
 *   1. Every `{{...}}` placeholder present in an English string is present,
 *      byte-identical, in its Hindi counterpart.
 *   2. No string listed under `NEVER_TRANSLATE_FIELD_PATHS` differs at all
 *      between the English and Hindi bundles.
 *
 * Prose written BEFORE this convention existed (the `lookFor` and `meaning`
 * strings across `steps.part*.ts` and `resolver.content.ts`) mostly avoids
 * bare tokens by describing them instead — "the flag letters the legend maps
 * to active" rather than "`As`". Where a bare token does survive, wrapping
 * it is a mechanical pass over those files and MUST happen before any string
 * is handed to a translator. Until that pass is done, treat this convention
 * as declared but not yet enforced across the content.
 */
export const TOKEN_PLACEHOLDER_RE = /\{\{([^{}]+)\}\}/g;

/**
 * Tokens that must never be translated, wherever they appear. Used to lint
 * translatable prose: an English `T` string containing one of these OUTSIDE
 * a `{{...}}` wrapper is a bug in the content, not in the translation.
 *
 * NOT exhaustive — it is the set an operator is actually asked to match
 * against real output.
 */
export const PROTECTED_TOKENS: Lit[] = [
  // route / interface flag letters
  "As",
  "Is",
  "XI",
  // status words the operator matches literally
  "bound",
  "searching...",
  "no-link",
  "link-ok",
  "synchronized",
  "established",
  "connected",
  // durations and numeric literals in device format
  "00:05:00",
  "5m",
  "3s",
  "25s",
  "0.0.0.0",
  "0.0.0.0/0",
  // interface, object and file names
  "ether1",
  "ether2",
  "bridge",
  "bridge1",
  "bridgeLocal",
  "wg-cloudguest",
  "wg-cloudguard",
  "hsprof1",
  "hotspot1",
  "hotspot-pool",
  "hotspot-dhcp",
  "cloudguest-api",
  "cloudguest-ca",
  "cloudguest-hotspot-cert",
  "login.html",
  "flash/hotspot/login.html",
  "hotspot/login.html",
  // config values
  "http-pap",
  "http-chap",
  "cookie",
  "https",
  "none",
  // hostnames and addresses
  "wifi.wyfyguest.com",
  "portal.wyfyguest.com",
  "hub.wyfyguest.com",
  "10.5.50.1",
  "10.20.0.1",
  "40.80.86.193",
  // counter names
  "accepts",
  "rejects",
  "timeouts",
  "bad-replies",
];

/** Verdict-level UI copy. TRANSLATE both fields. */
export const VERDICT_COPY: Record<Verdict, { headline: T; body: T }> = {
  PASS: {
    headline: "Looks right",
    body: "Every value this step needs is present and correct. Move on.",
  },
  WARNING: {
    headline: "Working, but note this",
    body: "This step passed, but something here will cause trouble later. Read the note before you continue.",
  },
  FAIL: {
    headline: "Not right yet",
    body: "A value on the router does not match what this step needs. Follow the fix below, then run the check again.",
  },
  UNKNOWN: {
    headline: "Cannot tell from this",
    body: "The output was read correctly, but it does not answer the question on its own. The next command below will.",
  },
  INCOMPLETE_OUTPUT: {
    headline: "Only part of the output came through",
    body: "Select everything from the first line to the last line, including the WYFY-BEGIN and WYFY-END lines, and paste it again.",
  },
  WRONG_OUTPUT: {
    headline: "That is a different command's output",
    body: "Copy the command from this step exactly as shown, run that one, and paste what it prints.",
  },
};
