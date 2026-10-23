/**
 * Batch B4 (ADDENDUM_04): Security Score, Block Websites, Firewall, Fix a
 * Problem, and Devices (replaces the built-in routers-only Devices page).
 */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import {
  BlockWebsitesPage,
  DevicesPage,
  FirewallPage,
  FixAProblemPage,
  SecurityScorePage,
} from "@/components/isp-partner/security-ops/B4Pages";

export const slots: PartnerSlot[] = [
  { id: "security", priority: 10, component: SecurityScorePage },
  { id: "blocking", priority: 10, component: BlockWebsitesPage },
  { id: "firewall", priority: 10, component: FirewallPage },
  { id: "debugging", priority: 10, component: FixAProblemPage },
  { id: "devices", priority: 10, component: DevicesPage },
];
