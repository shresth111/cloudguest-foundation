import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/isp-partner/OverviewPage";

export const Route = createFileRoute("/partner/")({
  ssr: false,
  component: OverviewPage,
});
