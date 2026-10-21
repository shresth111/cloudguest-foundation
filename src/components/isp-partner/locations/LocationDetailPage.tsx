/** `/partner/locations/$ispLocationId` (PRD §4.4-4.6): the venue, its
 * routers, its captive portal and its TR-069 setting. */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { MButton, MDialog, MSectionHeader, MSeg, MTag } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { LocationFormDrawer, PROPERTY_TYPES } from "@/components/isp-partner/locations/LocationFormDrawer";
import { RouterFormDrawer } from "@/components/isp-partner/routers/RouterFormDrawer";
import { RoutersTable } from "@/components/isp-partner/routers/RoutersTable";
import { PortalEditor } from "@/components/isp-partner/portal/PortalEditor";
import { Tr069LocationCard } from "@/components/isp-partner/tr069/Tr069LocationCard";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspLocation, useSetIspLocationSuspended } from "@/hooks/isp-partner/useIsp";
import { formatDate } from "@/lib/isp-partner/format";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

type Tab = "routers" | "portal" | "tr069";

export function LocationDetailPage({ locationId }: { locationId: string }) {
  const { can } = usePartner();
  const navigate = useNavigate();
  const q = useIspLocation(locationId);
  const [tab, setTab] = useState<Tab>("routers");
  const [editing, setEditing] = useState(false);
  const [addingRouter, setAddingRouter] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspendM = useSetIspLocationSuspended(locationId);

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this location" />;
  const l = q.data;
  const suspended = l.status === "suspended";
  const tabs: { value: Tab; label: string }[] = [
    { value: "routers", label: "Routers" },
    { value: "portal", label: "Captive portal" },
  ];
  if (can("tr069.read")) tabs.push({ value: "tr069", label: "TR-069" });

  return (
    <>
      <MSectionHeader
        eyebrow={l.customer_name}
        title={l.name}
        description={[
          PROPERTY_TYPES.find((p) => p.value === l.property_type)?.label,
          [l.address_line1, l.city, l.state_province].filter(Boolean).join(", "),
          `added ${formatDate(l.created_at)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <MTag label={l.status} />
            {can("isp_partner.update") && (
              <MButton variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </MButton>
            )}
            {can("isp_partner.manage") && (
              <MButton variant="outline" onClick={() => setConfirm(true)}>
                {suspended ? "Reactivate" : "Suspend"}
              </MButton>
            )}
          </>
        }
      />
      <p className="text-xs">
        <Link
          to="/partner/customers/$ispCustomerId"
          params={{ ispCustomerId: l.isp_customer_id }}
          className="text-primary hover:underline"
        >
          ← {l.customer_name}
        </Link>
      </p>

      <MSeg<Tab> value={tab} onChange={setTab} options={tabs} />

      {tab === "routers" && (
        <Card
          title={`Routers (${l.routers.online}/${l.routers.total} online)`}
          actions={
            can("isp_partner.create") && (
              <MButton onClick={() => setAddingRouter(true)}>
                <Plus /> Add router
              </MButton>
            )
          }
        >
          <RoutersTable
            customerId={l.isp_customer_id}
            locationId={locationId}
            emptyHint="Add this venue's MikroTik, then generate its setup script."
          />
        </Card>
      )}
      {tab === "portal" && <PortalEditor locationId={locationId} />}
      {tab === "tr069" && <Tr069LocationCard locationId={locationId} canManage={can("tr069.manage")} />}

      <LocationFormDrawer
        open={editing}
        onClose={() => setEditing(false)}
        customerId={l.isp_customer_id}
        location={l}
      />
      <RouterFormDrawer
        open={addingRouter}
        onClose={() => setAddingRouter(false)}
        locationId={locationId}
        router={null}
        onSaved={(r) => navigate({ to: "/partner/routers/$ispRouterId", params: { ispRouterId: r.id } })}
      />
      <MDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={suspended ? `Reactivate ${l.name}?` : `Suspend ${l.name}?`}
        footer={
          <>
            <MButton variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </MButton>
            <MButton
              disabled={suspendM.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await suspendM.mutateAsync(!suspended);
                  toast.success(suspended ? "Location reactivated." : "Location suspended.");
                  setConfirm(false);
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
              }}
            >
              {suspendM.isPending && <Spinner />} {suspended ? "Reactivate" : "Suspend"}
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {suspended
            ? "The location becomes active again in this console."
            : "The location is marked suspended in this console. This does not cut guest WiFi at the venue."}
        </p>
        <div className="mt-3">
          <FormError message={error} />
        </div>
      </MDialog>
    </>
  );
}
