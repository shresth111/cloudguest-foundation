/**
 * One customer, run by the ISP, with the customer dashboard's own nav
 * (ADDENDUM_04). The ISP chrome (`PartnerShell`) stays around it; this adds
 * the customer's sidebar inside the page, a location picker on top, and a
 * drawer for the same nav on phones.
 *
 * What it does NOT do: render anything a page did not register. A nav row
 * with no slot shows "Coming in this console soon"; an add-on this ISP is not
 * allowed shows the lock screen; a location-level row with no location picked
 * asks for one. The page mounts only after all three pass, inside
 * `VenueScope`, so every `/isp/venue/*` twin call carries this customer and
 * this location and nothing else.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, Menu, X } from "lucide-react";
import { M_INPUT, MEmptyState, MTag } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { VenueScope } from "@/components/isp-partner/workspace/VenueScope";
import { useIspCustomer, useIspCustomerLocations } from "@/hooks/isp-partner/useIsp";
import { cn } from "@/lib/utils";
import type { IspLocation } from "@/services/isp-partner/types";
import {
  DEFAULT_PARTNER_FEATURE,
  findPartnerNavItem,
  itemVisible,
  visiblePartnerNavGroups,
  type PartnerNavGroup,
  type PartnerNavItem,
} from "@/components/isp-partner/customer-shell/nav";
import { partnerSlots } from "@/components/isp-partner/customer-shell/slots";
import { useAddonOpen } from "@/components/isp-partner/customer-shell/addons";
import { useControllerGate } from "@/components/isp-partner/customer-shell/controller-gate";
import { ControllerManagedFeatureNotice } from "@/components/customer/ControllerManagedFeatureNotice";
import { AddonLocked, ComingSoon } from "@/components/isp-partner/customer-shell/parts";

export interface CustomerWorkspaceProps {
  customerId: string;
  feature: string;
  locationId: string | null;
  onNavigate: (feature: string, locationId: string | null) => void;
  onLocation: (locationId: string | null) => void;
}

function NavList({
  groups,
  customerId,
  active,
  locationId,
  onPick,
}: {
  groups: PartnerNavGroup[];
  customerId: string;
  active: string;
  locationId: string | null;
  onPick?: () => void;
}) {
  return (
    <nav aria-label="Customer workspace" className="space-y-4">
      {groups.map((g) => (
        <div key={g.id}>
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g.label}
          </p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = item.icon;
              const on = item.id === active;
              return (
                <li key={item.id}>
                  <Link
                    to="/partner/customers/$ispCustomerId/$feature"
                    params={{ ispCustomerId: customerId, feature: item.id }}
                    search={locationId ? { location: locationId } : {}}
                    onClick={onPick}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
                      on
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.addon && (
                      <span className="ml-auto rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                        Add-on
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: IspLocation[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <span className="sr-only">Location</span>
      <select
        className={cn(M_INPUT, "w-auto min-w-[200px]")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Location"
        disabled={locations.length === 0}
      >
        {locations.length === 0 && <option value="">No locations yet</option>}
        {locations.length > 0 && <option value="">All locations</option>}
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FeatureBody({
  item,
  customerId,
  location,
  children,
}: {
  item: PartnerNavItem;
  customerId: string;
  location: IspLocation | null;
  children: React.ReactNode;
}) {
  const open = useAddonOpen(customerId, item.addon);
  // The customer host's controller-venue rule, for every venue row: a screen
  // that writes RouterOS is not mounted where every router is controller-
  // managed (Omada / Aruba). "blocking" is gated under the customer id the
  // rule uses for it, "website-blocking".
  const gate = useControllerGate(
    item.id === "blocking" ? "website-blocking" : item.id,
    item.scope === "location" ? (location?.id ?? null) : null,
  );
  if (open === null) return <LoadingBlock />;
  if (!open && item.addon)
    return <AddonLocked label={item.label} customerId={customerId} addon={item.addon} />;
  if (item.scope === "location" && !location) {
    return (
      <Card title={item.label}>
        <MEmptyState
          icon={MapPin}
          title="Pick a location"
          description={`${item.label} is set per venue. Choose one of this customer's locations at the top.`}
        />
      </Card>
    );
  }
  if (gate.loading) return <LoadingBlock />;
  if (gate.gated) {
    return (
      <ControllerManagedFeatureNotice
        featureId={item.id === "blocking" ? "website-blocking" : item.id}
        featureLabel={item.label}
        venueName={location?.name ?? null}
        vendor={gate.vendor}
      />
    );
  }
  return <>{children}</>;
}

export function CustomerWorkspace({
  customerId,
  feature,
  locationId,
  onNavigate,
  onLocation,
}: CustomerWorkspaceProps) {
  const { can } = usePartner();
  const customer = useIspCustomer(customerId);
  const locationsQ = useIspCustomerLocations(customerId);
  const [drawer, setDrawer] = useState(false);

  const groups = useMemo(() => visiblePartnerNavGroups(can), [can]);
  const requested = findPartnerNavItem(feature);
  const item =
    requested && itemVisible(requested, can)
      ? requested
      : (groups[0]?.items.find((i) => i.id === DEFAULT_PARTNER_FEATURE) ?? groups[0]?.items[0]);

  const locations = useMemo(() => locationsQ.data?.items ?? [], [locationsQ.data]);
  // The URL's location counts only if it is one of THIS customer's. The
  // backend refuses a foreign one anyway (IspScope); this keeps the screen
  // from asking it to.
  const location = locations.find((l) => l.id === locationId) ?? null;

  // A customer with exactly one location: that is the venue, no pick needed.
  useEffect(() => {
    if (!locationId && locations.length === 1 && item?.scope === "location") {
      onLocation(locations[0].id);
    }
  }, [locationId, locations, item?.scope, onLocation]);

  // An unknown or hidden feature id in the URL is corrected, not rendered.
  useEffect(() => {
    if (item && item.id !== feature) onNavigate(item.id, locationId);
  }, [item, feature, locationId, onNavigate]);

  if (customer.isLoading) return <LoadingBlock />;
  if (customer.error || !customer.data)
    return (
      <ErrorBlock error={customer.error} onRetry={() => customer.refetch()} what="this customer" />
    );
  const c = customer.data;

  if (!item) {
    return (
      <MEmptyState
        icon={MapPin}
        title="Your role has no customer screens"
        description="Ask your account owner for access."
      />
    );
  }

  const slot = partnerSlots().get(item.id);
  const Page = slot?.component;
  const body = Page ? (
    <Suspense fallback={<LoadingBlock />}>
      <Page
        customerId={customerId}
        customer={c}
        locationId={location?.id ?? null}
        location={location}
      />
    </Suspense>
  ) : (
    <ComingSoon label={item.label} />
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link to="/partner/customers" className="text-primary hover:underline">
          Customers
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <Link
          to="/partner/customers/$ispCustomerId"
          params={{ ispCustomerId: customerId }}
          className="text-primary hover:underline"
        >
          {c.name}
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">{item.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium lg:hidden"
          onClick={() => setDrawer(true)}
          aria-label="Open customer menu"
        >
          <Menu className="h-4 w-4" /> {item.label}
        </button>
        <h1 className="hidden text-lg font-semibold tracking-tight lg:block">{c.name}</h1>
        <MTag label={c.status} />
        <div className="ml-auto">
          {locationsQ.error && !locationsQ.data ? (
            <ErrorBlock
              error={locationsQ.error}
              onRetry={() => locationsQ.refetch()}
              what="locations"
            />
          ) : (
            <LocationPicker
              locations={locations}
              value={location?.id ?? null}
              onChange={onLocation}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <NavList
              groups={groups}
              customerId={customerId}
              active={item.id}
              locationId={location?.id ?? null}
            />
          </div>
        </aside>
        <section className="min-w-0 space-y-4">
          <FeatureBody item={item} customerId={customerId} location={location}>
            {location ? (
              <VenueScope
                key={location.id}
                customerId={customerId}
                locationId={location.id}
                locationName={location.name}
              >
                {body}
              </VenueScope>
            ) : (
              body
            )}
          </FeatureBody>
        </section>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <button onClick={() => setDrawer(false)} aria-label="Close customer menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavList
                groups={groups}
                customerId={customerId}
                active={item.id}
                locationId={location?.id ?? null}
                onPick={() => setDrawer(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
