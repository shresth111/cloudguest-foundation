import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
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
    "Stop one of your networks reaching another -- guests reaching your office computers, for example -- while both still reach the internet. It works between networks that are kept separate; devices on the same network are not covered.",
  domain_blocking_dns:
    "Block a website by name for anyone using this gateway as their DNS server. A device with its own DNS settings, or private DNS switched on after sign-in, is not covered.",
  domain_blocking_sni:
    "Block a website by name on secure (https) connections too, without opening or reading anyone's traffic. It is switched on with every website you block, but we have not yet proven it on a real router, so it is listed here until we have. It cannot see a site whose browser hides the name, or newer kinds of connection (QUIC), or a VPN.",
  ip_and_cidr_blocking:
    "Block specific addresses or ranges, in both directions. Do not use this to block a website: popular services sit behind addresses that rotate constantly.",
  device_isolation:
    "Cut a single device off your router by its hardware address, now and every time it reconnects. Works reliably for devices you know; anonymous guests can switch on a private Wi-Fi address and come back as a new device. Keeping guests apart from each other is a separate switch.",
  guest_client_isolation:
    "Stop guests reaching each other's phones and laptops. Your router keeps apart guests on different access points; guests on the same access point are only kept apart if you also turn on “AP isolation” in that access point's settings.",
  rogue_dhcp_detection:
    "Tells you when a second device on the network starts handing out addresses, which is usually how an unauthorised access point gets introduced.",
  connection_flood_protection:
    "Limits how many connections one guest device can hold, which slows floods and password-guessing tools. It reduces the exposure rather than removing it, and a strict limit can break busy apps such as cloud backup or video calls.",
  // Written to be true whichever group the backend puts it in: the group
  // heading says whether it works today.
  web_category_filtering:
    "Block whole kinds of website, such as adult or gambling sites. Cloudflare keeps the list of which site belongs to which kind, and a site can be put in the wrong one. A phone set to use its own private DNS, or a VPN, can get round it unless you turn on the protection against that.",
  dns_bypass_protection:
    "Stops guests getting round your website blocks by changing their phone's DNS settings. It stops the easy ways round, not a determined user with a hidden VPN or a phone on mobile data.",
  application_control:
    "Switch off apps such as YouTube, Instagram or BGMI on your guest WiFi. It blocks the website names each app uses, not the app itself, so some apps may still get through -- one that is already open, one with a built-in address, or a phone with its own DNS or a VPN.",
  threat_intelligence:
    "Stop guests opening websites known to spread viruses or steal passwords. Cloudflare keeps the list up to date. It works on routers where web filtering is on, and a phone with its own DNS or a VPN is not covered.",
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
 * Each is checked against what the screen actually writes rather than
 * against the capability's name:
 *
 *  - `domain_blocking_dns`: Block Websites -> "Specific websites", which
 *    pushes a DNS block -- the whole of what `content_filtering` does for a
 *    website name.
 *  - `web_category_filtering`: Block Websites -> "Categories", which sets
 *    the venue's Cloudflare categories and switches its routers onto them
 *    (cloud-guest#307/#308).
 *  - `ip_and_cidr_blocking`: Block Websites -> "Advanced", the only place an
 *    internet address is blocked; `#advanced` unfolds it.
 *  - `device_isolation`: the Guests & devices tab, whose Device mode writes a
 *    blocked binding to the router (and whose number/email modes refuse the
 *    next sign-in and end the session they are in);
 *  - `connection_flood_protection`: Security -> Firewall's "Limit connection
 *    floods" switch, per router;
 *  - `guest_client_isolation`: Security -> Firewall's "Guests can't see each
 *    other" switch, per router;
 *  - `zone_to_zone_firewall`: Security -> Firewall, whose rules are
 *    between-network (`forward`) rules applied by cloud-guest#304's push.
 *
 * Every link is data-driven: a row is only rendered for a capability the
 * backend returned, and only linked from the "available" group. A backend
 * that still lists the firewall or categories as needing more technology
 * (before cloud-guest's capability update) shows them unlinked under
 * "Coming later", so this page works against the old backend and the new.
 *
 *  - `application_control`: Block Websites -> "Apps" (`#apps`), the
 *    per-app switches (cloud-guest content_filtering app catalogue).
 *  - `threat_intelligence`: the "Block known harmful websites" switch at the
 *    top of "Categories" -- Cloudflare's Security threats category.
 *
 * Deliberately absent: `domain_blocking_sni` (written with every website
 * block but not yet proven against a real browser, so the backend keeps it
 * under "Coming later") and `rogue_dhcp_detection` (no customer screen
 * manages it). */
type ManagedAt =
  | {
      to: "/blocking";
      tab: "websites" | "guests";
      hash?: string;
      labelKey: string;
      label: string;
    }
  | { to: "/firewall"; labelKey: string; label: string };

const MANAGED_AT: Record<string, ManagedAt> = {
  domain_blocking_dns: {
    to: "/blocking",
    tab: "websites",
    labelKey: "securityScore.link.website",
    label: "Block a website",
  },
  web_category_filtering: {
    to: "/blocking",
    tab: "websites",
    hash: "categories",
    labelKey: "securityScore.link.categories",
    label: "Choose kinds of website to block",
  },
  application_control: {
    to: "/blocking",
    tab: "websites",
    hash: "apps",
    labelKey: "securityScore.link.apps",
    label: "Choose apps to block",
  },
  threat_intelligence: {
    to: "/blocking",
    tab: "websites",
    hash: "categories",
    labelKey: "securityScore.link.harmful",
    label: "Block known harmful websites",
  },
  ip_and_cidr_blocking: {
    to: "/blocking",
    tab: "websites",
    hash: "advanced",
    labelKey: "securityScore.link.address",
    label: "Block an internet address",
  },
  device_isolation: {
    to: "/blocking",
    tab: "guests",
    labelKey: "securityScore.link.guest",
    label: "Block a guest",
  },
  zone_to_zone_firewall: {
    to: "/firewall",
    labelKey: "securityScore.link.firewall",
    label: "Set firewall rules",
  },
  connection_flood_protection: {
    to: "/firewall",
    labelKey: "securityScore.link.floodLimit",
    label: "Limit connection floods",
  },
  guest_client_isolation: {
    to: "/firewall",
    labelKey: "securityScore.link.guestIsolation",
    label: "Keep guests apart",
  },
};

/** The customer's name for each capability. The backend's `label` is the
 * engineering name ("IP and CIDR blocking", "Zone-to-zone firewall") and is
 * only the fallback, for a capability added after this list. */
const PLAIN_LABEL: Record<string, [key: string, fallback: string]> = {
  zone_to_zone_firewall: [
    "securityScore.label.zone_to_zone_firewall",
    "Keep your networks apart (Firewall)",
  ],
  domain_blocking_dns: ["securityScore.label.domain_blocking_dns", "Block a website by name"],
  domain_blocking_sni: [
    "securityScore.label.domain_blocking_sni",
    "Block a website on secure (HTTPS) connections",
  ],
  ip_and_cidr_blocking: ["securityScore.label.ip_and_cidr_blocking", "Block an internet address"],
  device_isolation: ["securityScore.label.device_isolation", "Block a guest or device"],
  rogue_dhcp_detection: [
    "securityScore.label.rogue_dhcp_detection",
    "Warn me about an unknown router on my network",
  ],
  connection_flood_protection: [
    "securityScore.label.connection_flood_protection",
    "Limit connection floods and password guessing",
  ],
  guest_client_isolation: [
    "securityScore.label.guest_client_isolation",
    "Guests can't see each other",
  ],
  web_category_filtering: [
    "securityScore.label.web_category_filtering",
    "Block kinds of website (categories)",
  ],
  dns_bypass_protection: [
    "securityScore.label.dns_bypass_protection",
    "Stop guests getting round website blocks",
  ],
  application_control: ["securityScore.label.application_control", "Block particular apps"],
  threat_intelligence: [
    "securityScore.label.threat_intelligence",
    "Block known harmful websites automatically",
  ],
  geo_blocking: ["securityScore.label.geo_blocking", "Block by country"],
};

/** One capability's link. Split by destination so each `<Link>` is typed
 * against its own route's search params. */
function ManagedAtLink({ at }: { at: ManagedAt }) {
  const { t } = useTranslation("nav", { i18n });
  const cls =
    "mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline";
  const body = (
    <>
      {t(at.labelKey, at.label)}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </>
  );
  return at.to === "/blocking" ? (
    <Link to="/blocking" search={{ tab: at.tab }} hash={at.hash} className={cls}>
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

/** The two groups a customer sees. "not_supported" (intrusion detection,
 * per-app traffic, URL-path filtering) is deliberately not rendered: a venue
 * owner cannot act on it, and a list of things the product will never do
 * reads as a list of things it is failing at. The backend still serves it,
 * for the Master console and the API. "Coming later" is folded for the same
 * reason -- honest to keep, and not what the owner came to the page for. */
const AVAILABILITY_GROUPS: {
  availability: SecurityAvailability;
  titleKey: string;
  title: string;
  noteKey: string;
  note: string;
  folded: boolean;
}[] = [
  {
    availability: "available",
    titleKey: "securityScore.workingTitle",
    title: "Working now",
    noteKey: "securityScore.workingNote",
    note: "Each of these works on your routers today. Follow the link to set it up.",
    folded: false,
  },
  {
    availability: "requires_additional_technology",
    titleKey: "securityScore.laterTitle",
    title: "Coming later",
    noteKey: "securityScore.laterNote",
    note: "Not something you can switch on yet.",
    folded: true,
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
  const { t } = useTranslation("nav", { i18n });
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
          only what works is offered as something to do, each with a link to
          the screen that does it. */}
      {capabilities.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t("securityScore.capabilitiesTitle", "What you can protect")}
          </h2>
          {AVAILABILITY_GROUPS.map((group) => {
            const items = capabilities.filter((f) => f.availability === group.availability);
            if (items.length === 0) return null;
            const list = (
              <ul className="grid gap-3 md:grid-cols-2">
                {items.map((feature) => {
                  const plain = PLAIN_LABEL[feature.key];
                  return (
                    <li
                      key={feature.key}
                      className="rounded-lg border border-border/60 bg-card px-4 py-3"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {plain ? t(plain[0], plain[1]) : feature.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {PLAIN_COPY[feature.key]
                          ? t(`securityScore.copy.${feature.key}`, PLAIN_COPY[feature.key])
                          : feature.detail}
                      </p>
                      {/* Only a "Working now" row gets a link -- a row that
                          is not working has no control to go to, even if its
                          key were ever listed above. */}
                      {group.availability === "available" && MANAGED_AT[feature.key] && (
                        <ManagedAtLink at={MANAGED_AT[feature.key]} />
                      )}
                    </li>
                  );
                })}
              </ul>
            );
            const heading = (
              <>
                <span className="text-sm font-medium text-foreground">
                  {t(group.titleKey, group.title)}
                </span>{" "}
                <span className="text-xs text-muted-foreground">
                  {t(group.noteKey, group.note)}
                </span>
              </>
            );
            return group.folded ? (
              <details key={group.availability} className="space-y-2">
                <summary className="cursor-pointer">{heading}</summary>
                <div className="pt-2">{list}</div>
              </details>
            ) : (
              <div key={group.availability} className="space-y-2">
                <h3>{heading}</h3>
                {list}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default SecurityOverviewView;
