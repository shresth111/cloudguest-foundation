import { Link } from "@tanstack/react-router";
import { Plug, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerFeatureHref } from "@/lib/customerNav";
import { controllerVenueFeatureReason } from "@/lib/router-vendors";

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
  featureLabel,
  vendor,
}: {
  /** The screen the owner was trying to open, in their own vocabulary --
   * "Port Forwarding", not "port-forwarding". */
  featureLabel: string;
  /** Raw `routers.vendor`, or null when the venue summary predates the
   * field. The copy stays correct either way. */
  vendor: string | null;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Server className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {featureLabel} is configured on this venue&rsquo;s controller
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        {controllerVenueFeatureReason(vendor)}
      </p>
      {/* Named, not implied. An owner who reads "configured elsewhere" and
          is not told which five things moved will try the other four one at
          a time. */}
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        Network Zones, IP Addresses, Port Forwarding, Call Priority and Website Blocking all work
        this way at this venue. Everything else on your dashboard &mdash; guests, sessions,
        vouchers, the sign-in portal and reports &mdash; is unaffected.
      </p>
      <Link to={customerFeatureHref("network-integrations")} className="mt-6 inline-block">
        <Button variant="outline">
          <Plug className="h-4 w-4" />
          <span className="ml-2">Open Network Integrations</span>
        </Button>
      </Link>
    </div>
  );
}
