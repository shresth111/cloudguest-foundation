/**
 * RAKESH-FS (P0 #2): a visible "Add router" on the Routers page. Picks the
 * customer and location first, then opens the existing RouterFormDrawer
 * (unchanged). Shown only with the workflow flag on and isp_partner.create.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { CustomerSelect, FormError } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { RouterFormDrawer } from "@/components/isp-partner/routers/RouterFormDrawer";
import { useIspCustomerLocations, useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useWorkflowFeatures } from "@/hooks/isp-partner/useWorkflow";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

export function AddRouterButton() {
  const { can } = usePartner();
  const wf = useWorkflowFeatures();
  const [picking, setPicking] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [drawer, setDrawer] = useState(false);
  const customers = useIspCustomerOptions(picking);
  const locations = useIspCustomerLocations(customerId, picking);
  const navigate = useNavigate();
  if (!wf.on || !can("isp_partner.create")) return null;
  const locs = locations.data?.items ?? [];

  return (
    <>
      <MButton
        onClick={() => {
          setCustomerId("");
          setLocationId("");
          setPicking(true);
        }}
      >
        <Plus /> Add router
      </MButton>
      <MDialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Add router: where is it installed?"
        footer={
          <>
            <MButton variant="outline" onClick={() => setPicking(false)}>
              Cancel
            </MButton>
            <MButton
              disabled={!locationId}
              onClick={() => {
                setPicking(false);
                setDrawer(true);
              }}
            >
              Next: router details
            </MButton>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Customer (site)</span>
            <CustomerSelect
              value={customerId}
              onChange={(v) => {
                setCustomerId(v);
                setLocationId("");
              }}
              customers={customers.data}
              allLabel="Pick a customer"
            />
          </label>
          {customerId && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Location</span>
              <select
                className={`${M_FILTER} w-full`}
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                aria-label="Location"
              >
                <option value="">Pick a location</option>
                {locs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {customerId && locations.isSuccess && locs.length === 0 && (
            <FormError message="This customer has no location yet. Add one from the customer's page first." />
          )}
          <p className="text-xs text-muted-foreground">
            After saving, the router page gives you its setup script. Link it to zones there.
          </p>
        </div>
      </MDialog>
      {locationId && (
        <RouterFormDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          locationId={locationId}
          router={null}
          onSaved={(r) =>
            navigate({ to: "/partner/routers/$ispRouterId", params: { ispRouterId: r.id } })
          }
        />
      )}
    </>
  );
}
