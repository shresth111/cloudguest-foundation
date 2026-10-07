/**
 * Guest Connection Records -> one session -> "Device events": the wording.
 *
 * What the venue's router logged about THIS session's device: the IP it was
 * given and released (DHCP), and when the router's hotspot signed it in and
 * out. The backend only returns events it could link to exactly this session
 * (by the device's MAC, or by IP on the session's own router); events that
 * also match another guest's session are held back and only counted.
 *
 * The one rule this module exists to keep: an empty list must never read as
 * "nothing happened" unless the router was actually sending logs at the
 * time. See `coverageState`.
 */
import type { GuestDeviceEvent, GuestSessionDeviceEvents } from "@/types/guestDeviceEvents";

export const DEVICE_EVENT_LABEL: Record<string, string> = {
  ip_assigned: "IP assigned",
  ip_released: "IP released",
  router_sign_in: "Signed in at the router",
  router_sign_out: "Signed out at the router",
};

/** An unknown kind (a newer backend) is shown as such, never dropped or
 * relabelled as one of the known four. */
export function deviceEventLabel(event: Pick<GuestDeviceEvent, "kind" | "detail">): string {
  const base = DEVICE_EVENT_LABEL[event.kind] ?? "Other router event";
  if (event.kind === "router_sign_out" && event.detail) return `${base} (${event.detail})`;
  return base;
}

export interface CoverageState {
  /** "events" -> render the list; "empty" / "unavailable" -> render the
   * message instead. */
  kind: "events" | "empty" | "unavailable";
  title: string;
  description: string;
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleString();
}

export function coverageState(data: GuestSessionDeviceEvents): CoverageState {
  if (data.coverage === "not_sending") {
    return {
      kind: "unavailable",
      title: "This router doesn't send device logs",
      description:
        "Device events appear here only when the venue's router sends its logs to Wyfy. Nothing is known about this session from the router's side.",
    };
  }
  if (data.coverage === "not_sending_during_session") {
    const since = formatWhen(data.logging_since);
    return {
      kind: "unavailable",
      title: "The router wasn't sending device logs during this session",
      description: since
        ? `This venue's router started sending device logs on ${since}, after this session.`
        : "This venue's router started sending device logs after this session.",
    };
  }
  if (data.coverage !== "covered") {
    return {
      kind: "unavailable",
      title: "Device events unavailable",
      description: "The server reported a state this page doesn't recognise.",
    };
  }
  if (!data.linkable) {
    return {
      kind: "unavailable",
      title: "Can't link router events to this session",
      description:
        "This session has no device MAC or IP address on record, so router events can't be tied to it.",
    };
  }
  if (data.events.length === 0) {
    return {
      kind: "empty",
      title: "No events for this session",
      description:
        "The router was sending logs, but logged nothing that could be tied to this session's device.",
    };
  }
  return { kind: "events", title: "", description: "" };
}

/** Footnote when events were held back because they also matched another
 * guest's session. Null when there were none. */
export function heldBackNote(count: number): string | null {
  if (!count || count < 1) return null;
  return count === 1
    ? "1 router event matched this session and another one at the same time, so it isn't shown."
    : `${count} router events matched this session and another one at the same time, so they aren't shown.`;
}

/** Always shown under the list: what the times are, and that it can be
 * incomplete. */
export const DEVICE_EVENTS_FOOTNOTE =
  "Times are when Wyfy received each event from the router. Routers send these logs over UDP, so an event can occasionally be lost: treat this list as a troubleshooting aid, not a complete record.";
