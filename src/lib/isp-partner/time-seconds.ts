/** Second-precision time helpers for NetLogs (founder ask: per second). */

/** "23 Oct 2026, 12:00:05" in the viewer's zone, always with seconds. */
export function formatDateTimeSeconds(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

/** "12:00:05" (for chart axes and tooltips). */
export function formatClockSeconds(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date as a `<input type="datetime-local" step="1">` value (local zone). */
export function toLocalInput(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** The input's local value as an ISO instant; seconds default to :00. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const d = new Date(withSeconds);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
