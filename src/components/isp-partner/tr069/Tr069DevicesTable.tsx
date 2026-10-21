/** TR-069 inventory table (API_CONTRACT §5 `GET /isp/tr069/devices`). */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Cpu } from "lucide-react";
import { MEmptyState, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import { ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { useTr069Devices } from "@/hooks/isp-partner/useTr069";
import { formatAgo, formatDateTime } from "@/lib/isp-partner/format";
import type { Tr069DeviceQuery } from "@/services/isp-partner/types";

export function Tr069DevicesTable({
  query,
  hideCustomer,
}: {
  query: Omit<Tr069DeviceQuery, "page" | "page_size">;
  hideCustomer?: boolean;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const q = useTr069Devices({ ...query, page, page_size: 25 });
  const data = q.data;

  if (q.error && !data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="TR-069 devices" />;
  if (data && data.items.length === 0) {
    return (
      <MEmptyState
        icon={Cpu}
        title="No devices"
        description="A device appears here after its first check-in with your ACS credential (Settings) or a customer's credential."
      />
    );
  }
  return (
    <div className="space-y-2">
      <MTable
        loading={q.isLoading}
        head={
          <>
            <MTh>Device</MTh>
            {!hideCustomer && <MTh>Customer</MTh>}
            <MTh>Model</MTh>
            <MTh>Software</MTh>
            <MTh>WAN IP</MTh>
            <MTh>Online</MTh>
            <MTh>Last check-in</MTh>
          </>
        }
      >
        {data?.items.map((d) => (
          <MTr
            key={d.id}
            onClick={() => navigate({ to: "/partner/tr069/$cpeId", params: { cpeId: d.id } })}
          >
            <MTd>
              <Link
                to="/partner/tr069/$cpeId"
                params={{ cpeId: d.id }}
                className="font-medium text-foreground hover:text-primary"
              >
                {d.label || d.serial_number || d.genieacs_device_id}
              </Link>
              <p className="font-mono text-[11px] text-muted-foreground">{d.genieacs_device_id}</p>
            </MTd>
            {!hideCustomer && (
              <MTd className="text-xs">
                {d.customer_name ?? <MTag label="Unassigned" tone="pending" />}
                {d.location_name && <p className="text-muted-foreground">{d.location_name}</p>}
              </MTd>
            )}
            <MTd className="text-xs">
              {[d.manufacturer, d.model].filter(Boolean).join(" ") || "–"}
            </MTd>
            <MTd className="text-xs">{d.software_version ?? "–"}</MTd>
            <MTd className="font-mono text-xs">{d.wan_ip ?? "–"}</MTd>
            <MTd>
              <MTag
                label={d.online ? "Online" : "Offline"}
                tone={d.online ? "online" : "offline"}
              />
              {!d.management_enabled && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Management off</p>
              )}
            </MTd>
            <MTd className="text-xs text-muted-foreground">
              <span title={formatDateTime(d.last_inform_at)}>{formatAgo(d.last_inform_at)}</span>
            </MTd>
          </MTr>
        ))}
      </MTable>
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
    </div>
  );
}
