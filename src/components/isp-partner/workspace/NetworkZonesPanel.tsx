/**
 * Network Zones for one router (PRD §4.6; API_CONTRACT §10).
 *
 * The partner console's own screen over `GET /isp/venue/vlans` -- not the
 * customer app's `VlanManagement`, which fetches its router list through
 * `routerService` (`/routers`) and would 403 that call on the partner host.
 * Building it here keeps the picker, the scope and the permissions under the
 * partner console's control.
 *
 * The router is a required input, not a default: see `RouterSelect`.
 */
import { useState } from "react";
import { toast } from "sonner";

import { MButton, MTag } from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Pager,
  Spinner,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { RouterSelect } from "@/components/isp-partner/workspace/RouterSelect";
import { usePushVenueVlan, useVenueVlans } from "@/hooks/isp-partner/useVenue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

const PAGE_SIZE = 25;

export function NetworkZonesPanel({ locationId }: { locationId: string }) {
  const { can } = usePartner();
  const [routerId, setRouterId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const q = useVenueVlans(routerId, page, PAGE_SIZE);
  const pushM = usePushVenueVlan(routerId);
  const canPush = can("isp_network.execute");

  if (!routerId) {
    return (
      <Card
        title="Network Zones"
        actions={<RouterSelect locationId={locationId} value={null} onChange={setRouterId} />}
      >
        <p className="text-sm text-muted-foreground">
          Pick this venue's router. VLANs and IP addresses live on a router, so each MikroTik at
          this location has its own set.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Network Zones"
      actions={
        <RouterSelect
          locationId={locationId}
          value={routerId}
          onChange={(id) => {
            setRouterId(id);
            setPage(1);
          }}
        />
      }
    >
      <FormError message={error} />
      {q.isLoading && <LoadingBlock />}
      {q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this router's VLANs" />
      ) : null}
      {q.data && q.data.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No VLANs on this router yet. The venue runs on its default network.
        </p>
      )}
      {q.data && q.data.rows.length > 0 && (
        // Scrolls in its own region rather than growing the page: an ISP with
        // many venues and many VLANs per router must not push the whole page
        // (founder, 2026-10-22: "saari cheejo ka scroll down").
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">VLAN</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Gateway / CIDR</th>
                <th className="py-2 pr-3 font-medium">Port</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((v) => (
                <tr key={v.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{v.vlanId}</td>
                  <td className="py-2 pr-3">{v.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {[v.gatewayIpAddress, v.cidr].filter(Boolean).join(" / ") || "–"}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{v.portMode}</td>
                  <td className="py-2 pr-3">
                    <MTag label={v.isEnabled ? "enabled" : "disabled"} />
                    <MTag label={v.devicePushStatus} />
                  </td>
                  <td className="py-2 text-right">
                    {canPush && (
                      <MButton
                        variant="outline"
                        disabled={pushM.isPending}
                        onClick={async () => {
                          setError(null);
                          try {
                            await pushM.mutateAsync(v.id);
                            toast.success(`${v.name} pushed to the router.`);
                          } catch (err) {
                            setError(ispErrorMessage(err));
                          }
                        }}
                      >
                        {pushM.isPending && <Spinner />} Push
                      </MButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && q.data.totalPages > 1 && (
        <Pager page={page} pages={q.data.totalPages} total={q.data.total} onPage={setPage} />
      )}
    </Card>
  );
}
