/**
 * Built-in slots (priority 0): nav rows the partner console already does,
 * mapped to the existing partner screens. A batch page for the same id with a
 * higher priority replaces one of these without deleting it (see `../slots`).
 *
 * Every component here is an existing partner component, called with the ids
 * the shell resolved. None of them reads the customer dashboard's store.
 */
import { useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Ticket } from "lucide-react";
import { MButton, MEmptyState, MStat } from "@/components/master/MasterKit";
import { Card } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ServiceCard } from "@/components/isp-partner/customers/ServiceCard";
import { GuestsSessionsTab } from "@/components/isp-partner/guests/GuestsSessionsTab";
import { ReportsView } from "@/components/isp-partner/reports/ReportsView";
import { PortalEditor } from "@/components/isp-partner/portal/PortalEditor";
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
import type { PartnerSlot, PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";

function Dashboard({ customer, location }: PartnerSlotProps) {
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

function Logs({
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

function Devices({ customerId, locationId }: PartnerSlotProps) {
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

function Vouchers() {
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

function StaffAccess() {
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

const onRouter =
  (title: string, Panel: ComponentType<{ routerId: string }>) =>
  ({ locationId }: PartnerSlotProps) => (
    <WithRouter locationId={locationId as string} title={title}>
      {(routerId) => <Panel routerId={routerId} />}
    </WithRouter>
  );

export const slots: PartnerSlot[] = [
  { id: "dashboard", component: Dashboard },
  { id: "users", component: ({ customerId }) => <GuestsSessionsTab customerId={customerId} /> },
  { id: "reports", component: ({ customerId }) => <ReportsView fixedCustomerId={customerId} /> },
  {
    id: "portal",
    component: ({ locationId }) => <PortalEditor locationId={locationId as string} />,
  },
  { id: "vouchers", component: Vouchers },
  { id: "devices", component: Devices },
  { id: "agents", component: StaffAccess },
  { id: "dhcp", component: onRouter("IP Addresses", DhcpPoolsPanel) },
  { id: "vlans", component: onRouter("Network Zones", NetworkZonesPanel) },
  { id: "port-forwarding", component: onRouter("Port Forwarding", PortForwardingPanel) },
  { id: "voip", component: onRouter("Call Priority", QosPanel) },
  {
    id: "network-activity",
    component: ({ customerId, locationId }) => (
      <Logs customerId={customerId} locationId={locationId} tab="auth" />
    ),
  },
  {
    id: "netlogs",
    component: ({ customerId, locationId }) => (
      <Logs customerId={customerId} locationId={locationId} tab="netlogs" />
    ),
  },
];
