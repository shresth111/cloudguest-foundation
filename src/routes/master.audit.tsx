import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStubPanel } from "@/components/master/MasterKit";

export const Route = createFileRoute("/master/audit")({ component: AuditScreen });

function AuditScreen() {
  return (
    <MasterShell title="Audit Logs">
      <MSectionHeader eyebrow="Compliance" title="Audit Logs" />
      <MStubPanel
        icon={ScrollText}
        title="Audit Logs"
        blurb="Immutable trail of every operator action across tenants."
        points={["Actor, action, target, IP, timestamp", "Filter by operator / tenant / resource", "Impersonation session records", "Config-change diffs", "Tamper-evident export", "Retention policy controls"]}
      />
    </MasterShell>
  );
}
