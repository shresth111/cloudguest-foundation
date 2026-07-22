import { createFileRoute } from "@tanstack/react-router";
import { ErrorMaintenancePage } from "@/components/error-pages/ErrorMaintenancePage";

export const Route = createFileRoute("/_authenticated/error-maintenance")({
  component: () => <ErrorMaintenancePage />,
});
