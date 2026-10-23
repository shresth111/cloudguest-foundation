/**
 * IP Addresses for one router (PRD §4.6; API_CONTRACT §10).
 *
 * The partner console's own screen over `GET /isp/venue/dhcp-pools`, for the
 * same reason `NetworkZonesPanel` is its own: the customer app's
 * `DhcpManagement` fetches its router list through `routerService` (`/routers`)
 * and would 403 that call on the partner host.
 *
 * `routerId` comes from the parent, not from a picker here — the Network tab
 * owns one picker for Zones, IP addresses and the rest, so switching between
 * them does not silently change which router is being configured.
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
import { usePushVenueDhcpPool, useVenueDhcpPools } from "@/hooks/isp-partner/useVenue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

const PAGE_SIZE = 25;

export function DhcpPoolsPanel({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const q = useVenueDhcpPools(routerId, page, PAGE_SIZE);
  const pushM = usePushVenueDhcpPool(routerId);
  const canPush = can("isp_network.execute");

  return (
    <Card title="IP Addresses">
      <FormError message={error} />
      {q.isLoading && <LoadingBlock />}
      {q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this router's IP pools" />
      ) : null}
      {q.data && q.data.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No IP address pools on this router yet.</p>
      )}
      {q.data && q.data.rows.length > 0 && (
        // Scrolls in its own region: an ISP has many venues and many pools
        // (founder, 2026-10-22: "saari cheejo ka scroll down").
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Range</th>
                <th className="py-2 pr-3 font-medium">Gateway</th>
                <th className="py-2 pr-3 font-medium">Lease</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{p.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {p.addressRangeStart} – {p.addressRangeEnd}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{p.gatewayIpAddress || "–"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {Math.round(p.leaseTimeSeconds / 3600)}h
                  </td>
                  <td className="py-2 pr-3">
                    <MTag label={p.isEnabled ? "enabled" : "disabled"} />
                    <MTag label={p.devicePushStatus} />
                  </td>
                  <td className="py-2 text-right">
                    {canPush && (
                      <MButton
                        variant="outline"
                        disabled={pushM.isPending}
                        onClick={async () => {
                          setError(null);
                          try {
                            await pushM.mutateAsync(p.id);
                            toast.success(`${p.name} pushed to the router.`);
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
