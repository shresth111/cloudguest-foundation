/**
 * Manual wizard engine — stage 9, COERCE.
 *
 * Turns one raw device string into a comparable value, per `FactType`.
 *
 * ---------------------------------------------------------------------
 * WHY EVERY FUNCTION HERE RETURNS A STATUS INSTEAD OF A VALUE
 * ---------------------------------------------------------------------
 * The failure this whole module exists to prevent is a value that looks
 * usable and is not. `0.0.0.0` is a valid dotted quad. A duration split
 * mid-token by a narrow terminal is still a string. An empty value from a
 * probe is a real statement by the device, while a corrupt one is not.
 *
 * So coercion never returns a bare value. It returns one of:
 *
 *   ok          — the value parsed and may be compared.
 *   empty       — the device printed the key with nothing after it. That
 *                 is a fact about the device, not about the paste. It is
 *                 NOT re-pastable, so it never raises INCOMPLETE_OUTPUT;
 *                 it makes every predicate over it null.
 *   malformed   — non-empty and did not parse for its declared type. Per
 *                 `parsing.rules.ts` WRAP_HAZARD this is treated as
 *                 INCOMPLETE_OUTPUT, because the overwhelmingly likely
 *                 cause is a paste split mid-token, not a broken router.
 *   over-length — longer than `MAX_SANE_VALUE_LEN` for its type. Same
 *                 treatment as malformed, same reason.
 *
 * Nothing here ever guesses. `parseBool("unknown")` is null, not false:
 * several probes in this module deliberately print `unknown` when a
 * `:do {...} on-error={...}` could not read a value, and reading that as
 * "no" would invent a failure the device never reported.
 */

import type { FactType, Lit } from "../types";
import {
  BOOL_FALSE,
  BOOL_TRUE,
  DURATION_NONE_TOKENS,
  MAX_SANE_VALUE_LEN,
  RE_DATE_ISO,
  RE_DATE_LEGACY,
  RE_DURATION_CLOCK,
  RE_DURATION_UNITS,
  RE_IPV4,
  RE_IPV4_CIDR,
  RE_VERSION,
} from "../parsing.rules";

// ---------------------------------------------------------------------
// Value shapes
// ---------------------------------------------------------------------

export type VersionValue = { major: number; minor: number; patch: number };

export type CoercedValue =
  | { kind: "string"; text: string }
  | { kind: "int"; n: number }
  | { kind: "bool"; b: boolean }
  | { kind: "ipv4"; text: string; n: number; unspecified: boolean }
  | {
      kind: "ipv4cidr";
      text: string;
      address: string;
      addressN: number;
      bits: number;
      unspecified: boolean;
    }
  | { kind: "duration"; seconds: number }
  | { kind: "set"; members: string[] }
  | { kind: "datetime"; ms: number }
  | { kind: "version"; version: VersionValue };

export type CoercionStatus = "ok" | "empty" | "malformed" | "over-length";

export type Coercion =
  | { status: "ok"; value: CoercedValue }
  | { status: "empty" | "malformed" | "over-length"; value: null };

const bad = (status: "empty" | "malformed" | "over-length"): Coercion => ({ status, value: null });
const good = (value: CoercedValue): Coercion => ({ status: "ok", value });

// ---------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------

export function stripQuotes(v: string): string {
  const s = v.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

const BOOL_TRUE_SET = new Set(BOOL_TRUE.map((x) => x.toLowerCase()));
const BOOL_FALSE_SET = new Set(BOOL_FALSE.map((x) => x.toLowerCase()));
const DURATION_NONE_SET = new Set(DURATION_NONE_TOKENS.map((x) => x.toLowerCase()));

/**
 * Three-valued. `null` means "this string does not state a boolean" —
 * `unknown`, `n/a`, or anything a probe printed when it could not read the
 * setting. Never collapse that to false.
 */
export function parseBool(raw: string): boolean | null {
  const s = stripQuotes(raw).toLowerCase();
  if (BOOL_TRUE_SET.has(s)) return true;
  if (BOOL_FALSE_SET.has(s) && s !== "") return false;
  return null;
}

/**
 * Seconds. `00:05:00` and `5m` are the same number, which is the entire
 * point — no rule in this module may string-compare a duration.
 *
 * `none` is Infinity, so any finite `maxSeconds` bound fails against it.
 * That is deliberate: `keepalive-timeout=none` is a real setting and it
 * must not silently satisfy "at most 30 minutes".
 */
export function parseDurationSeconds(raw: string): number | null {
  const s = stripQuotes(raw).toLowerCase();
  if (s === "") return null;
  if (DURATION_NONE_SET.has(s)) {
    // `0s` / `00:00:00` are listed as "none" tokens by parsing.rules.ts
    // because RouterOS uses them to mean "no limit" on timeout fields.
    return Number.POSITIVE_INFINITY;
  }
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

export function parseRouterDate(raw: string): number | null {
  const s = stripQuotes(raw).toLowerCase();
  const iso = RE_DATE_ISO.exec(s);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
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
    return Date.UTC(Number(legacy[3]), mi, Number(legacy[2]));
  }
  return null;
}

export function parseVersion(raw: string): VersionValue | null {
  const m = RE_VERSION.exec(stripQuotes(raw));
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: m[3] ? Number(m[3]) : 0 };
}

export function ipToInt(ip: string): number | null {
  if (!RE_IPV4.test(ip)) return null;
  return ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0) >>> 0;
}

/**
 * The unspecified address, and the whole `0.0.0.0/8` block it sits in.
 *
 * `0.0.0.0 !== ""` is precisely why a dead default route passed a
 * non-empty check and every ping came back "no route to host". Anything
 * comparing a gateway or an address goes through here.
 */
export function isUnspecifiedIpv4(ip: string): boolean {
  const s = stripQuotes(ip);
  if (!RE_IPV4.test(s)) return false;
  return s === "0.0.0.0" || s.startsWith("0.");
}

/** Comma OR semicolon OR whitespace separated -> members. Order is never
 * stable across RouterOS versions, so callers compare by membership only. */
export function toMembers(raw: string): string[] {
  return stripQuotes(raw)
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 0);
}

// ---------------------------------------------------------------------
// The coercion entry point
// ---------------------------------------------------------------------

export function coerce(type: FactType, rawIn: string): Coercion {
  const raw = stripQuotes(rawIn);
  if (raw === "") return bad("empty");
  if (raw.length > MAX_SANE_VALUE_LEN[type]) return bad("over-length");

  switch (type) {
    case "string":
      return good({ kind: "string", text: raw });

    case "int": {
      if (!/^[+-]?\d+$/.test(raw)) return bad("malformed");
      return good({ kind: "int", n: Number(raw) });
    }

    case "bool": {
      const b = parseBool(raw);
      if (b === null) return bad("malformed");
      return good({ kind: "bool", b });
    }

    case "ipv4": {
      if (!RE_IPV4.test(raw)) return bad("malformed");
      const n = ipToInt(raw);
      if (n === null) return bad("malformed");
      return good({ kind: "ipv4", text: raw, n, unspecified: isUnspecifiedIpv4(raw) });
    }

    case "ipv4cidr": {
      if (!RE_IPV4_CIDR.test(raw)) return bad("malformed");
      const [addr, bitsRaw] = raw.split("/");
      const addressN = ipToInt(addr);
      if (addressN === null) return bad("malformed");
      return good({
        kind: "ipv4cidr",
        text: raw,
        address: addr,
        addressN,
        bits: Number(bitsRaw),
        unspecified: isUnspecifiedIpv4(addr),
      });
    }

    case "duration": {
      const seconds = parseDurationSeconds(raw);
      if (seconds === null) return bad("malformed");
      return good({ kind: "duration", seconds });
    }

    case "csv":
    case "flags": {
      const members = toMembers(raw);
      if (members.length === 0) return bad("empty");
      return good({ kind: "set", members });
    }

    case "datetime": {
      const ms = parseRouterDate(raw);
      if (ms === null) return bad("malformed");
      return good({ kind: "datetime", ms });
    }

    case "version": {
      const v = parseVersion(raw);
      if (v === null) return bad("malformed");
      return good({ kind: "version", version: v });
    }
  }
}

// ---------------------------------------------------------------------
// CIDR overlap, used by the `noOverlap` predicate
// ---------------------------------------------------------------------

export type Cidr = { addressN: number; bits: number };

/** Accepts `10.5.50.1/24` and a bare `10.5.50.1` (treated as /32). */
export function parseCidr(raw: string): Cidr | null {
  const s = stripQuotes(raw);
  if (RE_IPV4_CIDR.test(s)) {
    const [addr, bits] = s.split("/");
    const n = ipToInt(addr);
    return n === null ? null : { addressN: n, bits: Number(bits) };
  }
  if (RE_IPV4.test(s)) {
    const n = ipToInt(s);
    return n === null ? null : { addressN: n, bits: 32 };
  }
  return null;
}

function maskFor(bits: number): number {
  if (bits <= 0) return 0;
  if (bits >= 32) return 0xffffffff >>> 0;
  return ((0xffffffff << (32 - bits)) >>> 0) >>> 0;
}

export function cidrsOverlap(a: Cidr, b: Cidr): boolean {
  const bits = Math.min(a.bits, b.bits);
  const mask = maskFor(bits);
  return (a.addressN & mask) >>> 0 === (b.addressN & mask) >>> 0;
}

// ---------------------------------------------------------------------
// Flag letters
// ---------------------------------------------------------------------

/**
 * Resolve a raw flag column against the legend THE DEVICE PRINTED.
 *
 * `Is` and `As` differ by one letter and mean the opposite thing about a
 * route. RouterOS 6 prints them space-separated and RouterOS 7 lowercases
 * some of them, so the letters are never matched as a string — each letter
 * is looked up in the legend and only its meaning is compared.
 *
 * Returns null when there is no legend and no fallback table for the menu.
 * Null propagates to UNKNOWN. It never becomes "no flags".
 */
export function resolveFlags(
  rawFlags: string,
  legend: Record<Lit, Lit> | null,
): { meanings: string[]; unresolved: string[] } | null {
  if (legend === null) return null;
  const letters = rawFlags.replace(/\s+/g, "").split("");
  const meanings: string[] = [];
  const unresolved: string[] = [];
  for (const letter of letters) {
    const direct = legend[letter];
    if (direct !== undefined) {
      meanings.push(direct.trim().toLowerCase());
      continue;
    }
    // v7 lowercases some letters that v6 printed uppercase, and vice
    // versa. Try the other case before giving up, but never invent one.
    const other =
      legend[letter.toUpperCase()] !== undefined
        ? legend[letter.toUpperCase()]
        : legend[letter.toLowerCase()];
    if (other !== undefined) meanings.push(other.trim().toLowerCase());
    else unresolved.push(letter);
  }
  return { meanings, unresolved };
}
