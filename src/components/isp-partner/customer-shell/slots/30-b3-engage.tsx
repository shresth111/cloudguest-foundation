/** B3 (Engagement + location dashboard) slots (PARITY-1). */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import {
  DashboardWithLocationPage,
  LoginPageOffersPage,
  ReportsWithVenuePage,
  VenueVouchersPage,
} from "@/components/isp-partner/customer-shell/pages/EngagePages";

export const slots: PartnerSlot[] = [
  { id: "dashboard", priority: 10, component: DashboardWithLocationPage },
  { id: "reports", priority: 10, component: ReportsWithVenuePage },
  { id: "campaigns", priority: 10, component: LoginPageOffersPage },
  { id: "vouchers", priority: 10, component: VenueVouchersPage },
];
