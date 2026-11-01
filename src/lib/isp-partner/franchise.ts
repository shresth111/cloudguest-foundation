/** FRANCHISE-2 pure helpers: mirrors of the backend share maths (for the
 * preview line in the plan editor) and range/form checks. */

export function previewIspShare(
  mode: "percent" | "wholesale",
  totalPaise: number,
  zoneShareBp: number,
  wholesalePaise: number,
): number {
  if (mode === "wholesale") return Math.max(0, Math.trunc(wholesalePaise));
  const bp = Math.min(10000, Math.max(0, Math.trunc(zoneShareBp)));
  return Math.max(0, Math.floor((Math.trunc(totalPaise) * (10000 - bp)) / 10000));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function rangeError(from: string, to: string): string | null {
  if (!DAY.test(from) || !DAY.test(to)) return "Pick a start and end date.";
  if (from > to) return "The start date is after the end date.";
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > 400) return "At most 401 days.";
  return null;
}

export function chargeDayError(day: number): string | null {
  return Number.isInteger(day) && day >= 1 && day <= 28
    ? null
    : "Day 1 to 28 (every month has it).";
}
