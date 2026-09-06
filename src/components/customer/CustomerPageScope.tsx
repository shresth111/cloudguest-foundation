import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { CUSTOMER_NAVS } from "@/lib/customerNav";

/**
 * The scope line every customer feature page sits under: what this screen
 * is, and which venue it is showing you.
 *
 * WHY IT EXISTS
 * -------------
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
 * and no request -- and it is the reason it renders even when a venue has
 * only one site, where it reads as reassurance rather than as a warning.
 *
 * WHAT USED TO BE HERE
 * --------------------
 * This file was `CustomerSectionTabs`: the same scope line plus a tab strip
 * for the sibling features folded into the same sidebar "destination". Those
 * tabs existed only because the sidebar had been collapsed from 26 rows to
 * nine and the other seventeen needed somewhere to live. The sidebar offers
 * all 26 again, so a tab strip duplicating the row you just clicked is
 * navigation with no destination of its own. The scope line is the half that
 * was never about the grouping, so it is the half that stayed.
 *
 * The name comes from `customerNav.ts` via the sidebar's own
 * `nav:customerItem.*` keys and its `t(key, hardcodedLabel)` fallback shape,
 * so the heading and the sidebar row that led here cannot disagree.
 */
export function CustomerPageScope({
  featureId,
  locationName,
}: {
  featureId: string;
  locationName?: string;
}) {
  const { t } = useTranslation("nav", { i18n });
  const item = CUSTOMER_NAVS.find((n) => n.id === featureId);
  if (!item) return null;
  const label = t(`customerItem.${item.id}`, item.label);

  return (
    <div className="mb-5 border-b border-border/70 pb-3">
      <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold tracking-tight">
        <span className="truncate">{label}</span>
        {locationName && (
          <>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <MapPin aria-hidden className="h-3.5 w-3.5" />
              {locationName}
            </span>
          </>
        )}
      </h1>
    </div>
  );
}
