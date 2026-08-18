import { Radar, ShieldAlert, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { getCustomerLoginRole } from "@/lib/customerNav";
import { ReportPanel, NETWORK_ACTIVITY_REPORT_TYPES } from "@/components/features/UserReports";

/**
 * "Network Activity Log" -- Support & Logs' own nav item
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
export default function NetworkActivityLog({ masked = true }: { masked?: boolean } = {}) {
  // Owner-only, render-time check -- defense in depth alongside the
  // sidebar/route-nav guard (customerNav.ts's "network-activity" entry,
  // `roles: ["owner"]`) and the backend's own independent RBAC
  // (`RequireRole("organization-owner")` on both /guest-sessions and the
  // new /guest-login-history endpoint per the spec's §7 contract) --
  // exact same three-layer posture as AdminLogsView (OperationsFeatures.tsx)
  // for the exact same reason: this is equally security-sensitive guest
  // data, and a UI guard alone is bypassable by a direct URL hit.
  const role = getCustomerLoginRole();
  if (role !== "owner") {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card className="border-0 shadow-sm">
          <CardContent>
            <EmptyState
              icon={ShieldAlert}
              title="Owner access only"
              description="Network Activity Log shows a security-sensitive record of guest connections and login attempts. Only the Organization Owner can view this page."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <ReportPanel reportTypes={NETWORK_ACTIVITY_REPORT_TYPES} csvPrefix="network-activity" masked={masked} />
    </div>
  );
}

/** Same icon-badge + title + description shape as OperationsFeatures.tsx's
 * own (unexported) FeatureHeader -- inlined rather than importing across
 * that file's boundary for one small header. Copy is the spec's own
 * recommended wording (§5) verbatim: describes what this page actually
 * does, no "compliance"/"IPDR" claim. */
function PageHeader() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
            <Radar className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Network Activity Log</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every guest's connection history: who connected, from which device, for how long, and how much data
              they used. Useful for troubleshooting connectivity issues and as a record of guest network activity.
            </p>
          </div>
        </div>
      </div>
      {/* Honest retention note, not an implied guarantee -- see
       * docs/ipdr-logs-syslog-spec.md §6: nothing purges this data today,
       * but nothing guarantees a specific retention floor either. Surfacing
       * that here rather than silently implying "2-year retention" (the
       * DOT figure the spec's §2 discusses) without the backup/durability
       * review that would actually back such a claim. */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <p>
          This shows session-level connection and login records, not destination-level traffic (what site a guest
          visited). The platform does not currently guarantee a specific data-retention period for these records.
        </p>
      </div>
    </div>
  );
}
