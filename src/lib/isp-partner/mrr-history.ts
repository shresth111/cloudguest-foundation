/** SMALL-4: MRR history labels (pure). */
export type MrrSource = "snapshot" | "live" | "billed_proxy";

export const MRR_SOURCE_NOTE: Record<MrrSource, string> = {
  snapshot: "daily snapshot",
  live: "today",
  billed_proxy: "billed (no snapshot)",
};

export function formatDso(days: number | null | undefined): string {
  return days === null || days === undefined ? "–" : `${days.toFixed(1)} days`;
}
