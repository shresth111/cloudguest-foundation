/**
 * THE ONE PLACE THE CUSTOMER DASHBOARD TALKS TO A VENUE'S NETWORK CONTROLLER.
 *
 * WHY EVERY CONTROLLER-SPECIFIC CALL IS IN THIS FILE AND NOWHERE ELSE
 * ------------------------------------------------------------------
 * Six routes, one wire shape, one envelope, one MAC convention. Spread across
 * four screens that would be four places to correct and four chances to miss
 * one. So the contract lives here, once, behind named functions, and
 * `src/lib/omada-client-controls.ts` -- which is what the screens reason
 * with -- knows nothing about HTTP.
 *
 * THE CONTRACT (cloud-guest #270), ALL ORGANIZATION-SCOPED
 * -------------------------------------------------------
 *   GET  /network-integrations/locations/{id}/clients/capabilities  locations.read
 *   POST /network-integrations/locations/{id}/clients/block         guest_access.update
 *   POST /network-integrations/locations/{id}/clients/unblock       guest_access.update
 *   POST /network-integrations/locations/{id}/clients/disconnect    guest_access.update
 *   PUT  /network-integrations/locations/{id}/clients/speed         bandwidth.update
 *   POST /network-integrations/locations/{id}/clients/speed/clear   bandwidth.update
 *
 * **NO ROUTE TAKES AN INTEGRATION ID, A SITE ID OR A CONTROLLER ADDRESS, AND
 * NONE MAY BE ADDED.** That is the tenancy design, not a URL preference: the
 * backend resolves the integration with the caller's own organization AND the
 * location in the WHERE clause, so a location belonging to another tenant
 * resolves to nothing and answers with the same 404 as a location of your own
 * that has no controller. There is no parameter here through which a caller
 * could name somebody else's controller, which is the structural opposite of
 * the path-id defect class this codebase has found in fourteen endpoints.
 *
 * WHAT IS NOT THIS
 * ----------------
 * The Master console's own disconnect exists and is a different route:
 * `POST /network-integrations/{integration_id}/clients/disconnect`, permission
 * `network_integrations.update`, ScopeType.GLOBAL -- see
 * `omada-disconnect.service.ts`. A venue admin holds none of that family and
 * `GET /network-integrations` 403s for them, so **nothing in the customer
 * dashboard may call it**. Wiring a customer screen to a Master route is how
 * you ship a 403 to a paying customer.
 *
 * THE ENVELOPE IS ALREADY OFF
 * ---------------------------
 * `api`'s response interceptor unwraps `{success, message, data, request_id}`,
 * so `response.data` IS the payload. Reading `data.data` here -- which the
 * provisional version of this file did, and which `omada-disconnect.service.ts`
 * still does -- unwraps a second time, finds `undefined`, and every field
 * falls back to its "we cannot" default. That failure is silent and looks
 * exactly like a controller that refused.
 */
import { api } from "./api";
import { resolveOrganizationId } from "./organization-id";
import type {
  ClientActionFacts,
  ClientRateLimitFacts,
  ControllerClientCapabilities,
  ControllerClientCapability,
  ControllerLiveness,
} from "@/lib/omada-client-controls";

/**
 * Whether the org-scoped client routes exist in the backend this build talks
 * to. **True since cloud-guest #270.**
 *
 * A single boolean rather than a feature flag service on purpose: it is not a
 * rollout decision, it is a statement about which API version is deployed, and
 * it is answered by the PR that added the routes.
 *
 * It stays because a build of this console can be pointed at an older backend,
 * and it is the switch that keeps that build off the network rather than
 * 404ing on every page load of every Omada venue. Nothing degrades badly if
 * that happens anyway -- `readCapabilities` reads a 404 as "nothing has told
 * us" -- but not asking is cheaper than asking and discarding.
 */
export const CUSTOMER_CLIENT_ROUTES_LANDED = true;

const BASE = (locationId: string) => `/network-integrations/locations/${locationId}/clients`;

/**
 * The controller round-trip is a live HTTP call from our backend to hardware
 * on the venue's LAN. Same ceiling the Master console's own controller calls
 * use; the default 30s is not enough for a cold Open API token exchange.
 */
const CONTROLLER_TIMEOUT_MS = 60_000;

/** snake_case, exactly as #270's `ClientCapabilityView` writes it. */
interface RawCapability {
  supported?: unknown;
  reason?: unknown;
}

/** snake_case, exactly as #289's `ControllerLivenessView` writes it. */
interface RawLiveness {
  reachable?: unknown;
  checked_at?: unknown;
  reason?: unknown;
}

/** snake_case, exactly as #270's `ClientCapabilitiesResponse` writes it,
 * plus the `controller` block #289 added beside it. */
interface RawCapabilities {
  set_rate_limit?: RawCapability;
  clear_rate_limit?: RawCapability;
  block?: RawCapability;
  unblock?: RawCapability;
  list_blocked?: RawCapability;
  disconnect?: RawCapability;
  client_stats?: RawCapability;
  controller?: RawLiveness | null;
}

/** snake_case, exactly as #270's `ClientRateLimitView` writes it. */
interface RawRateLimit {
  enabled?: unknown;
  applied_down_kbps?: unknown;
  applied_up_kbps?: unknown;
  requested_down_kbps?: unknown;
  requested_up_kbps?: unknown;
  clamped?: unknown;
  read_back?: unknown;
}

/** snake_case, exactly as #270's `ClientActionResponse` writes it. */
interface RawAction {
  action?: unknown;
  performed?: unknown;
  client_mac?: unknown;
  rate_limit?: RawRateLimit | null;
}

/**
 * EVERY CAPABILITY DEFAULTS TO FALSE, NEVER TO TRUE.
 *
 * A missing field means "this build's backend did not say", and the only safe
 * reading of that is that we cannot do it. Defaulting a capability to `true`
 * would put a live button in front of a venue owner on the strength of a field
 * nobody sent, and the owner would meet the refusal at click time -- the exact
 * failure mode CAPABILITY-MATRIX §7 closes on ("Offering the buttons and
 * failing at click time is the failure mode to avoid").
 *
 * The reason is carried through UNEDITED and only where `supported` is false.
 * It is written for the person looking at the disabled control and it names a
 * specific credential in a specific place in the controller's settings tree; a
 * paraphrase would be a second copy of that sentence, and the copy is what
 * goes stale.
 */
function toCapability(raw: RawCapability | undefined): ControllerClientCapability {
  const supported = raw?.supported === true;
  const reason = typeof raw?.reason === "string" ? raw.reason.trim() : "";
  return { supported, reason: !supported && reason ? reason : null };
}

function toCapabilities(payload: RawCapabilities | null | undefined): ControllerClientCapabilities {
  const body = payload ?? {};
  return {
    setRateLimit: toCapability(body.set_rate_limit),
    clearRateLimit: toCapability(body.clear_rate_limit),
    block: toCapability(body.block),
    unblock: toCapability(body.unblock),
    // Always false by design -- the block flag is not readable through the
    // connection this platform holds and an empty list would be a false
    // statement about the venue. Carried so a reader finds the answer where
    // they look for it; NOTHING in this console renders a blocked-device list.
    listBlocked: toCapability(body.list_blocked),
    disconnect: toCapability(body.disconnect),
    clientStats: toCapability(body.client_stats),
  };
}

/**
 * The `controller` block, or `null` WHEN THE BACKEND DID NOT SEND ONE.
 *
 * The null is load-bearing and is not the same as `{reachable: null}`. A build
 * of this console can talk to a backend older than #289, which has no liveness
 * to report; that must leave every venue as it is today (see
 * `controllerIsAnswering`), whereas a backend that DID answer and said
 * `reachable: null` is telling us nobody has looked recently, which degrades
 * the control. Returning an object either way would collapse the two and grey
 * the whole fleet on an older backend.
 *
 * `reachable` is only ever `true`/`false`/`null` -- anything else on the wire
 * (a string, a number) is not a state this product has, and reading it as
 * `null` is the honest coercion: we do not know.
 */
function toLiveness(raw: RawLiveness | null | undefined): ControllerLiveness | null {
  if (!raw || typeof raw !== "object") return null;
  const reachable = typeof raw.reachable === "boolean" ? raw.reachable : null;
  const checkedAt = typeof raw.checked_at === "string" ? raw.checked_at : null;
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  return { reachable, checkedAt, reason: reason ? reason : null };
}

/** A number the backend actually sent, or `null`. `null` on a direction means
 * unlimited -- it is not zero and it is not unknown, and coercing it to 0
 * would render as "stopped". */
function toKbps(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toRateLimit(raw: RawRateLimit | null | undefined): ClientRateLimitFacts | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    enabled: raw.enabled === true,
    appliedDownKbps: toKbps(raw.applied_down_kbps),
    appliedUpKbps: toKbps(raw.applied_up_kbps),
    requestedDownKbps: toKbps(raw.requested_down_kbps),
    requestedUpKbps: toKbps(raw.requested_up_kbps),
    clamped: raw.clamped === true,
    // Defaults to FALSE, like every capability above and for the same reason:
    // a missing field means this build's backend did not say it read anything
    // back, and "we confirmed this with the controller" is not a claim to make
    // on a field nobody sent.
    readBack: raw.read_back === true,
  };
}

/**
 * `performed` FALLS BACK TO FALSE, and that is the whole point of this
 * function.
 *
 * `performed: false` arrives on an HTTP 200 and is a real outcome: the request
 * was well-formed, the credentials were right, and the controller did not do
 * the thing. PR #279 shipped a green tick over exactly this by treating a
 * resolved promise as success. A body we cannot read is not better news than a
 * body that says no.
 */
function toActionFacts(
  payload: unknown,
  sentMac: string,
  fallbackAction: string,
): ClientActionFacts {
  const body = (payload ?? {}) as RawAction;
  return {
    action: typeof body.action === "string" ? body.action : fallbackAction,
    performed: body.performed === true,
    // The backend masks the MAC on the way out. Echo what it sent; fall back
    // to what we sent rather than to an empty string, which would render as an
    // action against no device in particular.
    clientMac: typeof body.client_mac === "string" ? body.client_mac : sentMac,
    rateLimit: toRateLimit(body.rate_limit),
  };
}

async function orgHeaders(locationId: string) {
  return {
    headers: {
      "X-Organization-Id": await resolveOrganizationId(),
      "X-Location-Id": locationId,
    },
    timeout: CONTROLLER_TIMEOUT_MS,
  };
}

/** A 404 from the capabilities read is "this location has no controller
 * connected", which the backend deliberately makes indistinguishable from
 * "that location is not yours". Neither is an error to report; both are
 * "nothing has told us". */
function isNotFound(error: unknown): boolean {
  const status = (error as { status?: unknown; response?: { status?: unknown } } | null)?.status;
  const nested = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return status === 404 || nested === 404;
}

/**
 * The speed a venue asked for: EITHER a speed profile it already picked, OR
 * explicit rates. The backend 422s when both or neither are given, so the
 * union is expressed in the type rather than checked at the call site.
 *
 * kbps, because that is `QueueProfile`'s own unit and a profile's numbers must
 * reach the controller unchanged. `0` on a direction means "do not limit that
 * direction"; clearing a limit is `clearSpeed`, not `0/0`.
 */
export type ClientSpeedRequest =
  | { queueProfileId: string }
  | { downKbps?: number; upKbps?: number };

/**
 * The capabilities read, which answers two separate questions.
 *
 * A pair rather than one flattened object so that neither can be mistaken for
 * the other at a call site: `capabilities` is "can this venue ever", computed
 * from configuration and true while the hardware is off; `controller` is "is
 * it answering", an observation with a timestamp that goes stale. The whole
 * of backend #289 is that those had been collapsed into one.
 */
export interface ControllerCapabilitiesRead {
  capabilities: ControllerClientCapabilities;
  /** `null` when the backend sent no liveness at all -- see `toLiveness`. */
  controller: ControllerLiveness | null;
}

export const omadaClientControlsService = {
  /**
   * What this venue's controller can be asked to do AND whether it is
   * answering -- or `null` when nothing has told us either.
   *
   * `null` is a first-class answer, not an error case: the verdict ladder has
   * a branch for it that produces honest copy, so a caller must never coalesce
   * it into an all-unsupported capabilities object, which would read as "the
   * controller refused" rather than "we could not ask".
   *
   * TWO ANSWERS, NOT ONE, AND THEY ARE KEPT APART ON PURPOSE. `capabilities`
   * says what this venue is configured to be able to do and stays true while
   * its controller is unplugged; `controller` says whether a real call reached
   * it recently. Reading the first as the second is the defect #289 fixed on
   * the backend, and it is why this returns a pair rather than a merged object.
   *
   * Contacts no hardware on the backend side -- the capabilities come from the
   * integration's own auth mode and the liveness from the background sync's
   * cached result -- so it is still safe to call while rendering.
   */
  async readCapabilities(locationId: string): Promise<ControllerCapabilitiesRead | null> {
    try {
      const { data } = await api.get<RawCapabilities | null>(
        `${BASE(locationId)}/capabilities`,
        await orgHeaders(locationId),
      );
      return { capabilities: toCapabilities(data), controller: toLiveness(data?.controller) };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  /** Stop one device joining this venue's network. */
  async blockClient(locationId: string, clientMac: string): Promise<ClientActionFacts> {
    const { data } = await api.post<unknown>(
      `${BASE(locationId)}/block`,
      // The MAC goes out exactly as we hold it: the backend normalizes colon,
      // hyphen and bare-hex forms itself, and reformatting here would add a
      // second place to get it wrong.
      { client_mac: clientMac },
      await orgHeaders(locationId),
    );
    return toActionFacts(data, clientMac, "block");
  },

  /** Let a blocked device back on. Idempotent on the controller. */
  async unblockClient(locationId: string, clientMac: string): Promise<ClientActionFacts> {
    const { data } = await api.post<unknown>(
      `${BASE(locationId)}/unblock`,
      { client_mac: clientMac },
      await orgHeaders(locationId),
    );
    return toActionFacts(data, clientMac, "unblock");
  },

  /**
   * End one device's authorization at this venue, by MAC.
   *
   * NOT the happy path for the Guests screen's Disconnect button.
   * `POST /guest-sessions/{id}/disconnect` already reaches this venue's
   * controller (backend `end_on_router` routes a controller-managed router to
   * `_end_on_controller`), so calling this as well on every disconnect would
   * be a second controller round-trip for the same guest. It is reached only
   * when that call comes back NOT enforced -- a different question asked a
   * different way, by MAC rather than by portal identifier.
   */
  async disconnectClient(locationId: string, clientMac: string): Promise<ClientActionFacts> {
    const { data } = await api.post<unknown>(
      `${BASE(locationId)}/disconnect`,
      { client_mac: clientMac },
      await orgHeaders(locationId),
    );
    return toActionFacts(data, clientMac, "disconnect");
  },

  /**
   * Set one device's speed limit.
   *
   * A profile is sent AS `queue_profile_id` and its rates are read server-side
   * by the domain that owns the model -- which also puts the caller's
   * organization into its own scope check, so another tenant's profile is
   * refused there rather than by a second copy of the rule written here.
   * Re-deriving a profile's numbers in the browser and sending those would
   * mean the console's idea of the profile, not the profile.
   */
  async setSpeed(
    locationId: string,
    clientMac: string,
    request: ClientSpeedRequest,
  ): Promise<ClientActionFacts> {
    const body: Record<string, string | number> = { client_mac: clientMac };
    if ("queueProfileId" in request) {
      body.queue_profile_id = request.queueProfileId;
    } else {
      // Only the directions that were named. Sending `null` for the other one
      // is not the same as omitting it to a validator that counts "rates were
      // named" by presence.
      if (typeof request.downKbps === "number") body.down_kbps = request.downKbps;
      if (typeof request.upKbps === "number") body.up_kbps = request.upKbps;
    }
    const { data } = await api.put<unknown>(
      `${BASE(locationId)}/speed`,
      body,
      await orgHeaders(locationId),
    );
    return toActionFacts(data, clientMac, "set_rate_limit");
  },

  /** Remove one device's speed limit. A separate route, not `0/0`. */
  async clearSpeed(locationId: string, clientMac: string): Promise<ClientActionFacts> {
    const { data } = await api.post<unknown>(
      `${BASE(locationId)}/speed/clear`,
      { client_mac: clientMac },
      await orgHeaders(locationId),
    );
    return toActionFacts(data, clientMac, "clear_rate_limit");
  },
};
