import { ShieldAlert } from "lucide-react";
import { locationIsNasOnly } from "@/lib/location-liveness";
import { useCustomerStore } from "@/stores/customerStore";
import { ARUBA_CONNECTION_RECORDS_NOTE } from "@/lib/aruba-reports";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Callout, PageHeader, type PageScope } from "@/components/customer/console";
import { EmptyState } from "@/components/common/EmptyState";
import { getCustomerLoginRole } from "@/lib/customerNav";
import { ReportPanel, NETWORK_ACTIVITY_REPORT_TYPES } from "@/components/features/UserReports";

/**
 * "Network Activity Log" -- a Logs-group nav item
 * (src/lib/customerNav.ts's "network-activity" entry), sitting next to the
 * existing "Logs" tab (AdminLogsView, dashboard/infra-access events) but a
 * genuinely different concern: real *guest* WiFi usage records --
 * session-level connection history and login/access attempts -- not
 * dashboard logins or router events. See docs/ipdr-logs-syslog-spec.md for
 * the full scoping writeup this page implements.
 *
 * Deliberately named "Network Activity Log," not "IPDR Logs" -- per that
 * spec's own naming discipline (§5, "Before this ships" #2), "IPDR" is a
 * flow-level term (destination IP/port per connection) this platform
 * cannot capture yet (no NetFlow/syslog/DPI ingestion exists anywhere in
 * this codebase, see spec §1/§3). What this page actually shows is
 * session-level: who connected, from what device/IP, for how long, and how
 * much data they used -- real and useful for troubleshooting and as a
 * partial compliance data point, but not "what site did this guest visit."
 * Never call this "IPDR" or "compliant" in product copy until legal signs
 * off on that claim (spec's own "Before this ships" #1).
 *
 * Reuses UserReports.tsx's `ReportPanel` almost entirely (same real-data
 * fetch, masking, sort/filter/paginate, and CSV-export-with-csvField
 * machinery every other real report in this app already uses) rather than
 * folding a sixth category into the Reports page's own CATEGORIES tab bar
 * -- this is a distinct nav item with a distinct, security-sensitive
 * audience framing (spec §4/§7: "different data, different framing, would
 * bury a compliance-relevant record inside" the general Reports tool), not
 * a seventh tab there.
 */
export default function NetworkActivityLog({
  masked = true,
  scope,
}: {
  masked?: boolean;
  /** Title + venue from the shell (OWN_PAGE_HEADER_FEATURES). */
  scope?: PageScope;
} = {}) {
  const { t } = useTranslation("nav", { i18n });
  // Owner-only, render-time check -- defense in depth alongside the
  // sidebar/route-nav guard (customerNav.ts's "network-activity" entry,
  // `roles: ["owner"]`) and the backend's own independent RBAC
  // (`RequireRole("organization-owner")` on both /guest-sessions and the
  // new /guest-login-history endpoint per the spec's §7 contract) --
  // exact same three-layer posture as AdminLogsView (OperationsFeatures.tsx)
  // for the exact same reason: this is equally security-sensitive guest
  // data, and a UI guard alone is bypassable by a direct URL hit.
  const role = getCustomerLoginRole();
  const owner = role === "owner";
  // The Aruba Instant On wording, for the active venue only.
  const nasOnly = locationIsNasOnly(useCustomerStore((st) => st.activeLocation)?.liveness);

  // One console header (the icon tile and the second, h2 title are gone).
  // Copy is the spec's own recommended wording (§5): describes what this
  // page actually does, no "compliance"/"IPDR" claim.
  const header = (
    <PageHeader
      title={scope?.title ?? t("customerItem.network-activity", "Guest Connection Records")}
      venue={scope?.venue}
      description="Every guest's connection history: who connected, from which device, for how long, and how much data they used. Useful for troubleshooting connectivity issues and as a record of guest network activity."
    />
  );

  if (!owner) {
    return (
      <div className="wy-console space-y-6">
        {header}
        <EmptyState
          icon={ShieldAlert}
          title="Owner access only"
          description="Guest Connection Records shows a security-sensitive record of guest connections and login attempts. Only the Organization Owner can view this page."
        />
      </div>
    );
  }

  return (
    <div className="wy-console space-y-6">
      {header}
      {/* Honest retention note, not an implied guarantee -- see
       * docs/ipdr-logs-syslog-spec.md §6: nothing purges this data today,
       * but nothing guarantees a specific retention floor either. Surfacing
       * that here rather than silently implying "2-year retention" (the
       * DOT figure the spec's §2 discusses) without the backup/durability
       * review that would actually back such a claim. One line, the rest
       * folded (design review: the amber disclaimer wall). */}
      <Callout tone="info" role="note">
        <details className="group">
          <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] [&::-webkit-details-marker]:hidden">
            {t(
              "networkActivity.noteSummary",
              "Connection and sign-in records only, not the websites guests visited.",
            )}{" "}
            <span className="font-medium text-[var(--wy-accent)] underline-offset-2 group-open:hidden hover:underline">
              {t("networkActivity.noteMore", "More")}
            </span>
          </summary>
          {nasOnly ? (
            <p
              className="mt-1.5 text-[var(--wy-text-muted)]"
              data-testid="aruba-connection-records-note"
            >
              {ARUBA_CONNECTION_RECORDS_NOTE}
            </p>
          ) : (
            <p className="mt-1.5 text-[var(--wy-text-muted)]">
              This shows session-level connection and login records, not destination-level traffic
              (what site a guest visited). Private IP is the guest&apos;s address on your WiFi;
              venue public IP is your router&apos;s routable WAN address (shared NAT egress), shown
              only when the router reports a real public address — not a LAN/CGNAT interface. The
              platform does not currently guarantee a specific data-retention period for these
              records.
            </p>
          )}
        </details>
      </Callout>
      <ReportPanel
        reportTypes={NETWORK_ACTIVITY_REPORT_TYPES}
        csvPrefix="network-activity"
        masked={masked}
      />
    </div>
  );
}
