/**
 * THE ONE PLACE THE CUSTOMER DASHBOARD TALKS TO AN OMADA CONTROLLER.
 *
 * WHY EVERY OMADA-SPECIFIC CALL IS IN THIS FILE AND NOWHERE ELSE
 * -------------------------------------------------------------
 * The backend routes these controls need are being written right now and their
 * contract was not published when this shipped. That is a normal thing to
 * build against and a dangerous thing to spread: a guessed path, a guessed
 * body and a guessed envelope scattered across four screens is four places to
 * correct and four chances to miss one. So the guess lives here, once, behind
 * named functions, and `src/lib/omada-client-controls.ts` -- which is what the
 * screens actually import -- knows nothing about HTTP.
 *
 * WHAT IS PROVISIONAL, EXACTLY
 * ----------------------------
 * `CUSTOMER_CLIENT_ROUTES_LANDED` below. It is `false`, and while it is false
 * this module issues **no requests at all**: `readClientWrites` resolves to
 * `null` without touching the network, the venue reads as "we can't ask this
 * controller for anything yet", and every device-level control renders greyed
 * with a reason that names our product rather than the customer's hardware.
 *
 * That is deliberate, and it is the opposite of the failure mode
 * CAPABILITY-MATRIX §7 warns about ("Offering the buttons and failing at click
 * time is the failure mode to avoid"). A speculative request to a path that
 * does not exist yet would 404 on every page load of every Omada venue, fill
 * the console's error reporting with a defect that is not one, and -- worse --
 * render as an outage to a venue owner whose venue is fine.
 *
 * WHAT IS NOT PROVISIONAL
 * -----------------------
 * The Master-console path already exists and is not this:
 * `POST /network-integrations/{id}/clients/disconnect`, permission
 * `network_integrations.update`, ScopeType.GLOBAL -- see
 * `omada-disconnect.service.ts`. A venue admin does not hold that permission
 * and `GET /network-integrations` 403s for them, so **nothing in the customer
 * dashboard may call it**. Wiring a customer screen to a Master route is how
 * you ship a 403 to a paying customer; the routes this file waits for are the
 * org-scoped ones.
 *
 * TURNING IT ON
 * -------------
 * When the backend contract is published: correct `WRITES_PATH` and
 * `toClientWrites` against it, flip the constant, and delete this paragraph.
 * Nothing else in the app changes -- the hook, the verdict ladder, the copy
 * and the tests are all already written against `ControllerClientWrites`.
 */
import { api } from "./api";
import { resolveOrganizationId } from "./organization-id";
import type { ControllerClientWrites } from "@/lib/omada-client-controls";
import type { ControllerAuthMode } from "@/types/network-integration";

/**
 * Whether the org-scoped Omada client routes exist in the backend this build
 * talks to.
 *
 * A single boolean rather than a feature flag service on purpose: it is not a
 * rollout decision, it is a statement about which API version is deployed, and
 * it is answered by the same PR that adds the routes.
 */
export const CUSTOMER_CLIENT_ROUTES_LANDED = false;

/**
 * PROVISIONAL PATH. Venue-scoped, because the capability being described is a
 * property of the venue's controller connection and a venue admin holds
 * location-scoped grants, not `network_integrations.*` ones.
 */
const WRITES_PATH = (locationId: string) => `/locations/${locationId}/controller/client-writes`;

/** PROVISIONAL wire shape -- snake_case, as every other backend response here. */
interface BackendClientWrites {
  disconnect?: boolean;
  block?: boolean;
  rate_limit?: boolean;
  auth_mode?: string | null;
}

/**
 * Every field defaults to FALSE, never to true.
 *
 * A missing field means "this build's backend did not say", and the only safe
 * reading of that is that we cannot do it. Defaulting a capability to `true`
 * would put a live button in front of a venue owner on the strength of a field
 * nobody sent -- the same shape of bug as `toResult` in
 * `omada-disconnect.service.ts` refusing to default `disconnected` to
 * anything cheerful.
 */
function toClientWrites(payload: unknown): ControllerClientWrites {
  const envelope = payload as { data?: BackendClientWrites | null } | null;
  const body = envelope?.data ?? {};
  const mode = body.auth_mode;
  return {
    disconnect: body.disconnect === true,
    block: body.block === true,
    rateLimit: body.rate_limit === true,
    authMode: mode === "openapi" || mode === "legacy" ? (mode as ControllerAuthMode) : null,
  };
}

export const omadaClientControlsService = {
  /**
   * What this venue's controller connection can be asked to do, or `null` when
   * nothing has told us.
   *
   * `null` is a first-class answer, not an error case. It is what every Omada
   * venue gets today, and the verdict ladder has a branch for it that produces
   * honest copy -- so a caller must never coalesce it into an empty
   * capabilities object, which would read as "the controller refused" rather
   * than "we have not asked".
   */
  async readClientWrites(locationId: string): Promise<ControllerClientWrites | null> {
    if (!CUSTOMER_CLIENT_ROUTES_LANDED) return null;
    const headers = { "X-Organization-Id": await resolveOrganizationId() };
    const { data } = await api.get<unknown>(WRITES_PATH(locationId), { headers });
    return toClientWrites(data);
  },
};
