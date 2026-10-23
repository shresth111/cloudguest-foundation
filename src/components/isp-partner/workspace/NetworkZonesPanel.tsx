/**
 * Network Zones for one router (PRD §4.6; API_CONTRACT §10).
 *
 * The partner console's own screen over `GET /isp/venue/vlans` -- not the
 * customer app's `VlanManagement`, which fetches its router list through
 * `routerService` (`/routers`) and would 403 that call on the partner host.
 * Building it here keeps the picker, the scope and the permissions under the
 * partner console's control.
 *
 * `routerId` comes from the parent: the Network tab owns one picker for Zones,
 * IP addresses and the rest, so switching between them does not silently change
 * which router is being configured.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { MButton, MDialog, MTag } from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Pager,
  Spinner,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { VlanFormDrawer } from "@/components/isp-partner/workspace/VlanFormDrawer";
import { useDeleteVenueVlan, usePushVenueVlan, useVenueVlans } from "@/hooks/isp-partner/useVenue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

const PAGE_SIZE = 25;

export function NetworkZonesPanel({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const q = useVenueVlans(routerId, page, PAGE_SIZE);
  const pushM = usePushVenueVlan(routerId);
  const deleteM = useDeleteVenueVlan(routerId);
  const canPush = can("isp_network.execute");

  return (
    <>
      <Card
        title="Network Zones"
        actions={
          can("isp_network.create") ? (
            <MButton onClick={() => setAdding(true)}>
              <Plus /> Add VLAN
            </MButton>
          ) : undefined
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
                      {can("isp_network.delete") && (
                        <MButton
                          variant="outline"
                          onClick={() => setDeleting({ id: v.id, name: v.name })}
                        >
                          Delete
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
      <VlanFormDrawer
        open={adding}
        onClose={() => setAdding(false)}
        routerId={routerId}
        onCreated={() => setPage(1)}
      />
      <MDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : "Delete VLAN?"}
        footer={
          <>
            <MButton variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </MButton>
            <MButton
              disabled={deleteM.isPending}
              onClick={async () => {
                if (!deleting) return;
                setError(null);
                try {
                  await deleteM.mutateAsync(deleting.id);
                  toast.success(`${deleting.name} deleted.`);
                  setDeleting(null);
                } catch (err) {
                  setError(ispErrorMessage(err));
                  setDeleting(null);
                }
              }}
            >
              {deleteM.isPending && <Spinner />} Delete
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This removes the VLAN's row only. If it was already pushed to the router, remove it there
          too, or the router keeps serving it.
        </p>
      </MDialog>
    </>
  );
}
