/**
 * Choosing the Omada site and guest SSID for an integration, from the
 * MASTER console.
 *
 * ## The gap this closes
 *
 * An Omada integration authorises nobody until it knows which site it
 * covers: without one the backend reports `site_not_selected`, and every
 * guest completes OTP and is then refused. That mapping had exactly one
 * home in this app -- the customer dashboard's Network Integrations page --
 * so a platform operator onboarding a venue had to leave the Master
 * console, sign in as the customer, and finish the job there. The device
 * wizard said so in as many words ("Open Integrations, pick this
 * controller's site"), and OMADA_OPERATOR_RUNBOOK records the same
 * complaint from the other side: *"The admin onboarding wizard sends you to
 * a screen with no site picker."*
 *
 * The reason given for that was an ordering argument, and it was only half
 * right: listing sites needs stored credentials, stored credentials need
 * the integration row, and the row does not exist until onboarding
 * returns. All true -- and all satisfied by the time this renders, because
 * onboarding has returned and its result carries the id. So the mapping
 * belongs on the screen that just created it, not on a different dashboard
 * behind a different login.
 *
 * ## A picker when there is something to pick, and never otherwise
 *
 * A hotspot-operator login cannot read inventory. It drives the captive
 * portal and nothing else, so `GET /{id}/sites` and `GET /{id}/ssids`
 * answer **501** for an integration whose only credentials are that pair.
 * A `<Select>` that can never populate is worse than a text box -- it reads
 * as a loading bug, and the operator waits for it.
 *
 * So there are two paths, and which one renders is decided twice over:
 *
 *   1. `authModeSupportsInventory` -- known in advance from the auth mode,
 *      so a legacy-only integration never issues a request whose answer we
 *      already have.
 *   2. The backend's own 501, caught and treated as an answer rather than a
 *      failure. This is the same gate `lib/omada-disconnect.ts` uses, and
 *      for the same reason: the credential type is the backend's fact to
 *      state, not ours to infer. It matters because since `116f7ca` an Open
 *      API app and an operator login can COEXIST on one integration -- so
 *      `authMode` is a hint about what was configured, and the 501 is the
 *      truth about what those credentials can actually do.
 *
 * The manual path is not a degraded stub. It carries the runbook's own
 * workaround -- read the `site=` value out of a phone's address bar on the
 * guest SSID -- because that is how an operator with only a hotspot login
 * actually finds the value, and leaving them to guess is how `Default` gets
 * typed into a controller that does not use it.
 *
 * ## Why the name is stored in both fields on the manual path
 *
 * There is no id to discover, and the contract allows `guest_ssid_id:
 * null`. For the site, the typed value IS the identifier: it is what Omada
 * puts on its own redirect's `site=` and what the authorize call sends back.
 * Inventing an id we do not have would be worse than repeating the one
 * value we do.
 */
import { useState } from "react";
import { OMADA_SITE_ID_EXAMPLE, omadaSiteIdError } from "@/lib/omada-site-id";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { networkIntegrationService } from "@/services/network-integration.service";
import {
  authModeSupportsInventory,
  type ControllerAuthMode,
  type NetworkIntegrationSite,
} from "@/types/network-integration";
import { requestErrorMessage } from "@/services/api";
import type { AppError } from "@/services/api";

/**
 * A 501 from either inventory read means "these credentials cannot list
 * this", which is a capability answer and not an error to show. Anything
 * else -- an unreachable controller, a bad password, a 500 -- IS an error
 * and gets reported as one, because retrying it may well work.
 */
function isInventoryUnsupported(err: unknown): boolean {
  return (err as AppError | null)?.status === 501;
}

interface Props {
  integrationId: string;
  /** What was configured. A hint, not the verdict -- see the docstring. */
  authMode: ControllerAuthMode;
  initialSiteId?: string | null;
  initialSiteName?: string | null;
  initialSsidId?: string | null;
  initialSsidName?: string | null;
  /** Called after a successful save, with the values that were stored, so a
   * host screen can refresh whatever it renders about readiness. */
  onSaved?: (mapped: { siteName: string; ssidName: string }) => void;
}

export function OmadaSiteMapping({
  integrationId,
  authMode,
  initialSiteId,
  initialSiteName,
  initialSsidId,
  initialSsidName,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const [siteId, setSiteId] = useState(initialSiteId ?? "");
  const [siteName, setSiteName] = useState(initialSiteName ?? "");
  const [ssidId, setSsidId] = useState(initialSsidId ?? "");
  const [ssidName, setSsidName] = useState(initialSsidName ?? "");

  const canListInventory = authModeSupportsInventory(authMode);

  const sites = useQuery({
    queryKey: ["network-integrations", "platform", integrationId, "sites"],
    queryFn: () => networkIntegrationService.listPlatformSites(integrationId),
    enabled: canListInventory,
    staleTime: 30_000,
    // No retry on a 501: it is a settled answer about the credential type,
    // and retrying it three times only delays the manual path by a minute.
    retry: (count, err) => !isInventoryUnsupported(err) && count < 1,
  });

  const sitesUnsupported = isInventoryUnsupported(sites.error);

  const ssids = useQuery({
    queryKey: ["network-integrations", "platform", integrationId, "ssids"],
    queryFn: () => networkIntegrationService.listPlatformSsids(integrationId),
    enabled: canListInventory && !sitesUnsupported,
    staleTime: 30_000,
    retry: (count, err) => !isInventoryUnsupported(err) && count < 1,
  });

  const ssidsUnsupported = isInventoryUnsupported(ssids.error);

  // The picker is offered only where there is genuinely something to pick.
  // Either read coming back 501 collapses that half to manual entry; they
  // are decided separately because a controller can answer one and refuse
  // the other.
  const pickSite = canListInventory && !sitesUnsupported;
  const pickSsid = canListInventory && !ssidsUnsupported;

  // Selecting a site by id has to carry its name across too -- the backend
  // stores both, and `external_site_name` is what the operator reads back on
  // every later screen.
  function chooseSite(id: string, rows: NetworkIntegrationSite[]) {
    setSiteId(id);
    setSiteName(rows.find((s) => s.siteId === id)?.name ?? id);
  }

  const save = useMutation({
    mutationFn: () =>
      networkIntegrationService.updatePlatformIntegration(integrationId, {
        externalSiteId: siteId.trim() || null,
        externalSiteName: siteName.trim() || null,
        // `null`, not `""`: the contract allows an absent SSID id, and an
        // empty string is a value that matches nothing on the controller.
        guestSsidId: ssidId.trim() || null,
        guestSsidName: ssidName.trim() || null,
      }),
    onSuccess: () => {
      // Both the platform list and this integration's own row carry the
      // site and the readiness gaps that depend on it.
      qc.invalidateQueries({ queryKey: ["network-integrations"] });
      toast.success("Site and guest network saved");
      // The site id when no name is known, which is every legacy
      // integration: a hotspot operator account cannot list sites (CR-002),
      // so the typed branch establishes an id and nothing else. Callers use
      // this purely to confirm what was mapped (`RouterWizard` renders
      // "Site {x} mapped."), and an empty string there silently renders no
      // confirmation at all.
      onSaved?.({
        siteName: siteName.trim() || siteId.trim(),
        ssidName: ssidName.trim(),
      });
    },
    onError: (err) =>
      toast.error(requestErrorMessage(err, "Could not save the site and guest network.")),
  });

  // A site is the load-bearing half: without one the integration authorises
  // nobody. An SSID is genuinely optional -- the controller reports it on
  // the redirect either way -- so it never blocks the save.
  //
  // Gated on the ID, not the name. The picker sets both; the typed branch
  // can only ever establish an id (CR-002: a hotspot operator account
  // cannot list sites, so there is no name to look up). `external_site_id`
  // is the field every controller call and the portal site-check read --
  // see src/lib/omada-site-id.ts -- so an empty name is survivable and an
  // empty or malformed id is not.
  const siteIdError = pickSite ? null : omadaSiteIdError(siteId);
  const canSave = siteId.trim().length > 0 && !siteIdError && !save.isPending;

  return (
    <div className="space-y-4" data-testid="omada-site-mapping">
      <div>
        <p className="text-sm font-medium text-foreground">Site and guest network</p>
        <p className="text-xs text-muted-foreground">
          Until a site is set, this controller stores its credentials and authorises nobody — every
          guest finishes signing in and is then refused.
        </p>
      </div>

      {/* ── The site ─────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="omada-mapping-site">{pickSite ? "Omada site" : "Omada site id"}</Label>
        {pickSite ? (
          <SitePicker
            sites={sites.data ?? []}
            loading={sites.isLoading}
            error={sites.isError ? requestErrorMessage(sites.error, "Could not read sites.") : null}
            onRetry={() => sites.refetch()}
            value={siteId}
            onChange={(id) => chooseSite(id, sites.data ?? [])}
          />
        ) : (
          <>
            <Input
              id="omada-mapping-site"
              placeholder={OMADA_SITE_ID_EXAMPLE}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              aria-invalid={siteIdError ? true : undefined}
            />
            {siteIdError && siteId.trim() ? (
              <p className="text-xs text-destructive">{siteIdError}</p>
            ) : null}
            <ManualSiteHelp legacy={!canListInventory} />
          </>
        )}
      </div>

      {/* ── The guest SSID ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="omada-mapping-ssid">Guest SSID (optional)</Label>
        {pickSsid ? (
          <Select
            value={ssidId || ssidName}
            onValueChange={(v) => {
              const row = (ssids.data ?? []).find((s) => (s.ssidId ?? s.name) === v);
              setSsidId(row?.ssidId ?? "");
              setSsidName(row?.name ?? v);
            }}
          >
            <SelectTrigger id="omada-mapping-ssid">
              <SelectValue
                placeholder={ssids.isLoading ? "Reading networks…" : "Select the guest network…"}
              />
            </SelectTrigger>
            <SelectContent>
              {(ssids.data ?? []).map((s) => (
                <SelectItem key={s.ssidId ?? s.name} value={s.ssidId ?? s.name}>
                  {s.name}
                  {/* `null` is "the controller did not say", which is not
                      "the portal is off" -- so only a definite false is
                      called out. */}
                  {s.portalEnabled === false ? " — portal off" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <Input
              id="omada-mapping-ssid"
              placeholder="Hotel-Guest"
              value={ssidName}
              onChange={(e) => setSsidName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The guest network&rsquo;s name exactly as it is broadcast. It must match what Omada
              puts on its redirect, because that is the value replayed back to the controller when a
              guest is authorised.
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          <span className="ml-1.5">Save site and network</span>
        </Button>
        {!siteId.trim() && (
          <span className="text-xs text-muted-foreground">A site is required.</span>
        )}
      </div>
    </div>
  );
}

/** The picker, with its own loading/error/empty states — an empty list is a
 * real answer (credentials with access to no site) and is not silence. */
function SitePicker({
  sites,
  loading,
  error,
  onRetry,
  value,
  onChange,
}: {
  sites: NetworkIntegrationSite[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  value: string;
  onChange: (id: string) => void;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading sites from the controller…
      </p>
    );
  }
  if (error) {
    return (
      <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5">
        <p className="text-xs text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="ml-1.5">Try again</span>
        </Button>
      </div>
    );
  }
  if (sites.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        The controller listed no sites for these credentials. Check that the Open API account has
        access to at least one site.
      </p>
    );
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="omada-mapping-site">
        <SelectValue placeholder="Select the site that covers this venue…" />
      </SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s.siteId} value={s.siteId}>
            {s.name}
            {s.deviceCount != null ? ` — ${s.deviceCount} devices` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Why the operator is typing rather than picking, and how to find the value.
 *
 * Two different causes, and they are not interchangeable: `legacy` means the
 * integration was configured with only a hotspot operator login, which the
 * operator can change by adding an Open API app; a 501 on an Open API
 * integration means the credentials it has still cannot read inventory.
 * Saying which one it is, is the difference between an instruction and a
 * shrug.
 */
function ManualSiteHelp({ legacy }: { legacy: boolean }) {
  return (
    <div className="flex gap-1.5 pt-0.5">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          {legacy
            ? "A hotspot operator account cannot list sites — it drives the captive portal and nothing else — so this is typed in. Adding an Open API app to this controller turns this into a picker; guest sign-in works either way."
            : "This controller's credentials could not list sites, so the value is typed in. Guest sign-in is unaffected."}
        </p>
        <p>
          It is the site <strong>id</strong> — 24 letters and digits — not the site&apos;s name. The
          reliable way to read it: connect a phone to the guest WiFi and take the <code>site=</code>{" "}
          value out of the address bar when the sign-in page appears. That parameter always carries
          the id. <code>Default</code> is a name and will not work, on a single-site controller
          either.
        </p>
      </div>
    </div>
  );
}
