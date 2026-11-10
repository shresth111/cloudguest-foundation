/**
 * RAKESH-FS (P0 #6): data limits are entered and shown in GB; the backend
 * keeps storing whole MB (`data_cap_mb`, `fup_limit_mb`, FUP top-up `mb`).
 * DECISIONS-1 (2026-11-10): 1 GB = 1000 MB everywhere in the ISP console
 * (telecom plans in India are decimal: "3,000 GB", stored as 3,000,000 MB).
 * The stored MB itself is unchanged: enforcement counts 1 MB = 2^20 bytes
 * (backend enforcement.MB), so byte counters are turned into MB with
 * BYTES_PER_MB first and then into GB/TB with this factor. That keeps a
 * "3,000 GB" package and its FUP meter ("x of 3,000 GB") on the same scale.
 * Pure functions, no React: tested by scripts/test-isp-partner-data-units.mjs.
 */
export const MB_PER_GB = 1000;
/** Bytes in one stored MB (matches backend enforcement.MB). */
export const BYTES_PER_MB = 1024 * 1024;
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

/** Number -> at most 2 decimals, no trailing zeros ("1", "1.5", "1.02"). */
function trim2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Stored MB -> "500 MB" / "1.5 GB" / "3 TB" with the console's 1000 factor. */
export function formatMbUnits(mb: number): string {
  if (mb >= MB_PER_GB * MB_PER_GB) return `${trim2(mb / (MB_PER_GB * MB_PER_GB))} TB`;
  if (mb >= MB_PER_GB) return `${trim2(mb / MB_PER_GB)} GB`;
  return `${trim2(mb)} MB`;
}

/**
 * Byte counter -> "512 B" / "12.0 KB" / "340 MB" / "2.9 GB". Bytes become MB
 * with BYTES_PER_MB (storage scale), then MB -> GB -> TB -> PB by 1000.
 */
export function formatDataBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "–";
  if (bytes < 1024) return `${bytes} B`;
  const fmt = (v: number, u: string) => `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${u}`;
  if (bytes < BYTES_PER_MB) return fmt(bytes / 1024, "KB");
  let value = bytes / BYTES_PER_MB;
  const units = ["MB", "GB", "TB", "PB"];
  let i = 0;
  while (value >= MB_PER_GB && i < units.length - 1) {
    value /= MB_PER_GB;
    i += 1;
  }
  return fmt(value, units[i]);
}
