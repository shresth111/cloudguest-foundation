import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/isp-partner/reports/ReportsPage";

export const Route = createFileRoute("/partner/reports")({
  ssr: false,
  component: ReportsPage,
});
