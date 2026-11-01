/**
 * Port Forwarding for one router (PRD §4.6; API_CONTRACT §10).
 *
 * The partner console's own screen over `GET /isp/venue/port-forwarding/rules`,
 * for the same reason the other network panels are: the customer app's
 * `PortForwardingManagement` fetches its router list through `routerService`
 * (`/routers`) and would 403 that call on the partner host.
 *
 * `routerId` comes from the Network tab's one picker, so switching views never
 * silently changes which router is being configured.
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
import { usePushVenuePortForward, useVenuePortForwards } from "@/hooks/isp-partner/useVenue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

const PAGE_SIZE = 25;

export function PortForwardingPanel({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const q = useVenuePortForwards(routerId, page, PAGE_SIZE);
  const pushM = usePushVenuePortForward(routerId);
  const canPush = can("isp_network.execute");

  return (
    <Card title="Port Forwarding">
      <FormError message={error} />
      {q.isLoading && <LoadingBlock />}
      {q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this router's rules" />
      ) : null}
      {q.data && q.data.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No port forwarding rules on this router yet.
        </p>
      )}
      {q.data && q.data.rows.length > 0 && (
        // Scrolls in its own region (founder, 2026-10-22: "saari cheejo ka
        // scroll down"), so a long ruleset never pushes the page.
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Protocol</th>
                <th className="py-2 pr-3 font-medium">Public</th>
                <th className="py-2 pr-3 font-medium">Internal</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.protocol}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {[r.destinationAddress, r.destinationPort].filter(Boolean).join(":") || "any"}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.internalAddress}:{r.internalPort}
                  </td>
                  <td className="py-2 pr-3">
                    <MTag label={r.isEnabled ? "enabled" : "disabled"} />
                    <MTag label={r.devicePushStatus} />
                  </td>
                  <td className="py-2 text-right">
                    {canPush && (
                      <MButton
                        variant="outline"
                        disabled={pushM.isPending}
                        onClick={async () => {
                          setError(null);
                          try {
                            await pushM.mutateAsync(r.id);
                            toast.success(`${r.name} pushed to the router.`);
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
