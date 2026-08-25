/**
 * Manual wizard engine — the `{{token}}` convention, enforced.
 *
 * ---------------------------------------------------------------------
 * WHAT BREAKS WITHOUT THIS
 * ---------------------------------------------------------------------
 * A `T` string is translated. Some `T` strings name a token the operator
 * will hunt for in real device output: the flag letters `As` and `Is`, the
 * DHCP status word `bound`, the fourth RADIUS counter `bad-replies`, an
 * interface called `ether1`. If a translator renders any of those into
 * Hindi, the operator searches the router's output for a word that will
 * never appear there — and does it confidently, because the app told them
 * to. That is worse than shipping no Hindi at all.
 *
 * `types.ts` declares the fix: wrap the token in `{{ }}` and the
 * translator's tooling leaves it alone. It also says plainly that the
 * convention is "declared but not yet enforced across the content". This
 * file is the enforcement.
 *
 * ---------------------------------------------------------------------
 * WHY THIS IS TWO TIERS AND NOT ONE
 * ---------------------------------------------------------------------
 * A blind lint over `PROTECTED_TOKENS` does not work, and pretending
 * otherwise is how a convention gets a test that everybody disables.
 * Eight of the tokens are also ordinary English words, and in this
 * content they are overwhelmingly used as English:
 *
 *   bridge      63 occurrences, ~8 of them the literal object name
 *   connected   15 occurrences, 1 of them a device status literal
 *   bound       13 occurrences, 10 of them the participle "bound to"
 *   none         9 occurrences, 0 of them the RouterOS value `none`
 *   accepts      9 occurrences, 3 of them the counter name
 *   rejects      4 occurrences, 2 of them the counter name
 *   timeouts     4 occurrences, 2 of them the counter name
 *   established  0 occurrences
 *
 * Wrapping "put the internet port into a LAN bridge" would produce Hindi
 * that reads like machine output, and forbidding it would produce a test
 * with a hundred exceptions. So:
 *
 *   LITERAL tier      — tokens that are never ordinary English. Any bare
 *                       occurrence in a translatable string is an error,
 *                       no exceptions. This is where `As`, `Is`, `XI`,
 *                       `bad-replies`, `ether1`, `0.0.0.0` and every
 *                       hostname, path and duration live.
 *   COLLIDING tier    — tokens that are also English words. Bare is an
 *                       error only in a DEVICE CUE context: the token is
 *                       being quoted as something to look for. The cues
 *                       are listed in `DEVICE_CUES` and are deliberately
 *                       narrow, so this tier has false negatives and no
 *                       false positives.
 *
 * `TOKEN_TIERS` must cover `PROTECTED_TOKENS` exactly. A token added there
 * and not classified here fails the test — the convention cannot rot by
 * someone forgetting this file exists.
 */

import type { Lit } from "../types";
import { PROTECTED_TOKENS, TOKEN_PLACEHOLDER_RE } from "../types";

export type TokenTier = "literal" | "colliding";

/**
 * Every entry of `PROTECTED_TOKENS`, classified. Keep in sync; the test
 * `protected token tiers cover PROTECTED_TOKENS exactly` enforces it.
 */
export const TOKEN_TIERS: Record<Lit, TokenTier> = {
  // --- flag letters. Also English words at the start of a sentence, but
  // a sentence in this content never starts with a bare flag letter and
  // the cost of a false positive here is one rewrite, while the cost of a
  // false negative is an operator hunting for a translated flag letter.
  As: "literal",
  Is: "literal",
  XI: "literal",

  // --- status words -------------------------------------------------
  bound: "colliding",
  "searching...": "literal",
  "no-link": "literal",
  "link-ok": "literal",
  synchronized: "literal",
  established: "colliding",
  connected: "colliding",

  // --- durations and numeric literals ---------------------------------
  "00:05:00": "literal",
  "5m": "literal",
  "3s": "literal",
  "25s": "literal",
  "0.0.0.0": "literal",
  "0.0.0.0/0": "literal",

  // --- interface, object and file names --------------------------------
  ether1: "literal",
  ether2: "literal",
  bridge: "colliding",
  bridge1: "literal",
  bridgeLocal: "literal",
  "wg-cloudguest": "literal",
  "wg-cloudguard": "literal",
  hsprof1: "literal",
  hotspot1: "literal",
  "hotspot-pool": "literal",
  "hotspot-dhcp": "literal",
  "cloudguest-api": "literal",
  "cloudguest-ca": "literal",
  "cloudguest-hotspot-cert": "literal",
  "login.html": "literal",
  "flash/hotspot/login.html": "literal",
  "hotspot/login.html": "literal",

  // --- config values ----------------------------------------------------
  "http-pap": "literal",
  "http-chap": "literal",
  cookie: "colliding",
  https: "literal",
  none: "colliding",

  // --- hostnames and addresses ------------------------------------------
  "wifi.wyfyguest.com": "literal",
  "auth.wyfyguest.com": "literal",
  "hub.wyfyguest.com": "literal",
  "10.5.50.1": "literal",
  "10.20.0.1": "literal",
  "40.80.86.193": "literal",

  // --- counter names ----------------------------------------------------
  accepts: "colliding",
  rejects: "colliding",
  timeouts: "colliding",
  "bad-replies": "literal",
};

/**
 * Contexts in which a COLLIDING token is being quoted as device output
 * rather than used as English. Narrow on purpose: this tier is tuned for
 * ZERO false positives against the shipped content, accepting false
 * negatives, because a lint that cries wolf is a lint someone deletes.
 *
 * `before` is applied to the 40 characters preceding the token, `after`
 * to the 20 following it. `tokens`, when present, limits the cue to those
 * tokens — several cues are only safe for some of the colliding set.
 *
 * KNOWN WEAKEST COVERAGE: `connected`. RouterOS really does print
 * `status: connected` for a PPPoE session, but this content uses the word
 * as ordinary English fourteen times out of fifteen ("the session is
 * connected", "the device shows as connected", "guests already connected
 * keep working"), in sentence shapes indistinguishable from the one
 * device-literal use. The literal use is wrapped by hand; a future one
 * will not be caught here. Stated rather than pretended away.
 */
export const DEVICE_CUES: { id: Lit; tokens?: Lit[]; before?: RegExp; after?: RegExp }[] = [
  // "bound means the ISP gave the router an address" — the token OPENS a
  // clause. That is what separates it from "a phone is connected means",
  // where `connected` is a participle and `means` belongs to the sentence.
  { id: "token-means", before: /(?:^|[.;:—]\s*)$/, after: /^\s+means\b/ },
  // "Whether status is bound", "the lease shows as bound"
  {
    id: "status-is",
    tokens: ["bound", "established"],
    before: /\bstatus (?:is|shows as|reads|says)\s+$/i,
  },
  {
    id: "shows-as",
    tokens: ["bound", "established", "accepts", "rejects", "timeouts", "none"],
    before: /(?:^|\s)(?:shows as|reads|says|reports|prints)\s+$/i,
  },
  // "a bridge called bridge", "a bridge named bridge". The leading
  // whitespace requirement keeps "a wrongly-named bridge" out.
  { id: "called-named", before: /(?:^|\s)(?:called|named)\s+$/i },
  // "set to none", "= none"
  { id: "set-to", before: /(?:^|\s)(?:set to)\s+$|=\s*$/i },
  // "called {{bridge1}}, not bridge" / "rebuilt on bridge" — a token
  // contrasted against an already-wrapped one is naming the same kind of
  // thing, so it is a literal too.
  {
    id: "contrast-with-wrapped",
    before: /\}\}[^.!?]{0,40}?\b(?:not|rather than|instead of|rebuilt on|renamed to)\s+$/,
  },
  // A counter name sitting next to an already-wrapped sibling is being
  // listed as device output, not used as a verb.
  {
    id: "counter-list",
    tokens: ["accepts", "rejects", "timeouts"],
    before: /\}\}[,\s]+(?:and\s+)?$/,
  },
  {
    id: "counter-list-after",
    tokens: ["accepts", "rejects", "timeouts"],
    after: /^[,\s]+(?:and\s+)?\{\{/,
  },
];

export type BareToken = {
  token: Lit;
  tier: TokenTier;
  /** Index of the token in the string. */
  index: number;
  /** The cue that made a colliding token an error, or null. */
  cue: Lit | null;
  /** Enough context to find it, verbatim. */
  context: Lit;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Blank out every `{{...}}` placeholder, preserving offsets so reported
 * indices still point into the original string.
 */
function maskWrapped(text: string): string {
  TOKEN_PLACEHOLDER_RE.lastIndex = 0;
  return text.replace(TOKEN_PLACEHOLDER_RE, (m) => " ".repeat(m.length));
}

/**
 * A token boundary that understands device tokens. `\b` is useless here:
 * it puts a boundary in the middle of `0.0.0.0` and inside `bad-replies`.
 *
 * Leading side: any word character, dot, slash, colon or hyphen
 * disqualifies, so `10.5.50.1` does not fire on the `0.1` inside
 * `10.20.0.1` and `3s` does not fire inside `25s`.
 *
 * Trailing side: the same, EXCEPT that a dot only disqualifies when a
 * word character follows it. A full stop is punctuation, and treating it
 * as part of the token silently skipped every sentence-final `ether1.` —
 * which is a third of the occurrences in this content, and exactly the
 * kind of quiet under-enforcement this lint exists to prevent.
 */
function tokenRegex(token: string): RegExp {
  return new RegExp(`(?<![\\w./:-])${escapeRegExp(token)}(?![\\w:/-])(?!\\.\\w)`, "g");
}

/**
 * Every bare protected token in one translatable string.
 *
 * Longest tokens are tested first so that `0.0.0.0/0` is reported once
 * rather than also matching `0.0.0.0`, and `bridge1` is never reported as
 * a bare `bridge`.
 */
export function findBareProtectedTokens(text: string): BareToken[] {
  const masked = maskWrapped(text);
  const claimed: boolean[] = new Array(masked.length).fill(false);
  const found: BareToken[] = [];

  const ordered = [...PROTECTED_TOKENS].sort((a, b) => b.length - a.length);
  for (const token of ordered) {
    const tier = TOKEN_TIERS[token];
    if (tier === undefined) continue;
    const re = tokenRegex(token);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      const start = m.index;
      const end = start + token.length;
      let overlaps = false;
      for (let i = start; i < end; i += 1) if (claimed[i]) overlaps = true;
      if (overlaps) continue;

      let cue: Lit | null = null;
      if (tier === "colliding") {
        const before = text.slice(Math.max(0, start - 40), start);
        const after = text.slice(end, end + 20);
        for (const c of DEVICE_CUES) {
          if (c.tokens && !c.tokens.includes(token)) continue;
          const beforeOk = c.before ? c.before.test(before) : true;
          const afterOk = c.after ? c.after.test(after) : true;
          if ((c.before || c.after) && beforeOk && afterOk) {
            cue = c.id;
            break;
          }
        }
        if (cue === null) continue;
      }

      for (let i = start; i < end; i += 1) claimed[i] = true;
      found.push({
        token,
        tier,
        index: start,
        cue,
        context: text.slice(Math.max(0, start - 30), end + 30),
      });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

/** The `{{...}}` placeholders in a string, in order. A Hindi counterpart
 * must contain exactly these, byte-identical. */
export function placeholdersIn(text: string): Lit[] {
  TOKEN_PLACEHOLDER_RE.lastIndex = 0;
  const out: Lit[] = [];
  let m: RegExpExecArray | null;
  while ((m = TOKEN_PLACEHOLDER_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}
