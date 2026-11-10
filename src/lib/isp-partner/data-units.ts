/**
 * RAKESH-FS (P0 #6): data limits are entered and shown in GB; the backend
 * keeps storing whole MB (`data_cap_mb`, `fup_limit_mb`, FUP top-up `mb`).
 * 1 GB = 1024 MB, the same factor `formatMb` in network.ts already uses.
 * Pure functions, no React: tested by scripts/test-isp-partner-data-units.mjs.
 */
export const MB_PER_GB = 1024;
/** Largest GB value the forms accept (fits the BE's int column with room). */
export const MAX_GB = 1_000_000;

/** Stored MB -> GB text for an input: "3000", "1.5", "0.488". Empty for null. */
export function mbToGbText(mb: number | null | undefined): string {
  if (mb === null || mb === undefined || !Number.isFinite(mb)) return "";
  const gb = mb / MB_PER_GB;
  // up to 3 decimals, no trailing zeros
  return String(Math.round(gb * 1000) / 1000);
}

export type GbParse = { ok: true; mb: number | null } | { ok: false; error: string };

/**
 * GB text -> whole MB. Empty = null (no limit). Accepts "3000", "3,000",
 * "1.5". Rounds to the nearest MB, never to 0 for a positive entry.
 */
export function parseGbToMb(raw: string, opts: { min?: number; max?: number } = {}): GbParse {
  const t = raw.trim().replace(/,/g, "");
  if (t === "") return { ok: true, mb: null };
  if (!/^\d+(\.\d+)?$/.test(t))
    return { ok: false, error: "Enter GB as a number, e.g. 3000 or 1.5." };
  const gb = Number(t);
  const min = opts.min ?? 0.001;
  const max = opts.max ?? MAX_GB;
  if (!Number.isFinite(gb) || gb < min) return { ok: false, error: `At least ${min} GB.` };
  if (gb > max) return { ok: false, error: `At most ${max.toLocaleString("en-IN")} GB.` };
  return { ok: true, mb: Math.max(1, Math.round(gb * MB_PER_GB)) };
}

/** Stored MB -> "3,000 GB" / "1.5 GB" / "None". */
export function formatMbAsGb(mb: number | null | undefined, none = "None"): string {
  if (!mb) return none;
  return `${Number(mbToGbText(mb)).toLocaleString("en-IN", { maximumFractionDigits: 3 })} GB`;
}
