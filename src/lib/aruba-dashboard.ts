/**
 * The customer dashboard at an Aruba Instant On venue -- the pure half: ONE
 * verdict for the venue and ONE verdict per access point, both derived from
 * the same `GET /locations/{id}/access-points` read, so the status header,
 * the KPI row and the access-point card can never contradict each other.
 * Pure so `scripts/test-aruba-customer-dashboard.mjs` can exercise it.
 *
 * Why this exists (owner, 2026-10-05): the Aruba dashboard printed "Set up
 * in Instant On" twice, "Nothing to do here" twice, guests online three
 * times, a Bandwidth card that only said "not available", and an access
 * point reading "Last guest activity 31 minutes ago" beside a pill saying
 * "No recent activity". Those were two words for one fact, rendered
 * separately; here the fact is turned into one sentence.
 *
 * The rules of `lib/aruba-access-points.ts` still hold: a figure the backend
 * did not send is "—", never 0; an idle access point is "Idle", never
 * "Offline" (an idle AP sends no RADIUS at all, so silence is not a fault);
 * a failed read is "unavailable", never an empty list.
 *
 * Only ever rendered for a NAS-only venue (`locationIsNasOnly`).
 */
import { formatBytes } from "@/lib/analytics-format";
import type { ArubaAccessPoint, ArubaAccessPointsState } from "@/lib/aruba-access-points";

const DASH = "—";

/** One access point, one verdict. `active` is the backend's own `status`
 * (a RADIUS packet inside its online window, or the Instant On app saying
 * online) -- never re-derived here with a second threshold. */
export interface ApVerdict {
  active: boolean;
  /** "Active" / "Idle". Never "Offline". */
  label: string;
  /** The one sentence behind the label: "Active · guest activity 2 minutes
   * ago", "Idle · last guest activity 31 minutes ago". */
  sentence: string;
  /** The sentence without its leading label ("guest activity 2 minutes
   * ago"), for a card that shows the label as a pill beside it. Empty when
   * the label is the whole sentence. `sentence` is always
   * `label + " · " + detail` (or just `label`). */
  detail: string;
  /** What the guest counter beside it means. An idle AP whose sessions are
   * still open has guests SIGNED IN, not guests it has heard from lately --
   * printing "1 online now" beside "Idle" was the contradiction. */
  countLabel: "online now" | "signed in";
}

export function apVerdict(
  ap: Pick<ArubaAccessPoint, "status" | "statusSource" | "lastSeenAt" | "instantOnStatus">,
  relative: (iso: string) => string,
): ApVerdict {
  const verdict = (
    active: boolean,
    label: string,
    detail: string,
    countLabel: ApVerdict["countLabel"],
  ): ApVerdict => ({
    active,
    label,
    detail,
    sentence: detail ? `${label} · ${detail}` : label,
    countLabel,
  });
  if (ap.status === "online") {
    const detail =
      ap.statusSource === "instant_on"
        ? "online in the Instant On app"
        : ap.lastSeenAt
          ? `guest activity ${relative(ap.lastSeenAt)}`
          : "";
    return verdict(true, "Active", detail, "online now");
  }
  const detail = ap.lastSeenAt
    ? `last guest activity ${relative(ap.lastSeenAt)}`
    : "no guest activity yet";
  return verdict(
    false,
    "Idle",
    ap.instantOnStatus === "offline"
      ? `${detail} · the Instant On app shows it disconnected`
      : detail,
    "signed in",
  );
}

/** The newest `lastSeenAt` across the venue's access points, or null. */
export function newestApActivity(
  items: readonly Pick<ArubaAccessPoint, "lastSeenAt">[],
): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const ap of items) {
    const ms = ap.lastSeenAt ? Date.parse(ap.lastSeenAt) : NaN;
    if (!Number.isNaN(ms) && ms > bestMs) {
      best = ap.lastSeenAt;
      bestMs = ms;
    }
  }
  return best;
}

/** The venue's status header. `tone` is `live` only when an access point is
 * active by the backend's own window -- fresh guest traffic is evidence the
 * WiFi works. Everything else is neutral: never a fault tone, because
 * nothing here can see an AP that has no guests on it. */
export interface ArubaVenueStatus {
  tone: "live" | "neutral";
  /** Short label for the header pill. */
  badge: string;
  /** The headline sentence of the status bar. */
  title: string;
  /** "1 of 2 active", "1 active", "—". */
  accessPoints: string;
  /** "2 minutes ago", "None yet", "—". */
  lastActivity: string;
}

export function arubaVenueStatus(
  state: ArubaAccessPointsState,
  relative: (iso: string) => string,
): ArubaVenueStatus {
  if (state.status === "loading") {
    return {
      tone: "neutral",
      badge: "Checking…",
      title: "Checking access points…",
      accessPoints: "…",
      lastActivity: "…",
    };
  }
  if (state.status === "unavailable") {
    return {
      tone: "neutral",
      badge: "Aruba Instant On",
      title: "Access point status is unavailable right now",
      accessPoints: DASH,
      lastActivity: DASH,
    };
  }
  const n = state.items.length;
  if (n === 0) {
    return {
      tone: "neutral",
      badge: "Aruba Instant On",
      title: "No access points are listed for this venue yet",
      accessPoints: "0",
      lastActivity: DASH,
    };
  }
  const active = state.items.filter((ap) => ap.status === "online").length;
  const newest = newestApActivity(state.items);
  const lastActivity = newest ? relative(newest) : "None yet";
  const accessPoints = n === 1 ? (active ? "1 active" : "1 idle") : `${active} of ${n} active`;
  if (active > 0) {
    return {
      tone: "live",
      badge: "Guest WiFi active",
      title: "Guest WiFi is active",
      accessPoints,
      lastActivity,
    };
  }
  return {
    tone: "neutral",
    badge: "Idle",
    title: newest ? "No recent guest activity" : "No guest activity yet",
    accessPoints,
    lastActivity,
  };
}

/** Guest data through the venue's access points today -- real octets from
 * the access points' accounting. `null` (render "—") when the read failed or
 * no access point reported a byte figure; never a 0 standing in for one. */
export function arubaDataToday(state: ArubaAccessPointsState): string | null {
  if (state.status !== "ok") return null;
  let total = 0;
  let measured = false;
  for (const ap of state.items) {
    for (const v of [ap.downloadBytesToday, ap.uploadBytesToday]) {
      if (v != null) {
        total += v;
        measured = true;
      }
    }
  }
  return measured ? formatBytes(total) : null;
}
