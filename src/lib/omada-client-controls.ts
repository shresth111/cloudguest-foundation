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
 * "Said nothing" is the defect. A speed set at an Omada venue was accepted,
 * saved, read back and shown as active -- and the only thing that consumes a
 * BANDWIDTH policy is `queue_management`, which wrote RouterOS
 * `/queue simple`. There was no queue on an Omada controller, no adapter
 * registered for one, and therefore no device anywhere that was ever going to
 * hear about that number. Same shape as the five Network screens
 * `router-vendors.ts` already gates: the backend refuses by vendor, correctly,
 * and the venue owner meets the refusal only after filling in the form -- or
 * in this case never, because saving a policy row succeeds.
 *
 * WHAT CHANGED, AND WHAT DID NOT (cloud-guest #270)
 * -------------------------------------------------
 * The venue's controller now declares what it can do, per action, and this
 * module reports that declaration instead of guessing at it. Three of those
 * gaps closed on the backend at the same time: `apply_queue` routes a
 * controller-managed router to its controller rather than to a queue adapter
 * that has one vendor in it, `end_on_router` does the same for a disconnect,
 * and per-client block/unblock/rate-limit exist as venue-scoped routes.
 *
 * What did NOT change is the shape of the honesty. A capability that says no
 * still greys its control and still renders a reason -- the backend's own
 * sentence now, which names the credential and where to add it, rather than a
 * paraphrase of it kept here. And an action that succeeds still promises no
 * more than was measured: §10.4, §10.5 and §10.6 below are unchanged and are
 * still executed as assertions.
 *
 * So the rule this module encodes is the one the rest of this console already
 * uses: where the thing cannot happen, the control is greyed and NAMED, never
 * hidden and never left looking live. And where it half-happens, it is left
 * live and the half is said out loud -- which is what `block-outcome.ts` does
 * after the fact, and what this does before the click.
 *
 * A CAPABILITY IS NOT A HEARTBEAT (cloud-guest #289)
 * --------------------------------------------------
 * The declaration above answers "can this venue ever do X". The backend
 * computes it from the integration's `auth_mode` and contacts nothing, which
 * is correct -- this console asks on every render, and a controller round trip
 * per painted button is not a thing to add to a render path.
 *
 * It was also being read as "will X work if I click it", which it cannot
 * answer. At an `openapi` venue every capability is supported by construction,
 * whether the controller is alive, unreachable, or switched off at the wall.
 * So a venue whose controller had been dark for a day saw a fully enabled
 * Bandwidth control and no notice at all -- while the honest sentence for
 * exactly that situation already existed a few lines below and read correctly.
 * It was wired to the wrong trigger: it fired only when OUR OWN capabilities
 * read failed.
 *
 * `ControllerVenueFacts.controller` is the second answer, and
 * `controllerIsAnswering` is where it is consulted -- once, at the top of each
 * of the two exported functions, normalizing a dark controller into the "we
 * could not ask" state this ladder already handles for every control. No new
 * copy, no second vocabulary, and no per-capability liveness flag: whether a
 * connection is answering is a fact about the connection, not about one verb.
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

export interface ControlVerdict<Id extends string = string> {
  control: Id;
  availability: ControlAvailability;
  /**
   * Why, in one sentence, in a venue owner's vocabulary. Never null for
   * `unavailable` or `qualified`; always null for `available`, so a caller
   * cannot render a warning over a control that works.
   *
   * Where the backend has given a reason, this IS that string, unedited.
   */
  reason: string | null;
}

export type ClientControlVerdict = ControlVerdict<ClientControlId>;

/**
 * The four per-device actions the Guests panel offers, named as the backend's
 * capability map names them rather than as the screen labels them, because
 * each one is gated on exactly one capability and nothing else.
 *
 * There is no `list-blocked`. See `ControllerClientCapabilities`.
 */
export type DeviceActionId = "block" | "unblock" | "speed" | "speed-clear";

export type DeviceActionVerdict = ControlVerdict<DeviceActionId>;

// ---------------------------------------------------------------------------
// What the platform can ask this venue's controller to do.
// ---------------------------------------------------------------------------

/**
 * One per-client action, and whether this venue's controller connection can
 * perform it, as the BACKEND reports it.
 *
 * `reason` is populated only when `supported` is false, and the backend writes
 * it FOR THE PERSON LOOKING AT THE DISABLED CONTROL. It is rendered verbatim
 * (see `capabilityReason` below): paraphrasing it here would be a second copy
 * of a sentence that names a specific credential and a specific place in the
 * controller's own settings tree, and the paraphrase is what would go stale.
 */
export interface ControllerClientCapability {
  supported: boolean;
  reason: string | null;
}

/**
 * The seven per-client actions the backend declares for a venue, named exactly
 * as `GET /network-integrations/locations/{id}/clients/capabilities` names
 * them (camelCased at the wire boundary and nowhere else).
 *
 * WHY THIS IS A REPORTED SHAPE AND NOT AN `authMode` CHECK HERE
 * ------------------------------------------------------------
 * The obvious implementation is `authMode === "openapi"`, because that is the
 * capability line on the controller: per-client rate limit and block/unblock
 * exist on the Open API surface and do not exist at all on the
 * hotspot-operator surface. CAPABILITY-MATRIX §7 is explicit -- the only
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
 * the backend has told us nothing, `null` -- not an all-false object -- is the
 * honest answer. The two are different sentences to a venue owner and the
 * ladder below keeps them apart.
 *
 * `listBlocked` IS DECLARED AND IS NEVER TRUE. The controller does not expose
 * the block flag through the connection this platform holds, and an empty list
 * would be this product asserting that the venue has blocked nobody. It is
 * carried here so that a future reader finds the answer where they look for
 * it, and so that a screen tempted to render such a list finds `supported:
 * false` and a sentence saying where the real list is. Nothing in this console
 * renders a blocked-device list.
 */
export interface ControllerClientCapabilities {
  setRateLimit: ControllerClientCapability;
  clearRateLimit: ControllerClientCapability;
  block: ControllerClientCapability;
  unblock: ControllerClientCapability;
  listBlocked: ControllerClientCapability;
  /**
   * End one guest's authorization on the controller.
   *
   * Rides the hotspot OPERATOR session, so it is the one per-client action a
   * `legacy` venue keeps -- proved on real hardware 2026-09-11 and recorded in
   * `omada-disconnect.ts`, against a change request that said the opposite.
   */
  disconnect: ControllerClientCapability;
  clientStats: ControllerClientCapability;
}

/** True only when the backend said so. Anything else -- no answer, a missing
 * field, a field of the wrong type -- reads as "we cannot do it". */
export function capabilityIsSupported(
  capability: ControllerClientCapability | undefined | null,
): boolean {
  return capability?.supported === true;
}

/**
 * Whether this venue's controller is ANSWERING -- a different question from
 * any capability above, and the one that was missing.
 *
 * A capability is computed by the backend from the integration's `auth_mode`
 * and contacts nothing. That is correct for "can this venue ever do X" (this
 * console asks on every render and must not make a controller round trip to
 * paint a button) and it cannot answer "is X going to work if I click it".
 * An `openapi` venue reports every action supported while its controller is
 * unplugged, so the Bandwidth control rendered fully live and the venue saw
 * no notice at all.
 *
 * `reachable` mirrors backend #289's `controller` block and is TRI-STATE:
 *
 *  - `true`   a real call reached the controller recently and worked.
 *  - `false`  a recent check did not get through.
 *  - `null`   nobody has looked recently enough to say -- the check has never
 *             run, or it has stopped running.
 *
 * `false` and `null` are different facts and the backend keeps them apart, but
 * to a control that needs the controller they mean the same thing: we cannot
 * promise this will work. Only `true` enables.
 */
export interface ControllerLiveness {
  reachable: boolean | null;
  /** ISO timestamp of that check, or null when none has ever run. */
  checkedAt: string | null;
  /** The backend's sentence for a non-`true` state. Not rendered by this
   * module -- see `controllerIsAnswering` -- but carried so a screen that
   * wants to show WHEN we last looked has it. */
  reason: string | null;
}

/**
 * Does the backend say this venue's controller is answering?
 *
 * ABSENCE IS NOT A REFUSAL, and this is the one place that distinction is
 * made. A build of this console can be pointed at a backend older than #289,
 * which sends no `controller` block at all; that is "nothing told us about
 * liveness", and it must leave every venue exactly as it is today rather than
 * grey every controller-dependent control in the fleet on the strength of a
 * field nobody sent. So a MISSING object answers `true` (carry on), while a
 * PRESENT object whose `reachable` is not `true` answers `false`.
 *
 * The asymmetry with `capabilityIsSupported` above -- which defaults to "we
 * cannot" -- is deliberate and is the opposite trade for a reason. There, a
 * missing field would put a live button in front of an owner. Here, a missing
 * field would take working controls away from every venue on an older
 * backend. In both cases the default is the one that cannot invent a claim.
 */
export function controllerIsAnswering(controller: ControllerLiveness | undefined | null): boolean {
  if (!controller) return true;
  return controller.reachable === true;
}

/** The backend's own sentence, or null. Never a paraphrase, and never a
 * non-empty string for a capability that IS supported -- rendering a warning
 * beside a working control is how a console teaches owners to ignore them. */
function capabilityReason(
  capability: ControllerClientCapability | undefined | null,
): string | null {
  if (!capability || capability.supported) return null;
  const reason = capability.reason?.trim();
  return reason ? reason : null;
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
  /**
   * What the backend says this venue's controller can be asked to do, or
   * `null` when nothing has told us -- a venue with no controller connected to
   * it, or a read that did not come back. `null` is NOT the same as an
   * all-unsupported object: one says "we could not ask", the other says "we
   * asked and the answer was no", and they get different sentences below.
   */
  capabilities: ControllerClientCapabilities | null;
  /**
   * Whether that controller is currently answering, or `null`/absent when the
   * backend did not say (see `controllerIsAnswering`).
   *
   * Optional so a build talking to a pre-#289 backend keeps every venue
   * exactly as it is today rather than degrading the whole fleet on a field
   * nobody sent.
   */
  controller?: ControllerLiveness | null;
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
 * The sentence for a control we could not get an answer about.
 *
 * Reached when `capabilities` is null at a venue we believe is
 * controller-managed: the capabilities read 404'd (no controller connection is
 * linked to this location, or the site on it was never chosen) or it did not
 * come back at all. Either way the honest statement is that WE could not ask,
 * not that the venue's hardware refused -- blaming a customer's controller for
 * a gap on our side is the copy that gets the controller replaced instead of
 * the gap closed.
 */
function couldNotAsk(what: string, vendor: string | null): string {
  return (
    `This venue's WiFi runs on ${controllerNoun(vendor)}, and we couldn't reach its connection to ` +
    `check whether ${what} is possible here — ask your Wyfy Guest contact and we'll look at it ` +
    "with you."
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
  "Blocking stops this person signing in again. Where you can see their device — Guests, then " +
  "the device panel on that guest — we can also ask the controller to keep that device off the " +
  "network. A phone can come back under a new random Wi-Fi address, so treat that half as a " +
  "deterrent rather than a lock.";

/**
 * The same two true things, said where the DEVICE itself is named: the guest
 * panel in Guests, whose button calls the controller's block directly.
 *
 * Separate from `BLOCK_DEVICE_CAVEAT` because that one is read on Blocked
 * Guests, where the thing being blocked is a phone number and the device half
 * is somewhere else. Here the device is on screen and the sign-in half is
 * somewhere else. Neither sentence may be used in the other's place without
 * pointing an owner at the screen they are already on.
 *
 * Says nothing about a guest who is connected right now: CAPABILITY-MATRIX
 * §10.6 is UNMEASURED.
 */
export const BLOCK_THIS_DEVICE_CAVEAT =
  "This asks the controller to keep this device off the venue's network. A phone can come back " +
  "under a new random Wi-Fi address, so treat it as a deterrent rather than a lock. To stop the " +
  "person signing in again on any device, block them under Blocked Guests.";

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

  const { vendor } = venue;
  // A CONTROLLER THAT IS NOT ANSWERING READS AS "WE COULD NOT ASK".
  //
  // This one line is the whole of the fix, and it is a normalization rather
  // than a branch in each case below because "we could not ask" is ALREADY a
  // state this ladder handles, in a venue owner's words, for every control:
  // `couldNotAsk` for the three that need a device write, and the honest
  // `qualified` half-sentences for disconnect and session timeout, whose
  // platform halves are real whatever the controller is doing. The copy QA
  // confirmed reads correctly was wired to the wrong trigger -- it fired only
  // when OUR OWN capabilities read failed -- and this puts a dark controller
  // on the same path instead of inventing a second vocabulary for it.
  //
  // Deliberately NOT keyed on any individual capability: liveness is a fact
  // about the connection, not about one verb, and the backend is the
  // authority on both. `block-signin` is untouched below because it is a row
  // in our own database and needs no controller at all.
  const capabilities = controllerIsAnswering(venue.controller) ? venue.capabilities : null;
  /** The backend's own sentence for a refused capability, or our fallback
   * when it declined to give one. Never our sentence over its one. */
  const refused = (
    control: ClientControlId,
    capability: ControllerClientCapability,
    fallback: string,
  ): ClientControlVerdict => ({
    control,
    availability: "unavailable",
    reason: capabilityReason(capability) ?? fallback,
  });

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
      if (capabilityIsSupported(capabilities?.disconnect)) return AVAILABLE(control);
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
      if (capabilityIsSupported(capabilities?.block)) {
        return { control, availability: "qualified", reason: BLOCK_DEVICE_CAVEAT };
      }
      if (capabilities) {
        return refused(
          control,
          capabilities.block,
          needsOpenApi("keep a device off the network", vendor),
        );
      }
      return {
        control,
        availability: "unavailable",
        reason: couldNotAsk("keeping a device off the network", vendor),
      };
    }

    // -----------------------------------------------------------------
    // Speed.
    // -----------------------------------------------------------------
    case "speed-limit": {
      if (capabilityIsSupported(capabilities?.setRateLimit)) {
        return { control, availability: "qualified", reason: SPEED_LIMIT_CAVEAT };
      }
      if (capabilities) {
        return refused(
          control,
          capabilities.setRateLimit,
          needsOpenApi("set guest speeds", vendor),
        );
      }
      // WE COULD NOT ASK -- WHICH IS NOT THE SAME AS "IT CANNOT WORK".
      //
      // This branch used to assert that "a speed set here would never reach
      // anybody's device", on the reasoning that the only consumer of a
      // BANDWIDTH policy was `queue_management` writing RouterOS
      // `/queue simple`, which a controller has no equivalent of. That was
      // true when it was written and is not true now: cloud-guest #270 routes
      // a controller-managed router to its controller, and per-client rate
      // limiting is measured working on real hardware (CAPABILITY-MATRIX
      // §3.1) -- accepted, stored, changed at runtime and cleared.
      //
      // It is also the WRONG BRANCH to have said it in. `capabilities` is
      // null when the read 404'd or did not come back, so the honest
      // statement is that we could not ask -- exactly what `block-device` and
      // every per-device action already say here. Stating an impossibility
      // instead blamed a customer's controller for a gap on our side, which
      // is the copy that gets the controller replaced rather than the gap
      // closed, and it is now false as well as unearned.
      //
      // Where the controller genuinely cannot do it -- an `auth_mode: legacy`
      // venue, which CAPABILITY-MATRIX §10.1 puts beyond per-client throttling
      // altogether -- the branch above says so in the backend's own words.
      return {
        control,
        availability: "unavailable",
        reason: couldNotAsk("setting guest speeds", vendor),
      };
    }

    case "speed-profile": {
      if (capabilityIsSupported(capabilities?.setRateLimit)) {
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
      if (capabilities) {
        return refused(
          control,
          capabilities.setRateLimit,
          needsOpenApi("give a tier its own speed", vendor),
        );
      }
      // The same correction as `speed-limit` above, for the same reason and in
      // the same branch. Both halves of one ladder said "would never reach
      // anybody's device" where the truth is "we could not ask", and fixing
      // only the screen that prompted this report would leave the second copy
      // to drift -- which is the failure this module exists to prevent.
      //
      // The second sentence survives because it is still true and still the
      // useful half: the rest of a tier is platform-side and works here.
      return {
        control,
        availability: "unavailable",
        reason:
          `${couldNotAsk("giving a tier its own speed", vendor)} Everything else about a tier ` +
          "still applies: how long guests get, how many devices, and their daily limit.",
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
      if (capabilityIsSupported(capabilities?.disconnect)) return AVAILABLE(control);
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
// The four per-device actions, each gated on its OWN capability.
// ---------------------------------------------------------------------------

const DEVICE_ACTION_CAPABILITY: Record<DeviceActionId, keyof ControllerClientCapabilities> = {
  block: "block",
  unblock: "unblock",
  speed: "setRateLimit",
  "speed-clear": "clearRateLimit",
};

/** What each action would be doing, for the sentence we fall back to when the
 * backend refuses without giving one of its own. */
const DEVICE_ACTION_NOUN: Record<DeviceActionId, string> = {
  block: "keep a device off the network",
  unblock: "let a blocked device back on",
  speed: "set one device's speed",
  "speed-clear": "remove one device's speed limit",
};

/**
 * May the venue admin press this one button, and if not, what does it say?
 *
 * ONE CAPABILITY PER BUTTON, never a venue-wide "controller is usable" flag.
 * The backend declares `block` and `unblock` separately and there is no rule
 * saying they move together; reading one off the other would be this console
 * deciding something the backend is the authority on.
 *
 * A NON-CONTROLLER VENUE NEVER REACHES THIS. The panel these verdicts gate is
 * not rendered at all unless `controllerManaged` is true, and the early return
 * here says the same thing a second time so a future caller cannot make a
 * MikroTik venue read as refused.
 */
export function deviceActionVerdict(
  action: DeviceActionId,
  venue: ControllerVenueFacts,
): DeviceActionVerdict {
  if (!venue.controllerManaged) {
    return { control: action, availability: "available", reason: null };
  }
  const { vendor } = venue;
  // The same normalization as the ladder above, and it must be here too: all
  // four of these buttons are a write to the controller and NONE of them has
  // a platform-side half to fall back on, so a dark controller makes every
  // one of them unpressable rather than merely qualified. Reached through the
  // existing `!capabilities` branch, which already says "we could not ask"
  // with the right noun for each action.
  const capabilities = controllerIsAnswering(venue.controller) ? venue.capabilities : null;
  if (!capabilities) {
    return {
      control: action,
      availability: "unavailable",
      reason: couldNotAsk(DEVICE_ACTION_NOUN[action], vendor),
    };
  }
  const capability = capabilities[DEVICE_ACTION_CAPABILITY[action]];
  if (capabilityIsSupported(capability)) {
    // Two of the four work and still promise less than their label implies,
    // and both say so BEFORE the click rather than as an apology after it.
    // Removing something (unblock, clear the limit) promises nothing extra.
    const caveat =
      action === "block"
        ? BLOCK_THIS_DEVICE_CAVEAT
        : action === "speed"
          ? SPEED_LIMIT_CAVEAT
          : null;
    return {
      control: action,
      availability: caveat ? "qualified" : "available",
      reason: caveat,
    };
  }
  return {
    control: action,
    availability: "unavailable",
    // The backend's sentence, verbatim -- it names the credential and where in
    // the controller's settings to add it, which no paraphrase here would.
    reason: capabilityReason(capability) ?? needsOpenApi(DEVICE_ACTION_NOUN[action], vendor),
  };
}

// ---------------------------------------------------------------------------
// AFTER the click: what actually happened.
// ---------------------------------------------------------------------------

/**
 * What the controller did with a speed we asked it to hold.
 *
 * `applied*` and `requested*` are separate because they differ: a controller
 * that holds a limit as a bounded number plus a Kbps/Mbps unit cannot express
 * every kbps value, so 1500 kbps is sent as 1 Mbps. `clamped` says so.
 *
 * ROUNDED DOWN, NEVER UP (backend #288). This used to read "1500 kbps is
 * applied as 2 Mbps", which was accurate about a backend that rounded to
 * nearest -- a 2000 kbps cap for a venue that asked for 1500, reachable from
 * any saved speed profile. A cap that comes back above the number an owner
 * typed is not a cap, so the encoding now floors and the shortfall is
 * reported through `clamped` rather than hidden.
 *
 * `null` on a direction means UNLIMITED in that direction. It is not zero and
 * it is not unknown.
 */
export interface ClientRateLimitFacts {
  enabled: boolean;
  appliedDownKbps: number | null;
  appliedUpKbps: number | null;
  requestedDownKbps: number | null;
  requestedUpKbps: number | null;
  clamped: boolean;
  /**
   * Whether `applied*` was READ BACK from the controller, or is just what we
   * encoded and sent. **False on every Omada venue**, because that
   * controller's Open API exposes a per-client rate-limit write and no
   * matching read (backend #288).
   *
   * So copy about these numbers says what was SET, never what was confirmed.
   * The distinction matters for the same reason `performed` does below: the
   * controller accepting a call is not the controller holding the value.
   */
  readBack: boolean;
}

/**
 * The outcome of one per-device action.
 *
 * `performed` IS THE OUTCOME, AND IT IS FALSE ON A 200. The controller
 * answering the HTTP call is not the controller doing the thing; PR #279
 * shipped a green tick over exactly this and had to be reverted. Every caller
 * goes through `clientActionMessage` below rather than assuming a resolved
 * promise means success.
 */
export interface ClientActionFacts {
  action: string;
  performed: boolean;
  /** Masked by the backend on the way out. Shown as-is; never re-derived. */
  clientMac: string;
  rateLimit: ClientRateLimitFacts | null;
}

/** "no limit" | "2 Mbps" | "1500 Kbps". `null` is unlimited, and says so in
 * words rather than as a 0 an owner would read as "stopped". */
export function rateLabel(kbps: number | null): string {
  if (kbps === null || kbps === 0) return "no limit";
  return kbps % 1000 === 0 ? `${kbps / 1000} Mbps` : `${kbps} Kbps`;
}

export interface ClientActionMessage {
  tone: "success" | "warning";
  text: string;
}

/**
 * What to tell the venue admin, from what the server actually said.
 *
 * Three rules live here and nowhere else, so no screen can get one of them
 * right and another wrong:
 *
 *  1. `performed: false` is a FAILURE, on an HTTP 200. Nothing may report it
 *     as done.
 *  2. The number shown is `applied_*`. Echoing back what was typed would be
 *     this platform asserting a limit that is not in force.
 *  3. `clamped` is said out loud, because the owner typed one number and the
 *     controller is holding another, and finding that out later feels like a
 *     bug in us.
 *
 * No sentence here says a speed is enforced or guaranteed: we have measured
 * the controller accept, store and return a limit, and nobody has measured a
 * device's throughput before and after (CAPABILITY-MATRIX §10.4).
 */
export function clientActionMessage(facts: ClientActionFacts): ClientActionMessage {
  if (!facts.performed) {
    return {
      tone: "warning",
      text:
        "The controller didn't confirm that, so nothing has changed on the device as far as we " +
        "can tell. Try again in a moment, and tell your Wyfy Guest contact if it keeps happening.",
    };
  }

  const rate = facts.rateLimit;
  if (rate) {
    if (!rate.enabled) {
      return { tone: "success", text: "This device has no speed limit on the network now." };
    }
    const held =
      `The network is now holding this device to ${rateLabel(rate.appliedDownKbps)} down and ` +
      `${rateLabel(rate.appliedUpKbps)} up.`;
    const measured =
      " Nobody has measured what a device actually gets afterwards, so treat it as a cap rather " +
      "than a promise.";
    if (!rate.clamped) return { tone: "success", text: held + measured };
    return {
      tone: "success",
      text:
        `${held} The controller stores speeds in its own steps, so it rounded what you asked ` +
        `for — the figure above is the one it is holding.${measured}`,
    };
  }

  return { tone: "success", text: "Done." };
}

// ---------------------------------------------------------------------------
// The disconnect ladder.
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
  /**
   * The controller's own answer to `POST .../clients/disconnect`, and a
   * TRI-STATE for the same reason `sessionEnforced` is:
   *
   *   true   the controller confirmed it dropped the client.
   *   false  we asked the controller and it did NOT -- `performed: false` on
   *          an HTTP 200, which is a real outcome and not a transport error.
   *   null   we never asked. **This is the value at every MikroTik venue, on
   *          every call, forever**: the panel that makes this call is not
   *          rendered there and the capability that gates it is never read
   *          there. That is what keeps the four branches below bit-identical
   *          to what they were for a RouterOS venue.
   */
  controllerDisconnected: boolean | null;
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
  | "session-only"
  /** We asked the venue's controller to drop the device and it said no. */
  | "controller-refused";

/**
 * Which of the five things happened. Ordered so the strongest CONFIRMED claim
 * wins and no claim is ever made twice.
 *
 * The controller branch sits ABOVE the generic failure branch deliberately.
 * Where we could not ask a controller at all, `sessionEnforced` is false on
 * every single call, and rendering that as "we could not take them off the
 * WiFi -- check the router and try again" sends an owner to look at hardware
 * that is behaving correctly, to retry something that cannot succeed. It is a
 * property of the venue, not an incident.
 *
 * `controllerDisconnected` is read FIRST, in both its decided states, because
 * it is the only leg that asked the device that is actually serving this
 * guest. `false` is a real refusal on an HTTP 200 and gets its own outcome
 * rather than collapsing into "check the router": there is no router.
 *
 * A MIKROTIK VENUE PASSES `null` HERE ALWAYS, so both new lines are skipped
 * and the remaining three are the same three, in the same order, as before.
 */
export function disconnectOutcome(facts: DisconnectOutcomeFacts): DisconnectOutcome {
  if (
    facts.controllerDisconnected === true ||
    facts.sessionEnforced === true ||
    facts.deviceDisconnected
  ) {
    return "device-cleared";
  }
  if (facts.controllerDisconnected === false) return "controller-refused";
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
