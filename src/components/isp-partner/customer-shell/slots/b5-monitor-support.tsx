/**
 * Batch B5 (ADDENDUM_04): Alerts, Support Tickets (ISP -> Wyfy), Staff
 * Activity (ISP staff) and How It Works (ISP guide).
 */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import {
  AlertsPage,
  HowItWorksPage,
  StaffActivityPage,
  SupportTicketsPage,
} from "@/components/isp-partner/monitor-support/B5Pages";

export const slots: PartnerSlot[] = [
  { id: "alerts", priority: 10, component: AlertsPage },
  { id: "tickets", priority: 10, component: SupportTicketsPage },
  { id: "admin-logs", priority: 10, component: StaffActivityPage },
  { id: "how-it-works", priority: 10, component: HowItWorksPage },
];
