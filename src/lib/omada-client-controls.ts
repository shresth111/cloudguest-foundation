/**
 * Which guest controls a controller-managed venue actually gets, and the
 * sentence a venue owner reads where it does not get one.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A venue admin should not have to know what hardware their venue runs. The
 * customer dashboard offers five things: end a guest's access, block a guest,
 * cap the guest network's speed, give a guest tier its own speed, and time a
 * session out. Every one of them was written for a MikroTik and shipped
 * unchanged to venues whose access points are a TP-Link Omada controller.
 * Two of them work there. Three of them reach no device and said nothing.
 *
 * "Said nothing" is the defect. A speed set at an Omada venue is accepted,
 * saved, read back and shown as active -- and the only thing that consumes a
 * BANDWIDTH policy is `queue_management`, which writes RouterOS
 * `/queue simple`. There is no queue on an Omada controller, no adapter
 * registered for one, and therefore no device anywhere that was ever going to
 * hear about that number. Same shape as the five Network screens
 * `router-vendors.ts` already gates: the backend refuses by vendor, correctly,
 * and the venue owner meets the refusal only after filling in the form -- or
 * in this case never, because saving a policy row succeeds.
 *
 * So the rule this module encodes is the one the rest of this console already
 * uses: where the thing cannot happen, the control is greyed and NAMED, never
 * hidden and never left looking live. And where it half-happens, it is left
 * live and the half is said out loud -- which is what `block-outcome.ts` does
 * after the fact, and what this does before the click.
 *
 * WHY IT IS PURE AND DEPENDENCY-LIGHT
 * -----------------------------------
 * Same reason as `omada-disconnect.ts`: `scripts/test-omada-client-controls.mjs`
 * bundles this module alone and drives every venue shape, including the ones a
 * browser would make you click through. A copy of this ladder inside a screen
 * would drift from the copy that ships, which is the bug `block-outcome.ts`
 * exists to avoid.
 *
 * EVERY SENTENCE BELOW IS BOUNDED BY A MEASUREMENT
 * ------------------------------------------------
 * `~/wyfy-omada/CAPABILITY-MATRIX.md` §10 is a list of things we must not
 * promise, and three of them are things this console would otherwise say by
 * accident:
 *
 *   §10.4  Nobody has measured a client's throughput before and after a
 *          throttle. The controller accepts, stores and returns the limit;
 *          that is a control-plane claim and nothing more. No copy here says
 *          "enforced" or "guaranteed" about a speed.
 *   §10.5  A block is per-site and per-MAC, and modern phones randomise their
 *          MAC per SSID. It is a deterrent, not a lock, and the copy says so.
 *   §10.6  What a block does to an ALREADY-AUTHORISED guest is UNMEASURED. No
 *          sentence here claims a block cuts a live guest off.
 */
import type { ControllerAuthMode } from "@/types/network-integration";

// ---------------------------------------------------------------------------
// The controls.
// ---------------------------------------------------------------------------

/**
 * The guest controls the customer dashboard offers, named as the SCREENS name
 * them rather than as the backend does.
 *
 * A union rather than a string so the day a sixth control lands, the switch
 * below fails typecheck instead of silently returning "available".
 */
export type ClientControlId =
  /** Guests -> "Disconnect". End this guest's access right now. */
  | "disconnect"
  /** Access Rules -> Blocked Guests. Bar an identifier from signing in. */
  | "block-signin"
  /** The device half of a block: stop this MAC getting on the network at all. */
  | "block-device"
  /** Access Rules -> Guest WiFi Limits -> the venue's guest speed. */
  | "speed-limit"
  /** Access Rules -> Access Tiers -> a tier's own speed. */
  | "speed-profile"
  /** Access Rules -> session timeout, on either of those two tabs. */
  | "session-timeout";

export const CLIENT_CONTROL_IDS: readonly ClientControlId[] = [
  "disconnect",
  "block-signin",
  "block-device",
  "speed-limit",
  "speed-profile",
  "session-timeout",
];

/**
 * How well a control works at this venue.
 *
 *  - `available`   it does what its label says, exactly as at a MikroTik
 *                  venue. Nothing renders differently.
 *  - `qualified`   it works, and it promises less than its label implies. The
 *                  control stays LIVE and a caveat renders beside it. This is
 *                  the honest middle `block-outcome.ts` occupies after the
 *                  fact; said before the click, it is not an apology.
 *  - `unavailable` it cannot work here. The control renders greyed, with
 *                  `reason`, and is not submittable.
 *
 * `qualified` is deliberately not collapsed into `available`: a caveat that
 * only appears afterwards is an apology, and the point of this module is to
 * say it first.
 */
export type ControlAvailability = "available" | "qualified" | "unavailable";

export interface ClientControlVerdict {
  control: ClientControlId;
  availability: ControlAvailability;
  /**
   * Why, in one sentence, in a venue owner's vocabulary. Never null for
   * `unavailable` or `qualified`; always null for `available`, so a caller
   * cannot render a warning over a control that works.
   */
  reason: string | null;
}

// ---------------------------------------------------------------------------
// What the platform can ask this venue's controller to do.
// ---------------------------------------------------------------------------

/**
 * The per-client writes a venue's controller connection supports, as the
 * BACKEND reports them.
 *
 * WHY THIS IS A REPORTED SHAPE AND NOT AN `authMode` CHECK HERE
 * ------------------------------------------------------------
 * The obvious implementation is `authMode === "openapi"`, because that is the
 * capability line on the controller: per-client rate limit and block/unblock
 * exist on the internal v2 and Open API surfaces and do not exist at all on
 * the hotspot-operator surface. CAPABILITY-MATRIX §7 is explicit -- the only
 * per-client verbs published under `/hotspot/` are authorize, unauth,
 * authed-record disconnect/period/delete, and a rate-limit profile LIST -- so
 * "a venue configured `auth_mode: legacy` can have none of" per-client speed
 * or block.
 *
 * The customer dashboard cannot see `authMode`. Backend `074d719` moved every
 * `network_integrations.*` route to GLOBAL scope, so `GET /network-integrations`
 * 403s for a venue owner, and `useVenueIntegration` is gated on a permission
 * they do not hold. Deriving the capability line here from something a venue
 * admin CAN see would be a second definition of it, drifting from the
 * backend's -- the exact failure `router-vendors.ts` warns about when it
 * refuses to re-read `vendor` next to `location-liveness.ts`.
 *
 * So the frontend does not decide. It reports what the backend says, and when
 * the backend says nothing -- which is today -- `null` is the honest answer
 * and every device-level write is `unavailable` with a reason that names our
 * own product rather than blaming the venue's hardware.
 *
 * PROVISIONAL, AND DELIBERATELY NARROW. These field names mirror the
 * `openapi`-vs-`legacy` capability table the backend is publishing for the
 * customer-scoped Omada client routes. Nothing reads them off the wire yet;
 * `src/services/omada-client-controls.service.ts` is the single place that
 * will, and it is the only file that changes when the contract lands.
 */
export interface ControllerClientWrites {
  /**
   * End one guest's authorization on the controller.
   *
   * Rides the hotspot OPERATOR session, so it is the one per-client write a
   * `legacy` venue has -- proved on real hardware 2026-09-11 and recorded in
   * `omada-disconnect.ts`, against a change request that said the opposite.
   */
  disconnect: boolean;
  /** `POST .../clients/{mac}/block`. v2 + Open API only, never legacy. */
  block: boolean;
  /** `PATCH .../clients/{mac}/ratelimit`. v2 + Open API only, never legacy. */
  rateLimit: boolean;
  /**
   * Which credentials the connection holds, when the backend reports it.
   * Read ONLY by copy that names the fix -- never as the capability itself,
   * for the reason in this interface's docstring.
   */
  authMode: ControllerAuthMode | null;
}

/**
 * What a customer screen knows about the venue it is rendering.
 *
 * `controllerManaged` comes from `locationIsControllerManaged`, which is
 * `every`, not `some`: a venue with a MikroTik alongside a controller is NOT
 * controller-managed, because the MikroTik is real and these controls
 * genuinely act on it. A venue whose routers could not be read is not
 * controller-managed either. Both fail open to today's behaviour, deliberately
 * and for the same reason that predicate already does.
 */
export interface ControllerVenueFacts {
  controllerManaged: boolean;
  /**
   * Raw `routers.vendor` (e.g. `"tplink_omada"`), or null when the persisted
   * venue summary predates the field. Only decides whether copy names a brand.
   */
  vendor: string | null;
  /** What the backend says this venue's controller can be asked to do, or
   * null when nothing has told us. */
  writes: ControllerClientWrites | null;
}

// ---------------------------------------------------------------------------
// The words.
// ---------------------------------------------------------------------------

/**
 * "a TP-Link Omada controller", or a vendor-neutral fallback.
 *
 * Local rather than an import of `routerVendorLabel`: this module is bundled
 * alone by its test, and one brand string is not worth depending on a
 * 794-line module that pulls in tab definitions and liveness vocabulary.
 */
function controllerNoun(vendor: string | null): string {
  const v = (vendor ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, "");
  return v === "omada" || v === "tplinkomada"
    ? "a TP-Link Omada controller"
    : "a network controller";
}

/** The same noun at the start of a sentence. */
function ControllerNoun(vendor: string | null): string {
  const n = controllerNoun(vendor);
  return n[0].toUpperCase() + n.slice(1);
}

/**
 * The sentence for a device-level write the controller CAN make and we have no
 * customer-facing route for yet.
 *
 * It says the gap is ours, because it is: the controller accepts these writes
 * and returns them (CAPABILITY-MATRIX §3.1 and §4.1-4.3, measured on hardware
 * 2026-09-18). Blaming a customer's controller for a hole in our own product
 * is the copy that gets the controller replaced instead of the hole filled.
 */
function notWiredYet(what: string, vendor: string | null): string {
  return (
    `This venue's WiFi runs on ${controllerNoun(vendor)}. ${what} isn't something your ` +
    "dashboard can do here yet — ask your Wyfy Guest contact and we'll set it on the controller " +
    "for you."
  );
}

/**
 * The sentence for a write the credentials we hold genuinely cannot make.
 *
 * Names the fix and who performs it. CAPABILITY-MATRIX §7 closes with the
 * warning this sentence exists to honour: "Offering the buttons and failing at
 * click time is the failure mode to avoid."
 */
function needsOpenApi(what: string, vendor: string | null): string {
  return (
    `This venue's WiFi runs on ${controllerNoun(vendor)}, and the connection we hold for it can ` +
    `sign guests in but cannot ${what}. Ask your Wyfy Guest contact to add Open API credentials ` +
    "to this venue's controller."
  );
}

/**
 * The caveat on a block that DOES reach the device.
 *
 * Two true things in the order that matters: the first is why the feature is
 * worth using, the second is CAPABILITY-MATRIX §10.5. The second is true at a
 * MikroTik venue too; it is said here because this is where the owner is
 * deciding whether a block is the tool they want.
 *
 * What it does NOT say: anything about a guest who is connected right now.
 * §10.6 is UNMEASURED, and `block-outcome.ts` reports that from what the
 * server actually did, which is the only honest place for it.
 */
export const BLOCK_DEVICE_CAVEAT =
  "Blocking stops this person signing in again, and asks the controller to keep their device " +
  "off the network. A phone can come back under a new random Wi-Fi address, so treat it as a " +
  "deterrent rather than a lock.";

/**
 * The caveat on any speed we successfully set. CAPABILITY-MATRIX §10.4.
 *
 * "ask" and "cap", never "enforce" or "guarantee": we have measured the
 * controller accept, store and return a limit, and nobody has measured a
 * device's actual throughput before and after.
 */
export const SPEED_LIMIT_CAVEAT =
  "We ask the network to hold guests to this speed. Nobody has measured what a device actually " +
  "gets afterwards, so treat it as a cap rather than a promise.";

/**
 * The ceiling we enforce on a per-client speed, in Mbps.
 *
 * CAPABILITY-MATRIX §3.1 and §10.9: TP-Link's own contract is 1-1024 with a
 * Kbps/Mbps unit. The internal v2 endpoint does NOT enforce it -- 5000 Mbps
 * was accepted and read back -- but a controller storing a number is not an
 * access point honouring it, and there is no evidence it does above 1024. We
 * enforce the documented contract ourselves rather than pass an unbounded
 * number through and call the result a speed.
 */
export const CONTROLLER_SPEED_LIMIT_MAX_MBPS = 1024;

// ---------------------------------------------------------------------------
// The ladder.
// ---------------------------------------------------------------------------

const AVAILABLE = (control: ClientControlId): ClientControlVerdict => ({
  control,
  availability: "available",
  reason: null,
});

/**
 * What this venue gets for one control.
 *
 * A NON-CONTROLLER VENUE IS RETURNED UNTOUCHED, ALWAYS, ON THE FIRST LINE.
 * Every MikroTik venue -- and every mixed venue, and every venue whose routers
 * could not be read -- exits immediately with `available` and a null reason,
 * which is exactly what these screens render today. That single early return
 * is the whole "a MikroTik venue behaves identically" guarantee, and
 * `scripts/test-omada-client-controls.mjs` asserts it positively rather than
 * by absence.
 */
export function clientControlVerdict(
  control: ClientControlId,
  venue: ControllerVenueFacts,
): ClientControlVerdict {
  if (!venue.controllerManaged) return AVAILABLE(control);

  const { vendor, writes } = venue;

  switch (control) {
    // -----------------------------------------------------------------
    // Ending one guest's access.
    // -----------------------------------------------------------------
    case "disconnect": {
      // The platform half -- closing our own GuestSession row -- is real at
      // every venue on every vendor and already happens. What differs is
      // whether anything then removes the DEVICE. At a MikroTik venue
      // `POST /connected-devices/{id}/disconnect` reaches the RouterOS
      // adapter and clears the wireless registration and the DHCP lease; at a
      // controller venue that adapter refuses by vendor and
      // `customerService.disconnectSession` swallows the refusal, so the
      // guest keeps their address and their association.
      //
      // `qualified`, not `unavailable`: ending the session is real, useful,
      // and it is what most owners actually want. Greying the button would
      // take away a control that works.
      if (writes?.disconnect) return AVAILABLE(control);
      return {
        control,
        availability: "qualified",
        reason:
          `This venue's WiFi runs on ${controllerNoun(vendor)}. We'll end this guest's Wyfy ` +
          "session and they'll have to sign in again — but we can't yet ask the controller to " +
          "drop their device, so it may stay connected until it reconnects on its own.",
      };
    }

    // -----------------------------------------------------------------
    // Blocking.
    // -----------------------------------------------------------------
    case "block-signin":
      // Barring an identifier from signing in again is a row in our own
      // database, read by our own portal, at every venue on every vendor.
      // It already works at an Omada venue and is deliberately not gated:
      // gating it would remove the one half of blocking that is whole.
      return AVAILABLE(control);

    case "block-device": {
      if (writes?.block) {
        return { control, availability: "qualified", reason: BLOCK_DEVICE_CAVEAT };
      }
      if (writes) {
        return {
          control,
          availability: "unavailable",
          reason: needsOpenApi("keep a device off the network", vendor),
        };
      }
      return {
        control,
        availability: "unavailable",
        reason: notWiredYet("Keeping a device off the network entirely", vendor),
      };
    }

    // -----------------------------------------------------------------
    // Speed.
    // -----------------------------------------------------------------
    case "speed-limit": {
      if (writes?.rateLimit) {
        return { control, availability: "qualified", reason: SPEED_LIMIT_CAVEAT };
      }
      if (writes) {
        return {
          control,
          availability: "unavailable",
          reason: needsOpenApi("set guest speeds", vendor),
        };
      }
      // THE ONE THAT WAS SILENTLY DOING NOTHING.
      //
      // A speed saved here becomes a BANDWIDTH policy, and the only thing on
      // this platform that consumes one is `queue_management`, which writes
      // RouterOS `/queue simple`. There is no queue on a controller and no
      // adapter registered for one, so the number was stored, read back,
      // displayed as active, and never reached a device. Naming the
      // alternative matters as much as naming the gap: the controller can cap
      // the guest network as a whole (CAPABILITY-MATRIX §2.4), which is a real
      // thing an owner can have today by asking.
      return {
        control,
        availability: "unavailable",
        reason:
          `Guest speeds are applied by the venue's router, and this venue's WiFi runs on ` +
          `${controllerNoun(vendor)} instead — a speed set here would never reach anybody's ` +
          "device. Your Wyfy Guest contact can cap the guest network on the controller for you.",
      };
    }

    case "speed-profile": {
      if (writes?.rateLimit) {
        // Worth saying even when it works, because the SHAPE differs from
        // MikroTik and an owner will notice: on a router the tier's speed
        // arrives with the guest's sign-in, and on a controller it is a
        // separate write once they are already online.
        return {
          control,
          availability: "qualified",
          reason: `${SPEED_LIMIT_CAVEAT} At this venue a tier's speed is applied once the guest is online, a moment after they sign in.`,
        };
      }
      if (writes) {
        return {
          control,
          availability: "unavailable",
          reason: needsOpenApi("give a tier its own speed", vendor),
        };
      }
      return {
        control,
        availability: "unavailable",
        reason:
          `A tier's speed is applied by the venue's router when a guest signs in, and this ` +
          `venue's WiFi runs on ${controllerNoun(vendor)} instead — a speed set here would ` +
          "never reach anybody's device. Everything else about a tier still applies: how long " +
          "guests get, how many devices, and their daily limit.",
      };
    }

    // -----------------------------------------------------------------
    // Session timeout.
    // -----------------------------------------------------------------
    case "session-timeout":
      // Real, and ours. The timeout is held and expired by this platform,
      // which is why it works at a controller venue at all -- unlike the
      // speed above, nothing about it depends on a device adapter. What the
      // controller does not do is count the guest's minutes down itself, so
      // the end of a session is our expiry plus the disconnect above, and it
      // inherits that disconnect's gap.
      //
      // `qualified` rather than `available` for exactly that reason: the
      // label promises the guest goes offline, and today only half of that is
      // certain. When the controller write lands, both halves are, and this
      // returns `available` with nothing rendered beside it.
      if (writes?.disconnect) return AVAILABLE(control);
      return {
        control,
        availability: "qualified",
        reason:
          "Wyfy ends the session when the time is up and the guest has to sign in again. " +
          `${ControllerNoun(vendor)} doesn't count the time down itself, so a device that is ` +
          "already connected may stay on until it reconnects.",
      };
  }
}

// ---------------------------------------------------------------------------
// AFTER the click: what actually happened.
// ---------------------------------------------------------------------------

/**
 * What the server said a disconnect did.
 *
 * `sessionEnforced` is `guest_sessions.disconnect_enforced`, which the backend
 * has always returned and this dashboard has always discarded. It is a
 * TRI-STATE and every state means something different:
 *
 *   true   the router acknowledged removing the device.
 *   false  we asked something to remove the device and it did not happen --
 *          at a MikroTik venue that is a fault, at a controller venue it is
 *          the guaranteed outcome, because `get_guest_access_adapter` has one
 *          vendor in it and the synthetic controller row has no credentials.
 *   null   nothing tried. Not a failure; the absence of an attempt.
 *
 * `deviceDisconnected` is the separate, best-effort `/connected-devices/{id}/disconnect`
 * loop. At a controller venue there are usually no `connected_devices` rows at
 * all -- the sync that writes them is a MikroTik DHCP-lease read -- so it is
 * false there for a second, independent reason.
 */
export interface DisconnectOutcomeFacts {
  sessionEnforced: boolean | null;
  deviceDisconnected: boolean;
  /** The pre-click verdict, so one venue fact decides both halves. */
  verdict: ClientControlVerdict;
}

export type DisconnectOutcome =
  /** The device was confirmed off the network. */
  | "device-cleared"
  /** Our session is closed; the venue's hardware was never going to be asked. */
  | "controller-venue"
  /** Our session is closed; something tried to clear the device and failed. */
  | "not-cleared"
  /** Our session is closed and nothing looked at the device. */
  | "session-only";

/**
 * Which of the four things happened. Ordered so the strongest CONFIRMED claim
 * wins and no claim is ever made twice.
 *
 * The controller branch sits ABOVE the failure branch deliberately. At a
 * controller venue `sessionEnforced` is false on every single call, and
 * rendering that as "we could not take them off the WiFi -- check the router
 * and try again" sends an owner to look at hardware that is behaving
 * correctly, to retry something that cannot succeed. It is a property of the
 * venue, not an incident.
 */
export function disconnectOutcome(facts: DisconnectOutcomeFacts): DisconnectOutcome {
  if (facts.sessionEnforced === true || facts.deviceDisconnected) return "device-cleared";
  if (facts.verdict.availability !== "available") return "controller-venue";
  if (facts.sessionEnforced === false) return "not-cleared";
  return "session-only";
}

/** Every verdict for a venue, in a stable order, for a screen that wants to
 * show the whole picture rather than gate one control. */
export function clientControlVerdicts(venue: ControllerVenueFacts): ClientControlVerdict[] {
  return CLIENT_CONTROL_IDS.map((c) => clientControlVerdict(c, venue));
}

/** Convenience for the common render: may this control be submitted? */
export function controlIsUsable(verdict: ClientControlVerdict): boolean {
  return verdict.availability !== "unavailable";
}
