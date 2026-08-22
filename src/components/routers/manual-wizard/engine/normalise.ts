/**
 * Manual wizard engine — the normalisation pipeline, stages 0 to 8.
 *
 * Implements exactly the pipeline written down in `parsing.rules.ts`.
 * Stage numbers in the comments below are that file's numbers; if the two
 * ever disagree, `parsing.rules.ts` is the specification and this file is
 * the bug.
 *
 *   0. GUARD          size and binary rejection
 *   1. DECODE         BOM, CRLF, ANSI, backspace overstrike
 *   2. DEPAGE         terminal pager markers
 *   3. STRIP PROMPTS  and record every echoed command first
 *   3b. BANNER PAIR   `==== TITLE ====` / `====================`
 *   4. SENTINEL SLICE last WYFY-BEGIN, first WYFY-END after it
 *   5. UNWRAP         soft-wrapped lines
 *   6. LEGEND         the device's own `Flags:` line
 *   7. RECORDS        `print` rows, with their `;;;` comments
 *   8. KV             `key=value` and `key: value`
 *
 * ---------------------------------------------------------------------
 * MIRRORS `guided-setup/analyse.ts`
 * ---------------------------------------------------------------------
 * `parseOutput` in `guided-setup/analyse.ts` already solves this problem
 * and has run against real fleet output. This file deliberately keeps its
 * vocabulary — `ParsedRecord`, `legend`, `flagsUnresolved`, `kv`,
 * `echoedCommands` — and its stage ordering, so that when the two modules
 * are merged onto one runtime the shapes line up instead of having to be
 * translated. Where this file differs it is because `parsing.rules.ts`
 * specifies something `analyse.ts` does not do (the sentinel slice, the
 * banner pair as a truncation test, the `;`-separated multi-row form).
 *
 * One naming divergence that is NOT an accident and must survive a merge:
 * `analyse.ts` calls the truncated-paste verdict `INCOMPLETE`, and
 * `manual-wizard/types.ts` calls it `INCOMPLETE_OUTPUT`. This engine uses
 * its own module's spelling because `types.ts` is its contract.
 *
 * ---------------------------------------------------------------------
 * ONE DEVIATION FROM THE SPEC, DECLARED
 * ---------------------------------------------------------------------
 * Stage 5 is specified in terms of a constant named `RE_KV_LINE`, which
 * `parsing.rules.ts` never exports. `looksLikeKvLine` below is this file's
 * reading of what that constant was meant to be: a line that RE_KV_EQ
 * matches from its first non-blank character, or that RE_KV_COLON matches.
 * Flagged rather than silently invented.
 *
 * ---------------------------------------------------------------------
 * ORDER MATTERS IN ONE NON-OBVIOUS PLACE
 * ---------------------------------------------------------------------
 * `RE_BANNER_OPEN` also matches a bare row of twenty `=` characters — its
 * `(.+?)` group happily eats the middle of them. So the CLOSING banner is
 * tested first and an opening banner is only considered on a line that is
 * not a closing one. Getting this backwards makes every complete paste
 * look like an unterminated one.
 */

import type { Lit } from "../types";
import {
  MAX_PASTE_BYTES,
  RE_ANSI,
  RE_BACKSPACE_RUN,
  RE_BANNER_CLOSE,
  RE_BANNER_OPEN,
  RE_COLUMNS_HINT,
  RE_FLAGS_LEGEND,
  RE_FLAGS_LEGEND_PAIR,
  RE_KV_COLON,
  RE_KV_EQ,
  RE_PAGING_PROMPT,
  RE_PROMPT_COMMAND,
  RE_PROMPT_LINE,
  RE_RECORD_START,
  RE_SEMI_COMMENT,
  RE_SENTINEL_BEGIN,
  RE_SENTINEL_END,
  RE_SUBFIELD_SPLIT,
} from "../parsing.rules";

// ---------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------

/** A hard stop found before anything could be parsed. */
export type GuardProblem = "too-large" | "binary";

export type EchoedCommand = { menu: Lit; command: Lit };

export type ParsedRecord = {
  index: number;
  rawFlags: Lit;
  /** Resolved flag meanings, lowercased. Null means NO LEGEND WAS
   * AVAILABLE — "cannot tell", never "this row has no flags". Mirrors
   * `flagsUnresolved` in `guided-setup/analyse.ts`. */
  flagMeanings: string[] | null;
  unresolvedFlagLetters: string[];
  kv: Record<Lit, Lit>;
  comment: Lit | null;
  raw: Lit;
};

export type BannerState = {
  open: boolean;
  /** The title the device printed, which names what was actually run. */
  title: Lit | null;
  close: boolean;
};

export type SentinelState = {
  begin: Lit | null;
  end: Lit | null;
  /** True when a BEGIN line appeared more than once — a terminal echoing
   * the pasted script. The LAST one is the real output. */
  duplicated: boolean;
};

export type NormalisedPaste = {
  guard: GuardProblem | null;
  bytes: number;
  /** Cleaned, de-paged, prompt-stripped lines — the whole paste. */
  lines: Lit[];
  nonBlankLines: number;
  paged: boolean;
  echoedCommands: EchoedCommand[];
  banner: BannerState;
  sentinel: SentinelState;
  /** The scored region: between the sentinels when both are present,
   * after BEGIN when END is missing, the whole paste when neither is. */
  body: Lit[];
  legend: Record<Lit, Lit> | null;
  hasHeaderLine: boolean;
  records: ParsedRecord[];
  /** Free-line `key=value` pairs, in the order the device printed them.
   * Repeated keys accumulate; that is what a `multi` fact reads. */
  kv: Record<Lit, Lit[]>;
  /** A `RESULT: ...` line from a legacy self-reporting block. Recorded as
   * a CLAIM. Nothing in this engine ever promotes it to a verdict — see
   * `verdict.ts`, which only ever uses it to DOWNGRADE. */
  claimedResult: Lit | null;
};

// ---------------------------------------------------------------------
// Stage 0 — GUARD
// ---------------------------------------------------------------------

const CH_NUL = String.fromCharCode(0);
const CH_BACKSPACE = String.fromCharCode(8);
const CH_BOM = String.fromCharCode(65279);

function byteLength(s: string): number {
  // No Buffer in the browser bundle; this is the same number.
  return new TextEncoder().encode(s).length;
}

/**
 * C0 controls that a real terminal paste never contains in quantity.
 *
 * FIVE are excluded because a legitimate paste is full of them and stage 1
 * removes them: tab (9), newline (10), carriage return (13), backspace (8)
 * from WinBox line redraw, and ESCAPE (27) which opens every ANSI colour
 * sequence an SSH client emits.
 *
 * Escape was inside the range on the first version of this file, so a
 * perfectly ordinary colourised paste was rejected as "binary" before a
 * single line of it was read. Caught by
 * `scripts/test-manual-wizard-engine.mjs`, which is the entire argument
 * for a test that feeds real terminal shapes rather than clean fixtures.
 *
 * Built with `String.fromCharCode` rather than written as escapes so this
 * file stays pure ASCII — a control byte pasted literally into source is
 * invisible in review, which is exactly the kind of thing this module is
 * supposed to be paranoid about.
 */
const RE_BINARY_CONTROLS = new RegExp(
  "[" +
    String.fromCharCode(1) +
    "-" +
    String.fromCharCode(7) +
    String.fromCharCode(11) +
    String.fromCharCode(12) +
    String.fromCharCode(14) +
    "-" +
    String.fromCharCode(26) +
    String.fromCharCode(28) +
    "-" +
    String.fromCharCode(31) +
    "]",
  "g",
);

function looksBinary(s: string): boolean {
  if (s.includes(CH_NUL)) return true;
  const sample = s.slice(0, 8192);
  if (sample.length === 0) return false;
  const controls = sample.match(RE_BINARY_CONTROLS);
  return controls !== null && controls.length / sample.length > 0.02;
}

// ---------------------------------------------------------------------
// Stage 1 — DECODE
// ---------------------------------------------------------------------

function decode(raw: string): string {
  let s = raw.startsWith(CH_BOM) ? raw.slice(1) : raw;
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(RE_ANSI, "");
  // Applied repeatedly: `abc` followed by three backspaces is three
  // overlapping runs, and one pass only removes every other pair.
  let previous: string;
  do {
    previous = s;
    s = s.replace(RE_BACKSPACE_RUN, "");
  } while (s !== previous);
  // A backspace with nothing before it never matches the run regex.
  return s.split(CH_BACKSPACE).join("");
}

// ---------------------------------------------------------------------
// Stage 5 helper — what counts as a key/value line
// ---------------------------------------------------------------------

export function looksLikeKvLine(line: string): boolean {
  if (RE_KV_COLON.test(line)) return true;
  const trimmed = line.trimStart();
  RE_KV_EQ.lastIndex = 0;
  const m = RE_KV_EQ.exec(trimmed);
  return m !== null && m.index === 0;
}

function looksLikeRecordStart(line: string): boolean {
  if (looksLikeKvLine(line)) return false;
  return /^\s*\d+\s+\S/.test(line);
}

/** A `print` table header — all caps, dashes, no `=`. */
export function looksLikeHeaderLine(line: string): boolean {
  const s = line.trim();
  if (s.length === 0) return false;
  if (s.includes("=")) return false;
  const tokens = s.split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.every((t) => /^[A-Z][A-Z0-9-]*$/.test(t));
}

// ---------------------------------------------------------------------
// Stage 8 — KV extraction
// ---------------------------------------------------------------------

/**
 * `=` wins over `:` on any line that has one, and the two are never mixed.
 * A duration value contains colons (`idle-timeout=00:05:00`) and a naive
 * colon split shreds it into `idle-timeout` -> `00`.
 */
export function extractKv(line: string): [Lit, Lit][] {
  const out: [Lit, Lit][] = [];
  if (line.includes("=")) {
    RE_KV_EQ.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_KV_EQ.exec(line)) !== null) {
      out.push([m[1], m[2]]);
      if (m.index === RE_KV_EQ.lastIndex) RE_KV_EQ.lastIndex += 1;
    }
    return out;
  }
  const colon = RE_KV_COLON.exec(line);
  if (colon) out.push([colon[1], colon[2].trim()]);
  return out;
}

/** `route=1.2.3.4;active=true;distance=1` -> primary + sub-fields. */
export function splitRow(rawValue: string): { primary: Lit; sub: Record<Lit, Lit> } {
  const parts = rawValue.split(RE_SUBFIELD_SPLIT);
  const primary = parts.length > 0 ? parts[0].trim() : "";
  const sub: Record<Lit, Lit> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    sub[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  return { primary, sub };
}

// ---------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------

export function normalise(
  rawInput: string,
  options: { flagFallback?: Record<Lit, Lit> | null } = {},
): NormalisedPaste {
  const empty: NormalisedPaste = {
    guard: null,
    bytes: 0,
    lines: [],
    nonBlankLines: 0,
    paged: false,
    echoedCommands: [],
    banner: { open: false, title: null, close: false },
    sentinel: { begin: null, end: null, duplicated: false },
    body: [],
    legend: null,
    hasHeaderLine: false,
    records: [],
    kv: {},
    claimedResult: null,
  };

  // --- 0. GUARD ------------------------------------------------------
  const bytes = byteLength(rawInput);
  if (bytes > MAX_PASTE_BYTES) return { ...empty, bytes, guard: "too-large" };
  if (looksBinary(rawInput)) return { ...empty, bytes, guard: "binary" };

  // --- 1. DECODE -----------------------------------------------------
  const decoded = decode(rawInput);
  let lines = decoded.split("\n");

  // --- 2. DEPAGE -----------------------------------------------------
  const paged = lines.some((l) => RE_PAGING_PROMPT.test(l));
  lines = lines.filter((l) => !RE_PAGING_PROMPT.test(l));

  // --- 3. STRIP PROMPTS ----------------------------------------------
  const echoedCommands: EchoedCommand[] = [];
  const kept: string[] = [];
  for (const line of lines) {
    if (RE_PROMPT_LINE.test(line)) {
      const m = RE_PROMPT_COMMAND.exec(line);
      if (m) {
        const menu = (m[1] ?? "").trim();
        const command = (m[2] ?? "").trim();
        if (menu !== "" || command !== "") echoedCommands.push({ menu, command });
      }
      continue;
    }
    kept.push(line);
  }
  lines = kept;

  const nonBlankLines = lines.filter((l) => l.trim() !== "").length;

  // --- 3b. BANNER PAIR -----------------------------------------------
  // Closing form is tested FIRST; see this file's header.
  const banner: BannerState = { open: false, title: null, close: false };
  for (const line of lines) {
    if (RE_BANNER_CLOSE.test(line)) {
      if (banner.open) banner.close = true;
      continue;
    }
    const opened = RE_BANNER_OPEN.exec(line);
    if (opened && !banner.open) {
      banner.open = true;
      banner.title = opened[1].trim();
    }
  }

  // --- 4. SENTINEL SLICE ---------------------------------------------
  let beginIndex = -1;
  let beginId: Lit | null = null;
  let beginCount = 0;
  lines.forEach((line, i) => {
    const m = RE_SENTINEL_BEGIN.exec(line);
    if (m) {
      beginCount += 1;
      beginIndex = i;
      beginId = m[1];
    }
  });

  let endIndex = -1;
  let endId: Lit | null = null;
  if (beginIndex >= 0) {
    for (let i = beginIndex + 1; i < lines.length; i += 1) {
      const m = RE_SENTINEL_END.exec(lines[i]);
      if (m) {
        endIndex = i;
        endId = m[1];
        break;
      }
    }
  }

  const sentinel: SentinelState = {
    begin: beginId,
    end: endId,
    duplicated: beginCount > 1,
  };

  let body: string[];
  if (beginIndex >= 0 && endIndex >= 0) body = lines.slice(beginIndex + 1, endIndex);
  else if (beginIndex >= 0) body = lines.slice(beginIndex + 1);
  else body = lines.slice();

  // --- 5. UNWRAP -----------------------------------------------------
  const unwrapped: string[] = [];
  for (const line of body) {
    const isStructural =
      line.trim() === "" ||
      looksLikeKvLine(line) ||
      looksLikeRecordStart(line) ||
      looksLikeHeaderLine(line) ||
      RE_FLAGS_LEGEND.test(line) ||
      RE_COLUMNS_HINT.test(line) ||
      RE_SEMI_COMMENT.test(line) ||
      RE_BANNER_CLOSE.test(line) ||
      RE_BANNER_OPEN.test(line);
    const previous = unwrapped.length > 0 ? unwrapped[unwrapped.length - 1] : null;
    const previousIsJoinable =
      previous !== null && previous.trim() !== "" && looksLikeKvLine(previous);
    if (!isStructural && previousIsJoinable) {
      unwrapped[unwrapped.length - 1] = `${previous} ${line.trim()}`;
      continue;
    }
    unwrapped.push(line);
  }

  // --- 6. LEGEND -----------------------------------------------------
  let legend: Record<Lit, Lit> | null = null;
  for (const line of unwrapped) {
    const m = RE_FLAGS_LEGEND.exec(line);
    if (!m) continue;
    const table: Record<Lit, Lit> = {};
    RE_FLAGS_LEGEND_PAIR.lastIndex = 0;
    let p: RegExpExecArray | null;
    while ((p = RE_FLAGS_LEGEND_PAIR.exec(m[1])) !== null) {
      table[p[1]] = p[2].trim().toLowerCase();
    }
    if (Object.keys(table).length > 0) legend = table;
    break;
  }
  // FALLBACK ONLY. `parsing.rules.ts`: use the device's own legend in
  // every other case, because v7 lowercases letters v6 printed uppercase.
  if (legend === null && options.flagFallback) legend = options.flagFallback;

  // --- 7 + 8. RECORDS and KV -----------------------------------------
  const records: ParsedRecord[] = [];
  const kv: Record<Lit, Lit[]> = {};
  let hasHeaderLine = false;
  let claimedResult: Lit | null = null;
  let pendingComment: Lit | null = null;
  let current: ParsedRecord | null = null;

  const push = (key: Lit, value: Lit) => {
    const bucket = kv[key];
    if (bucket) bucket.push(value);
    else kv[key] = [value];
  };

  const lookUpLetter = (letter: string): Lit | undefined => {
    if (!legend) return undefined;
    if (legend[letter] !== undefined) return legend[letter];
    if (legend[letter.toUpperCase()] !== undefined) return legend[letter.toUpperCase()];
    if (legend[letter.toLowerCase()] !== undefined) return legend[letter.toLowerCase()];
    return undefined;
  };

  for (const line of unwrapped) {
    if (line.trim() === "") {
      current = null;
      continue;
    }
    if (RE_COLUMNS_HINT.test(line)) continue;
    if (RE_FLAGS_LEGEND.test(line)) continue;
    if (RE_BANNER_CLOSE.test(line) || RE_BANNER_OPEN.test(line)) continue;

    const result = /^\s*RESULT:\s*(.+)$/.exec(line);
    if (result) {
      claimedResult = result[1].trim();
      continue;
    }

    const semi = RE_SEMI_COMMENT.exec(line);
    if (semi) {
      pendingComment = semi[1].trim();
      continue;
    }

    if (looksLikeHeaderLine(line)) {
      hasHeaderLine = true;
      current = null;
      continue;
    }

    if (looksLikeRecordStart(line)) {
      const m = RE_RECORD_START.exec(line);
      const index = m ? Number(m[1]) : records.length;
      const rawFlags = (m && m[2] ? m[2] : "").trim();
      const letters = rawFlags.replace(/\s+/g, "").split("").filter(Boolean);
      const meanings: string[] = [];
      const unresolvedFlagLetters: string[] = [];
      for (const letter of letters) {
        const hit = lookUpLetter(letter);
        if (hit !== undefined) meanings.push(hit.trim().toLowerCase());
        else unresolvedFlagLetters.push(letter);
      }
      current = {
        index,
        rawFlags,
        flagMeanings: legend ? meanings : null,
        unresolvedFlagLetters,
        kv: {},
        comment: pendingComment,
        raw: line,
      };
      pendingComment = null;
      records.push(current);
      for (const [k, v] of extractKv(line)) current.kv[k.toLowerCase()] = v;
      continue;
    }

    const pairs = extractKv(line);
    if (pairs.length === 0) {
      if (current) current.raw = `${current.raw}\n${line}`;
      continue;
    }
    if (current) {
      for (const [k, v] of pairs) current.kv[k.toLowerCase()] = v;
      current.raw = `${current.raw}\n${line}`;
    } else {
      for (const [k, v] of pairs) push(k, v);
    }
  }

  return {
    guard: null,
    bytes,
    lines,
    nonBlankLines,
    paged,
    echoedCommands,
    banner,
    sentinel,
    body: unwrapped,
    legend,
    hasHeaderLine,
    records,
    kv,
    claimedResult,
  };
}
