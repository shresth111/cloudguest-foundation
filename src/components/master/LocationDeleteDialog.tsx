/**
 * Master > Locations delete confirmation.
 *
 * Replaces a bare `window.confirm`. Two guards:
 *
 * - Type the venue's name, the same bar `/master/integrations` uses for
 *   deleting an integration: the rows read near-identically and the failure
 *   mode is acting on the wrong one.
 * - Show what is still attached. `DELETE /locations/{id}` archives the row
 *   only, so the backend now refuses (409) while any router that is not
 *   decommissioned is attached. The dialog lists those routers and keeps
 *   Delete disabled until there are none. Controller integrations are listed
 *   too: deleting strands their guest sign-in.
 */
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { MButton, MDialog } from "@/components/master/MasterKit";
import { requestErrorMessage } from "@/services/api";
import { networkIntegrationService } from "@/services/network-integration.service";
import { routerService } from "@/services/router.service";
import type { Location } from "@/types/location";
import type { NetworkIntegration } from "@/types/network-integration";
import type { RouterDevice } from "@/types/router";

interface Attachments {
  routers: RouterDevice[];
  integrations: NetworkIntegration[];
  /** Set when a lookup failed: the dialog then cannot vouch that nothing is
   * attached, and says so. The backend's 409 is still the real guard. */
  error: string | null;
}

function locationDeleteNameMatches(typed: string, name: string): boolean {
  return typed.trim().toLowerCase() === name.trim().toLowerCase() && name.trim() !== "";
}

export function LocationDeleteDialog({
  location,
  deleting,
  onCancel,
  onConfirm,
}: {
  location: Location | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (location: Location) => void;
}) {
  const [typed, setTyped] = useState("");
  const [attached, setAttached] = useState<Attachments | null>(null);

  useEffect(() => {
    setTyped("");
    setAttached(null);
    if (!location) return;
    let cancelled = false;
    (async () => {
      const [routers, integrations] = await Promise.allSettled([
        routerService.listForLocation(location.id, location.organizationId),
        networkIntegrationService.listAllPlatformIntegrations({
          organizationId: location.organizationId,
        }),
      ]);
      if (cancelled) return;
      const failed = [routers, integrations].find(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      setAttached({
        routers: routers.status === "fulfilled" ? routers.value : [],
        integrations:
          integrations.status === "fulfilled"
            ? integrations.value.filter((i) => i.locationId === location.id)
            : [],
        error: failed
          ? requestErrorMessage(failed.reason, "Could not check what is attached to this location.")
          : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [location]);

  if (!location) return null;
  const nameOk = locationDeleteNameMatches(typed, location.name);
  const hasRouters = (attached?.routers.length ?? 0) > 0;
  const canDelete = nameOk && !!attached && !hasRouters && !deleting;

  return (
    <MDialog
      open
      onClose={onCancel}
      title={`Delete ${location.name}?`}
      footer={
        <>
          <MButton variant="outline" onClick={onCancel}>
            Cancel
          </MButton>
          <MButton
            variant="primary"
            data-testid="confirm-location-delete"
            disabled={!canDelete}
            className="bg-destructive text-destructive-foreground"
            onClick={() => onConfirm(location)}
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete location
          </MButton>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          The location is archived and disappears from every location screen. This cannot be undone
          from the console.
        </p>

        {!attached ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking what is attached…
          </p>
        ) : (
          <div className="space-y-3" data-testid="location-delete-attachments">
            {attached.error && (
              <p role="alert" className="text-destructive">
                {attached.error}
              </p>
            )}
            <div>
              <p className="font-medium">
                Routers: {attached.routers.length === 0 ? "none" : attached.routers.length}
              </p>
              {hasRouters && (
                <>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {attached.routers.map((r) => (
                      <li key={r.id}>
                        {r.name} ({r.status})
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-destructive">
                    Decommission these routers first. The backend refuses to delete a location that
                    still has routers attached, because they would keep serving guests from a
                    location no screen shows.
                  </p>
                </>
              )}
            </div>
            <div>
              <p className="font-medium">
                Controller integrations:{" "}
                {attached.integrations.length === 0 ? "none" : attached.integrations.length}
              </p>
              {attached.integrations.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {attached.integrations.map((i) => (
                    <li key={i.id}>{i.name}: guest sign-in through it stops working.</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Type <span className="font-semibold text-foreground">{location.name}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Type the location name to confirm"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </label>
      </div>
    </MDialog>
  );
}
