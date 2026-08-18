// TEMP DIAGNOSTIC — remove after incident resolved.
//
// Live incident: a real guest gets stuck on the captive-portal "connecting"
// spinner, and RouterOS's own hotspot log shows literally zero evidence of
// a login POST ever arriving for that attempt -- despite a real, active
// GuestSession existing in the backend DB for that exact guest. There is no
// access to the guest's own browser console/network tab, so this fires a
// tiny, best-effort, fire-and-forget beacon to a temporary backend endpoint
// (POST /diagnostics/portal-beacon, see cloud-guest-repo/backend's
// app/api/v1/diagnostics/routes.py) at every meaningful decision point in
// the routing/hotspot-login flow, to get ground truth on which gate
// condition is false (or isn't) for a real device.
//
// navigator.sendBeacon is preferred over a normal fetch: it's explicitly
// designed to survive page unload/navigation, which matters here since the
// event this incident cares about most (submitHotspotLogin's real top-level
// form POST) *is* a page navigation. fetch(..., { keepalive: true }) is
// used as a fallback for any context without sendBeacon.
//
// Deliberately never throws into the real flow -- a beacon failing to send
// must never be the thing that breaks a guest's actual login.
import { guestPortalApi } from "@/services/guest-portal-api";

interface PortalDiagnosticBeaconFields {
  event: string;
  guestIdentifier?: string | null;
  deviceMac?: string | null;
  routerId?: string | null;
  organizationId?: string | null;
  locationId?: string | null;
  details?: Record<string, unknown>;
}

export function sendPortalDiagnosticBeacon(fields: PortalDiagnosticBeaconFields): void {
  try {
    const base = guestPortalApi.defaults.baseURL || "/api/v1";
    const url = `${base.replace(/\/$/, "")}/diagnostics/portal-beacon`;
    const body = JSON.stringify({
      event: fields.event,
      guest_identifier: fields.guestIdentifier ?? null,
      device_mac: fields.deviceMac ?? null,
      router_id: fields.routerId ?? null,
      organization_id: fields.organizationId ?? null,
      location_id: fields.locationId ?? null,
      client_timestamp: new Date().toISOString(),
      details: fields.details ?? {},
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const queued = navigator.sendBeacon(url, blob);
      if (queued) return;
      // sendBeacon returning false (queue full/oversized) falls through to
      // the fetch fallback below rather than silently dropping the signal.
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Diagnostic-only -- never let this beacon break the real login flow.
  }
}
