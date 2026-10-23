/**
 * Built-in slots (priority 0): nav rows the partner console already does,
 * mapped to the existing partner screens (`../builtins`). A batch page for the
 * same id with a higher priority replaces one of these without deleting it
 * (see `../slots`).
 */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import {
  CallPriorityPage,
  Dashboard,
  Devices,
  GuestConnectionRecordsPage,
  GuestsPage,
  IpAddressesPage,
  NetLogsPage,
  NetworkZonesPage,
  PortalPage,
  PortForwardingPage,
  ReportsPage,
  StaffAccess,
  Vouchers,
} from "@/components/isp-partner/customer-shell/builtins";

export const slots: PartnerSlot[] = [
  { id: "dashboard", component: Dashboard },
  { id: "users", component: GuestsPage },
  { id: "reports", component: ReportsPage },
  { id: "portal", component: PortalPage },
  { id: "vouchers", component: Vouchers },
  { id: "devices", component: Devices },
  { id: "agents", component: StaffAccess },
  { id: "dhcp", component: IpAddressesPage },
  { id: "vlans", component: NetworkZonesPage },
  { id: "port-forwarding", component: PortForwardingPage },
  { id: "voip", component: CallPriorityPage },
  { id: "network-activity", component: GuestConnectionRecordsPage },
  { id: "netlogs", component: NetLogsPage },
];
