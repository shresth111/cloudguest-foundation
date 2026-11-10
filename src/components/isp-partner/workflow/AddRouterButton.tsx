/**
 * RAKESH-FS (P0 #2): a visible "Add router" on the Routers page. Picks the
 * customer and location first, then opens the existing RouterFormDrawer
 * (unchanged). Shown only with the workflow flag on and isp_partner.create.
 *
 * DECISIONS-1: a franchisee (no isp_partner.create) also gets the button, but
 * its picker lists only the sites inside its zones (the backend's
 * /workflow/franchisee/router-sites) and the router is saved through the
 * franchisee route, which links it to the zone. It cannot add sites.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { CustomerSelect, FormError } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { RouterFormDrawer } from "@/components/isp-partner/routers/RouterFormDrawer";
import { useIspCustomerLocations, useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import {
  useFranchiseeAddRouter,
  useFranchiseeRouterSites,
  useWorkflowFeatures,
} from "@/hooks/isp-partner/useWorkflow";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

export function AddRouterButton() {
  const { can } = usePartner();
  const wf = useWorkflowFeatures();
  const franchisee = !!wf.features?.is_franchisee;
  if (wf.on && franchisee) return <FranchiseeAddRouterButton />;
  return <OwnerAddRouterButton allowed={wf.on && can("isp_partner.create")} />;
}

function OwnerAddRouterButton({ allowed }: { allowed: boolean }) {
  const [picking, setPicking] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [drawer, setDrawer] = useState(false);
  const customers = useIspCustomerOptions(picking);
  const locations = useIspCustomerLocations(customerId, picking);
  const navigate = useNavigate();
  if (!allowed) return null;
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

/** DECISIONS-1: franchisee picker = sites inside its zones only. */
function FranchiseeAddRouterButton() {
  const [picking, setPicking] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [drawer, setDrawer] = useState(false);
  const sites = useFranchiseeRouterSites(picking);
  const add = useFranchiseeAddRouter(siteId);
  const navigate = useNavigate();
  const items = sites.data?.items ?? [];
  const site = items.find((i) => i.isp_location_id === siteId);

  return (
    <>
      <MButton
        onClick={() => {
          setSiteId("");
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
              disabled={!siteId}
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
            <span className="text-xs font-medium text-muted-foreground">Site in your zones</span>
            <select
              className={`${M_FILTER} w-full`}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              aria-label="Site"
            >
              <option value="">Pick a site</option>
              {items.map((i) => (
                <option key={i.isp_location_id} value={i.isp_location_id}>
                  {i.customer_name} · {i.location_name}
                  {i.zone.name ? ` (${i.zone.name})` : ""}
                </option>
              ))}
            </select>
          </label>
          {sites.isSuccess && items.length === 0 && (
            <FormError message="No site in your zones yet. Ask the ISP to add the site first." />
          )}
          {site && (
            <p className="text-xs text-muted-foreground">
              The router is linked to {site.zone.name ?? "this site's zone"} automatically.
            </p>
          )}
        </div>
      </MDialog>
      {siteId && (
        <RouterFormDrawer
          open={drawer}
          onClose={() => setDrawer(false)}
          locationId={siteId}
          router={null}
          onCreate={(body) => add.mutateAsync(body)}
          creating={add.isPending}
          onSaved={(r) =>
            navigate({ to: "/partner/routers/$ispRouterId", params: { ispRouterId: r.id } })
          }
        />
      )}
    </>
  );
}
