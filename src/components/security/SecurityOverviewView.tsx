import { Link } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck, Wifi, WifiOff, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, type StatTone } from "@/components/ui-ext";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useSecurityCapabilities, useSecurityOverview } from "@/hooks/useSecurity";
import type {
  SecurityAvailability,
  SecurityCounter,
  SecurityFeature,
  SecurityScore,
} from "@/types/security";

/**
 * The Security posture page.
 *
 * ## What this page will not do
 *
 * It will not show a number it does not have. Every counter arrives with its
 * own `available` flag, and an unavailable one renders the backend's reason --
 * "we do not collect gateway log events", say -- rather than a `0`, because a
 * zero and an absence look identical in a card and mean opposite things. The
 * score is the same: a venue with no managed gateway gets "not measured yet",
 * not a perfect 100.
 *
 * ## No page title, on purpose
 *
 * `CustomerHeader` already renders "<feature> · <venue>". A heading here would
 * be the same two facts a second time, which is the duplication this dashboard
 * has been pulled up on more than once, so the page opens on the status strip
 * instead.
 *
 * ## These figures follow the selected venue
 *
 * `X-Location-Id` goes out with the request, and the venue is part of the
 * query key, so the numbers below describe the venue named in the header above
 * them and reload when it changes. This used to be an organization-wide
 * aggregate carrying an "Account-wide" qualifier; the qualifier is gone
 * because the thing it described is.
 */

/** Plain-language copy per capability, for the customer surface.
 *
 * The backend's `detail` is written for the API and the operator console and
 * says things like "chain=forward" and "pushed over 8728"; that vocabulary is
 * explicitly not this audience's (see the product's own rule that an operator
 * should think "I want to block this", never "which firewall chain"). The
 * `enforcement` string is therefore never rendered here.
 *
 * Keys are looked up with a fallback to `detail`, so a capability the backend
 * adds later shows the backend's own wording rather than nothing at all --
 * drift in that direction is a page that says slightly too much, not a blank
 * panel. */
const PLAIN_COPY: Record<string, string> = {
  zone_to_zone_firewall:
    "Stop one group of networks from reaching another -- guests to your office machines, for example -- while both still reach the internet. Only traffic the gateway routes between them can be controlled this way.",
  domain_blocking_dns:
    "Block a website by name for anyone using this gateway as their DNS server. A device with its own DNS settings, or private DNS switched on after sign-in, is not covered.",
  domain_blocking_sni:
    "Block a website by name over HTTPS, without opening or inspecting anyone's traffic. Coverage drops where newer browsers hide the site name, and it sees nothing over some newer protocols or a VPN.",
  ip_and_cidr_blocking:
    "Block specific addresses or ranges, in both directions. Do not use this to block a website: popular services sit behind addresses that rotate constantly.",
  device_isolation:
    "Cut a single device off, or confine it to everything except what you allow. Works reliably for hardware you have enrolled; anonymous guests can change their hardware identity and reappear as someone new.",
  rogue_dhcp_detection:
    "Tells you when a second device on the network starts handing out addresses, which is usually how an unauthorised access point gets introduced.",
  connection_flood_protection:
    "Limits how many connections one source can open, which reduces floods and password-guessing. It reduces the exposure rather than removing it, and a strict limit can drop legitimate bursts.",
  web_category_filtering:
    "Needs a maintained list of which sites belong to which category, and something to apply it. This platform has neither yet -- a DNS filtering provider supplies both.",
  application_control:
    "Only partly achievable today, by matching an app's known website names. Telling one app from another reliably needs deep packet inspection, which this platform does not have.",
  threat_intelligence:
    "Needs a maintained list of known-bad sites and addresses. The way to block them already works; the intelligence behind it is what is missing.",
  geo_blocking:
    "Needs a country-to-address database plus regular updates. Blocking traffic coming in from a country would be reliable; blocking traffic going out would not, because popular sites are served from many countries at once.",
  per_application_traffic:
    "Needs deep packet inspection or flow records. This platform reports data per guest, device, network and session, and cannot attribute it per app.",
  ids_ips:
    "Needs dedicated inspection hardware. The gateway is not an intrusion-detection system, and a screen for this would show alarms nothing was evaluating.",
  url_path_filtering:
    "Would require reading inside encrypted traffic, which means breaking the certificate trust of every device on the network. Filtering here is by site name, by design.",
};

/** Where a capability is managed, for the ones that have a screen.
 *
 * Only these four, and each is checked against what the screen actually
 * writes rather than against the capability's name:
 *
 *  - `domain_blocking_dns`: a website rule on the Websites tab is a DNS
 *    block -- that is the whole of what `content_filtering` pushes for a
 *    domain.
 *  - `ip_and_cidr_blocking`: an address rule on the same tab.
 *  - `device_isolation`: blocking a guest on the Guests tab refuses their
 *    next sign-in and ends the session they are in.
 *  - `zone_to_zone_firewall`: Security -> Firewall, whose rules are
 *    between-network (`forward`) rules applied to the router by
 *    cloud-guest#304's push -- which is exactly what the backend's catalogue
 *    means by it.
 *
 * Every link is still data-driven: a row is only rendered for a capability
 * the backend returned, and only linked from the "available" group. If the
 * backend reports `zone_to_zone_firewall` as anything else (a backend without
 * #304 does), it gets no link.
 *
 * Deliberately absent: `domain_blocking_sni` (nothing in the product writes
 * an HTTPS-hostname rule yet, so a link would lead to a screen that does
 * something else), `connection_flood_protection` and `rogue_dhcp_detection`
 * (no customer screen manages them). A capability
 * with no entry here simply has no link -- and one the backend stops sending
 * is simply not rendered, since this list is only ever read through the
 * capabilities the backend returned. */
type ManagedAt =
  | { to: "/blocking"; tab: "websites" | "guests"; label: string }
  | { to: "/firewall"; label: string };

const MANAGED_AT: Record<string, ManagedAt> = {
  domain_blocking_dns: { to: "/blocking", tab: "websites", label: "Block a website" },
  ip_and_cidr_blocking: { to: "/blocking", tab: "websites", label: "Block an address" },
  device_isolation: { to: "/blocking", tab: "guests", label: "Block a guest" },
  zone_to_zone_firewall: { to: "/firewall", label: "Set firewall rules" },
};

/** One capability's link. Split by destination so each `<Link>` is typed
 * against its own route's search params. */
function ManagedAtLink({ at }: { at: ManagedAt }) {
  const cls =
    "mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline";
  const body = (
    <>
      {at.label}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </>
  );
  return at.to === "/blocking" ? (
    <Link to="/blocking" search={{ tab: at.tab }} className={cls}>
      {body}
    </Link>
  ) : (
    <Link to="/firewall" className={cls}>
      {body}
    </Link>
  );
}

const BAND_COPY: Record<NonNullable<SecurityScore["band"]>, string> = {
  excellent: "Nothing on this platform's checklist needs attention",
  good: "A few items are worth a look",
  fair: "Several items need attention",
  poor: "Multiple items need attention",
};

const AVAILABILITY_GROUPS: {
  availability: SecurityAvailability;
  title: string;
  note: string;
}[] = [
  {
    availability: "available",
    title: "Enforced today",
    note: "Working now on the gateways this platform manages.",
  },
  {
    availability: "requires_additional_technology",
    title: "Needs something we do not have yet",
    note: "The mechanism is here; the data or the service behind it is not.",
  },
  {
    availability: "not_supported",
    title: "Not available",
    note: "Not deliverable on this platform as it stands, and not shown as a control you can switch on.",
  },
];

function scoreTone(score: SecurityScore): StatTone {
  if (!score.available) return "default";
  if (score.band === "excellent") return "success";
  if (score.band === "good") return "info";
  if (score.band === "fair") return "warning";
  return "danger";
}

function StatusChip({
  ok,
  label,
  detail,
  icon: Icon,
}: {
  ok: boolean;
  label: string;
  detail: string;
  icon: typeof Wifi;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
      <Icon
        className={ok ? "mt-0.5 h-4 w-4 text-emerald-500" : "mt-0.5 h-4 w-4 text-amber-500"}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function CounterCard({ counter }: { counter: SecurityCounter }) {
  if (!counter.available) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-5">
          <p className="text-2xl font-semibold text-muted-foreground" aria-hidden="true">
            --
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{counter.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {counter.unavailableReason ?? "Not measured yet."}
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <StatCard label={counter.label} value={counter.count ?? 0} hint={counter.source ?? undefined} />
  );
}

export function SecurityOverviewView() {
  const overviewQuery = useSecurityOverview();
  const capabilitiesQuery = useSecurityCapabilities();

  if (overviewQuery.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <EmptyState
        title="Could not load your security posture"
        description="This is usually temporary. Reload the page, and if it persists raise a support ticket."
      />
    );
  }

  const { score, counters, fleet, generatedAt } = overviewQuery.data;
  const capabilities: SecurityFeature[] = capabilitiesQuery.data ?? [];

  if (fleet.noManagedGateway) {
    return (
      <EmptyState
        title="No gateway is connected yet"
        description="Security features apply to gateways this platform manages. Once one is connected and reporting, this page fills in on its own."
      />
    );
  }

  const gatewayOk = fleet.routersStale === 0;

  return (
    <div className="space-y-6">
      {/* Status first: it is the context for every number below it. The
          platform's own management tunnel is deliberately not shown here --
          it is not a venue's control, and the backend no longer serves it to
          this page (cloud-guest#303). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusChip
          ok={gatewayOk}
          icon={gatewayOk ? Wifi : WifiOff}
          label={gatewayOk ? "Gateways reporting" : "Some gateways have gone quiet"}
          detail={
            gatewayOk
              ? `All ${fleet.routersTotal} reporting`
              : `${fleet.routersReporting} of ${fleet.routersTotal} reporting`
          }
        />
        <StatusChip
          ok
          icon={ShieldCheck}
          label="Last updated"
          detail={new Date(generatedAt).toLocaleString()}
        />
      </div>

      {/* The score, with its own arithmetic shown rather than asserted. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Security score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {score.available && score.score !== null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-4xl font-semibold tabular-nums text-foreground">
                  {score.score}
                </span>
                <span className="text-sm text-muted-foreground">/ {score.maxScore}</span>
                {score.band && (
                  <span className="text-sm capitalize text-muted-foreground">
                    {score.band} · {BAND_COPY[score.band]}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This measures how well this platform's own protections are set up and applied. It
                does not measure attacks, and a clean score does not mean nothing was attempted.
              </p>
              <ul className="divide-y divide-border/60">
                {score.factors.map((factor) => (
                  <li
                    key={factor.key}
                    className="flex items-start justify-between gap-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{factor.label}</p>
                      <p className="text-xs text-muted-foreground">{factor.detail}</p>
                    </div>
                    <span
                      className={
                        factor.penalty === 0
                          ? "shrink-0 tabular-nums text-emerald-600 dark:text-emerald-400"
                          : "shrink-0 tabular-nums text-amber-600 dark:text-amber-400"
                      }
                    >
                      {factor.penalty === 0 ? "OK" : `-${factor.penalty}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Not measured yet</p>
                <p className="text-xs text-muted-foreground">
                  {score.unavailableReason ??
                    "There is not enough information to score this account yet."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Where you stand</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {counters.map((counter) => (
            <CounterCard key={counter.key} counter={counter} />
          ))}
        </div>
      </section>

      {/* The capability matrix. This is the part that keeps the product honest:
          anything not enforceable is listed with what is missing, instead of
          being offered as a switch that does nothing. */}
      {capabilities.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">What this platform can enforce</h2>
          {AVAILABILITY_GROUPS.map((group) => {
            const items = capabilities.filter((f) => f.availability === group.availability);
            if (items.length === 0) return null;
            return (
              <div key={group.availability} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
                  <p className="text-xs text-muted-foreground">{group.note}</p>
                </div>
                <ul className="grid gap-3 md:grid-cols-2">
                  {items.map((feature) => (
                    <li
                      key={feature.key}
                      className="rounded-lg border border-border/60 bg-card px-4 py-3"
                    >
                      <p className="text-sm font-medium text-foreground">{feature.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {PLAIN_COPY[feature.key] ?? feature.detail}
                      </p>
                      {/* Only an "Enforced today" row gets a link -- a row
                          in the other two groups has no control to go to,
                          even if its key were ever listed above. */}
                      {group.availability === "available" && MANAGED_AT[feature.key] && (
                        <ManagedAtLink at={MANAGED_AT[feature.key]} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default SecurityOverviewView;
