/**
 * "Fix a Problem" -- the customer-facing replacement for Connection Tools.
 *
 * WHY THIS IS A REWRITE AND NOT A RESTYLE
 * ---------------------------------------
 * The old page was already renamed and re-laid-out once for exactly the
 * complaint it is being rebuilt for now ("looks like a competitor's"), and
 * the complaint outlived the rename. It survived because the page was not
 * styled wrong; it was the wrong page. Two inputs -- a ping target and a
 * guest's private LAN IP -- and three buttons named after RouterOS
 * commands, offered to a cafe owner standing in front of an annoyed guest.
 *
 * Feature for feature it was TP-Link Omada's Network Tools. You cannot
 * restyle your way out of that, because the shape came from the router
 * vendor's command set rather than from anyone's question.
 *
 * So this page asks the venue's question instead. Ping and traceroute
 * survive as the *implementation* of "can my guest open this site", never
 * as buttons with those names.
 *
 * THE ORDER OF THE ZONES IS THE ARGUMENT
 * --------------------------------------
 * A. The standing answer, needing no input. The page must never open
 *    empty, and it does not have to: the platform health-checks the
 *    venue's uplink on a 30-second sweep, so the answer to "is my internet
 *    working" is already known before anyone presses anything.
 * B. Look up a guest -- by PHONE NUMBER, the identifier this whole product
 *    is built on and the one the front desk is actually holding. The old
 *    page asked for a LAN IP, which a front desk cannot obtain, to find a
 *    session in a list the page had already fetched.
 * C. Check one website.
 * E. What we checked -- the raw output, collapsed, for the phone call to
 *    the ISP. (Zone D, the speed test, is deliberately a later stage.)
 *
 * THE UNREACHABLE STATE IS BUILT FIRST AND IS NOT AN EDGE CASE
 * -----------------------------------------------------------
 * Every router command travels over the management tunnel, which runs over
 * the venue's own WAN. When their internet dies the tunnel dies with it,
 * so no router check will run -- in exactly the situation that makes
 * someone open this page. `venueVerdict` therefore reads heartbeat
 * staleness and stored health, never a live probe, and Zones B and C
 * degrade rather than disappear: the guest lookup is entirely database
 * state and keeps working through an outage.
 *
 * WHAT THIS PAGE WILL NOT DO
 * --------------------------
 * No composite health score, ever -- no percentage, no grade for "your
 * network". No signal strength, no dBm, no Good/Fair/Poor: the fleet is a
 * wired five-port MikroTik with no radio, so those are not weakly
 * supported, they are absent. "The link is fine and the problem is in the
 * wireless, which we cannot see" is a designed result here, not a gap.
 * And no raw device rows: hotspot and log output carry guest MAC addresses
 * and phone numbers that the read-only reader's sanitizer does not strip.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  Router as RouterIcon,
  Search,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/masking";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { routerService } from "@/services/router.service";
import { ispService } from "@/services/isp.service";
import { guestService } from "@/services/guest.service";
import { contentFilterService } from "@/services/contentFilter.service";
import { networkDiagnosticsService } from "@/services/network-diagnostics.service";
import type { AppError } from "@/services/api";
import type { RouterDevice } from "@/types/router";
import type { IspLink } from "@/types/isp";
import type { Guest, GuestSession } from "@/types/guest";
import type { DiagnosticRun } from "@/types/network-diagnostics";
import {
  describeDiagnosticApiError,
  diagnosticVerdict,
  summarizeDiagnosticResult,
  tracerouteHopsOf,
} from "@/lib/diagnostics-presentation";
import {
  guestVerdict,
  humanizeAge,
  siteVerdict,
  venueVerdict,
  type GuestVerdict,
  type LinkReading,
  type SiteVerdict,
  type VenueVerdict,
  type VerdictTone,
} from "@/lib/connection-verdicts";
import {
  HEARTBEAT_SILENT_AFTER_MINUTES,
  deriveRouterLiveness,
  lastContactLabel,
  minutesSince,
} from "@/lib/location-liveness";

/** `lastContactLabel` needs the derived liveness, not the wire row -- and
 * `deriveRouterLiveness` is what knows that `last_seen_at` on a still-
 * provisioning router is the token exchange rather than a check-in. */
function routerContactLine(router: RouterDevice): string {
  const now = new Date();
  return lastContactLabel(
    deriveRouterLiveness(
      {
        id: router.id,
        name: router.name,
        status: router.status,
        last_seen_at: router.lastSeenAt,
      },
      now,
    ),
    now,
  );
}

/** A public resolver, used only as the "can this router reach the internet
 * by NUMBER" control probe. Pinging this and then the hostname, and
 * comparing, is the DNS test -- `/tool ping` has always taken a hostname,
 * so the distinction costs nothing and the old page could not make it. */
const CONTROL_IP = "8.8.8.8";

/** Mirrors `services/api.ts`'s axios `timeout`. Only used to tell a
 * client-side give-up apart from a dropped connection when reporting. */
const API_TIMEOUT_MS = 20_000;

/* ── shared bits ────────────────────────────────────────────────────── */

const TONE_CARD: Record<VerdictTone, string> = {
  success: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  warning: "border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10",
  danger: "border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10",
  neutral: "border-border bg-muted/40",
};
const TONE_TEXT: Record<VerdictTone, string> = {
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-rose-700 dark:text-rose-300",
  neutral: "text-foreground",
};
const TONE_ICON: Record<VerdictTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
};

/**
 * The three-part template every result on this page uses:
 * what we found → what that means → what to do.
 *
 * The third part is the one that matters and the one the old page never
 * had. A finding a salon owner cannot act on is a log line with better
 * typography.
 */
function VerdictCard({
  tone,
  headline,
  meaning,
  action,
  footnote,
  children,
}: {
  tone: VerdictTone;
  headline: string;
  meaning?: string | null;
  action?: string | null;
  footnote?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <div className={cn("rounded-xl border p-4", TONE_CARD[tone])}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_TEXT[tone])} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{headline}</p>
          {meaning && <p className="text-sm text-muted-foreground">{meaning}</p>}
          {action && (
            <p className="text-sm">
              <span className="font-medium">What to do: </span>
              <span className="text-muted-foreground">{action}</span>
            </p>
          )}
          {children}
          {footnote}
        </div>
      </div>
    </div>
  );
}

/** A disclosure. Everything an engineer wants and a venue owner does not
 * lives behind one of these -- the hop table included. */
function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

/** §8.4 -- a swept value always carries its age, and anything past the
 * staleness line is never presented as current. */
function CheckedAgo({ iso, stale }: { iso: string | null; stale: boolean }) {
  if (!iso) return null;
  const mins = minutesSince(iso, new Date());
  if (mins == null) return null;
  const text = mins < 1 ? "Checked seconds ago" : `Checked ${humanizeAge(mins * 60_000)} ago`;
  return (
    <span className="text-xs text-muted-foreground">
      {text}
      {stale && " — this may have changed"}
    </span>
  );
}

/** What was and was not established. Rendering the gaps is the point:
 * an unchecked rung must never read as a clean bill of health. */
function CheckedList({ checked, notChecked }: { checked: string[]; notChecked: string[] }) {
  if (checked.length === 0 && notChecked.length === 0) return null;
  return (
    <Disclosure label="What we checked">
      <div className="space-y-2 rounded-lg border bg-background/60 p-3">
        {checked.length > 0 && (
          <ul className="space-y-1">
            {checked.map((c) => (
              <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                {c}
              </li>
            ))}
          </ul>
        )}
        {notChecked.length > 0 && (
          <>
            <p className="pt-1 text-xs font-medium">We could not check:</p>
            <ul className="space-y-1">
              {notChecked.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  {c}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Disclosure>
  );
}

/* ── demo fixtures ──────────────────────────────────────────────────── */

/**
 * Under demo this page shows a fully worked example, because that example
 * IS the pitch. The old page showed a tool that refused every button and a
 * tile reading "Demo" where a number should be -- the one screen in the
 * product with no fixtures at all.
 *
 * Labelled "Example" inline rather than badged "Demo" as a status tile: it
 * is a property of the data, not of the venue's network.
 */
const DEMO_NOW = () => Date.now();
const DEMO_LINKS: LinkReading[] = [
  {
    id: "demo-primary",
    providerName: "Airtel Fiber",
    isPrimary: true,
    status: "up",
    latencyMs: 18,
    packetLossPercent: 0,
    checkedAt: new Date(DEMO_NOW() - 12_000).toISOString(),
  },
];
const DEMO_GUEST_IDENTIFIER = "+91 98765 43210";
/** Three, and the strip says three -- a demo that claims 41 guests over an
 * empty picker is the same small dishonesty this page exists to remove. */
const DEMO_SESSION_COUNT = 3;

/* ── the page ───────────────────────────────────────────────────────── */

export function FixAProblem({
  locationId,
  masked = true,
}: {
  locationId?: string;
  masked?: boolean;
}) {
  const demo = isDemo();

  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [links, setLinks] = useState<IspLink[]>([]);
  const [sessions, setSessions] = useState<GuestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (demo) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const orgId = await resolveOrgId();
        // Zone A must survive a partial failure -- an uplink read that
        // fails should not take the guest lookup with it, and vice versa.
        const [routerRows, linkRows, sessionRows] = await Promise.allSettled([
          locationId ? routerService.listForLocation(locationId, orgId) : Promise.resolve([]),
          ispService.listLinks({ page: 1, pageSize: 100, locationId }),
          guestService.listSessions({
            status: "active",
            organizationId: orgId,
            locationId: locationId ?? "all",
            page: 1,
            pageSize: 100,
          }),
        ]);
        if (!alive) return;
        setRouters(routerRows.status === "fulfilled" ? routerRows.value : []);
        setLinks(
          linkRows.status === "fulfilled"
            ? linkRows.value.rows.filter((l) => l.isEnabled && l.locationId === locationId)
            : [],
        );
        setSessions(sessionRows.status === "fulfilled" ? sessionRows.value.rows : []);
        // Only a total failure is an error -- one leg failing degrades a
        // zone, it does not invalidate the page.
        setLoadError(
          routerRows.status === "rejected" &&
            linkRows.status === "rejected" &&
            sessionRows.status === "rejected",
        );
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationId, demo, refreshKey]);

  const router = routers[0] ?? null;
  const routerOrgId = router?.organizationId;

  /** Contact is judged on heartbeat age, never on a probe -- a probe is
   * what fails during the outage this has to describe. */
  const routerReachable = useMemo<boolean | null>(() => {
    if (demo) return true;
    if (!router) return null;
    const mins = minutesSince(router.lastSeenAt, new Date());
    if (mins == null) return null;
    return mins < HEARTBEAT_SILENT_AFTER_MINUTES;
  }, [router, demo]);

  const readings = useMemo<LinkReading[]>(() => {
    if (demo) return DEMO_LINKS;
    return links.map((l) => ({
      id: l.id,
      providerName: l.providerName,
      isPrimary: l.role === "primary",
      status:
        l.healthStatus === "healthy"
          ? ("up" as const)
          : l.healthStatus === "degraded"
            ? ("degraded" as const)
            : l.healthStatus === "unhealthy"
              ? ("down" as const)
              : ("unknown" as const),
      latencyMs: l.latencyMs,
      packetLossPercent: l.packetLossPercentage,
      checkedAt: l.lastCheckedAt,
    }));
  }, [links, demo]);

  const guestsOnline = demo ? DEMO_SESSION_COUNT : sessions.length;

  const venue: VenueVerdict = useMemo(
    () =>
      venueVerdict({
        hasRouter: demo ? true : routers.length > 0,
        links: readings,
        routerLastSeenAt: demo
          ? new Date(Date.now() - 20_000).toISOString()
          : (router?.lastSeenAt ?? null),
        routerReachable,
        guestsOnline,
      }),
    [routers.length, readings, router, routerReachable, guestsOnline, demo],
  );

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeading demo={demo} />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading demo={demo} />

      <ZoneA
        venue={venue}
        router={router}
        guestsOnline={guestsOnline}
        onRetry={reload}
        loadError={loadError}
      />

      {venue.status !== "no-router" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ZoneBGuestLookup
            demo={demo}
            masked={masked}
            locationId={locationId}
            sessions={sessions}
            venueStatus={venue.status}
            onSessionReset={reload}
          />
          <ZoneCSiteCheck
            demo={demo}
            routerId={router?.id ?? ""}
            routerOrgId={routerOrgId}
            routerReachable={routerReachable}
          />
        </div>
      )}

      {venue.status !== "no-router" && (
        <ZoneEWhatWeChecked demo={demo} routerId={router?.id ?? ""} routerOrgId={routerOrgId} />
      )}
    </div>
  );
}

function PageHeading({ demo }: { demo: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
          <Wifi className="h-[18px] w-[18px] text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Fix a Problem</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Someone says the WiFi isn&apos;t working. Start with their phone number — most of the
            time the answer is already here.
          </p>
        </div>
      </div>
      {demo && (
        <p className="text-xs text-muted-foreground">
          This is an example, using sample guests. Sign in to see your own.
        </p>
      )}
    </div>
  );
}

/* ── Zone A ─────────────────────────────────────────────────────────── */

function ZoneA({
  venue,
  router,
  guestsOnline,
  onRetry,
  loadError,
}: {
  venue: VenueVerdict;
  router: RouterDevice | null;
  guestsOnline: number | null;
  onRetry: () => void;
  loadError: boolean;
}) {
  if (loadError) {
    return (
      <ErrorState
        title="We couldn't load this location just now"
        description="This is a problem reaching us, not a problem with your internet. Nothing has changed at your venue."
        onRetry={onRetry}
      />
    );
  }

  const unreachable =
    venue.status === "router-unreachable-internet-down" ||
    venue.status === "router-unreachable-internet-ok";

  return (
    <VerdictCard
      tone={venue.tone}
      headline={venue.headline}
      meaning={venue.meaning}
      action={venue.action}
      footnote={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <CheckedAgo iso={venue.checkedAt} stale={venue.stale} />
          {guestsOnline != null && venue.status !== "no-router" && (
            <span className="text-xs text-muted-foreground">
              · {guestsOnline} guest{guestsOnline === 1 ? "" : "s"} connected now
            </span>
          )}
          {router && (
            <span className="text-xs text-muted-foreground">· {routerContactLine(router)}</span>
          )}
        </div>
      }
    >
      {unreachable && (
        <Button size="sm" variant="outline" className="mt-1" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </VerdictCard>
  );
}

/* ── Zone B ─────────────────────────────────────────────────────────── */

function ZoneBGuestLookup({
  demo,
  masked,
  locationId,
  sessions,
  venueStatus,
  onSessionReset,
}: {
  demo: boolean;
  masked: boolean;
  locationId?: string;
  sessions: GuestSession[];
  venueStatus: VenueVerdict["status"];
  onSessionReset: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    verdict: GuestVerdict;
    identifier: string;
    session: GuestSession | null;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const lookup = async (rawIdentifier: string, knownSession?: GuestSession) => {
    const identifier = rawIdentifier.trim();
    if (!identifier) {
      toast.error("Enter the phone number the guest used to log in.");
      return;
    }
    if (demo) {
      // The worked example: a guest who mistyped their code. Under demo
      // this is the whole pitch, so it is a real verdict rendered by the
      // real component, not a screenshot.
      setResult({
        identifier: DEMO_GUEST_IDENTIFIER,
        session: null,
        verdict: guestVerdict({
          guest: {
            identifier: DEMO_GUEST_IDENTIFIER,
            isBlocked: false,
            blockedReason: null,
            lastSeenAt: new Date(Date.now() - 3 * 60_000).toISOString(),
          },
          session: null,
          venue: "internet-up",
        }),
      });
      return;
    }
    setBusy(true);
    try {
      const orgId = await resolveOrgId();
      let guest: Guest | null = null;
      let session: GuestSession | null = knownSession ?? null;

      if (knownSession) {
        // Came from the picker, so we already hold the guest's id. Look
        // them up by it rather than by their identifier: guest sessions do
        // not carry the phone number yet, so a search keyed on whatever
        // the row could show would be a search for a UUID -- which matches
        // nothing, and would have reported a guest who is demonstrably
        // online as one we have never seen.
        guest = await guestService.get(knownSession.guestId, orgId);
      } else {
        const found = await guestService.list({
          organizationId: orgId,
          locationId: locationId && locationId !== "all" ? locationId : undefined,
          search: identifier,
          page: 1,
          pageSize: 5,
        });
        // Prefer an exact identifier match; the endpoint's search is a
        // substring match, and "9876" must not silently answer for someone
        // whose number merely contains it.
        const digits = (s: string) => s.replace(/\D/g, "");
        guest =
          found.rows.find((g) => digits(g.identifier) === digits(identifier)) ??
          (found.rows.length === 1 ? found.rows[0] : null);
      }

      const matched = guest;
      if (matched && !session) {
        session = sessions.find((s) => s.guestId === matched.id) ?? null;
      }

      setResult({
        identifier: guest?.identifier ?? identifier,
        session,
        verdict: guestVerdict({
          guest: guest
            ? {
                identifier: guest.identifier,
                isBlocked: guest.isBlocked,
                blockedReason: guest.blockedReason,
                lastSeenAt: guest.lastSeenAt,
              }
            : null,
          session: session
            ? {
                startedAt: session.startedAt,
                lastActivityAt: session.lastActivityAt,
                bytesDownloaded: session.bytesDownloaded,
                dataLimitMb: session.dataLimitMb,
              }
            : null,
          venue: venueStatus,
        }),
      });
    } catch (err) {
      const e = err as AppError;
      toast.error(
        e.status === 403
          ? "You don't have permission to look up guests here."
          : "We couldn't look that guest up just now.",
        { description: "Try again in a moment." },
      );
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!result?.session) return;
    setResetting(true);
    try {
      await guestService.terminateSession(result.session.id, "Session reset from Fix a Problem");
      toast.success("Done — they'll be sent back to the login page to sign in again.");
      setResult(null);
      setPhone("");
      onSessionReset();
    } catch {
      toast.error("We couldn't reset that session.", {
        description: "Try again in a moment.",
      });
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" /> Who&apos;s having trouble?
        </CardTitle>
        <CardDescription>
          Type the number they used to log in. If you don&apos;t have it, pick them from the list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="98765 43210"
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup(phone)}
            className="h-9"
          />
          <Button size="sm" disabled={busy} onClick={() => lookup(phone)}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            <span className="ml-2">Look up</span>
          </Button>
        </div>

        {sessions.length > 0 && (
          <Disclosure label={`Or pick someone — connected now (${sessions.length})`}>
            <div className="max-h-40 overflow-y-auto rounded-lg border">
              {sessions.slice(0, 25).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => lookup(s.guestIdentifier ?? s.guestId, s)}
                  className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/50"
                >
                  <span className="truncate font-medium">
                    {s.guestIdentifier
                      ? masked
                        ? maskPhone(s.guestIdentifier)
                        : s.guestIdentifier
                      : `Guest ${s.guestId.slice(0, 8)}`}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{s.ipAddress ?? "—"}</span>
                </button>
              ))}
            </div>
            {/* The backend's guest-session payload carries guest_id only, so
                these rows cannot show a phone number yet. Saying so beats a
                column of UUID fragments with no explanation. */}
            {sessions.some((s) => !s.guestIdentifier) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Some rows show an internal reference instead of a phone number — guest sessions
                don&apos;t carry the number yet.
              </p>
            )}
          </Disclosure>
        )}

        {!result && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm font-medium">Nothing needs fixing right now.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When a guest tells you the WiFi isn&apos;t working, type their number above and
              we&apos;ll tell you what we can see.
            </p>
          </div>
        )}

        {result && (
          <VerdictCard
            tone={result.verdict.tone}
            headline={result.verdict.headline}
            meaning={result.verdict.meaning}
            action={result.verdict.action}
            footnote={
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {masked ? maskPhone(result.identifier) : result.identifier}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Confidence: {result.verdict.confidence}
                  </span>
                </div>
                <CheckedList
                  checked={result.verdict.checked}
                  notChecked={result.verdict.notChecked}
                />
              </div>
            }
          >
            {result.session && (
              <Button
                size="sm"
                variant="outline"
                className="mt-1"
                disabled={resetting}
                onClick={() => setConfirmReset(true)}
              >
                {resetting ? "Resetting…" : "Reset this guest's session"}
              </Button>
            )}
          </VerdictCard>
        )}
      </CardContent>

      {/* Kicking a real guest off the network is destructive and used to
          happen on a single click with no confirmation. */}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset this guest's session?"
        description="They'll be disconnected and sent back to the login page to sign in again. Anything they're in the middle of will stop."
        confirmLabel="Reset session"
        destructive
        onConfirm={doReset}
      />
    </Card>
  );
}

/* ── Zone C ─────────────────────────────────────────────────────────── */

function ZoneCSiteCheck({
  demo,
  routerId,
  routerOrgId,
  routerReachable,
}: {
  demo: boolean;
  routerId: string;
  routerOrgId?: string;
  routerReachable: boolean | null;
}) {
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<SiteVerdict | null>(null);
  const [runs, setRuns] = useState<DiagnosticRun[]>([]);

  const check = async () => {
    const clean = host
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "");
    if (!clean) {
      toast.error("Enter the website the guest can't open, e.g. instagram.com");
      return;
    }
    if (demo) {
      setVerdict(
        siteVerdict({
          host: clean,
          blockedByRule: { name: "Social media — evenings", confirmedOnRouter: true },
          reachedControlIp: null,
          reachedHostname: null,
        }),
      );
      return;
    }
    setBusy(true);
    setRuns([]);
    const startedAt = Date.now();
    try {
      // 1. Our own blocking rules first: it is a list lookup with no device
      //    I/O, and it is the answer often enough to be worth asking first.
      let blockedByRule: { name: string; confirmedOnRouter: boolean } | null = null;
      try {
        const rules = await contentFilterService.list({ routerId, page: 1, pageSize: 200 });
        const hit = rules.rows.find(
          (r) =>
            r.isEnabled &&
            r.valueType === "domain" &&
            (clean.toLowerCase() === r.value.toLowerCase() ||
              clean.toLowerCase().endsWith(`.${r.value.toLowerCase()}`)),
        );
        if (hit) {
          blockedByRule = { name: hit.name, confirmedOnRouter: hit.devicePushStatus === "active" };
        }
      } catch {
        // Not fatal -- fall through to the reachability half rather than
        // failing the whole check on one unreadable list.
      }

      if (blockedByRule) {
        setVerdict(
          siteVerdict({
            host: clean,
            blockedByRule,
            reachedControlIp: null,
            reachedHostname: null,
          }),
        );
        return;
      }

      if (routerReachable === false) {
        setVerdict(
          siteVerdict({
            host: clean,
            blockedByRule: null,
            reachedControlIp: null,
            reachedHostname: null,
          }),
        );
        return;
      }

      // 2. By NUMBER, then by NAME. The comparison is the DNS test.
      const control = await networkDiagnosticsService.ping(routerId, CONTROL_IP, routerOrgId);
      const byName = await networkDiagnosticsService.ping(routerId, clean, routerOrgId);
      setRuns([byName, control]);
      const reached = (r: DiagnosticRun) => {
        const v = diagnosticVerdict(r);
        return v.outcome === "reached" || v.outcome === "degraded";
      };
      setVerdict(
        siteVerdict({
          host: clean,
          blockedByRule: null,
          reachedControlIp: reached(control),
          reachedHostname: reached(byName),
        }),
      );
    } catch (err) {
      const problem = describeDiagnosticApiError(err as AppError, {
        kind: "ping",
        target: clean,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: API_TIMEOUT_MS,
      });
      toast.error(problem.title, { description: problem.description });
      setVerdict(
        siteVerdict({
          host: clean,
          blockedByRule: null,
          reachedControlIp: null,
          reachedHostname: null,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4 text-primary" /> A guest can&apos;t open one particular site?
        </CardTitle>
        <CardDescription>
          We&apos;ll check your own blocking rules first, then try it from your router.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="instagram.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            className="h-9"
          />
          <Button size="sm" disabled={busy} onClick={check}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span className={busy ? "ml-2" : ""}>Check this site</span>
          </Button>
        </div>
        {busy && (
          <p className="text-xs text-muted-foreground">
            Checking from your router — this takes a few seconds.
          </p>
        )}
        {verdict && (
          <VerdictCard
            tone={verdict.tone}
            headline={verdict.headline}
            meaning={verdict.meaning}
            action={verdict.action}
            footnote={
              runs.length > 0 ? (
                <div className="pt-1">
                  <Disclosure label="Show the technical detail">
                    <div className="space-y-2">
                      {runs.map((r) => (
                        <TechnicalRun key={r.id} run={r} />
                      ))}
                    </div>
                  </Disclosure>
                </div>
              ) : null
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

/** The engineer's view of one run. Never above a disclosure: this is the
 * material for the phone call to the ISP, not for the venue owner. */
function TechnicalRun({ run }: { run: DiagnosticRun }) {
  const v = diagnosticVerdict(run);
  const hops = run.diagnosticType === "traceroute" ? tracerouteHopsOf(run) : [];
  return (
    <div className="rounded-lg border bg-background/60 p-2">
      <p className="font-mono text-xs">
        {run.diagnosticType} {run.target} — {summarizeDiagnosticResult(run) ?? v.headline}
      </p>
      {hops.length > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Hop</TableHead>
                <TableHead className="text-xs">Address</TableHead>
                <TableHead className="text-xs">Loss</TableHead>
                <TableHead className="text-xs">RTT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hops.map((h) => (
                <TableRow key={h.hop_number}>
                  <TableCell className="text-xs">{h.hop_number}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {h.address ?? <span className="text-muted-foreground">* (no reply)</span>}
                  </TableCell>
                  <TableCell className="text-xs">{h.packet_loss_percentage}%</TableCell>
                  <TableCell className="text-xs">
                    {h.avg_rtt_ms != null ? `${h.avg_rtt_ms.toFixed(1)} ms` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ── Zone E ─────────────────────────────────────────────────────────── */

function ZoneEWhatWeChecked({
  demo,
  routerId,
  routerOrgId,
}: {
  demo: boolean;
  routerId: string;
  routerOrgId?: string;
}) {
  const [runs, setRuns] = useState<DiagnosticRun[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (demo || !routerId) {
      setLoaded(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await networkDiagnosticsService.listRuns(routerId, routerOrgId, 1, 20);
        if (!alive) return;
        setRuns(res.rows);
        setTotal(res.total);
        setError(false);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [routerId, routerOrgId, demo, retry]);

  if (!loaded) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">What we checked</CardTitle>
        <CardDescription>
          Every test we ran, with the raw result. Useful if you&apos;re on the phone to your
          internet provider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Disclosure label={error ? "Show what we know" : `Show ${runs.length} recent checks`}>
          {error ? (
            <ErrorState
              title="We couldn't read back this router's history"
              description="Your earlier checks are still recorded — we just couldn't load them."
              onRetry={() => setRetry((r) => r + 1)}
            />
          ) : runs.length === 0 ? (
            <EmptyState
              icon={RouterIcon}
              title="No checks recorded yet"
              description="Anything this page runs against your router is listed here."
            />
          ) : (
            <div className="space-y-2">
              {total != null && total > runs.length && (
                <p className="text-xs text-muted-foreground">
                  Showing the {runs.length} most recent of {total}.
                </p>
              )}
              {runs.map((r) => (
                <TechnicalRun key={r.id} run={r} />
              ))}
            </div>
          )}
        </Disclosure>
      </CardContent>
    </Card>
  );
}
