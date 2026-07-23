import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStubPanel } from "@/components/master/MasterKit";

export const Route = createFileRoute("/master/health")({ component: HealthScreen });

function HealthScreen() {
  return (
    <MasterShell title="System Health">
      <MSectionHeader eyebrow="Reliability" title="System Health" />
      <MStubPanel
        icon={Activity}
        title="System Health"
        blurb="Platform service status, incidents and SLOs."
        points={["Service status board (API, RADIUS, portal, WG)", "Live incident timeline", "Error-rate & latency SLOs", "Region-level uptime", "Dependency map", "On-call / escalation"]}
      />
    </MasterShell>
  );
}
