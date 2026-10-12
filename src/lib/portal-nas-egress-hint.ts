/**
 * The guest portal's one hint per page load at an Aruba Instant On venue:
 * "this venue's traffic currently leaves from the address this request comes
 * from". The backend (`POST /guest/portal/nas-egress-hint`, cloud-guest
 * `app.domains.guest.nas_egress`) reads the request's real source address
 * and, if it is new and public, adds it to the RADIUS hub as an extra client
 * for this venue's NAS -- so a venue on a dynamic public IP keeps working.
 *
 * Why the portal and not the AP: FreeRADIUS accepts an Access-Request only
 * from a known source address, and the portal page load leaves the venue
 * through the same NAT as the AP's RADIUS packets, well before the guest has
 * typed their OTP (measured on the AP21, 2026-10-03: the venue's address
 * changed from 103.84.202.195 to 111.223.3.241 within an hour).
 *
 * Nothing here identifies the guest: the body is the routerId from our own
 * portal URL plus the AP-appended `apmac` and `nas-id`. Fire-and-forget; a
 * failure is invisible to the guest by design.
 */
import { isArubaInstantOnProvider } from "@/lib/portal-aruba-login";

export interface NasEgressHintBody {
  router_id: string;
  nas_id: string;
  ap_mac: string;
  net_provider: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `apmac` and `nas-id` read straight off the raw URL. Not from the validated
 * search: `nas-id` is not a declared portal param (TanStack drops it), and
 * Aruba may join its parameters to our configured query with a second `?`,
 * which a plain URLSearchParams would fold into the previous value.
 */
export function readArubaEgressParams(href: string): { apMac?: string; nasId?: string } {
  const withoutHash = href.split("#")[0] ?? "";
  const start = withoutHash.indexOf("?");
  if (start < 0) return {};
  const params = new URLSearchParams(withoutHash.slice(start + 1).replace(/\?/g, "&"));
  const apMac = params.get("apmac")?.trim() || undefined;
  const nasId = params.get("nas-id")?.trim() || undefined;
  return { apMac, nasId };
}

/** The hint body, or null when this load has nothing to report: not an
 * Aruba venue, no real routerId, or no AP redirect (a bookmark, a QR code, a
 * reload after the redirect params were dropped). */
export function buildNasEgressHint(args: {
  routerId: string | null | undefined;
  netProvider: string | null | undefined;
  href: string;
}): NasEgressHintBody | null {
  if (!isArubaInstantOnProvider(args.netProvider)) return null;
  const routerId = (args.routerId ?? "").trim();
  if (!UUID_RE.test(routerId)) return null;
  const { apMac, nasId } = readArubaEgressParams(args.href);
  if (!apMac || !nasId) return null;
  return {
    router_id: routerId,
    nas_id: nasId.slice(0, 255),
    ap_mac: apMac.slice(0, 64),
    net_provider: "aruba_instant_on",
  };
}

const sent = new Set<string>();

/** Sends the hint at most once per document per router. Never throws. */
export async function sendNasEgressHintOnce(
  body: NasEgressHintBody | null,
  post: (path: string, body: NasEgressHintBody) => Promise<unknown>,
): Promise<boolean> {
  if (!body || sent.has(body.router_id)) return false;
  sent.add(body.router_id);
  try {
    await post("/guest/portal/nas-egress-hint", body);
    return true;
  } catch {
    return false;
  }
}

/** Test hook only. */
export function __resetNasEgressHintForTests(): void {
  sent.clear();
}
