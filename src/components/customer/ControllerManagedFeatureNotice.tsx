import { Server } from "lucide-react";
import {
  CONTROLLER_UNSUPPORTED_HEADLINE,
  controllerUnsupportedCopy,
  controllerVenueFeatureReason,
} from "@/lib/router-vendors";

/**
 * What a venue owner sees in place of a Network screen their venue cannot
 * use -- contract §11.5, customer side.
 *
 * WHY THIS EXISTS RATHER THAN A HIDDEN NAV ROW
 * -------------------------------------------
 * Five screens in the Network group (Network Zones, IP Addresses, Port
 * Forwarding, Call Priority, Website Blocking) are RouterOS writes. At a
 * venue whose only router is a vendor controller there is no RouterOS to
 * write to, and the backend says so -- `get_vlan_adapter` and its peers
 * raise a typed refusal for an unregistered vendor. That refusal is right,
 * and it is also the last possible moment: the owner has already found the
 * screen, read the form and filled it in.
 *
 * Hiding the five rows would fix the lie and introduce a different one --
 * a product that silently has fewer features than the one next door, with
 * no way for the person paying for it to find out why. An absence cannot be
 * asked a question. So the row stays, greyed, and this panel answers it:
 * what is true, why, and where the setting they were looking for actually
 * lives. The same reasoning `routerDetailTabsNotApplicableFor` already uses
 * on the Master console, where nine excluded tabs are NAMED rather than
 * dropped.
 *
 * The deep link is the load-bearing half. "You cannot do this here" with no
 * destination is a support ticket; with one it is a redirect.
 */
export function ControllerManagedFeatureNotice({
  featureId,
  featureLabel,
  venueName,
  vendor,
}: {
  /** The screen's id (`"vlans"`), which selects the noun and verb in
   * `controllerUnsupportedCopy` -- FIX-PLAN D4's table. */
  featureId: string;
  /** The screen the owner was trying to open, in their own vocabulary --
   * "Port Forwarding", not "port-forwarding". Used only in the fallback
   * sentence, for a feature id the D4 table does not cover. */
  featureLabel: string;
  /** This venue's name, so the panel addresses the place rather than "this
   * venue" in the abstract. Null is fine; the copy degrades cleanly. */
  venueName: string | null;
  /** Raw `routers.vendor`, or null when the venue summary predates the
   * field. The copy stays correct either way. */
  vendor: string | null;
}) {
  // FIX-PLAN D4's exact copy where the feature is in its table; the older
  // vendor-neutral sentence otherwise, so a screen this panel is reused for
  // later still says something true rather than nothing.
  const planned = controllerUnsupportedCopy(featureId, venueName);
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Server className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {planned
          ? CONTROLLER_UNSUPPORTED_HEADLINE
          : `${featureLabel} is configured on this venue's controller`}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        {planned ?? controllerVenueFeatureReason(vendor)}
      </p>
      {/* Named, not implied. An owner who reads "configured elsewhere" and
          is not told which five things moved will try the other four one at
          a time. */}
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        Network Zones, IP Addresses, Port Forwarding, Call Priority and Website Blocking all work
        this way at this venue. Everything else on your dashboard &mdash; guests, sessions,
        vouchers, the sign-in portal and reports &mdash; is unaffected.
      </p>
      {/* NO BUTTON, DELIBERATELY -- FIX-PLAN FE-0 step 4.

          This panel's own docstring argues that the deep link is its
          load-bearing half: "'You cannot do this here' with no destination is
          a support ticket; with one it is a redirect." That was right for as
          long as a destination existed. It no longer does. Backend `074d719`
          moved every `network_integrations.*` route to ScopeType.GLOBAL and
          retired the org-scoped grants, so the page this button pointed at
          403s on every call for a venue owner -- and its own route, nav row
          and catalog entry have now been removed with it.

          A button to a denial is worse than a sentence: it spends the trust
          the rest of the panel is built on, at the exact moment the owner has
          accepted that they cannot do the thing and is looking for who can.
          So the answer to "then who?" is a person, not a link.

          If the product wants the redirect back, the destination has to be
          something a venue owner can actually open -- a read-only "your
          controller" panel -- which is a new surface and a separate decision,
          not a link fix. */}
      <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">
        Your Wyfy Guest contact manages this venue&rsquo;s controller. Tell us what you need changed
        and we&rsquo;ll do it.
      </p>
    </div>
  );
}
