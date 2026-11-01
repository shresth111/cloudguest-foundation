/** Persistent banner: one or more routers are not sending NAT logs (J4).
 * Shown on every partner page for roles that can read the ISP; links to the
 * details tab. Silent while loading, on error, and when nothing alerts. */
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useNatFeed } from "@/hooks/isp-partner/useCompliance";

export function NatFeedBanner() {
  const { can } = usePartner();
  const allowed = can("isp_partner.read");
  const q = useNatFeed(allowed);
  if (!allowed || !q.data?.banner) return null;
  const n = q.data.alerting_count;
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <span>
        NAT logs are not being received from {n} router{n === 1 ? "" : "s"}. Without them a public
        IP and port cannot be traced to a subscriber.
      </span>
      <Link
        to="/partner/compliance"
        search={{ tab: "nat" }}
        className="font-medium text-primary hover:underline"
      >
        View details
      </Link>
    </div>
  );
}
