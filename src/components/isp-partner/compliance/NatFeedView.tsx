/** NAT log feed per router (J4 details page). */
import { Link } from "@tanstack/react-router";
import { MEmptyState, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { Card, ErrorBlock } from "@/components/isp-partner/kit";
import { useNatFeed } from "@/hooks/isp-partner/useCompliance";
import { formatAgo, formatDateTime, formatIst } from "@/lib/isp-partner/format";
import type { NatFeedState } from "@/services/isp-partner/compliance";

export const FEED_LABEL: Record<NatFeedState, string> = {
  ok: "Receiving",
  stale: "Stopped",
  never_received: "Never received",
  not_configured: "Not set up",
  router_offline: "Router offline",
  not_applicable: "Not applicable",
};
const FEED_TONE: Record<NatFeedState, string> = {
  ok: "active",
  stale: "failed",
  never_received: "failed",
  not_configured: "pending",
  router_offline: "offline",
  not_applicable: "pending",
};
const FEED_HELP: Record<NatFeedState, string> = {
  ok: "",
  stale:
    "Translations stopped arriving. Check the router is online and that flow export is still applied.",
  never_received:
    "Flow export is set up but no NAT translation has ever arrived. Run the setup script again.",
  not_configured: "Flow export has not been applied on this router yet.",
  router_offline: "The router is offline; its NAT feed resumes when it reconnects.",
  not_applicable:
    "This venue is run through its vendor controller (Omada or Aruba Instant On). NAT logs for it are kept on that equipment, not sent here.",
};

export function NatFeedView() {
  const q = useNatFeed();
  if (q.error)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the NAT log feed" />;
  const d = q.data;
  return (
    <Card title="NAT log feed">
      <p className="mb-3 text-xs text-muted-foreground">
        Each router reports its NAT translations so that a public IP and port can be traced to a
        subscriber. A router counts as stopped when nothing arrived for{" "}
        {d?.stale_after_minutes ?? 60} minutes (change this under Settings).
      </p>
      {d && d.routers.length === 0 ? (
        <MEmptyState title="No routers yet" description="Routers you add appear here." />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <MTr>
              <MTh>Router</MTh>
              <MTh>Customer</MTh>
              <MTh>Status</MTh>
              <MTh>Last NAT record</MTh>
              <MTh>Last flow record</MTh>
              <MTh>Export check</MTh>
            </MTr>
          }
        >
          {(d?.routers ?? []).map((r) => (
            <MTr key={r.isp_router_id}>
              <MTd>
                <Link
                  to="/partner/routers/$ispRouterId"
                  params={{ ispRouterId: r.isp_router_id }}
                  className="font-medium text-primary hover:underline"
                >
                  {r.router_name}
                </Link>
                <div className="text-xs text-muted-foreground">{r.location_name}</div>
              </MTd>
              <MTd>{r.customer_name}</MTd>
              <MTd>
                <MTag label={FEED_LABEL[r.state]} tone={FEED_TONE[r.state]} />
                {FEED_HELP[r.state] && (
                  <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                    {FEED_HELP[r.state]}
                  </div>
                )}
              </MTd>
              <MTd>
                <span title={formatDateTime(r.last_nat_record_at)}>
                  {r.last_nat_record_at ? (
                    <span title={formatIst(r.last_nat_record_at)}>
                      {formatAgo(r.last_nat_record_at)}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </MTd>
              <MTd>
                <span title={formatDateTime(r.last_flow_record_at)}>
                  {r.last_flow_record_at ? (
                    <span title={formatIst(r.last_flow_record_at)}>
                      {formatAgo(r.last_flow_record_at)}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </MTd>
              <MTd>
                {r.export_last_verified_at ? (
                  <span title={r.export_last_verdict_detail ?? ""}>
                    {r.export_last_verdict_ok ? "OK" : "Failed"} ·{" "}
                    <span title={formatIst(r.export_last_verified_at)}>
                      {formatAgo(r.export_last_verified_at)}
                    </span>
                  </span>
                ) : (
                  "—"
                )}
                {!r.ipdr_ports && r.export_configured && (
                  <div className="text-xs text-muted-foreground">
                    Ports not exported: lookups match on IP only.
                  </div>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {d && <p className="mt-2 text-[11px] text-muted-foreground">{d.source}</p>}
    </Card>
  );
}
