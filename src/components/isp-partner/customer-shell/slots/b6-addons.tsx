/**
 * Batch B6 (ADDENDUM_04): add-on pages -- Traffic Lens and Guest Messaging
 * (the customer's own pages, mounted unchanged; F1/F3 coordinator defaults).
 */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import { TrafficLensPage } from "@/components/isp-partner/addons/TrafficLensPage";
import { GuestMessagingPage } from "@/components/isp-partner/messaging/MessagingPages";

export const slots: PartnerSlot[] = [
  { id: "traffic-lens", priority: 10, component: TrafficLensPage },
  { id: "marketing", priority: 10, component: GuestMessagingPage },
];
