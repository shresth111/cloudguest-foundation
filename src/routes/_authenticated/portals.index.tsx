import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalKpiGrid } from "@/components/portals/PortalKpiGrid";
import { PortalTable } from "@/components/portals/PortalTable";

export const Route = createFileRoute("/_authenticated/portals/")({
  component: PortalsPage,
});

function PortalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Captive portals</h1>
          <p className="text-sm text-muted-foreground">
            Design, publish, and monitor guest login experiences across every location.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Portal metrics exported")}>
            <Download className="mr-2 h-4 w-4" /> Export report
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <PortalKpiGrid />
      <PortalTable />
    </div>
  );
}
