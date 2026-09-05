/**
 * The verdict engine behind the "Fix a Problem" page.
 *
 * Pure functions over normalized inputs. No I/O, no React, no service
 * types -- callers map whatever their API returns into the small shapes
 * below. That is deliberate: the ladders are the part that has to be
 * right, and they should be executable by a test rather than reasoned
 * about through three layers of fetching.
 *
 * ── THE RULES THESE FOLLOW ──────────────────────────────────────────────
 *
 * 1. ORDERED, FIRST MATCH WINS, most certain and cheapest first. Every
 *    verdict carries the confidence it was reached with.
 * 2. NEVER INFER. If no rule matches, say so and name what was checked --
 *    `notChecked` exists so the page can be honest about its own blind
 *    spots rather than rounding an absence up to "everything is fine".
 * 3. NO COMPOSITE SCORE, EVER. No percentage, no grade, no "health" number
 *    for the venue. An unexplainable number is worse than no number: it
 *    spends the trust the rest of the page needs, and there is a whole
 *    competitor doing it badly to learn from.
 * 4. NEVER CLAIM WIRELESS. The fleet is MikroTik hEX lite / RB750r2 -- a
 *    five-port *wired* router with no radio. Signal strength, SNR, channel
 *    use and airtime are not weakly supported, they are absent; the menu
 *    does not exist on the hardware. So "the link is fine and the problem
 *    is in the wireless, which we cannot see" is a designed, first-class
 *    result here (`wireless-boundary`), not a fallback -- because it is
 *    frequently the true answer, and a green tick over a broken venue
 *    costs more than an honest boundary.
 *
 * What is deliberately NOT here yet: the login-history and OTP rungs.
 * Those need `GET /guest-login-history` to grow an `identifier` filter.
 * Until it does, `guestVerdict` reports them in `notChecked` rather than
 * guessing -- an absent rung must be visible, never silently skipped.
 */

/* ── Zone A: is the venue's internet working ────────────────────────── */

export type VerdictTone = "success" | "warning" | "danger" | "neutral";
export type Confidence = "certain" | "high" | "medium";

/** One uplink's most recent recorded health check. */
export interface LinkReading {
  id: string;
  providerName: string | null;
  isPrimary: boolean;
  status: "up" | "down" | "degraded" | "unknown";
  latencyMs: number | null;
  packetLossPercent: number | null;
  /** ISO timestamp of the reading, or null if it has never been checked. */
  checkedAt: string | null;
}

export interface VenueSignals {
  /** False when this location has no router registered at all. */
  hasRouter: boolean;
  /** Newest reading per uplink. Empty means nothing has ever been measured. */
  links: LinkReading[];
  /** ISO timestamp we last heard anything from the router, null if unknown. */
  routerLastSeenAt: string | null;
  /**
   * Whether we currently believe the router is in contact.
   *
   * Derived from HEARTBEAT STALENESS, never from probing the device --
   * probing is exactly what fails during the outage this rung exists for,
   * and `location-liveness.ts` documents that nothing on the backend ever
   * flips a router's stored status from online to offline when heartbeats
   * stop, so `status === "online"` alone proves nothing.
   *
   * `null` means we do not know yet -- not the same as a failure, and it
   * must never be rendered as one.
   */
  routerReachable: boolean | null;
  /** Guests connected right now, or null when we could not count them. */
  guestsOnline: number | null;
  /** Injectable for tests. */
  now?: number;
}

export type VenueStatus =
  | "no-router"
  | "router-unreachable-internet-down"
  | "router-unreachable-internet-ok"
  | "internet-down"
  | "on-backup"
  | "internet-slow"
  | "internet-up"
  | "unknown";

export interface VenueVerdict {
  status: VenueStatus;
  tone: VerdictTone;
  /** One sentence, in the venue owner's words. */
  headline: string;
  /** Why it matters / what it implies. Null when the headline says it all. */
  meaning: string | null;
  /** Something the reader can do without ringing anyone. */
  action: string | null;
  /** Freshest reading behind this verdict, for the "checked N ago" line. */
  checkedAt: string | null;
  /** True when nothing behind this verdict is recent enough to call current. */
  stale: boolean;
}

/**
 * Above these, an uplink that is technically "up" is the thing making
 * guests say "it's connected but nothing loads".
 *
 * Chosen to sit well clear of a healthy Indian broadband line (typically
 * 10-60 ms to a public resolver, ~0% loss) so that crossing one of them
 * means something. They are thresholds on a measurement we actually take,
 * not a score -- see rule 3 above.
 */
export const SLOW_LATENCY_MS = 250;
export const SLOW_PACKET_LOSS_PERCENT = 2;

/** §8.4 -- past this, a swept value is labelled with its age and never
 * presented as current. */
export const STALE_AFTER_MS = 10 * 60_000;

function ageMs(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, now - t) : null;
}

function isSlow(l: LinkReading): boolean {
  // A link the platform already grades "degraded" counts even when it
  // carries no numbers -- otherwise a link known to be struggling reads as
  // healthy purely because its latency field happened to be null.
  return (
    l.status === "degraded" ||
    (l.latencyMs != null && l.latencyMs >= SLOW_LATENCY_MS) ||
    (l.packetLossPercent != null && l.packetLossPercent >= SLOW_PACKET_LOSS_PERCENT)
  );
}

/** Most recent `checkedAt` across the readings we were given. */
function freshest(links: LinkReading[]): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const l of links) {
    if (!l.checkedAt) continue;
    const t = new Date(l.checkedAt).getTime();
    if (Number.isFinite(t) && t > bestT) {
      bestT = t;
      best = l.checkedAt;
    }
  }
  return best;
}

function guestsClause(n: number | null): string {
  if (n == null) return "";
  if (n === 0) return " No guests were connected at the time.";
  return ` ${n} guest${n === 1 ? " was" : "s were"} connected at the time.`;
}

/**
 * The standing answer at the top of the page. No input, always renderable.
 *
 * THE UNREACHABLE RUNGS COME FIRST AND THAT IS THE POINT. Every router
 * command travels over the management tunnel, which runs over the venue's
 * own WAN -- so when their internet dies, the tunnel dies with it and not
 * one router check will run. That is precisely the situation someone opens
 * this page in, which makes it the primary state rather than an edge case.
 * What survives is everything recorded beforehand, and that is most of
 * what this page needs anyway.
 *
 * The two unreachable rungs must not be conflated: telling a venue whose
 * line is genuinely down that "your internet looks fine" is the wrong
 * answer at the worst possible moment.
 */
export function venueVerdict(signals: VenueSignals): VenueVerdict {
  const now = signals.now ?? Date.now();
  const links = signals.links;
  const checkedAt = freshest(links);
  const readingAge = ageMs(checkedAt, now);
  const stale = readingAge == null || readingAge > STALE_AFTER_MS;

  const base = { checkedAt, stale };

  if (!signals.hasRouter) {
    return {
      ...base,
      status: "no-router",
      tone: "neutral",
      headline: "This location doesn't have a router set up with us yet.",
      meaning:
        "Once it's connected we can check your internet, see who's online, and tell you why a guest can't log in.",
      action: null,
    };
  }

  const up = links.filter((l) => l.status === "up" || l.status === "degraded");
  const anyUp = up.length > 0;
  const allDown = links.length > 0 && links.every((l) => l.status === "down");

  // Unreachable, and nothing tells us the line survived.
  if (signals.routerReachable === false && !anyUp) {
    const lostAge = ageMs(signals.routerLastSeenAt, now);
    return {
      ...base,
      status: "router-unreachable-internet-down",
      tone: "danger",
      headline: lostAge
        ? `We lost contact with your router ${humanizeAge(lostAge)} ago — and that usually means your internet is down.`
        : "We can't reach your router — and that usually means your internet is down.",
      meaning:
        "We reach your router through your own internet connection, so when your line goes down we lose the router with it." +
        guestsClause(signals.guestsOnline),
      action:
        "Check the lights on your provider's box and on your router. We'll reconnect on our own the moment your line is back — you don't need to do anything here.",
      checkedAt: signals.routerLastSeenAt ?? checkedAt,
      stale: true,
    };
  }

  // Unreachable, but a link is demonstrably carrying traffic.
  if (signals.routerReachable === false && anyUp) {
    return {
      ...base,
      status: "router-unreachable-internet-ok",
      tone: "warning",
      headline: "We can't reach your router right now, but your internet looks fine.",
      meaning:
        "Traffic is still flowing on your line" +
        (signals.guestsOnline ? ` and ${signals.guestsOnline} guests are connected` : "") +
        ", so this looks like our connection to the router rather than your WiFi.",
      action: "Try again in a few minutes. If it's still happening, we'll raise it ourselves.",
    };
  }

  if (allDown) {
    return {
      ...base,
      status: "internet-down",
      tone: "danger",
      headline: "Your internet is down.",
      meaning: "Guests cannot get online at all. This is your line, not their phones.",
      action:
        "We've alerted you already. If you have a backup line we'll switch to it automatically.",
    };
  }

  const primaryDown = links.some((l) => l.isPrimary && l.status === "down");
  if (primaryDown && anyUp) {
    return {
      ...base,
      status: "on-backup",
      tone: "warning",
      headline: "Your main line is down. You're running on your backup.",
      meaning: "Guests are online, but it may be slower than usual.",
      action: "Nothing to do here — we'll switch back automatically when your main line returns.",
    };
  }

  const slow = up.find(isSlow);
  if (slow) {
    const bits = [
      slow.latencyMs != null ? `${Math.round(slow.latencyMs)} ms response` : null,
      slow.packetLossPercent != null ? `${slow.packetLossPercent}% packet loss` : null,
    ].filter(Boolean);
    return {
      ...base,
      status: "internet-slow",
      tone: "warning",
      headline: "Your internet is up, but it's struggling right now.",
      meaning:
        (bits.length ? `${bits.join(", ")}. ` : "") +
        "This is the state that makes guests say it's connected but nothing loads.",
      action:
        "If it stays like this for more than a few minutes, it's worth calling your provider.",
    };
  }

  if (anyUp) {
    return {
      ...base,
      status: "internet-up",
      tone: "success",
      headline: "Your internet is working.",
      meaning: null,
      action: null,
    };
  }

  return {
    ...base,
    status: "unknown",
    tone: "neutral",
    headline: "We don't have a recent reading of your internet yet.",
    meaning:
      "This usually means your router was set up very recently, or we haven't been able to check it.",
    action: null,
  };
}

/** "3 minutes" / "2 hours" / "18 minutes" -- for "lost contact N ago". */
export function humanizeAge(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "less than a minute";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/* ── Zone B: why is this one guest having trouble ───────────────────── */

export interface GuestSignals {
  /** Null when no guest with that identifier is known at this location. */
  guest: {
    identifier: string;
    isBlocked: boolean;
    blockedReason: string | null;
    lastSeenAt: string | null;
  } | null;
  /** This guest's currently-active session here, if any. */
  session: {
    startedAt: string;
    lastActivityAt: string;
    bytesDownloaded: number;
    /** Their daily allowance in MB, or null when they have none. */
    dataLimitMb: number | null;
  } | null;
  /** Zone A's answer -- an outage outranks everything about one guest. */
  venue: VenueStatus;
  now?: number;
}

export type GuestFinding =
  | "venue-outage"
  | "blocked"
  | "never-seen"
  | "over-allowance"
  | "gone-quiet"
  | "not-signed-in"
  | "wireless-boundary";

export interface GuestVerdict {
  finding: GuestFinding;
  tone: VerdictTone;
  confidence: Confidence;
  headline: string;
  meaning: string;
  action: string;
  /** Things this verdict genuinely established. */
  checked: string[];
  /** Things it could not look at, and why. Rendered, never hidden. */
  notChecked: string[];
}

/** Rungs this build cannot reach yet, named so the page can admit to them
 * rather than let their absence read as a clean bill of health. */
const NOT_YET_CHECKABLE = [
  "Whether a login code was sent to them, and whether they typed it correctly — we can't search login history by phone number yet.",
  "Whether their phone is on the network but stuck at the login page — that needs a reading from the router we don't collect yet.",
  "The WiFi signal where they're sitting — your access points are separate devices that don't report back to us.",
];

const IDLE_AFTER_MS = 15 * 60_000;

export function guestVerdict(signals: GuestSignals): GuestVerdict {
  const now = signals.now ?? Date.now();
  const { guest, session } = signals;

  // 1. An outage outranks anything about one guest, and saying otherwise
  //    sends someone to fiddle with a phone while the venue is dark.
  if (signals.venue === "internet-down" || signals.venue === "router-unreachable-internet-down") {
    return {
      finding: "venue-outage",
      tone: "danger",
      confidence: "certain",
      headline: "Your internet is down — this affects everyone, not just them.",
      meaning:
        "There's nothing wrong with this guest's phone. No one at this location can get online until your line is back.",
      action:
        "Check your provider's box. Tell your guests it's the line rather than their devices — it saves them restarting phones that are fine.",
      checked: ["Your internet connection"],
      notChecked: [],
    };
  }

  if (!guest) {
    return {
      finding: "never-seen",
      tone: "warning",
      confidence: "high",
      headline: "We have no record of this number at this location.",
      meaning:
        "They never reached the login screen, or they're typing a different number. The most common cause is that their phone hasn't actually joined your WiFi network yet.",
      action:
        "Ask them to open their WiFi settings and tap your guest network, then wait for the login page. If it doesn't appear, ask them to turn WiFi off and on again.",
      checked: ["Guests seen at this location"],
      notChecked: [NOT_YET_CHECKABLE[0]],
    };
  }

  if (guest.isBlocked) {
    return {
      finding: "blocked",
      tone: "danger",
      confidence: "certain",
      headline: "This guest is blocked at this location.",
      meaning: guest.blockedReason
        ? `The reason recorded was "${guest.blockedReason}".`
        : "No reason was recorded when they were blocked.",
      action: "If that was a mistake, unblock them in Access Rules.",
      checked: ["Whether they're blocked here"],
      notChecked: [],
    };
  }

  if (!session) {
    return {
      finding: "not-signed-in",
      tone: "warning",
      confidence: "medium",
      headline: "We know this guest, but they're not signed in right now.",
      meaning:
        "They've used your WiFi before and they're not blocked, so the most likely thing is that they're partway through logging in again — either they haven't opened the login page, or they haven't finished it.",
      action:
        "Ask them to open a browser and go to any website — that brings up the login page. If nothing appears, ask them to turn WiFi off and on again.",
      checked: ["Whether they're blocked here", "Whether they have a session open now"],
      notChecked: [NOT_YET_CHECKABLE[0], NOT_YET_CHECKABLE[1]],
    };
  }

  if (session.dataLimitMb != null && session.bytesDownloaded / 1_000_000 >= session.dataLimitMb) {
    return {
      finding: "over-allowance",
      tone: "warning",
      confidence: "certain",
      headline: "They've used their full data allowance.",
      meaning: `Their WiFi will be slow or stopped until it resets. They've used ${formatGb(session.bytesDownloaded)} of a ${session.dataLimitMb} MB allowance.`,
      action: "You can give this guest more data if you want to.",
      checked: ["Their session", "Their data allowance"],
      notChecked: [],
    };
  }

  if (now - new Date(session.lastActivityAt).getTime() > IDLE_AFTER_MS) {
    return {
      finding: "gone-quiet",
      tone: "warning",
      confidence: "medium",
      headline: "They're signed in, but their phone has gone quiet.",
      meaning:
        "We haven't seen any traffic from them for a while. A phone that goes to sleep does this, and so does one that has drifted out of WiFi range.",
      action:
        "Ask them to wake their phone and open a website. If it asks them to log in again, that's normal — a sleeping phone gets signed out.",
      checked: ["Their session", "When we last saw traffic from them"],
      notChecked: [NOT_YET_CHECKABLE[2]],
    };
  }

  // Everything we can see is healthy. That is a real result, not a gap.
  return {
    finding: "wireless-boundary",
    tone: "neutral",
    confidence: "high",
    headline: "We checked everything we can see, and it's all healthy.",
    meaning:
      "This guest is signed in, not blocked, and hasn't hit any limit, and your internet is working. That points at the WiFi signal itself — and that's the one part we can't measure. Your access points are separate devices that don't report back to us, so signal strength, interference from nearby networks, and how many phones one access point is carrying are all invisible to us.",
    action:
      "If it's always the same spot in the room, that spot needs another access point. If it's the whole venue at the same time each evening, it's usually interference from neighbouring WiFi. If it's this guest only and everyone else is fine, it's usually their phone — ask them to turn WiFi off and on.",
    checked: [
      "Your internet connection",
      "Whether they're blocked here",
      "Their session",
      "Their data allowance",
    ],
    notChecked: [NOT_YET_CHECKABLE[0], NOT_YET_CHECKABLE[1], NOT_YET_CHECKABLE[2]],
  };
}

function formatGb(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/* ── Zone C: a guest can't open one particular site ─────────────────── */

export interface SiteSignals {
  host: string;
  /** A content-filtering rule of this venue's that covers the host. */
  blockedByRule: { name: string; confirmedOnRouter: boolean } | null;
  /** Did the router reach a known-good address by NUMBER. */
  reachedControlIp: boolean | null;
  /** Did the router reach the site by NAME. */
  reachedHostname: boolean | null;
}

export type SiteFinding =
  | "blocked-by-rule"
  | "dns-fault"
  | "router-cannot-reach"
  | "reachable-so-its-the-device"
  | "inconclusive";

export interface SiteVerdict {
  finding: SiteFinding;
  tone: VerdictTone;
  confidence: Confidence;
  headline: string;
  meaning: string;
  action: string;
}

/**
 * Pinging a known-good IP and then the hostname, and comparing the two, IS
 * the DNS test -- `/tool ping` has always accepted a hostname, so this
 * costs nothing to build and makes a distinction the old page could not:
 * a name-lookup fault fails almost every site while the connection itself
 * tests perfectly.
 *
 * The blocked verdict says *blocked*, never *cannot possibly reach*:
 * content filtering here is a DNS sinkhole with no Layer 7 and no TLS
 * interception, so a guest on a VPN or using private DNS goes straight
 * past it. And because the platform can push filter rules but cannot read
 * back what the device actually holds, an unconfirmed rule is reported as
 * our record, not as device state.
 */
export function siteVerdict(signals: SiteSignals): SiteVerdict {
  const { host } = signals;

  if (signals.blockedByRule) {
    const { name, confirmedOnRouter } = signals.blockedByRule;
    return {
      finding: "blocked-by-rule",
      tone: "neutral",
      confidence: confirmedOnRouter ? "certain" : "medium",
      headline: `${host} is blocked at this location.`,
      meaning: confirmedOnRouter
        ? `Blocked by your rule "${name}". Guests using a VPN or a private-DNS setting can still get past it.`
        : `Your rule "${name}" blocks it, but we haven't confirmed that rule reached your router.`,
      action: "If this wasn't meant to apply to guests, change it in Website Blocking.",
    };
  }

  if (signals.reachedControlIp === true && signals.reachedHostname === false) {
    return {
      finding: "dns-fault",
      tone: "danger",
      confidence: "certain",
      headline: `Your internet is working, but your router can't look up "${host}".`,
      meaning:
        "It can reach the internet by address but not by name. This is a name-lookup fault, not an outage — and it makes almost every site fail while the connection itself tests fine.",
      action: "This is worth raising with us — clearing the router's name cache fixes most cases.",
    };
  }

  if (signals.reachedControlIp === false) {
    return {
      finding: "router-cannot-reach",
      tone: "danger",
      confidence: "certain",
      headline: "Your router can't reach the internet at all right now.",
      meaning: `This isn't about ${host} — nothing outside your building is answering.`,
      action: "Check your provider's box. Guests won't be able to load anything until it's back.",
    };
  }

  if (signals.reachedHostname === true) {
    return {
      finding: "reachable-so-its-the-device",
      tone: "success",
      confidence: "high",
      headline: `${host} isn't blocked by you, and your router can reach it fine.`,
      meaning:
        "So the problem is on the guest's own phone. Usually the app itself, or a VPN, or a private-DNS setting — that last one is common on newer Android phones and stops your network helping them at all.",
      action:
        "Ask them to close the app completely and reopen it. If that fails, ask them to turn WiFi off and on again.",
    };
  }

  return {
    finding: "inconclusive",
    tone: "neutral",
    confidence: "medium",
    headline: `We couldn't test ${host} from your router just now.`,
    meaning:
      "We checked your own blocking rules and this site isn't on them, but we couldn't reach your router to test it from there.",
    action: "Try again in a moment.",
  };
}
