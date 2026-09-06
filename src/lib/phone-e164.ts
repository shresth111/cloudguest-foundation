/**
 * The one place this dashboard turns something a venue owner typed into
 * the phone identifier a guest actually signs in with.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A guest's login identifier is E.164 with the dialling code attached:
 * the captive portal submits `dialCode + nationalPhone`
 * (`useGuestSignIn.ts`'s `identifierForChannel`), and guest_access matches
 * a rule to a guest by exact string equality
 * (`guest_access/repository.py`). There is no normalisation on either
 * side of that comparison, so a rule stored in any other shape is a rule
 * that can never fire.
 *
 * Blocked Guests used to build its identifier as `"+" + digits` after
 * stripping the "+" the owner may have typed, with no country-code input
 * anywhere on the screen. An Indian owner typing the ten digits they know
 * (`9876543210`) got the rule `+9876543210`; the guest signs in as
 * `+919876543210`; nothing ever matched. That failed twice over -- future
 * sign-ins were not blocked, and, worse, the block-enforcement path
 * (`guest_access/enforcement.py`) looks the guest up by that same exact
 * identifier, found nobody, and returned "nothing to do" without
 * contacting a router. A guest sitting in the lobby stayed online while
 * the screen said they had been cut off.
 *
 * Access Rules (`WhiteList.tsx`) has the same joining problem and is
 * being fixed on `fix/access-rules-audit`. Both screens must end up on
 * ONE normaliser: two of them drifting apart is precisely how an
 * identifier written by one screen stops matching an identifier written
 * by the other. This module is that one normaliser, and it lives in
 * `src/lib/` -- next to the other pure, node-testable rule modules
 * (`connection-verdicts.ts`, `device-health.ts`) -- rather than inside
 * either screen, so neither owns it and both can import it.
 */

export interface PhoneCountry {
  /** Dialling code including the leading "+", e.g. "+91". */
  code: string;
  /** What the picker shows, e.g. "🇮🇳 +91". */
  label: string;
}

/**
 * The dialling codes the customer dashboard offers. Deliberately the same
 * list, in the same order, as the picker Access Rules already ships, so a
 * number blocked on one screen and allowed on the other normalise
 * identically. India first: that is who this product sells to.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+971", label: "🇦🇪 +971" },
];

export const DEFAULT_DIAL_CODE = "+91";

/**
 * Join a picker's dialling code to a national number. Trivial by design:
 * the value of having it here is that every caller produces the identical
 * string, and that there is exactly one function to change if the shape
 * ever moves.
 */
export const toE164 = (dialCode: string, national: string) => `${dialCode}${national}`;

/**
 * Split a stored identifier back into picker + national parts, for an
 * edit form. Longest dialling code first, so "+1" never shadows a longer
 * code that happens to start with the same digits.
 */
export const splitE164 = (identifier: string): { cc: string; national: string } => {
  const match = [...PHONE_COUNTRIES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => identifier.startsWith(c.code));
  if (match) return { cc: match.code, national: identifier.slice(match.code.length) };
  // Rows written before this fix carry bare national digits behind a
  // stray "+". Show them against the default code rather than as a
  // country code nobody chose.
  return { cc: DEFAULT_DIAL_CODE, national: identifier.replace(/^\+/, "") };
};

/**
 * Why the phone must land in a range at all: E.164 caps a full number at
 * 15 digits, and nothing shorter than 8 digits including a country code
 * is a reachable mobile. Numbers outside that are typos, not numbers.
 */
const E164_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;

/**
 * Plausible length of a *national* number once the trunk prefix is gone,
 * across the codes this product offers: AE/AU 9, IN/GB/US 10, with a
 * digit of slack either side for the codes we do not list. A bare string
 * inside this range is read as a national number and gets the picker's
 * code; one outside it is not, which is what lets `919876543210` be
 * recognised as a country code the owner typed without the "+".
 */
const NATIONAL_MIN_DIGITS = 7;
const NATIONAL_MAX_DIGITS = 11;

export type PhoneNormalizeReason =
  | "empty"
  | "not-a-number"
  | "too-short"
  | "too-long"
  | "ambiguous";

export type PhoneNormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: PhoneNormalizeReason; message: string };

/**
 * A message the venue owner can act on, rather than the word "invalid".
 * Each one names the thing that is wrong and what to do instead.
 */
const MESSAGES: Record<PhoneNormalizeReason, string> = {
  empty: "Enter a mobile number.",
  "not-a-number": "Only digits, spaces, +, -, ( ) are allowed in a mobile number.",
  "too-short": "Too short for a mobile number — check for missing digits.",
  "too-long": "Too long for a mobile number — a full number is at most 15 digits.",
  ambiguous:
    "Add the country code with a + (e.g. +919876543210), or pick the country and enter the local number.",
};

const fail = (reason: PhoneNormalizeReason): PhoneNormalizeResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
});

/**
 * Turn one pasted line into the exact identifier a guest signs in with,
 * or say why it cannot be done.
 *
 * A pasted list from a real venue mixes shapes, and every shape below has
 * to land on the SAME canonical string or the list silently half-works.
 * With India selected in the picker:
 *
 *   "9876543210"     -> "+919876543210"  national number, gets the picker's code
 *   "+919876543210"  -> "+919876543210"  already E.164, taken as given
 *   "919876543210"   -> "+919876543210"  country code typed without the "+"
 *   "09876543210"    -> "+919876543210"  national with a trunk-prefix 0
 *   "00919876543210" -> "+919876543210"  "00" is the international access prefix
 *   "+91 98765-43210" -> "+919876543210" formatting punctuation is not data
 *
 * The two judgement calls, stated plainly:
 *
 * 1. AN EXPLICIT "+" BEATS THE PICKER. If the owner typed a country code
 *    they meant it, and a pasted export of foreign guests must not be
 *    rewritten into the venue's own country. So "+441632960961" stays
 *    British even with India selected.
 *
 * 2. A BARE STRING OF NATIONAL LENGTH IS A NATIONAL NUMBER, even when it
 *    happens to begin with the picker's own digits. "9198765432" is ten
 *    digits, so it is read as a local number and becomes "+919198765432",
 *    not as "+91" plus an eight-digit stub. Ten digits is what an Indian
 *    owner types; a country code without the "+" only becomes the better
 *    reading once the string is too long to be national. Anything that
 *    fits neither reading is rejected with `ambiguous` rather than
 *    guessed at -- a wrong guess here is a rule that silently never
 *    matches, which is the bug this file exists to end.
 *
 * Nothing is ever accepted in a shape that cannot match a sign-in.
 */
export function normalizePhoneToE164(
  raw: string,
  dialCode: string = DEFAULT_DIAL_CODE,
): PhoneNormalizeResult {
  // Spaces, hyphens, brackets and dots are how people write a number down;
  // they carry no information. The "+" does, so it is not stripped here.
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");
  if (!cleaned) return fail("empty");

  let international = cleaned.startsWith("+");
  let digits = international ? cleaned.slice(1) : cleaned;
  // "00" is the ITU international access prefix -- the way a "+" is
  // dialled from a landline, and how numbers come out of some address
  // books. It means exactly what a "+" means.
  if (!international && digits.startsWith("00")) {
    international = true;
    digits = digits.slice(2);
  }
  if (!/^\d+$/.test(digits)) return fail("not-a-number");

  if (international) {
    if (digits.length < E164_MIN_DIGITS) return fail("too-short");
    if (digits.length > E164_MAX_DIGITS) return fail("too-long");
    return { ok: true, e164: `+${digits}` };
  }

  // No "+" anywhere. Strip a trunk prefix ("0" before a domestic number in
  // India, the UK and most of Europe) before measuring the length.
  const national = digits.replace(/^0+/, "");
  if (!national) return fail("not-a-number");

  const ccDigits = dialCode.replace(/^\+/, "");

  if (national.length >= NATIONAL_MIN_DIGITS && national.length <= NATIONAL_MAX_DIGITS) {
    const joined = toE164(dialCode, national);
    // Guard the join itself: a long national number under a long dialling
    // code can still overflow E.164.
    if (joined.length - 1 > E164_MAX_DIGITS) return fail("too-long");
    return { ok: true, e164: joined };
  }

  // Too long to be a national number. The one reading left that is not a
  // guess is "the owner typed the country code and left off the +", and
  // we only accept it when the string actually starts with the code they
  // have selected.
  if (national.startsWith(ccDigits) && national.length > ccDigits.length) {
    if (national.length < E164_MIN_DIGITS) return fail("too-short");
    if (national.length > E164_MAX_DIGITS) return fail("too-long");
    return { ok: true, e164: `+${national}` };
  }

  if (national.length < NATIONAL_MIN_DIGITS) return fail("too-short");
  if (national.length > E164_MAX_DIGITS) return fail("too-long");
  // Long enough to carry some country code, but not one we can identify:
  // say so instead of prepending the picker's code and writing a rule
  // that will never match.
  return fail("ambiguous");
}
