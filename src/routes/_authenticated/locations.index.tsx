import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPinned, Plus, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/permissions/Can";
import { LocationTable } from "@/components/locations/LocationTable";
import { PlatformLocationWizard } from "@/components/locations/PlatformLocationWizard";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/locations/")({
  component: LocationMasterPage,
});


function LocationMasterPage() {
  const { can, isLocked, isVisible } = usePermissions();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const locked = isLocked("location-master") || isLocked("locations");
  const hidden = !isVisible("location-master") && !isVisible("locations");

  if (hidden) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
        <MapPinned className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Location Master unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your role does not have access to the Location Master. Contact your Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <MapPinned className="h-3 w-3" /> Location Master
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Every operational activity starts here. Open a location to manage its NAS devices,
            guests, portals and policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Can module="location-master" action="import" mode="hidden">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4" />
              <span className="ml-2">Import</span>
            </Button>
          </Can>
          <Can
            module="location-master"
            action="create"
            mode="fallback"
            fallback={
              <Button size="sm" disabled title="Access restricted. Contact your Administrator.">
                <Plus className="h-4 w-4" />
                <span className="ml-2">Create location</span>
              </Button>
            }
          >
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="ml-2">Create location</span>
            </Button>

          </Can>
        </div>
      </div>

      {locked && !can("location-master", "view") ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Location Master is locked for your role. Contact your Administrator to unlock.
        </div>
      ) : (
        <LocationTable />
      )}
    </div>
  );
}
