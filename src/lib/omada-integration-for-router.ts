/**
 * Which network integration a TP-Link Omada fleet row belongs to.
 *
 * An Omada controller is a `Router` row (contract §11.3) created by
 * `POST /network-integrations/platform/onboard`, and the integration holds
 * the link: `network_integrations.router_id`. The integration RESPONSE does
 * not echo that column, though -- so the join is read off the one field that
 * does carry it: the External Portal Server URL. The backend builds that URL
 * in `validators.build_external_portal_url` from the integration's own
 * `organization_id`, `location_id` and `router_id`, so its `routerId=` is
 * `router_id` by construction, not by coincidence.
 *
 * That URL is withheld (both halves null) exactly when the integration has
 * no mapped location or no fleet device. Such an integration cannot be
 * joined by id, and it is also the one an operator most needs to see,
 * because its readiness gaps are the whole answer. So when no row names this
 * device, the fallback is every URL-less Omada integration in the same
 * organization that is either at this device's venue or at no venue at all
 * -- each is "possibly this controller, not linked yet", and the panel shows
 * them as that, with their gaps, rather than guessing one.
 *
 * A row whose URL names a DIFFERENT router is never a candidate: it belongs
 * to another fleet device, and showing its values here would hand the
 * operator another venue's portal link.
 *
 * Dependency-free on purpose, like `lib/router-vendors.ts`, so the test can
 * bundle it on its own.
 */
import type { NetworkIntegration } from "@/types/network-integration";

/** The `routerId` query parameter of a backend-built portal URL, or null.
 *
 * `hostAndQuery` is `host/path?query` WITHOUT a scheme (that is the shape
 * the controller's form wants), so it is parsed against a dummy scheme. */
export function portalUrlRouterId(hostAndQuery: string | null | undefined): string | null {
  if (!hostAndQuery) return null;
  try {
    return new URL(`https://${hostAndQuery}`).searchParams.get("routerId");
  } catch {
    return null;
  }
}

export type IntegrationForRouter =
  /** The integration whose portal URL names this device. */
  | { kind: "linked"; integration: NetworkIntegration }
  /** Integrations with no portal URL that could be this device's. */
  | { kind: "unlinked"; candidates: NetworkIntegration[] }
  | { kind: "none" };

export function findIntegrationForRouter(
  rows: NetworkIntegration[],
  router: { id: string; organizationId: string; locationId: string },
): IntegrationForRouter {
  const linked = rows.find((r) => portalUrlRouterId(r.portalUrlHostAndQuery) === router.id);
  if (linked) return { kind: "linked", integration: linked };

  const candidates = rows.filter(
    (r) =>
      r.provider === "omada" &&
      r.organizationId === router.organizationId &&
      !r.portalUrlHostAndQuery &&
      (r.locationId === router.locationId || r.locationId === null),
  );
  return candidates.length > 0 ? { kind: "unlinked", candidates } : { kind: "none" };
}
