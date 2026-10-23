/**
 * Slot pages built from existing partner screens (registered in
 * `slots/00-existing.tsx`). Every one is an existing partner component called
 * with the ids the shell resolved; none reads the customer dashboard's store.
 */
import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Ticket } from "lucide-react";
import { MButton, MEmptyState, MStat } from "@/components/master/MasterKit";
import { Card, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ServiceCard } from "@/components/isp-partner/customers/ServiceCard";
import { GuestsSessionsTab } from "@/components/isp-partner/guests/GuestsSessionsTab";
import { ReportsView } from "@/components/isp-partner/reports/ReportsView";
import { RoutersTable } from "@/components/isp-partner/routers/RoutersTable";
import { Tr069DevicesTable } from "@/components/isp-partner/tr069/Tr069DevicesTable";
import { LogsView } from "@/components/isp-partner/log-views/LogsView";
import {
  DEFAULT_LOG_FILTERS,
  type LogFilters,
  type LogTab,
} from "@/components/isp-partner/log-views/logFilters";
import { NetworkZonesPanel } from "@/components/isp-partner/workspace/NetworkZonesPanel";
import { DhcpPoolsPanel } from "@/components/isp-partner/workspace/DhcpPoolsPanel";
import { PortForwardingPanel } from "@/components/isp-partner/workspace/PortForwardingPanel";
import { QosPanel } from "@/components/isp-partner/workspace/QosPanel";
import { WithRouter } from "@/components/isp-partner/customer-shell/parts";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";

export function Dashboard({ customer, location }: PartnerSlotProps) {
  const c = customer;
  return (
    <div className="space-y-4">
      <ServiceCard customerId={c.id} customerName={c.name} locationCount={c.counts.locations} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MStat label="Locations" value={c.counts.locations} />
        <MStat
          label="Routers online"
          value={`${c.counts.routers_online} / ${c.counts.routers_total}`}
        />
        <MStat label="TR-069 CPEs" value={c.counts.cpes} />
        {location ? (
          <MStat
            label={`${location.name}: routers online`}
            value={`${location.routers.online} / ${location.routers.total}`}
          />
        ) : (
          <MStat label="TR-069" value={c.tr069_enabled ? "On" : "Off"} />
        )}
      </div>
    </div>
  );
}

export function Logs({
  customerId,
  locationId,
  tab,
}: {
  customerId: string;
  locationId: string | null;
  tab: LogTab;
}) {
  const [filters, setFilters] = useState<LogFilters>({
    ...DEFAULT_LOG_FILTERS,
    tab,
    customer: customerId,
    location: locationId ?? "",
  });
  return <LogsView filters={filters} onChange={setFilters} fixedCustomerId={customerId} />;
}

export function Devices({ customerId, locationId }: PartnerSlotProps) {
  const { can } = usePartner();
  return (
    <div className="space-y-4">
      <Card title="Routers">
        <RoutersTable
          customerId={customerId}
          locationId={locationId ?? undefined}
          emptyHint="Add this venue's MikroTik from the location page."
        />
      </Card>
      {can("tr069.read") && (
        <Card title="TR-069 devices (this customer)">
          <Tr069DevicesTable query={{ isp_customer_id: customerId }} hideCustomer />
        </Card>
      )}
    </div>
  );
}

export function Vouchers() {
  const { can } = usePartner();
  return (
    <Card title="Vouchers">
      <MEmptyState
        icon={Ticket}
        title="Coupons are managed under Plans & coupons"
        description="Coupons you sell with a package are vouchers in this customer's account. Front-desk voucher batches for one venue are coming in this console soon."
        action={
          can("isp_coupons.read") ? (
            <Link to="/partner/plans">
              <MButton variant="outline">Open Plans & coupons</MButton>
            </Link>
          ) : undefined
        }
      />
    </Card>
  );
}

export function StaffAccess() {
  return (
    <Card title="Staff Access">
      <MEmptyState
        icon={Bot}
        title="Your staff, not the customer's"
        description="Customers in this console have no logins. Staff Access is your own team: add staff and limit them to the customers they look after."
        action={
          <Link to="/partner/users">
            <MButton variant="outline">Open Staff users</MButton>
          </Link>
        }
      />
    </Card>
  );
}

export function GuestsPage({ customerId }: PartnerSlotProps) {
  return <GuestsSessionsTab customerId={customerId} />;
}

export function ReportsPage({ customerId }: PartnerSlotProps) {
  return <ReportsView fixedCustomerId={customerId} />;
}

// The customer dashboard's OWN Portal page, unchanged (founder 2026-10-23):
// file uploads, colours, content picture, login methods, phone preview. The
// shell has already wrapped this in VenueScope, so the shim rewrites its calls
// to the /isp/venue twins (scripts/test-isp-partner-portal-shim.mjs).
const CustomerPortalPage = lazy(() =>
  import("@/components/features/PortalPage").then((m) => ({ default: m.PortalPage })),
);

export function PortalPage({ locationId }: PartnerSlotProps) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomerPortalPage locationId={locationId ?? undefined} />
    </Suspense>
  );
}

export function GuestConnectionRecordsPage({ customerId, locationId }: PartnerSlotProps) {
  return <Logs customerId={customerId} locationId={locationId} tab="auth" />;
}

export function NetLogsPage({ customerId, locationId }: PartnerSlotProps) {
  return <Logs customerId={customerId} locationId={locationId} tab="netlogs" />;
}

export function IpAddressesPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="IP Addresses">
      {(routerId) => <DhcpPoolsPanel routerId={routerId} />}
    </WithRouter>
  );
}

export function NetworkZonesPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="Network Zones">
      {(routerId) => <NetworkZonesPanel routerId={routerId} />}
    </WithRouter>
  );
}

export function PortForwardingPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="Port Forwarding">
      {(routerId) => <PortForwardingPanel routerId={routerId} />}
    </WithRouter>
  );
}

export function CallPriorityPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="Call Priority">
      {(routerId) => <QosPanel routerId={routerId} />}
    </WithRouter>
  );
}
