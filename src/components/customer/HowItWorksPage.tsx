import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronRight, HelpCircle } from "lucide-react";
import {
  customerFeatureHref,
  customerNavGroupsForRole,
  getCustomerLoginRole,
} from "@/lib/customerNav";
import { filterNavGroupsByPermissions } from "@/lib/customerNavPermissions";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";

/**
 * The customer-facing "How the dashboard works" reference page, reachable
 * from the sidebar's Support & Logs group and rendered as the
 * `how-it-works` case in `CustomerFeaturePage.tsx`.
 *
 * WHY THIS IS GENERATED AND NOT WRITTEN
 * ------------------------------------
 * This page used to carry its own hand-written `GROUPS` constant: five
 * groups and seventeen feature blurbs, with a docstring and an on-page
 * sub-line both claiming it "mirrors your sidebar section by section".
 * It did not, and could not keep doing so:
 *
 *   - `customerNav.ts` had 7 groups / 26 items; this file had 5 / 17.
 *   - It documented **Background Image**, a screen deleted from both
 *     `customerNav.ts` and `config/customerFeatureCatalog.ts` when the
 *     login backdrop moved into Portal -> Design. This file was the last
 *     place in the codebase still telling a customer that screen existed.
 *   - It omitted nine real screens -- Reports, Alerts, Website Blocking,
 *     Internet Connection, Notifications, Connection Tools, Support
 *     Tickets, Logs and Network Activity Log -- including every item in
 *     the two groups (Operations, Support & Logs) it never mentioned, one
 *     of which is the group this page is itself filed under.
 *
 * That is a drift class, not a one-off: a hand-maintained duplicate of a
 * nav config diverges from it on every change to either, and this one had
 * already diverged twice. "Remember to update How It Works" does not fix
 * it. Generating the list does.
 *
 * So the list below is rendered from the **exact expression
 * `CustomerSidebar.tsx` evaluates** to build the sidebar -- role filter
 * then real RBAC grants from `GET /me/permissions`:
 *
 *     filterNavGroupsByPermissions(customerNavGroupsForRole(role), permissions)
 *
 * Two things follow, both of which the old page got wrong. A screen
 * renamed, added or removed in `customerNav.ts` changes here with it. And
 * the page now describes *this reader's* dashboard: an agent (staff)
 * login sees 8 sidebar items, and the old page explained all 17 to them,
 * so 13 of its blurbs described screens that reader could not open.
 * Explaining a screen someone cannot reach generates the support contact
 * it was meant to prevent.
 *
 * Group headings, item labels and the per-item sentence all come from
 * i18next -- `nav:customerGroup.*` / `nav:customerItem.*` (the same keys
 * and the same `t(key, hardcodedLabel)` fallback shape the sidebar uses,
 * so the two can never disagree about what a screen is called) and
 * `help:*` for this page's own copy. The previous version had zero
 * translation calls and ~1,070 words of inline English in a product that
 * ships a Hindi slice, which made the single wordiest customer screen the
 * only one that could not be translated at all.
 *
 * Icons are not chosen here either: each group shows the icon
 * `customerNav.ts` already assigns to its first item, so this page's
 * visual language is literally the sidebar's rather than a second one
 * competing with it.
 */
export function HowItWorksView() {
  const { t } = useTranslation(["help", "nav"], { i18n });
  const navigate = useNavigate();

  // Same two-stage narrowing as the sidebar (CustomerSidebar.tsx) -- role
  // preference first, then the caller's real effective grants. Both only
  // ever remove items, and an absent/failed/empty permission set leaves
  // the role-based nav untouched; see customerNavPermissions.ts for why
  // every ambiguity resolves toward showing the customer more rather than
  // stranding them with less.
  const role = getCustomerLoginRole();
  const { data: permissions } = useMyPermissions();
  // This page omits itself from its own index -- a row reading "How It
  // Works: you are here" is noise. Dropping it can empty the Support &
  // Logs group for a reader who holds nothing else in it, so groups are
  // re-filtered after the removal rather than before.
  const navGroups = filterNavGroupsByPermissions(customerNavGroupsForRole(role), permissions)
    .map((g) => ({ ...g, items: g.items.filter((item) => item.id !== "how-it-works") }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {/* Same small icon-badge + title + description header every other
       * real feature page uses (see OperationsFeatures.tsx's
       * FeatureHeader), sized as a reference-page header rather than a
       * hero. The badge reuses the exact HelpCircle icon customerNav.ts
       * assigns to this sidebar item. */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
          <HelpCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {t("help:title", "How the dashboard works")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("help:subtitle", "A quick reference for the screens you have access to.")}
          </p>
        </div>
      </div>
      <p className="-mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t(
          "help:intro",
          "Everything you need to run your guest WiFi lives here — from checking who's online right now to deciding exactly who gets to connect. Every screen listed below is one you can open; tap any of them to go straight there.",
        )}
      </p>

      {/* One section per sidebar group, open by default so the whole page
       * is scannable and Cmd+F-searchable without extra clicks, but still
       * collapsible for anyone focusing on one section. */}
      <Accordion type="multiple" defaultValue={navGroups.map((g) => g.id)} className="space-y-4">
        {navGroups.map((group) => {
          // The icon customerNav.ts already gives this group's first item,
          // rather than a second set chosen here. A group is never empty:
          // filterNavGroupsByPermissions drops any group it empties.
          const GroupIcon = group.items[0].icon;
          return (
            <AccordionItem
              key={group.id}
              value={group.id}
              className="premium-card overflow-hidden rounded-2xl border px-4 sm:px-6"
            >
              <AccordionTrigger className="py-4 hover:no-underline sm:py-4">
                <div className="flex items-center gap-3.5 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
                    <GroupIcon className="h-[18px] w-[18px] text-white" />
                  </div>
                  <div>
                    <p className="text-base font-semibold tracking-tight text-foreground">
                      {t(`nav:customerGroup.${group.id}`, group.label)}
                    </p>
                    <p className="mt-0.5 text-sm font-normal text-muted-foreground">
                      {t(`help:group.${group.id}`, { defaultValue: "" })}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 pb-2 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const label = t(`nav:customerItem.${item.id}`, item.label);
                    // A missing description renders as a label-only row
                    // rather than a raw i18next key -- a screen added to
                    // customerNav.ts before its sentence is written still
                    // appears here, correctly named and correctly linked.
                    const description = t(`help:feature.${item.id}`, { defaultValue: "" });
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate({ to: customerFeatureHref(item.id) })}
                        className="premium-card premium-card-hover group flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors sm:p-5"
                      >
                        <ItemIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{label}</span>
                            <ChevronRight
                              aria-hidden
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          </span>
                          {description && (
                            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                              {description}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
