/**
 * What the Instant On app itself reports for an Aruba Instant On venue
 * (DASHBOARD_PLAN P1-K): access points, connected devices and WiFi networks
 * inside the dashboard's Access points card, and Instant On alerts on the
 * Alerts page. Mounted ONLY at a NAS-only venue. Every read that the backend
 * cannot vouch for says "Data unavailable · source Instant On" -- never a 0.
 */
import { BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/friendly";
import { useInstantOnView } from "@/hooks/useInstantOnView";
import {
  INSTANT_ON_UNAVAILABLE,
  instantOnAlertLabel,
  instantOnApSummary,
  toInstantOnAlerts,
  toInstantOnAps,
  toInstantOnClients,
  toInstantOnSsids,
  type InstantOnView,
} from "@/lib/instant-on-views";

function Row({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="flex items-center justify-between gap-3" data-testid={testid}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function shown<T>(v: InstantOnView<T>, ok: (items: T[]) => string): string {
  if (v.status === "loading") return "…";
  if (v.status === "unavailable") return "—";
  return ok(v.items);
}

/** Inside the Access points card. */
export function InstantOnVenueData({ locationId }: { locationId: string }) {
  const aps = useInstantOnView(locationId, "access-points", toInstantOnAps);
  const clients = useInstantOnView(locationId, "clients", toInstantOnClients);
  const ssids = useInstantOnView(locationId, "ssids", toInstantOnSsids);
  const views = [aps, clients, ssids];
  const allUnavailable = views.every((v) => v.status === "unavailable");
  return (
    <div
      className="space-y-1.5 rounded-lg border border-border/60 px-3 py-2.5 text-xs"
      data-testid="instant-on-venue-data"
    >
      <p className="font-medium text-foreground">From the Instant On app</p>
      {allUnavailable ? (
        <p className="text-muted-foreground" data-testid="instant-on-unavailable">
          {INSTANT_ON_UNAVAILABLE}
        </p>
      ) : (
        <>
          <Row
            label="Access points"
            value={aps.status === "ok" ? (instantOnApSummary(aps) ?? "—") : shown(aps, () => "")}
            testid="instant-on-aps"
          />
          <Row
            label="Devices connected"
            value={shown(clients, (items) => items.length.toLocaleString())}
            testid="instant-on-clients"
          />
          <Row
            label="WiFi networks"
            value={shown(ssids, (items) =>
              items.length ? items.map((s) => s.name).join(", ") : "None listed",
            )}
            testid="instant-on-ssids"
          />
          {views.some((v) => v.status === "unavailable") && (
            <p className="text-muted-foreground">— {INSTANT_ON_UNAVAILABLE}</p>
          )}
        </>
      )}
    </div>
  );
}

/** On the Alerts page, above this platform's own alerts. */
export function InstantOnAlertsCard({ locationId }: { locationId: string }) {
  const alerts = useInstantOnView(locationId, "alerts", toInstantOnAlerts);
  return (
    <Card className="premium-card mb-4" data-testid="instant-on-alerts">
      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
          <BellRing className="h-3.5 w-3.5 text-white" />
        </div>
        <CardTitle className="text-sm">Alerts from the Instant On app</CardTitle>
      </CardHeader>
      <CardContent className="text-xs">
        {alerts.status === "loading" ? (
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        ) : alerts.status === "unavailable" ? (
          <p className="text-muted-foreground" data-testid="instant-on-alerts-unavailable">
            {INSTANT_ON_UNAVAILABLE}
          </p>
        ) : alerts.items.length === 0 ? (
          <p className="text-muted-foreground">The Instant On app reports no alerts.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {alerts.items.map((a, i) => (
              <li
                key={`${a.type}-${a.raisedAt ?? i}`}
                className="flex items-center justify-between gap-3 py-2"
                data-testid="instant-on-alert-row"
              >
                <span className="font-medium text-foreground">
                  {instantOnAlertLabel(a.type)}
                  {a.deviceName ? ` · ${a.deviceName}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {a.cleared ? "Cleared" : (a.severity ?? "Active")}
                  {a.raisedAt ? ` · ${relativeTime(a.raisedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
