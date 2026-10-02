/**
 * The customer's view of an Aruba Instant On venue -- the counterpart of the
 * Omada venue's controller card (`ControllerDevicesCard`), for a vendor this
 * platform has NO API to.
 *
 * What it may show is exactly what Wyfy really knows about such a venue: its
 * own guest-session records (people online now, sign-ins today, the latest
 * sign-in). It never lists access points, never shows an AP or venue as
 * online/offline (PM_SPEC §0.4 item 5, §2.3: "Set up in Instant On", tone
 * neutral), never calls the Instant On cloud, and never prints a stand-in
 * zero: when the sessions read failed, the numbers read "—".
 *
 * Customer copy only names the Instant On app -- never RADIUS, NAS, the hub,
 * a public IP or a secret (`cloudguest_wireguard_customer_scope`).
 *
 * Data source: `useCustomerDashboard` (`GET /guest-sessions` for the last 24
 * hours, plus `/guests`), the same query and cache entry the dashboard home
 * already reads -- no new endpoint.
 */
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomerDashboard } from "@/hooks/useCustomerDashboard";
import { CONTROLLER_STATE_COPY, CONTROLLER_STATE_NEXT_STEP } from "@/lib/router-vendors";
import { ARUBA_VENUE_IN_INSTANT_ON, ARUBA_VENUE_IN_WYFY, arubaVenueStats } from "@/lib/aruba-venue";

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-foreground" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

export function ArubaInstantOnVenueCard({ locationId }: { locationId: string }) {
  const { data, isError, isLoading } = useCustomerDashboard(locationId);
  const copy = CONTROLLER_STATE_COPY.no_controller_api;
  const stats = isLoading
    ? { online: "…", today: "…", lastSignIn: "…" }
    : arubaVenueStats(data, isError);
  return (
    <Card className="premium-card h-full" data-testid="aruba-venue-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Radio className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Aruba Instant On access points</CardTitle>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
          title={copy.sentence}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
          {copy.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{copy.sentence}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Guests online now" value={stats.online} testId="aruba-online" />
          <Stat label="Sign-ins today" value={stats.today} testId="aruba-today" />
          <Stat label="Last guest sign-in" value={stats.lastSignIn} testId="aruba-last" />
        </div>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-foreground">Managed here, in Wyfy</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {ARUBA_VENUE_IN_WYFY.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Managed in the Instant On app</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {ARUBA_VENUE_IN_INSTANT_ON.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {CONTROLLER_STATE_NEXT_STEP.no_controller_api}
        </p>
      </CardContent>
    </Card>
  );
}
