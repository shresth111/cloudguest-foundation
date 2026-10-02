/**
 * Router Fleet: add an Aruba Instant On site, and remove a mistaken one.
 * Master console only (PM_SPEC §0.1 items 2-3). Nothing in the customer
 * dashboard may import this file.
 *
 * Add creates ONE `aruba_instant_on` fleet row at the chosen location
 * (`POST /platform/routers/instant-on-sites`, GLOBAL). It does not register
 * RADIUS, touch the hub or contact the AP: on success the caller opens the
 * row's Instant On setup panel, where Register is the next step.
 *
 * Remove is the fleet's ordinary decommission (`DELETE /routers/{id}`,
 * GLOBAL), which deregisters the RADIUS client from the hub first and
 * refuses -- changing nothing -- if the hub will not drop it.
 *
 * Errors are the backend's own sentences. There is no success toast for
 * Add: the setup panel opening IS the confirmation, and it reads the row
 * back from the backend.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import {
  EMPTY_INSTANT_ON_SITE_DRAFT,
  devicesAlreadyAtLocation,
  instantOnSiteRefusal,
  locationConflictWarning,
  validateInstantOnSiteDraft,
  type AddInstantOnSiteDraft,
  type CreatedInstantOnSite,
} from "@/lib/aruba-instant-on-site";
import { requestErrorMessage } from "@/services/api";
import { arubaInstantOnService } from "@/services/aruba-instant-on.service";
import { routerService } from "@/services/router.service";
import type { RouterDevice } from "@/types/router";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive" data-testid={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function AddInstantOnSiteDialog({
  open,
  onClose,
  fleet,
  fleetIncomplete = false,
  onCreated,
  onOpenExisting,
}: {
  open: boolean;
  onClose: () => void;
  /** The fleet as loaded, to warn about a location that already has a
   * device before the backend refuses it. */
  fleet: readonly RouterDevice[];
  /** The fleet read could not reach every organization or location, so the
   * pre-submit warning may miss a device. The backend checks again. */
  fleetIncomplete?: boolean;
  /** Called after the backend created the row. The caller refreshes the
   * fleet and opens the setup panel for `created.routerId`. */
  onCreated: (created: CreatedInstantOnSite) => Promise<void> | void;
  /** Open an existing row's setup panel (the "already onboarded" refusal). */
  onOpenExisting: (routerId: string) => void;
}) {
  const [draft, setDraft] = useState<AddInstantOnSiteDraft>(EMPTY_INSTANT_ON_SITE_DRAFT);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<{
    message: string;
    existingRouterId: string | null;
  } | null>(null);

  const orgs = useQuery({
    queryKey: ["master", "instant-on-site", "organizations"],
    queryFn: () => routerService.organizations(),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });
  const locations = useQuery({
    queryKey: ["master", "instant-on-site", "locations"],
    queryFn: () => routerService.locations(),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });

  const orgLocations = useMemo(
    () => (locations.data ?? []).filter((l) => l.organizationId === draft.organizationId),
    [locations.data, draft.organizationId],
  );
  const errors = validateInstantOnSiteDraft(draft);
  const shownErrors = touched ? errors : {};
  const conflict = locationConflictWarning(devicesAlreadyAtLocation(fleet, draft.locationId));

  const set = (patch: Partial<AddInstantOnSiteDraft>) => {
    setRefusal(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  function close() {
    if (saving) return;
    setDraft(EMPTY_INSTANT_ON_SITE_DRAFT);
    setTouched(false);
    setRefusal(null);
    onClose();
  }

  async function submit() {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setRefusal(null);
    try {
      const created = await arubaInstantOnService.createSite(draft);
      await onCreated(created);
      setDraft(EMPTY_INSTANT_ON_SITE_DRAFT);
      setTouched(false);
    } catch (err) {
      setRefusal(instantOnSiteRefusal(err));
    } finally {
      setSaving(false);
    }
  }

  const loadError =
    (orgs.isError && requestErrorMessage(orgs.error, "Could not load customers.")) ||
    (locations.isError && requestErrorMessage(locations.error, "Could not load locations.")) ||
    null;

  return (
    <MDialog
      open={open}
      onClose={close}
      title="Add Instant On site"
      footer={
        <>
          <MButton variant="outline" onClick={close} disabled={saving}>
            Cancel
          </MButton>
          <MButton
            variant="primary"
            onClick={submit}
            disabled={saving}
            data-testid="instant-on-site-submit"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              "Add site"
            )}
          </MButton>
        </>
      }
    >
      <div className="space-y-4" data-testid="instant-on-site-form">
        <p className="text-xs text-muted-foreground">
          One Instant On site is one fleet row at one location. This only records the site: nothing
          is sent to the access points or the RADIUS hub. The Instant On setup panel opens next,
          where you register the venue&apos;s public IP.
        </p>

        {loadError && (
          <p role="alert" className="text-xs text-destructive">
            {loadError}
          </p>
        )}

        <Field id="ios-org" label="Customer" error={shownErrors.organizationId}>
          <select
            id="ios-org"
            className={M_INPUT}
            value={draft.organizationId}
            disabled={saving || orgs.isLoading}
            onChange={(e) => set({ organizationId: e.target.value, locationId: "" })}
          >
            <option value="">{orgs.isLoading ? "Loading…" : "Choose a customer"}</option>
            {(orgs.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="ios-location"
          label="Location"
          error={shownErrors.locationId}
          hint={
            draft.organizationId && !locations.isLoading && orgLocations.length === 0
              ? "This customer has no locations. Add one on the Locations page first."
              : undefined
          }
        >
          <select
            id="ios-location"
            className={M_INPUT}
            value={draft.locationId}
            disabled={saving || !draft.organizationId || locations.isLoading}
            onChange={(e) => set({ locationId: e.target.value })}
          >
            <option value="">{locations.isLoading ? "Loading…" : "Choose a location"}</option>
            {orgLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>

        {conflict && (
          <div
            role="alert"
            data-testid="instant-on-site-conflict"
            className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{conflict}</span>
          </div>
        )}

        {fleetIncomplete && draft.locationId && !conflict && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="instant-on-site-fleet-incomplete"
          >
            Part of the fleet could not be read, so a device already at this location may not be
            shown here. Adding the site still checks it.
          </p>
        )}

        <Field id="ios-name" label="Device name" error={shownErrors.name}>
          <input
            id="ios-name"
            className={M_INPUT}
            value={draft.name}
            disabled={saving}
            placeholder="e.g. Aruba AP21 VNV5M1K1M6"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="ios-serial"
            label="AP serial (optional)"
            hint="Instant On › Inventory. Left blank, a visibly synthetic one is recorded."
            error={shownErrors.serialNumber}
          >
            <input
              id="ios-serial"
              className={M_INPUT}
              value={draft.serialNumber}
              disabled={saving}
              placeholder="VNV5M1K1M6"
              onChange={(e) => set({ serialNumber: e.target.value })}
            />
          </Field>
          <Field
            id="ios-mac"
            label="AP MAC (optional)"
            hint="Left blank, a locally administered one is recorded."
            error={shownErrors.macAddress}
          >
            <input
              id="ios-mac"
              className={M_INPUT}
              value={draft.macAddress}
              disabled={saving}
              placeholder="54:F0:B1:C8:A9:0A"
              onChange={(e) => set({ macAddress: e.target.value })}
            />
          </Field>
          <Field
            id="ios-site-name"
            label="Instant On site name (optional)"
            error={shownErrors.siteName}
          >
            <input
              id="ios-site-name"
              className={M_INPUT}
              value={draft.siteName}
              disabled={saving}
              placeholder="inhouse-office"
              onChange={(e) => set({ siteName: e.target.value })}
            />
          </Field>
          <Field
            id="ios-site-id"
            label="Instant On site id (optional)"
            hint="Recorded so one site cannot be added twice."
            error={shownErrors.siteId}
          >
            <input
              id="ios-site-id"
              className={M_INPUT}
              value={draft.siteId}
              disabled={saving}
              placeholder="fe0177b6-…"
              onChange={(e) => set({ siteId: e.target.value })}
            />
          </Field>
        </div>

        {refusal && (
          <div
            role="alert"
            data-testid="instant-on-site-refusal"
            className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground"
          >
            <p>{refusal.message}</p>
            {refusal.existingRouterId && (
              <MButton
                variant="outline"
                onClick={() => {
                  const id = refusal.existingRouterId!;
                  close();
                  onOpenExisting(id);
                }}
              >
                Open that site&apos;s Instant On setup
              </MButton>
            )}
          </div>
        )}
      </div>
    </MDialog>
  );
}

export function RemoveInstantOnSiteDialog({
  router,
  onClose,
  onRemoved,
}: {
  router: RouterDevice | null;
  onClose: () => void;
  onRemoved: (router: RouterDevice) => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (saving) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!router) return;
    setSaving(true);
    setError(null);
    try {
      await arubaInstantOnService.removeSite(router.id);
      await onRemoved(router);
      setError(null);
    } catch (err) {
      setError(requestErrorMessage(err, "The Instant On site could not be removed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MDialog
      open={!!router}
      onClose={close}
      title={`Remove ${router?.name ?? "this Instant On site"}?`}
      footer={
        <>
          <MButton variant="outline" onClick={close} disabled={saving}>
            Cancel
          </MButton>
          <MButton
            variant="primary"
            className="bg-destructive text-destructive-foreground"
            onClick={confirm}
            disabled={saving}
            data-testid="instant-on-site-remove-confirm"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Removing…
              </>
            ) : (
              "Remove site"
            )}
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm" data-testid="instant-on-site-remove">
        <p>
          This decommissions the fleet row for {router?.organizationName} / {router?.locationName}.
          If the site is registered with RADIUS, its client is removed from the hub first, which
          restarts RADIUS on the hub for 1 to 2 seconds; if the hub refuses, nothing is removed.
        </p>
        <p className="text-xs text-muted-foreground">
          Guests at this venue can no longer sign in once it is gone. Past guest sessions are kept.
          Nothing is changed in the Instant On app: remove the Wyfy RADIUS profile and guest portal
          there yourself.
        </p>
        {error && (
          <p
            role="alert"
            data-testid="instant-on-site-remove-error"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs"
          >
            {error}
          </p>
        )}
      </div>
    </MDialog>
  );
}
