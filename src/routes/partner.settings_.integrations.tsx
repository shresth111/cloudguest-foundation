import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/components/isp-partner/settings/IntegrationsPage";

/** `/partner/settings/integrations` (APPS-2 #5): read-only integration status. */
export const Route = createFileRoute("/partner/settings_/integrations")({
  ssr: false,
  component: IntegrationsPage,
});
