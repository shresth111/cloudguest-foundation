/** SMALL-5: auto incident helpers (pure). */
export const AUTO_INCIDENT_KEYS = {
  settings: ["isp", "incident-auto", "settings"] as const,
  marks: ["isp", "incident-auto", "marks"] as const,
};

/** The BE accepts 1..240 whole minutes. */
export function minutesProblem(raw: string): string | null {
  const n = Number(raw);
  if (!/^\d+$/.test(raw.trim()) || n < 1 || n > 240)
    return "Minutes are a whole number from 1 to 240.";
  return null;
}

/** Tooltip for the "Auto" tag. */
export function autoMarkTitle(m: { auto_resolved: boolean; closed_at: string | null }): string {
  if (m.auto_resolved)
    return "Opened and resolved automatically (router back up). No automatic grace.";
  if (m.closed_at) return "Opened automatically; resolved by staff.";
  return "Opened automatically: the router stayed down.";
}
