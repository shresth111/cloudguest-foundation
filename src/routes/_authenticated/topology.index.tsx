import { createFileRoute } from "@tanstack/react-router";
import { DeviceTopology } from "@/components/topology/DeviceTopology";
import { PageHeader } from "@/components/system/PageHeader";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";

export const Route = createFileRoute("/_authenticated/topology/")({
  component: TopologyPage,
});

function TopologyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Device topology"
        description="Visual network hierarchy showing your entire infrastructure at a glance."
      />
      <DeviceTopology />
    </div>
  );
}
