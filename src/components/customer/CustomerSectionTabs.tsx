import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { customerFeatureHref, getCustomerLoginRole } from "@/lib/customerNav";
import { destinationForFeature, sectionsFor } from "@/lib/customerDestinations";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";

/**
 * The heading every feature page now sits under: which destination you are
 * in, which venue it is scoped to, and the sibling sections of that
 * destination as tabs.
 *
 * WHY THE TABS
 * ------------
 * Folding 26 sidebar entries into 9 destinations only works if the other 17
 * are visible once you are inside the right one. A destination is not a
 * category page: it opens directly onto its first section, with the rest as
 * tabs, so "Guests" is one click from the guest list and two from the
 * session log -- where the old nav was one click from either and 26 rows
 * deep to find them.
 *
 * Each tab is a real `<Link>` to that feature's own existing route. No new
 * URLs, no redirects: the 26 routes stay canonical, so every bookmark,
 * support link and deep link keeps resolving exactly where it did.
 *
 * WHY THE SCOPE LINE
 * ------------------
 * A location-scoped staff member's lists are filtered server-side to their
 * own site, and the API does not mark what it withheld -- correctly, since
 * that is a permission boundary, not a filter the client should be able to
 * lift. But it means a front-desk user looking at eleven firewall rules has
 * no way to know whether that is eleven rules or eleven of forty. The
 * dashboard has always carried the active venue in the shell chrome, which
 * is exactly where you stop reading it after the first day.
 *
 * So the venue is named on the screen itself, beside the thing it scopes:
 * "Access Rules · Mumbai HQ". This is presentational -- it adds no plumbing
 * and no request -- and it is the reason the scope line renders even when a
 * venue has only one site, where it reads as reassurance rather than as a
 * warning.
 */
export function CustomerSectionTabs({
  featureId,
  locationName,
}: {
  featureId: string;
  locationName?: string;
}) {
  const role = getCustomerLoginRole();
  const { data: permissions } = useMyPermissions();
  const destination = destinationForFeature(featureId);
  if (!destination) return null;

  const sections = sectionsFor(destination, role, permissions);
  // Nothing to switch between, and the destination name would just repeat
  // the page's own title -- but the scope still matters, so that stays.
  const showTabs = sections.length > 1;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">{destination.label}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{destination.blurb}</span>
          {locationName && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <MapPin aria-hidden className="h-3 w-3" />
                {locationName}
              </span>
            </>
          )}
        </p>
      </div>

      {showTabs && (
        // A tablist of links, not buttons: each section is a real page with
        // its own URL, so cmd-click and back both work.
        <nav
          aria-label={`${destination.label} sections`}
          className="-mb-3 flex max-w-full items-center gap-1 overflow-x-auto pb-1"
        >
          {sections.map((section) => {
            const active = section.id === featureId;
            return (
              <Link
                key={section.id}
                to={customerFeatureHref(section.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
