import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStubPanel } from "@/components/master/MasterKit";

export const Route = createFileRoute("/master/settings")({ component: SettingsScreen });

function SettingsScreen() {
  return (
    <MasterShell title="Platform Settings">
      <MSectionHeader eyebrow="Configuration" title="Platform Settings" />
      <MStubPanel
        icon={Settings}
        title="Platform Settings"
        blurb="Operator roles, branding, integrations and defaults."
        points={["Operator roles & permissions (RBAC)", "White-label branding defaults", "RADIUS / WireGuard cluster config", "Billing & tax settings", "Webhooks & API keys", "Notification routing"]}
      />
    </MasterShell>
  );
}
