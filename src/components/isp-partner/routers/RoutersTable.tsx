/** Routers across customers (or one customer / location). */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Router as RouterIcon } from "lucide-react";
import { MEmptyState, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { useIspRouters } from "@/hooks/isp-partner/useIsp";
import {
  CLOUD_LINK_LABEL,
  ROUTER_STATUS_LABEL,
  formatAgo,
  routerStatusTone,
} from "@/lib/isp-partner/format";

export function RoutersTable({
  customerId,
  locationId,
  status,
  emptyHint,
}: {
  customerId?: string;
  locationId?: string;
  status?: string;
  emptyHint?: string;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const q = useIspRouters({
    isp_customer_id: customerId,
    isp_location_id: locationId,
    status: status || undefined,
    page,
    page_size: 25,
  });
  const data = q.data;

  if (q.error && !data) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="routers" />;
  if (data && data.items.length === 0) {
    return (
      <MEmptyState
        icon={RouterIcon}
        title="No routers"
        description={emptyHint ?? "Routers are added from a location's page."}
      />
    );
  }
  return (
    <div className="space-y-2">
      <MTable
        loading={q.isLoading}
        head={
          <>
            <MTh>Router</MTh>
            {!customerId && <MTh>Customer</MTh>}
            {!locationId && <MTh>Location</MTh>}
            <MTh>Status</MTh>
            <MTh>Cloud link</MTh>
            <MTh>Last seen</MTh>
            <MTh>TR-069</MTh>
          </>
        }
      >
        {data?.items.map((r) => (
          <MTr
            key={r.id}
            onClick={() => navigate({ to: "/partner/routers/$ispRouterId", params: { ispRouterId: r.id } })}
          >
            <MTd>
              <Link
                to="/partner/routers/$ispRouterId"
                params={{ ispRouterId: r.id }}
                className="font-medium text-foreground hover:text-primary"
              >
                {r.name}
              </Link>
              <p className="font-mono text-[11px] text-muted-foreground">
                {r.model} · {r.serial_number}
              </p>
            </MTd>
            {!customerId && <MTd className="text-xs">{r.customer_name}</MTd>}
            {!locationId && <MTd className="text-xs">{r.location_name}</MTd>}
            <MTd>
              <MTag label={ROUTER_STATUS_LABEL[r.status] ?? r.status} tone={routerStatusTone(r.status)} />
            </MTd>
            <MTd>
              <MTag
                label={CLOUD_LINK_LABEL[r.cloud_link] ?? r.cloud_link}
                tone={r.cloud_link === "up" ? "online" : r.cloud_link === "down" ? "offline" : "normal"}
              />
            </MTd>
            <MTd className="text-xs text-muted-foreground">{formatAgo(r.last_seen_at)}</MTd>
            <MTd className="text-xs">{r.tr069.enabled ? "On" : "Off"}</MTd>
          </MTr>
        ))}
      </MTable>
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
    </div>
  );
}
