/** IPDR-2 pure helpers: validate the LEA trace form and build its body. */
import type { LeaTraceBody } from "@/services/isp-partner/ipdr-lea";

export interface LeaForm {
  public_ip: string;
  public_port: string;
  /** `<input type="datetime-local">` value, read as IST. */
  at: string;
  tolerance_seconds: string;
  lea_reference: string;
  reason: string;
  gap_minutes: string;
}

export const EMPTY_LEA: LeaForm = {
  public_ip: "",
  public_port: "",
  at: "",
  tolerance_seconds: "60",
  lea_reference: "",
  reason: "",
  gap_minutes: "5",
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export type LeaResult =
  | { ok: true; body: LeaTraceBody }
  | { ok: false; errors: Partial<Record<keyof LeaForm, string>> };

export function buildLeaBody(f: LeaForm): LeaResult {
  const e: Partial<Record<keyof LeaForm, string>> = {};
  const ip = f.public_ip.trim();
  if (!IPV4.test(ip) && !(ip.includes(":") && /^[0-9a-fA-F:]+$/.test(ip)))
    e.public_ip = "A public IPv4 or IPv6 address.";
  const port = f.public_port.trim();
  if (port && (!/^\d+$/.test(port) || Number(port) > 65535))
    e.public_port = "0 to 65535, or empty.";
  if (!LOCAL_DT.test(f.at)) e.at = "Date and time (IST) from the notice.";
  const tol = Number(f.tolerance_seconds);
  if (!Number.isInteger(tol) || tol < 0 || tol > 900) e.tolerance_seconds = "0 to 900 seconds.";
  const gap = Number(f.gap_minutes);
  if (!Number.isInteger(gap) || gap < 1 || gap > 1440) e.gap_minutes = "1 to 1440 minutes.";
  const ref = f.lea_reference.trim();
  if (ref.length < 3 || ref.length > 100)
    e.lea_reference = "The notice / requisition number (3-100 characters).";
  const reason = f.reason.trim();
  if (reason.length < 3 || reason.length > 500)
    e.reason = "Why this trace is run (3-500 characters).";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(ref)) e.lea_reference = "No line breaks or control characters.";
  if (Object.keys(e).length) return { ok: false, errors: e };
  return {
    ok: true,
    body: {
      public_ip: ip,
      public_port: port ? Number(port) : null,
      at: f.at.length === 16 ? `${f.at}:00` : f.at,
      tz: "Asia/Kolkata",
      tolerance_seconds: tol,
      lea_reference: ref,
      reason,
      gap_minutes: gap,
    },
  };
}

export const CONFIDENCE_TONE: Record<string, string> = {
  high: "online",
  medium: "pending",
  low: "offline",
  none: "normal",
};
