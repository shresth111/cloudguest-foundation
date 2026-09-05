import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";

/**
 * Live session explorer -- deliberately empty until it is wired to a real
 * feed.
 *
 * WHAT THIS USED TO DO
 * --------------------
 * It rendered 45 sessions built entirely in the browser, under a page
 * heading that reads "Real-time view of all active guest sessions across
 * locations". Not one field came from a request. Every row was invented:
 *
 *   ssid         `rand(["CloudGuest-Corporate", "CloudGuest-Guest",
 *                 "CloudGuest-IoT", "CloudGuest-VIP"])`
 *   router       `rand(["GW-01 (Mumbai)", ... "GW-05 (Chennai)"])`
 *   device       `rand(["iPhone 15", "Samsung Galaxy S24", ...])`
 *   signal       `Math.floor(Math.random() * 40) + 60`
 *   sessionTime  `Math.floor(Math.random() * 36000)`
 *   download     `Math.floor(Math.random() * 50000)`
 *   upload       `Math.floor(Math.random() * 15000)`
 *   username     `user${i + 1}@email.com`
 *   mac / ip / nas   index arithmetic
 *   status       the first 30 rows "active", then 8 "idle", then "disconnected"
 *
 * The four SSIDs are the sharpest example and the reason this was found:
 * the fleet has no WiFi radio to name. Every router the company owns is a
 * MikroTik hEX lite / RB750r2 -- five wired ports, no radio -- and the
 * wireless comes from separate TP-Link/Omada APs the platform cannot see.
 * `live_sessions.ssid` is therefore always empty, never sometimes empty.
 * So an operator reading this screen -- and repeating it to the venue
 * owner on the phone -- was reading network names that had been made up
 * in their own browser a few milliseconds earlier.
 *
 * Same class as the campaigns `.catch` that seeded six invented campaigns:
 * data conjured on the client and presented as the customer's own.
 *
 * WHY THIS IS EMPTY RATHER THAN WIRED UP
 * --------------------------------------
 * `GET /sessions/live` is real (backend `app.domains.live_sessions`), and
 * this component's old `Session` interface matched its `LiveSession`
 * schema field for field -- which is how the fabrication stayed plausible.
 * But nothing in this frontend has ever called it, and that domain is
 * being actively corrected right now: cloud-guest#147 (shipped 2026-09-05)
 * removed seven fields that were being read off `GuestSession` under
 * attribute names that do not exist on it (`ssid`, `nas_identifier`,
 * `router_name`, `signal_strength`, `session_duration_seconds`,
 * `guest_username`, `mac_address` -- every one silently returning its
 * default). Those are now `None`-by-absence, and that schema's own
 * docstring records which of them can ever be filled:
 *
 *   - `ssid` / `signal`  never, on this path. They are observed per
 *                        *device* by the 15-minute connected-devices sync
 *                        (`ConnectedDevice.interface` /
 *                        `signal_strength_dbm`), and only for wireless
 *                        devices. `signal_strength_dbm` is `None` on every
 *                        router the company owns and always will be --
 *                        there is no radio to ask.
 *   - `nas`              lives on `RadiusNasClient`, keyed by router.
 *   - `router`           `router_id` is carried; the name is a join this
 *                        listing does not do yet.
 *
 * Guessing at that shape from here is what produced the last version.
 * Wiring it is a deliberate piece of work with a product decision in it
 * (which of those columns should exist at all), not something to infer.
 *
 * Meanwhile the operator console already has a real, working equivalent:
 * `LiveSessionsTable` on /guests, fed by `useSessions` -> `/guest-sessions`,
 * with real search, pagination, CSV export and the four session actions.
 * This page points there instead of competing with it using fiction.
 */
export function LiveSessionExplorer() {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="p-4">
        <EmptyState
          icon={Wifi}
          title="Not connected to a live feed yet"
          description="This screen has no data source. Active guest sessions are on the Guests page, which reads them from the live session records."
        >
          <Button asChild className="mt-5">
            <Link to="/guests">Go to Guests</Link>
          </Button>
        </EmptyState>
      </CardContent>
    </Card>
  );
}
