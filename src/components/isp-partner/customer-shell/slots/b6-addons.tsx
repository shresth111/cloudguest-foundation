/**
 * Batch B6 (ADDENDUM_04): add-on pages. Traffic Lens only; Guest Messaging
 * stays "Coming soon" until founder F1/F3 (credits, sender) are answered.
 */
import type { PartnerSlot } from "@/components/isp-partner/customer-shell/slots";
import { TrafficLensPage } from "@/components/isp-partner/addons/TrafficLensPage";

export const slots: PartnerSlot[] = [
  { id: "traffic-lens", priority: 10, component: TrafficLensPage },
];
