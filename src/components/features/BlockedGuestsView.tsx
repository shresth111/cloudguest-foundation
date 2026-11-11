import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { PageHeader, type PageScope } from "@/components/customer/console";
import BlockUsers from "@/components/features/BlockUsers";

/**
 * Guests -> Guests & devices: the guests, numbers, emails and devices this
 * venue has blocked from its guest WiFi.
 *
 * A page header around `BlockUsers` and nothing else. The screen itself is
 * the one that was the "Guests & devices" tab of Security -> Blocking (and,
 * before that, the "Blocked Guests" tab of Access Rules); it moved here on
 * the owner's call (2026-11-12) because blocking a guest is about the people
 * on the WiFi, and that is the Guests section. Moved, not copied: Blocking
 * no longer mounts it (see `lib/blocking.ts`), and `/blocking?tab=guests`
 * redirects to this page's `/blocked-guests`.
 *
 * Not controller-gated. Blocking a guest is enforced at sign-in on our side
 * and, at a controller venue, reaches the controller through its own
 * client-block call; `BlockUsers` already reports what the controller (or
 * Aruba Instant On) did with each block.
 */
export function BlockedGuestsView({
  locationId,
  scope,
}: {
  locationId?: string;
  /** Title + venue from the shell (OWN_PAGE_HEADER_FEATURES). */
  scope?: PageScope;
}) {
  const { t } = useTranslation("nav", { i18n });
  return (
    <div className="wy-console space-y-5">
      <PageHeader
        title={scope?.title ?? t("customerItem.blocked-guests", "Guests & devices")}
        venue={scope?.venue}
        description={
          <>
            {t(
              "blockedGuestsPage.intro",
              "Stop a guest or device from using your guest WiFi, and let them back on.",
            )}{" "}
            {t("blockingPage.onlyAllowedPrefix", "To let in only people you have listed, use")}{" "}
            <Link
              to="/whitelist"
              className="rounded-sm font-medium text-[var(--wy-accent)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wy-accent)]"
            >
              {t("customerItem.whitelist", "Only Allowed")}
            </Link>
            .
          </>
        }
      />
      <BlockUsers locationId={locationId} />
    </div>
  );
}

export default BlockedGuestsView;
