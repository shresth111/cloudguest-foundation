/**
 * `/partner/routers/$ispRouterId` (PRD §4.5): router facts, the MikroTik
 * setup script and the TR-069 step.
 *
 * The setup script is the existing `RouterSetupDrilldown`, mounted unchanged.
 * Its server calls are rewritten to the ISP twins by `lib/isp-partner/api-shim`
 * (installed by the partner layout). Its `router` prop comes from
 * `/isp/routers/{id}/as-router-device`, the same shape as Master's.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Info, Pencil } from "lucide-react";
import { MButton, MSectionHeader, MTag } from "@/components/master/MasterKit";
import { RouterSetupDrilldown } from "@/components/routers/RouterSetupScriptAdvanced";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { RouterFormDrawer } from "@/components/isp-partner/routers/RouterFormDrawer";
import { Tr069ScriptPanel } from "@/components/isp-partner/tr069/Tr069ScriptPanel";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspRouter, useIspRouterAsDevice } from "@/hooks/isp-partner/useIsp";
import {
  CLOUD_LINK_LABEL,
  ROUTER_STATUS_LABEL,
  formatAgo,
  formatDateTime,
  routerStatusTone,
} from "@/lib/isp-partner/format";

function SetupScript({ routerId }: { routerId: string }) {
  const device = useIspRouterAsDevice(routerId);
  if (device.isLoading) return <LoadingBlock label="Loading the router for setup…" />;
  if (device.error || !device.data)
    return (
      <ErrorBlock error={device.error} onRetry={() => device.refetch()} what="the setup script" />
    );
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div className="space-y-1">
          <p className="font-semibold">Before you click Generate</p>
          <p className="text-muted-foreground">
            Keep both the tunnel box (this is the router&apos;s cloud link) and the RADIUS box
            ticked. Without the cloud link the router cannot be managed or monitored, and without
            RADIUS no guest can sign in. Unticking either asks you to type a confirmation and is
            written into the script.
          </p>
          <p className="text-muted-foreground">
            Each Generate issues new credentials, so a script you copied earlier stops working.
            Paste the newest one, in one sitting.
          </p>
        </div>
      </div>
      <RouterSetupDrilldown
        router={device.data}
        demo={false}
        vendorSaving={false}
        onVendorChange={(v) => {
          if (v !== "mikrotik")
            toast.error("Only MikroTik routers are supported in the partner console for now.");
        }}
      />
    </div>
  );
}

export function RouterDetailPage({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const q = useIspRouter(routerId);
  const [editing, setEditing] = useState(false);

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this router" />;
  const r = q.data;

  return (
    <>
      <MSectionHeader
        eyebrow="Router"
        title={r.name}
        description={`${r.model} · serial ${r.serial_number} · ${r.mac_address}`}
        actions={
          can("isp_partner.update") && (
            <MButton variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </MButton>
          )
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="Status">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <MTag
                label={ROUTER_STATUS_LABEL[r.status] ?? r.status}
                tone={routerStatusTone(r.status)}
              />
            </dd>
            <dt className="text-muted-foreground">Cloud link</dt>
            <dd>
              <MTag
                label={CLOUD_LINK_LABEL[r.cloud_link] ?? r.cloud_link}
                tone={
                  r.cloud_link === "up" ? "online" : r.cloud_link === "down" ? "offline" : "normal"
                }
              />
            </dd>
            <dt className="text-muted-foreground">Last seen</dt>
            <dd title={formatDateTime(r.last_seen_at)}>{formatAgo(r.last_seen_at)}</dd>
            <dt className="text-muted-foreground">RouterOS</dt>
            <dd>{r.routeros_version ?? "–"}</dd>
          </dl>
        </Card>
        <Card title="Where">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Customer</dt>
            <dd>
              <Link
                to="/partner/customers/$ispCustomerId"
                params={{ ispCustomerId: r.isp_customer_id }}
                className="text-primary hover:underline"
              >
                {r.customer_name}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd>
              <Link
                to="/partner/locations/$ispLocationId"
                params={{ ispLocationId: r.isp_location_id }}
                className="text-primary hover:underline"
              >
                {r.location_name}
              </Link>
            </dd>
            <dt className="text-muted-foreground">TR-069</dt>
            <dd>
              {r.tr069.enabled ? "On" : "Off"}
              {r.tr069.cpe_id && (
                <>
                  {" · "}
                  <Link
                    to="/partner/tr069/$cpeId"
                    params={{ cpeId: r.tr069.cpe_id }}
                    className="text-primary hover:underline"
                  >
                    device
                  </Link>
                </>
              )}
            </dd>
          </dl>
        </Card>
      </div>

      {can("isp_partner.execute") ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">MikroTik setup script</h2>
          <SetupScript routerId={routerId} />
        </section>
      ) : (
        <Card title="MikroTik setup script">
          <p className="text-sm text-muted-foreground">
            Your role cannot generate setup scripts. A Technician, Admin or Owner can.
          </p>
        </Card>
      )}

      {can("tr069.manage") && (
        <Tr069ScriptPanel routerId={routerId} locationName={r.location_name} />
      )}

      <RouterFormDrawer
        open={editing}
        onClose={() => setEditing(false)}
        locationId={r.isp_location_id}
        router={r}
      />
    </>
  );
}
