import { createFileRoute } from "@tanstack/react-router";
import { MessagingPage } from "@/components/isp-partner/messaging/MessagingPages";

/** `/partner/messaging` (ADDENDUM_04 F1/F3): the ISP's credit wallet and its
 * ISP-level messaging sender. */
export const Route = createFileRoute("/partner/messaging")({
  ssr: false,
  component: MessagingPage,
});
