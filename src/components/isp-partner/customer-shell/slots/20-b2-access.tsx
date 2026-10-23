/** B2 (Access & Policy) + Internet Connection slots (PARITY-1). */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import {
  AccessRulesPage,
  GuestAllowListPage,
  GuestGroupsPage,
  InternetConnectionPage,
  OpenHoursPage,
  TrustedDevicesPage,
} from "@/components/isp-partner/customer-shell/pages/AccessPages";

export const slots: PartnerSlot[] = [
  { id: "policies", priority: 10, component: AccessRulesPage },
  { id: "whitelist", priority: 10, component: GuestAllowListPage },
  { id: "mac-auth", priority: 10, component: TrustedDevicesPage },
  { id: "business-hours", priority: 10, component: OpenHoursPage },
  { id: "teams", priority: 10, component: GuestGroupsPage },
  { id: "isp-details", priority: 10, component: InternetConnectionPage },
];
