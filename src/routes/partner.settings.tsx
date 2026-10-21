import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/isp-partner/settings/SettingsPage";

export const Route = createFileRoute("/partner/settings")({
  ssr: false,
  component: SettingsPage,
});
