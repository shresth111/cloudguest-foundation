import { createFileRoute } from "@tanstack/react-router";
import { SubscriberDirectoryPage } from "@/components/isp-partner/subscribers/SubscriberDirectoryPage";

/** `/partner/subscribers` (ADDENDUM_05 J11). */
export const Route = createFileRoute("/partner/subscribers/")({
  ssr: false,
  component: SubscriberDirectoryPage,
});
