import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  KeyRound,
  Loader2,
  MapPin,
  Plug,
  RadioTower,
  RefreshCw,
  Server,
  ShieldCheck,
  Copy,
  Lock,
  Signal,
  Trash2,
  Users,
  Wifi,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeader, StatCard, Stepper, type StepperItem } from "@/components/ui-ext";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useCustomerLocations, useIsDemo } from "@/hooks/useCustomerDashboard";
import { relativeTime } from "@/lib/friendly";
import {
  CREDENTIAL_GAP_KEYS,
  deriveIntegrationSetup,
  halfConfiguredIntegrations,
} from "@/lib/network-integration-readiness";
import { cn } from "@/lib/utils";
import type { AppError } from "@/services/api";
import { networkIntegrationService } from "@/services/network-integration.service";
import {
  authModeSupportsInventory,
  CONTROLLER_AUTH_MODE_LABEL,
  CONTROLLER_AUTH_MODE_SUMMARY,
  CONTROLLER_TLS_MODE_LABEL,
  CONTROLLER_TLS_MODE_SUMMARY,
  credentialsCompleteForMode,
  describeIntegrationError,
  GUEST_OPERATOR_REQUIRED_NOTE,
  isNetworkIntegrationErrored,
  LEGACY_INVENTORY_BODY,
  LEGACY_INVENTORY_TITLE,
  NETWORK_INTEGRATION_STATUS_DETAIL,
  NETWORK_INTEGRATION_STATUS_LABEL,
  NETWORK_INTEGRATION_STATUS_TONE,
  normalizeTlsFingerprint,
  type ControllerAuthMode,
  type ControllerTlsMode,
  type NetworkIntegration,
  type NetworkIntegrationClient,
  type NetworkIntegrationCredentials,
  type NetworkIntegrationDevice,
  type NetworkIntegrationStatus,
  type NetworkIntegrationStatusTone,
} from "@/types/network-integration";

/**
 * "Network Integrations" — connect a venue's own TP-Link Omada controller so
 * that Wyfy Guest logins are enforced on its access points.
 *
 * WHAT THIS SCREEN IS FOR
 * -----------------------
 * A venue that already runs Omada hardware does not want a second network
 * stack. It wants its existing controller to be the thing that lets guests
 * online after they finish the portal flow. So this page is a *connection*
 * screen, not a management screen: it owns the credentials, the site
 * mapping, and an honest read-only view of what the controller reports.
 * Everything about who a guest is — OTP, vouchers, consent, analytics — stays
 * exactly where it already lives (`app.domains.guest`). Nothing here signs
 * anybody in.
 *
 * AN OMADA VENUE HAS NO MIKROTIK ROUTER IN THE PATH
 * --------------------------------------------------
 * MikroTik and Omada are separate, parallel deployments, not a mixed
 * topology at one venue: an Omada venue talks to the Omada controller and has
 * no MikroTik router in the path at all. So an integration's parent here is a
 * **location**, never a router. Nothing on this page links to a router, shows
 * router health, or mentions NAS/RADIUS -- those belong to the MikroTik
 * deployment and would be a dead end (or worse, a wrong diagnosis) on an
 * Omada venue. The two "see master.nas.tsx" comments below are pointers to
 * the *wording* of a destructive confirmation, not a claim that a NAS exists.
 *
 * The icons are part of that: a controller is drawn as an appliance
 * (`Server`) and its access points as radio hardware (`RadioTower`), never
 * with lucide's `Router` glyph, which in this console means a MikroTik box in
 * the Router Fleet.
 *
 * WHY THE BROWSER NEVER TALKS TO THE CONTROLLER
 * ---------------------------------------------
 * Every read and write on this page goes to our own API. The controller URL
 * is rendered (it is the one field a venue owner uses to recognise their own
 * box) but never fetched from the browser: a customer's controller sits on
 * their LAN behind their own TLS, and a browser-side call would mean shipping
 * their credentials to the browser to make it. It would also make this page a
 * cross-origin request forgery engine pointed at whatever the customer typed.
 * The backend holds the credentials, validates the URL against SSRF rules on
 * every outbound request, and is the only thing that connects.
 *
 * CREDENTIALS ARE WRITE-ONLY, AND THIS FILE IS WHERE THAT IS ENFORCED
 * ------------------------------------------------------------------
 * The API's whole vocabulary for a stored credential is
 * `hasCredentials: boolean`. There is therefore no secret to render, and this
 * page renders none. In-flight drafts (the wizard's own form state) live in
 * `useState` and nowhere else — not in a React Query key, not in
 * `localStorage`/`sessionStorage`, not in a URL, not in a toast, not in a
 * console line. A rotation replaces; it never reveals.
 *
 * WHY THE WIZARD SAVES BEFORE THE LAST STEP
 * -----------------------------------------
 * The obvious wizard is "collect everything, POST once at the end". It cannot
 * work here, and the shape of the API says so: `POST /test-connection` is a
 * pre-save probe that persists nothing, while the site and SSID lists come
 * from `GET /{id}/sites` and `GET /{id}/ssids` — which need an `{id}`. So the
 * row is created as soon as the connection test passes, and the site / venue /
 * SSID choices are PATCHed onto it. That is not a workaround: `unconfigured`
 * is one of the seven statuses in the contract, and it means precisely
 * "we can reach the controller but nothing has been mapped yet". A customer
 * who closes the wizard halfway therefore gets a real, resumable row that
 * says "Setup incomplete" with a Finish setup button, instead of losing five
 * minutes of typing.
 *
 * ON QUERY KEYS
 * -------------
 * No key on this page contains an organization id, and none is gated on a
 * flag that starts out wrong. Both halves of that sentence are scar tissue:
 * `useIsDemo` used to initialise to `true` and correct itself in an effect,
 * so a query gated on it fired once with an unresolved org id, then again
 * once the id arrived and changed the key — a live capture caught one endpoint
 * being hit four times on a single page load (see
 * `components/network/PortForwardingManagement.tsx`'s own note). `useIsDemo`
 * is now correct on the first client render (`useSyncExternalStore`), and the
 * org id is attached by the service layer as a header, where it belongs,
 * rather than being smuggled into a cache key. A key here describes the
 * request and nothing else.
 */

/**
 * One place for this feature's cache keys, so an invalidation cannot miss a
 * reader. Deliberately *not* exported: everything that needs them is in this
 * file, and exporting a non-component from a component module trips
 * `react-refresh/only-export-components` for no benefit.
 */
const keys = {
  list: ["network-integrations", "list"] as const,
  sites: (id: string) => ["network-integrations", id, "sites"] as const,
  ssids: (id: string) => ["network-integrations", id, "ssids"] as const,
  devices: (id: string) => ["network-integrations", id, "devices"] as const,
  clients: (id: string) => ["network-integrations", id, "clients"] as const,
  events: (id: string) => ["network-integrations", id, "events"] as const,
};

/** Every error this page shows a human goes through here. `AppError.code` is
 * the backend's normalized code for a domain failure, so a known code gets
 * our own actionable sentence; anything else falls back to the backend's
 * already-human-safe message, then to a generic line. A raw code, a stack
 * trace or a controller response body never reaches the screen. */
function errorText(err: unknown, fallback?: string): string {
  const e = err as AppError | undefined;
  const upper = e?.code ? e.code.toUpperCase() : null;
  const described = describeIntegrationError(upper, e?.message);
  // `describeIntegrationError`'s own generic line is right for an unknown
  // controller fault, but a caller with a better sentence for its specific
  // action ("Could not start a sync") should win over it.
  const generic = describeIntegrationError(null, null);
  return described === generic && fallback ? fallback : described;
}

const TONE_BADGE: Record<NetworkIntegrationStatusTone, string> = {
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  info: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  neutral: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
};

/** Same outline-pill-with-a-dot shape as `RouterStatusBadge`, so a status on
 * this page reads as the same kind of thing as a status anywhere else in the
 * console. The seven states and their words come from
 * `types/network-integration.ts`; an unrecognised value renders as a neutral
 * "Unknown" rather than an empty pill. */
function IntegrationStatusBadge({ status }: { status: NetworkIntegrationStatus }) {
  const label = NETWORK_INTEGRATION_STATUS_LABEL[status] ?? "Unknown";
  const tone = NETWORK_INTEGRATION_STATUS_TONE[status] ?? "neutral";
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", TONE_BADGE[tone])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Coarse on purpose: "3h 12m" answers the only question anyone asks of an
 * AP's uptime or a guest's session length. Seconds-level precision on a
 * figure that was already stale when the controller reported it would be
 * false precision. */
function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${Math.floor(seconds)}s`;
}

const DEVICE_TYPE_LABEL: Record<string, string> = {
  ap: "Access point",
  switch: "Switch",
  gateway: "Gateway",
  unknown: "Unknown",
};

const DEVICE_STATUS_TONE: Record<string, NetworkIntegrationStatusTone> = {
  connected: "success",
  disconnected: "danger",
  pending: "warning",
  unknown: "neutral",
};

/**
 * The state a device or client table renders in when the integration is
 * connected with hotspot operator credentials (CR-002).
 *
 * Not an empty table, and not an error banner. An empty table here reads as
 * "you have no access points", which is false and generates a support
 * ticket; an error banner reads as "something is broken", which is also
 * false. This is a capability the operator API does not have, so the honest
 * rendering is an explanation plus the one action that changes it.
 *
 * The `onFix` route matters as much as the words. A dead end that says
 * "requires Open API credentials" and offers nothing leaves the reader to
 * work out that the fix lives behind a button labelled "Replace
 * credentials" three cards up the page.
 */
function LegacyInventoryPanel({ onFix }: { onFix: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
        <KeyRound className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{LEGACY_INVENTORY_TITLE}</h3>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">{LEGACY_INVENTORY_BODY}</p>
      <Button className="mt-5" variant="outline" onClick={onFix}>
        <KeyRound className="mr-1.5 h-4 w-4" />
        Replace credentials
      </Button>
    </div>
  );
}

/** A dash, not a zero. A count we do not have is not a count of nothing —
 * the same rule `CustomerLocationSummary.routerHealth` documents for
 * "0% health on a venue whose routers failed to load". */
function num(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

function text(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

// ---------------------------------------------------------------------------
// The page.
// ---------------------------------------------------------------------------

export function NetworkIntegrationsPage({ locationId }: { locationId?: string }) {
  const demo = useIsDemo();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: keys.list,
    queryFn: () => networkIntegrationService.list(),
    // The demo workspace has no backend session, so this would 401. It also
    // has no Omada controller, and inventing fixture APs here would put
    // fabricated hardware in front of a prospect — this product has already
    // shipped a screen whose numbers were all fixtures once. The demo gets an
    // honest "not available here" panel instead.
    enabled: !demo,
    staleTime: 15_000,
    retry: 1,
  });

  /** Integrations relevant to the venue being viewed.
   *
   * A row with no `locationId` is included deliberately: that is exactly the
   * half-configured state the wizard can leave behind, and hiding it would
   * make it unreachable — the customer would keep creating new ones against
   * the same controller and hit the backend's partial-unique constraint. */
  const rows = useMemo(() => {
    const all = list.data?.rows ?? [];
    if (!locationId) return all;
    return all.filter((r) => r.locationId === locationId || r.locationId === null);
  }, [list.data, locationId]);

  /** The rows that exist, look plausible, and authorise nobody.
   *
   * Raised to the top of the page rather than left to be noticed on
   * whichever row happens to be selected. An owner with three venues lands
   * on the first one; if the second is the dead one, the only signal used to
   * be an amber badge on a chip they had not clicked. */
  const halfConfigured = useMemo(() => halfConfiguredIntegrations(rows), [rows]);

  // Keep the selection valid across refetches without an effect that fights
  // the user: only fall back to the first row when the current selection is
  // genuinely gone.
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  function refreshAll(id?: string) {
    qc.invalidateQueries({ queryKey: keys.list });
    if (id) {
      qc.invalidateQueries({ queryKey: keys.devices(id) });
      qc.invalidateQueries({ queryKey: keys.clients(id) });
      qc.invalidateQueries({ queryKey: keys.events(id) });
    }
  }

  const header = (
    <SectionHeader
      icon={Plug}
      eyebrow="Network"
      title="Network Integrations"
      description="Connect the TP-Link Omada controller that already runs this venue's WiFi, so guests who finish the sign-in flow are let onto its access points."
      actions={
        !demo && (
          <Button
            onClick={() => {
              setResumeId(null);
              setWizardOpen(true);
            }}
          >
            <Plug className="mr-1.5 h-4 w-4" /> Add integration
          </Button>
        )
      }
    />
  );

  if (demo) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Info}
          title="Not available in the demo workspace"
          description="Connecting a controller needs a real Omada box and real credentials, so there is nothing honest to show here. Sign in to a live account to set one up."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {list.isLoading && <LoadingSkeleton rows={5} />}

      {list.isError && (
        <ErrorState
          title="Could not load network integrations"
          description={errorText(
            list.error,
            "The list could not be loaded. Try again in a moment.",
          )}
          onRetry={() => list.refetch()}
        />
      )}

      {!list.isLoading && !list.isError && rows.length === 0 && (
        <EmptyState
          icon={Plug}
          title="No controller connected"
          description="This venue's guest WiFi is not being enforced by an Omada controller yet. Connecting one takes the controller's address and either an Open API app or a hotspot operator account."
          action={{
            label: "Add integration",
            onClick: () => {
              setResumeId(null);
              setWizardOpen(true);
            },
          }}
        />
      )}

      {/* THE LOUD ONE. A half-configured integration is not a settings nit:
          the guest completes the whole sign-in journey -- code delivered,
          code accepted, "you're connected" -- and then has no internet,
          which the venue reads as this platform being broken. It gets a
          destructive banner above everything, naming the venue and what is
          missing, with the button that fixes it. */}
      {halfConfigured.length > 0 && (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          {halfConfigured.map((r) => {
            const setup = deriveIntegrationSetup(r);
            return (
              <div key={r.id} className="flex flex-wrap items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-foreground">{setup.title}</p>
                  <p className="text-sm text-muted-foreground">{setup.summary}</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {setup.gaps.map((g) => (
                      <li key={g.key}>
                        <span className="font-medium text-foreground">{g.label}</span> — {g.detail}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* No wizard for a credential-only gap (none stored, or an
                    Open API app with no operator account): it resumes at the
                    site step and cannot re-ask for a secret nothing can read
                    back. That row is sent to the integration's own Replace
                    credentials action instead, which `setup.nextStep` says. */}
                {setup.gaps.some((g) => !CREDENTIAL_GAP_KEYS.includes(g.key)) ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedId(r.id);
                      setResumeId(r.id);
                      setWizardOpen(true);
                    }}
                  >
                    Finish setup
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(r.id)}>
                    Open integration
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                r.id === selected?.id
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Server className="h-4 w-4" />
              <span className="font-medium">{r.name}</span>
              <IntegrationStatusBadge status={r.status} />
              {/* So the chip for the dead venue is distinguishable from the
                  chips for the working ones without clicking it. */}
              {deriveIntegrationSetup(r).isHalfConfigured && (
                <Badge
                  variant="outline"
                  className="rounded-full bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                >
                  Authorising nobody
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <IntegrationDetail
          integration={selected}
          onChanged={() => refreshAll(selected.id)}
          onFinishSetup={() => {
            setResumeId(selected.id);
            setWizardOpen(true);
          }}
        />
      )}

      {/* Mounted only while open, and therefore initialised from props
          exactly once per opening.
          The alternative -- always mounted, with a `useEffect` that resets
          the draft when `open` flips -- looks equivalent and is not: the
          `resumeIntegration` object is a fresh identity on every refetch of
          the list, so that effect re-ran and reset the wizard's step and
          selections underneath a customer who was halfway through it, every
          time the 15s-stale list query refreshed. Mounting per opening makes
          "initialise once" a property of the component's lifetime instead of
          something a dependency array has to get right. */}
      {wizardOpen && (
        <ConnectWizard
          resumeIntegration={resumeId ? (rows.find((r) => r.id === resumeId) ?? null) : null}
          defaultLocationId={locationId}
          onClose={(createdId) => {
            setWizardOpen(false);
            setResumeId(null);
            if (createdId) setSelectedId(createdId);
            refreshAll(createdId ?? undefined);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connected view.
// ---------------------------------------------------------------------------

function IntegrationDetail({
  integration,
  onChanged,
  onFinishSetup,
}: {
  integration: NetworkIntegration;
  onChanged: () => void;
  onFinishSetup: () => void;
}) {
  const [tab, setTab] = useState("devices");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const id = integration.id;
  /** CR-002: a hotspot operator credential cannot read sites, devices or
   * clients at all. The backend answers those endpoints with a normalized
   * error rather than an empty list, and the gateway refuses to even issue
   * the call — so the request is not made here either. Asking for something
   * whose answer we already know, purely to render its failure, would turn a
   * documented capability limit into a red error banner. */
  const inventoryAvailable = authModeSupportsInventory(integration.authMode);

  // Each list is fetched when its tab is opened, not on mount. The counts in
  // the tiles come from the integration row itself, which the sync task keeps
  // current, so first paint costs one request rather than four — and three of
  // those four go all the way out to the controller.
  const devices = useQuery({
    queryKey: keys.devices(id),
    queryFn: () => networkIntegrationService.listDevices(id),
    enabled: tab === "devices" && inventoryAvailable,
    staleTime: 30_000,
    retry: 1,
  });
  const clients = useQuery({
    queryKey: keys.clients(id),
    queryFn: () => networkIntegrationService.listClients(id),
    enabled: tab === "clients" && inventoryAvailable,
    staleTime: 30_000,
    retry: 1,
  });
  const events = useQuery({
    queryKey: keys.events(id),
    queryFn: () => networkIntegrationService.listEvents(id, { page: 1, pageSize: 25 }),
    enabled: tab === "activity",
    staleTime: 30_000,
    retry: 1,
  });

  const test = useMutation({
    mutationFn: () => networkIntegrationService.testConnection(id),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          result.controllerVersion
            ? `Controller answered — Omada ${result.controllerVersion}`
            : "Controller answered.",
        );
      } else {
        toast.error(describeIntegrationError(result.errorCode, result.message));
      }
      onChanged();
    },
    onError: (err) =>
      toast.error(errorText(err, "The connection test could not be completed. Try again.")),
  });

  const sync = useMutation({
    mutationFn: () => networkIntegrationService.sync(id),
    onSuccess: () => {
      toast.success("Sync finished — device and client lists refreshed.");
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "Could not start a sync. Try again.")),
  });

  const remove = useMutation({
    mutationFn: () => networkIntegrationService.remove(id),
    onSuccess: () => {
      // Not a cheerful message. Disconnecting stops guest authorisation at
      // this venue, and the toast says so rather than congratulating the
      // person who just turned it off.
      toast.warning("Disconnected — guest logins are no longer sent to this controller.");
      setDisconnectOpen(false);
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "Could not disconnect. Nothing was changed.")),
  });

  const busy = test.isPending || sync.isPending || remove.isPending;
  const errored = isNetworkIntegrationErrored(integration.status);
  /* Derived from the fields, not from `status`. A row still reading
     `connecting` with no site mapped is exactly as dead as an
     `unconfigured` one, and its status sentence -- "waiting on the
     controller's first successful reply, this usually takes seconds" --
     is a reassuring thing to say about a venue where nobody can get
     online. See src/lib/network-integration-readiness.ts. */
  const setup = deriveIntegrationSetup(integration);
  /* The wizard resumes at the site step; it cannot re-ask for a credential
     (nothing can read one back), so a row whose only gaps are credential
     ones -- none stored, or an Open API app with no operator account -- is
     sent to Replace credentials instead of to a wizard that would show it
     five filled-in steps and change nothing. */
  const needsSetup = setup.gaps.some((g) => !CREDENTIAL_GAP_KEYS.includes(g.key));

  return (
    <div className="space-y-4">
      <Card className="premium-card">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
              <Server className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="truncate">{integration.name}</span>
                <IntegrationStatusBadge status={integration.status} />
                {!integration.isEnabled && integration.status !== "disabled" && (
                  <Badge variant="outline" className="rounded-full">
                    Switched off
                  </Badge>
                )}
              </CardTitle>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {NETWORK_INTEGRATION_STATUS_DETAIL[integration.status] ??
                  "This integration is in a state this version of the dashboard does not recognise. Nothing is assumed about it."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needsSetup && (
              <Button size="sm" onClick={onFinishSetup}>
                Finish setup
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => test.mutate()}
              title="Asks our servers to sign in to the controller with the stored credentials. Nothing is sent from this browser."
            >
              {test.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-4 w-4" />
              )}
              Test connection
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => sync.mutate()}>
              {sync.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Sync now
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setCredentialsOpen(true)}
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              Replace credentials
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setTrustOpen(true)}>
              <Lock className="mr-1.5 h-4 w-4" />
              Certificate &amp; Omada ID
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setDisconnectOpen(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Says what is missing and what its absence costs, item by item.
              The status sentence above cannot do this job: it is one
              sentence for a state that has up to four separate causes, each
              with its own fix. */}
          {setup.isHalfConfigured && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold text-foreground">{setup.title}</p>
                  <p className="text-muted-foreground">{setup.summary}</p>
                </div>
              </div>
              <ul className="ml-6 space-y-0.5 text-muted-foreground">
                {setup.gaps.map((g) => (
                  <li key={g.key}>
                    <span className="font-medium text-foreground">{g.label}</span> — {g.detail}
                  </li>
                ))}
              </ul>
              <p className="ml-6 text-muted-foreground">{setup.nextStep}</p>
            </div>
          )}

          {/* The last error is shown whether or not the current status is an
              error one: a sync that failed at 03:00 and recovered at 03:05
              still explains why a chart has a hole in it. When the status is
              *currently* bad the banner is red; when it has recovered it is
              a muted note, because a red banner over a working integration
              trains people to ignore red banners. */}
          {integration.lastErrorCode && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                errored
                  ? "border-destructive/30 bg-destructive/5 text-foreground"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <AlertTriangle
                className={cn("mt-0.5 h-4 w-4 shrink-0", errored ? "text-destructive" : "")}
              />
              <div>
                <p>
                  {describeIntegrationError(
                    integration.lastErrorCode,
                    integration.lastErrorMessage,
                  )}
                </p>
                {integration.lastErrorAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {errored ? "Since" : "Last seen"} {relativeTime(integration.lastErrorAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CR-002 again, and this is the half that is easy to miss: with
              operator credentials nothing ever populates these two counts, so
              the backend's `0` is "we cannot look", not "there are none". A
              zero here would be a fabricated measurement of the same kind
              `CustomerLocationSummary.routerHealth` documents, so it renders
              as a dash with the reason attached. `Active guest sessions` is
              NOT gated: that number is the platform's own record of
              authorisations it issued, and it is real in both modes. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Access points & devices"
              value={inventoryAvailable ? integration.deviceCount : "—"}
              icon={RadioTower}
              hint={
                inventoryAvailable
                  ? "Reported by the controller at the last sync"
                  : "Needs Open API credentials"
              }
            />
            <StatCard
              label="Connected clients"
              value={inventoryAvailable ? integration.clientCount : "—"}
              icon={Wifi}
              tone="info"
              hint={
                inventoryAvailable
                  ? "Everything on the controller's networks, guests included"
                  : "Needs Open API credentials"
              }
            />
            <StatCard
              label="Active guest sessions"
              value={integration.activeAuthorizationCount}
              icon={Users}
              tone="success"
              hint="Guests this platform has authorised and whose access has not expired"
            />
            <StatCard
              label="Last synced"
              value={integration.lastSyncAt ? relativeTime(integration.lastSyncAt) : "Never"}
              icon={RefreshCw}
              tone={integration.lastSyncStatus === "error" ? "warning" : "default"}
              hint={
                integration.lastSyncStatus === "never"
                  ? "No successful sync yet"
                  : integration.lastSyncStatus === "error"
                    ? "The last attempt failed"
                    : `Every ${formatDuration(integration.syncIntervalSeconds)}`
              }
            />
          </div>

          <div className="grid gap-x-8 gap-y-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Controller address" value={integration.baseUrl} mono />
            <Detail
              label="Sign-in method"
              value={CONTROLLER_AUTH_MODE_LABEL[integration.authMode]}
              hint={inventoryAvailable ? undefined : "Guest sign-in only — see the tabs below"}
            />
            <Detail
              label="Controller software"
              value={integration.controllerVersion ? `Omada ${integration.controllerVersion}` : "—"}
            />
            <Detail label="Controller ID" value={text(integration.controllerId)} mono />
            <Detail
              label="Certificate check"
              value={CONTROLLER_TLS_MODE_LABEL[integration.tlsMode] ?? integration.tlsMode}
              hint={
                integration.tlsMode === "pinned" && integration.tlsPinnedSha256
                  ? `SHA-256 ${integration.tlsPinnedSha256}`
                  : undefined
              }
            />
            <Detail label="Omada site" value={text(integration.externalSiteName)} />
            <Detail
              label="Wyfy Guest venue"
              value={text(integration.locationName)}
              hint={integration.locationId ? undefined : "Not mapped to a venue yet"}
            />
            <Detail label="Guest network (SSID)" value={text(integration.guestSsidName)} />
            <Detail
              label="Guest session length"
              value={formatDuration(integration.sessionDurationSeconds)}
            />
            <Detail
              label="Credentials"
              value={integration.hasCredentials ? "On file" : "Not set"}
              hint={
                integration.hasCredentials
                  ? "Stored encrypted server-side and never shown again — use Replace credentials to change them"
                  : "This integration cannot connect until credentials are added"
              }
            />
          </div>

          <PortalLinkPanel
            integration={integration}
            onChanged={onChanged}
            onAddOperatorAccount={() => setCredentialsOpen(true)}
          />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="devices">Access points</TabsTrigger>
          <TabsTrigger value="clients">Connected clients</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          {inventoryAvailable ? (
            <DevicesTable
              rows={devices.data ?? []}
              loading={devices.isLoading}
              error={devices.isError ? errorText(devices.error) : null}
              onRetry={() => devices.refetch()}
            />
          ) : (
            <LegacyInventoryPanel onFix={() => setCredentialsOpen(true)} />
          )}
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          {inventoryAvailable ? (
            <ClientsTable
              rows={clients.data ?? []}
              loading={clients.isLoading}
              error={clients.isError ? errorText(clients.error) : null}
              onRetry={() => clients.refetch()}
              activeAuthorizations={integration.activeAuthorizationCount}
            />
          ) : (
            <LegacyInventoryPanel onFix={() => setCredentialsOpen(true)} />
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-sm">Recent controller activity</CardTitle>
              <p className="text-xs text-muted-foreground">
                Syncs, connection tests and guest authorisations recorded by the platform. Messages
                are redacted server-side before they are written.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {events.isLoading ? (
                <div className="p-4">
                  <LoadingSkeleton rows={4} />
                </div>
              ) : events.isError ? (
                <div className="p-4">
                  <ErrorState
                    title="Could not load activity"
                    description={errorText(events.error)}
                    onRetry={() => events.refetch()}
                  />
                </div>
              ) : (events.data?.rows.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Info}
                  title="Nothing recorded yet"
                  description="Syncs, tests and guest authorisations will appear here as they happen."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wide">When</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Event</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Result</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(events.data?.rows ?? []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {relativeTime(e.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {e.eventType.replace(/[_-]+/g, " ")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full font-medium",
                              e.errorCode || e.status === "error"
                                ? TONE_BADGE.danger
                                : TONE_BADGE.success,
                            )}
                          >
                            {e.errorCode || e.status === "error" ? "Failed" : "OK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">
                          {/* A known code gets our own sentence; an event with
                              neither a code nor a message shows a dash rather
                              than an empty cell pretending to be a reason. */}
                          {e.errorCode || e.message
                            ? describeIntegrationError(e.errorCode, e.message)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        destructive
        title={`Disconnect "${integration.name}"?`}
        // THE CONFIRMATION STATES THE CONSEQUENCE, in the words a venue owner
        // needs rather than the words the operation uses — same rule
        // master.nas.tsx applies to a secret rotation. This is not "remove a
        // configuration": from the moment it returns, guests who finish the
        // sign-in flow are no longer let onto the WiFi.
        description={`Guest logins at ${integration.locationName || "this venue"} will stop being sent to the controller straight away, so guests who finish signing in will not get online. The stored credentials are deleted and will have to be entered again to reconnect. Guests already online are not kicked off.`}
        confirmLabel={remove.isPending ? "Disconnecting…" : "Disconnect"}
        onConfirm={() => remove.mutate()}
      />

      {/* Mounted only while open, same reasoning as the wizard: a dialog that
          holds a draft secret in state should not exist while it is closed. */}
      {credentialsOpen && (
        <CredentialsDialog
          integration={integration}
          onClose={(changed) => {
            setCredentialsOpen(false);
            if (changed) onChanged();
          }}
        />
      )}
      {trustOpen && (
        <TrustSettingsDialog
          integration={integration}
          onClose={(changed) => {
            setTrustOpen(false);
            if (changed) onChanged();
          }}
        />
      )}
    </div>
  );
}

/**
 * The Omada portal link, and whether it will actually let a guest on.
 *
 * ## Why this screen exists at all
 *
 * An Omada controller's captive portal redirects guests to a URL its
 * operator types into the controller by hand. Nothing in this platform
 * generates that configuration (unlike the MikroTik path, where the
 * override page is written onto the device by the provisioning script), so
 * this block is the ONLY way an operator can learn the URL for their venue.
 * Without it the whole guest flow has no entry point.
 *
 * ## Two fields, not one string
 *
 * The controller takes the scheme and the host+path+query in SEPARATE
 * inputs, and its own `serverUrl` validation pattern REJECTS a value that
 * contains a scheme. Handing over one `https://…` string would produce the
 * single most likely paste error, so the two values are rendered and copied
 * separately, with the joined form offered only as something to open in a
 * browser to check. Both come straight off the API -- the shape is decided
 * once, server-side, in `validators.build_external_portal_url`, which is
 * also where the pattern is checked against TP-Link's published regex.
 *
 * ## It is the same URL a MikroTik venue's router already serves
 *
 * Same `/portal` route, same three ids. The controller appends its own
 * parameters to the configured query string with `&` (observed on hardware,
 * 2026-09-11), so an Omada guest lands on exactly the captive portal a
 * MikroTik guest lands on. There is no second entry point, and nothing
 * about this page's URL is Omada-shaped except `netProvider`.
 *
 * ## The link is shown, and it is not a secret
 *
 * It sits in every guest's address bar at this venue within minutes of
 * being pasted. Rendering it is the point. It is deliberately NOT treated
 * like `hasCredentials` two fields up, which is the opposite kind of value
 * and may never be shown.
 *
 * ## And there is no link at all when there could not be one
 *
 * The backend withholds both halves together whenever the integration has
 * no mapped location or no fleet device -- there is no `locationId` or
 * `routerId` to put in the URL, and `guest_sessions.router_id` is NOT NULL,
 * so a guest arriving at a partial link would complete OTP and fail at
 * session creation. Handing an operator something to paste that turns every
 * guest away is exactly the "writes a row, changes nothing on a device"
 * failure CONTRACT §11.5 names. `portalReadinessGaps` supplies the reason.
 *
 * `FLEET_DEVICE_MISSING` used to be the one an operator could not fix: only
 * Wyfy's own onboarding registered a controller as a device. The backend
 * now does it the moment the integration is mapped to a venue, and an
 * integration created before that gets a Register controller button here.
 *
 * `GUEST_OPERATOR_MISSING` is an Open API app with no hotspot operator
 * account -- the one setup that synced green and let nobody online.
 */
const PORTAL_READINESS_GAP_COPY: Record<string, string> = {
  credentials_missing: "no controller credentials have been saved yet",
  guest_operator_missing:
    "it has an Open API app but no hotspot operator account, and the controller only lets guests online through that account",
  location_not_mapped: "it is not mapped to one of your venues yet",
  site_not_selected: "no Omada site has been selected yet",
  fleet_device_missing: "this controller has not been registered as this venue's device yet",
};

function CopyableValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground">
          {value}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            // Best-effort: `navigator.clipboard` is unavailable on an
            // insecure origin and rejects when the document is not focused.
            // The value is on screen and selectable either way, so a failed
            // copy is an inconvenience rather than a dead end — and saying
            // "Copied" when nothing was copied is the thing worth avoiding.
            navigator.clipboard
              ?.writeText(value)
              .then(() => toast.success(`${label} copied`))
              .catch(() =>
                toast.error(
                  `Could not copy — select the ${label.toLowerCase()} and copy it manually.`,
                ),
              );
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PortalLinkPanel({
  integration,
  onChanged,
  onAddOperatorAccount,
}: {
  integration: NetworkIntegration;
  onChanged: () => void;
  onAddOperatorAccount: () => void;
}) {
  // `?? []` even though the type says it is always an array. A backend that
  // has not shipped the field yet would otherwise throw here, and this panel
  // sits inside the integration detail card, so a throw white-screens the
  // whole page over a value that is advisory.
  const gaps = integration.portalReadinessGaps ?? [];
  const scheme = integration.portalUrlScheme;
  const hostAndQuery = integration.portalUrlHostAndQuery;

  // The repair for an integration created before the backend registered the
  // controller as its venue's device on its own. Offered only once a venue
  // is mapped: without one there is nowhere to register it, and the backend
  // would refuse with NETWORK_INTEGRATION_LOCATION_REQUIRED anyway.
  const canRegister = gaps.includes("fleet_device_missing") && !!integration.locationId;
  const register = useMutation({
    mutationFn: () => networkIntegrationService.ensureFleetDevice(integration.id),
    onSuccess: () => {
      toast.success("Controller registered for this venue.");
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "Could not register the controller.")),
  });

  // The backend withholds the URL as a pair whenever the integration could
  // not serve a guest, so the presence of a link IS the readiness check --
  // there is no state where this renders a copyable URL beside a warning
  // that it will not work. `gaps` only supplies the reason.
  if (!scheme || !hostAndQuery) {
    return (
      <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Guests cannot sign in at this venue yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {gaps.length > 0
                ? `There is no guest sign-in link to give the controller because ${gaps
                    .map((g) => PORTAL_READINESS_GAP_COPY[g] ?? g)
                    .join(", and ")}.`
                : "No guest sign-in link is available for this integration yet. Contact support."}
            </p>
            {(canRegister || gaps.includes("guest_operator_missing")) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {gaps.includes("guest_operator_missing") && (
                  <Button size="sm" variant="outline" onClick={onAddOperatorAccount}>
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                    Add operator account
                  </Button>
                )}
                {canRegister && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={register.isPending}
                    onClick={() => register.mutate()}
                  >
                    {register.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Server className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Register controller
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // The host on its own, for the pre-authentication access entry below.
  // Taken off the URL the server built rather than re-derived, so the host
  // an operator is told to permit is by construction the host their guests
  // are actually sent to. Those two drifting apart is a walled garden that
  // lets nobody in.
  const host = hostAndQuery.split("/")[0];

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">Omada portal configuration</p>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Two things to set on the controller. Guests cannot sign in until <strong>both</strong> are
        done, and skipping the second produces the failure that is hardest to spot: everything looks
        configured and the sign-in page simply never loads.
      </p>

      {/* ---- Step 1 ---------------------------------------------------- */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground">
        1. External Portal Server
      </p>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Site View &rarr; Network Config &rarr; Authentication &rarr; Portal &rarr; your portal
        &rarr; Authentication Type <strong>External Portal Server</strong> &rarr; Host Type{" "}
        <strong>URL</strong>. These are two separate fields on that form.
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <CopyableValue label="Scheme" value={scheme} />
        <CopyableValue
          label="URL"
          value={hostAndQuery}
          // The controller's own `serverUrl` pattern rejects a value
          // containing a scheme, so this is the mistake worth pre-empting in
          // the copy rather than leaving the operator to decode a validation
          // error on a screen we cannot see.
          hint={`Without ${scheme}:// — the controller rejects it if the scheme is included here.`}
        />
      </div>

      {/* ---- Step 2 ----------------------------------------------------
          Measured on real hardware, 2026-09-11, from an associated but
          unauthorized client: DNS resolves, TCP 443 connects (the AP
          accepts it in order to intercept), and then EVERY HTTPS request
          times out — including to our own portal host. Omada does not
          auto-permit the external portal server it is itself redirecting
          to. So the chain is: AP's redirect works, the controller's 302
          works, and the guest's browser then hangs for 20 seconds on a URL
          that is completely correct. There is nothing in the controller's
          UI that reports this, which is why it is step 2 and not a
          footnote. With the entry applied the same request returns 200 in
          ~80 ms. */}
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-foreground">
        2. Pre-Authentication Access
      </p>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Settings &rarr; Authentication &rarr; Portal &rarr; Access Control &rarr;{" "}
        <strong>Pre-Authentication Access</strong>. Turn it on and add one entry of type{" "}
        <strong>URL</strong> for the host below. Without it a guest&rsquo;s browser reaches the
        sign-in page over HTTPS and the request simply times out — the redirect is correct and the
        page never appears.
      </p>
      <div className="mt-2">
        <CopyableValue label="Pre-authentication URL" value={host} />
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Two more things worth knowing before you test it
        </summary>
        {/* Both observed on real hardware, 2026-09-11, and neither is in
            TP-Link's documentation. Each one on its own produces a guest
            who never reaches the portal, so they belong next to the fields
            rather than in a runbook nobody opens. */}
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>
            The guest&rsquo;s phone is sent to <strong>your controller</strong> first, not to us —
            the access point answers with a redirect to the controller&rsquo;s own portal page on{" "}
            <strong>port 8088</strong> (8843 with HTTPS Redirect enabled). Guest devices must be
            able to reach the controller on that port, or the sign-in page never appears at all.
          </li>
          <li>
            A URL entry permits the <strong>address</strong> the name resolves to, not the name.
            Today that means the single entry above also covers the API the sign-in page calls,
            because both names point at the same address — so one entry is enough. That is a fact
            about today&rsquo;s DNS, not a rule: if those names are ever moved apart, this entry
            stops being sufficient and the page will load and then hang instead. It also means the
            entry permits anything else sharing that address.
          </li>
        </ul>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Full link, for opening in a browser to check it works
        </summary>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
          {`${scheme}://${hostAndQuery}`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Do not paste this into the controller — it is the two fields above joined together, and
          the controller will not accept it.
        </p>
      </details>
    </div>
  );
}

function Detail({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 break-words text-sm text-foreground", mono && "font-mono text-xs")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TableFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function DevicesTable({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: NetworkIntegrationDevice[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <TableFrame
      title="Controller hardware"
      description="Read live from the controller. This platform does not manage these devices — it only reports what the controller says about them."
    >
      {loading ? (
        <div className="p-4">
          <LoadingSkeleton rows={4} />
        </div>
      ) : error ? (
        <div className="p-4">
          <ErrorState title="Could not load devices" description={error} onRetry={onRetry} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RadioTower}
          title="No devices reported"
          description="The controller did not return any devices for the selected site."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Device</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Type</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">IP</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Firmware</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Uptime</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Clients</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.mac}>
                <TableCell>
                  <div className="text-sm font-medium">{d.name || d.model || "Unnamed"}</div>
                  <div className="font-mono text-xs text-muted-foreground">{d.mac}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {DEVICE_TYPE_LABEL[d.deviceType] ?? "Unknown"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full font-medium capitalize",
                      TONE_BADGE[DEVICE_STATUS_TONE[d.status] ?? "neutral"],
                    )}
                  >
                    {d.status || "unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{text(d.ipAddress)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {text(d.firmwareVersion)}
                </TableCell>
                <TableCell className="text-sm">{formatDuration(d.uptimeSeconds)}</TableCell>
                <TableCell className="text-sm">{num(d.clientCount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableFrame>
  );
}

function ClientsTable({
  rows,
  loading,
  error,
  onRetry,
  activeAuthorizations,
}: {
  rows: NetworkIntegrationClient[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  activeAuthorizations: number;
}) {
  // Derived from the rows on screen, and labelled as such. `isGuest` and
  // `isAuthorized` are both nullable on the wire — a controller that does not
  // report them must not be counted as a "no", so the tiles below count
  // explicit `true`s only and the hints say what the number is a count of.
  const guests = rows.filter((c) => c.isGuest === true).length;
  const authorized = rows.filter((c) => c.isAuthorized === true).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="On the guest network"
          value={guests}
          icon={Users}
          tone="info"
          hint="Clients the controller flags as guests, in the list below"
        />
        <StatCard
          label="Authorised by the controller"
          value={authorized}
          icon={CheckCircle2}
          tone="success"
          hint="Clients the controller currently considers signed in"
        />
        <StatCard
          label="Active platform authorisations"
          value={activeAuthorizations}
          icon={ShieldCheck}
          hint="Guests this platform authorised, counted server-side — not derived from the list below"
        />
      </div>

      {/* NO PER-GUEST DISCONNECT CONTROL HERE, AND THERE MUST NOT BE ONE.
          CR-001 (`/Users/shresth/wyfy-omada/CHANGE-REQUESTS.md`): TP-Link
          publishes no client-deauthorization endpoint in any generation of
          the Omada API. The adapter keeps the signature and always raises
          `OMADA_API_UNSUPPORTED`; Open API's `clients/{mac}/block` was
          deliberately not repurposed, because a blocklist is materially more
          punitive and longer-lived than ending a portal session, and it is
          keyed on a MAC that phones rotate per SSID.
          So a "Disconnect guest" button here would be a control with no
          operation behind it -- it could only ever report a success it did
          not achieve, or fail. Guest access ends when its authorisation
          expires, and the table says so out loud rather than leaving someone
          hunting for the button. */}
      <TableFrame
        title="Connected clients"
        description="Read live from the controller. A client can be connected without being authorised — that is the state a guest is in before they finish signing in. Guest access ends on its own when the session length runs out: Omada offers no way to sign a guest out early, so there is no button for it here."
      >
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState title="Could not load clients" description={error} onRetry={onRetry} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="Nobody connected"
            description="The controller is not reporting any connected clients for the selected site right now."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wide">Client</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Network</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Access point</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Authorised</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Online for</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Down / up</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.mac}>
                  <TableCell>
                    <div className="text-sm font-medium">{c.name || "Unnamed device"}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.mac}</div>
                    {c.ipAddress && (
                      <div className="font-mono text-xs text-muted-foreground">{c.ipAddress}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{text(c.ssid)}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.isGuest === true ? "Guest" : c.isGuest === false ? "Staff" : "Unknown"}
                      {c.vlanId !== null ? ` · VLAN ${c.vlanId}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{text(c.apMac)}</TableCell>
                  <TableCell>
                    {c.isAuthorized === null ? (
                      // The controller did not say. "Unknown" is the honest
                      // answer; rendering it as "No" would accuse a working
                      // guest session of being broken.
                      <span className="text-xs text-muted-foreground">Unknown</span>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full font-medium",
                          c.isAuthorized ? TONE_BADGE.success : TONE_BADGE.neutral,
                        )}
                      >
                        {c.isAuthorized ? "Yes" : "Not yet"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDuration(c.durationSeconds)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatBytes(c.trafficDownBytes)} / {formatBytes(c.trafficUpBytes)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.signalDbm === null ? (
                      "—"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Signal className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.signalDbm} dBm
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableFrame>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credential rotation.
// ---------------------------------------------------------------------------

/** Replace-only. There is no "current credentials" field to show, because the
 * API will not return one and this dialog would have nowhere honest to get it
 * from. The auth mode can change here too: a venue that upgrades its
 * controller to 5.13 can move from an operator account to an Open API app
 * without deleting and re-adding the integration. */
function CredentialsDialog({
  integration,
  onClose,
}: {
  integration: NetworkIntegration;
  onClose: (changed: boolean) => void;
}) {
  const [authMode, setAuthMode] = useState<ControllerAuthMode>(integration.authMode);
  const [creds, setCreds] = useState<NetworkIntegrationCredentials>({});

  const save = useMutation({
    mutationFn: () => networkIntegrationService.replaceCredentials(integration.id, authMode, creds),
    onSuccess: () => {
      toast.success("Credentials replaced. The next check will use them.");
      // Cleared the moment the request settles, so a draft secret does not
      // sit in component state behind a closed dialog.
      setCreds({});
      onClose(true);
    },
    onError: (err) =>
      toast.error(errorText(err, "Could not save the credentials. Nothing was changed.")),
  });

  const complete = credentialsCompleteForMode(authMode, creds);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          setCreds({});
          onClose(false);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace controller credentials</DialogTitle>
          <DialogDescription>
            The credentials on file are never shown again — they can only be replaced. The new ones
            are sent to our servers, encrypted there, and used from there. They are not stored in
            this browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <AuthModeField value={authMode} onChange={setAuthMode} />
          <CredentialFields authMode={authMode} value={creds} onChange={setCreds} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button disabled={!complete || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Replace credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuthModeField({
  value,
  onChange,
}: {
  value: ControllerAuthMode;
  onChange: (v: ControllerAuthMode) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>How should we sign in to the controller?</Label>
      {/* THE TRADE-OFF IS STATED HERE, NOT DISCOVERED LATER. CR-002: an
          operator credential cannot read sites, access points or clients, so
          picking it silently costs the customer the device and client screens
          and turns the site/SSID pickers into fields they have to type by
          hand. The two capability summaries come from
          `types/network-integration.ts` so this radio, the tables' empty
          state and the KPI hints all describe the same limitation in the same
          words. */}
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ControllerAuthMode)}
        className="gap-2"
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <RadioGroupItem value="openapi" className="mt-0.5" />
          <span>
            <span className="font-medium">
              {CONTROLLER_AUTH_MODE_LABEL.openapi}
              <span className="ml-2 font-normal text-primary">Recommended</span>
            </span>
            <span className="block text-xs text-muted-foreground">
              A client ID and client secret from the controller's Settings → Platform Integration →
              Open API screen — a purpose-made integration credential, not a login.
            </span>
            <span className="mt-1 block text-xs text-foreground">
              {CONTROLLER_AUTH_MODE_SUMMARY.openapi}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <RadioGroupItem value="legacy" className="mt-0.5" />
          <span>
            <span className="font-medium">{CONTROLLER_AUTH_MODE_LABEL.legacy}</span>
            <span className="block text-xs text-muted-foreground">
              The operator name and password the controller's own external-portal API uses.
            </span>
            <span className="mt-1 block text-xs text-foreground">
              {CONTROLLER_AUTH_MODE_SUMMARY.legacy}
            </span>
          </span>
        </label>
      </RadioGroup>
    </div>
  );
}

/**
 * The credential inputs for the selected mode.
 *
 * `autoComplete="off"` and `type="password"` on the secret halves: not
 * security theatre, but the difference between a hotel manager's browser
 * offering to save a controller secret into a shared machine's password
 * manager and it not doing that. The draft lives in the parent's `useState`
 * and is dropped when the dialog closes.
 */
function CredentialFields({
  authMode,
  value,
  onChange,
}: {
  authMode: ControllerAuthMode;
  value: NetworkIntegrationCredentials;
  onChange: (next: NetworkIntegrationCredentials) => void;
}) {
  const operatorFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="omada-operator">Operator name</Label>
        <Input
          id="omada-operator"
          autoComplete="off"
          value={value.username ?? ""}
          onChange={(e) => onChange({ ...value, username: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="omada-operator-password">Operator password</Label>
        <Input
          id="omada-operator-password"
          type="password"
          autoComplete="new-password"
          value={value.password ?? ""}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
        />
      </div>
    </div>
  );
  if (authMode !== "openapi") return operatorFields;
  // Open API: the app pair, AND the operator account. The second half is not
  // optional in this form even though the API accepts an app on its own --
  // the controller only lets guests online through the operator login, so an
  // app-only integration is a venue where nobody gets on.
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="omada-client-id">Client ID</Label>
          <Input
            id="omada-client-id"
            autoComplete="off"
            value={value.clientId ?? ""}
            onChange={(e) => onChange({ ...value, clientId: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="omada-client-secret">Client secret</Label>
          <Input
            id="omada-client-secret"
            type="password"
            autoComplete="new-password"
            value={value.clientSecret ?? ""}
            onChange={(e) => onChange({ ...value, clientSecret: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Hotspot operator account</p>
          <p className="text-xs text-muted-foreground">{GUEST_OPERATOR_REQUIRED_NOTE}</p>
        </div>
        {operatorFields}
      </div>
    </div>
  );
}

/**
 * Certificate trust and the Omada ID -- the three settings a self-hosted or
 * a TP-Link cloud controller cannot connect without, and which used to exist
 * on the API only.
 *
 * Controlled: the parent owns the draft so the wizard can send it with the
 * pre-save probe (a self-signed controller cannot pass a strict one) and the
 * settings dialog can send it with a PATCH. `observedFingerprint` is the
 * certificate the last test actually saw; offering it as a one-click pin is
 * what keeps "turn checking off" from being the path of least resistance.
 */
function TrustFields({
  controllerId,
  tlsMode,
  pin,
  observedFingerprint,
  onChange,
}: {
  controllerId: string;
  tlsMode: ControllerTlsMode;
  pin: string;
  observedFingerprint: string | null;
  onChange: (next: { controllerId: string; tlsMode: ControllerTlsMode; pin: string }) => void;
}) {
  const pinValid = normalizeTlsFingerprint(pin) !== null;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="omada-controller-id">Omada ID (TP-Link cloud controllers)</Label>
        <Input
          id="omada-controller-id"
          autoComplete="off"
          placeholder="Leave blank for a controller you reach directly"
          value={controllerId}
          onChange={(e) => onChange({ controllerId: e.target.value, tlsMode, pin })}
        />
        <p className="text-xs text-muted-foreground">
          One TP-Link cloud address serves every controller in a region, so a cloud controller
          cannot be found without it. It is on the controller&rsquo;s API credentials screen and in
          its web address. Any other controller reports it on its own.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Certificate check</Label>
        <RadioGroup
          value={tlsMode}
          onValueChange={(v) => onChange({ controllerId, tlsMode: v as ControllerTlsMode, pin })}
          className="gap-2"
        >
          {(["strict", "pinned", "insecure"] as const).map((mode) => (
            <label
              key={mode}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <RadioGroupItem value={mode} className="mt-0.5" />
              <span>
                <span className="font-medium">{CONTROLLER_TLS_MODE_LABEL[mode]}</span>
                <span className="block text-xs text-muted-foreground">
                  {CONTROLLER_TLS_MODE_SUMMARY[mode]}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>
      {tlsMode === "pinned" && (
        <div className="space-y-1.5">
          <Label htmlFor="omada-tls-pin">Certificate fingerprint (SHA-256)</Label>
          <Input
            id="omada-tls-pin"
            autoComplete="off"
            className="font-mono text-xs"
            placeholder="AB:CD:EF:… — 64 hexadecimal characters"
            value={pin}
            onChange={(e) => onChange({ controllerId, tlsMode, pin: e.target.value })}
          />
          {pin && !pinValid && (
            <p className="text-xs text-destructive">
              That is not a SHA-256 fingerprint — it needs 64 hexadecimal characters. Colons and
              spaces are fine.
            </p>
          )}
          {observedFingerprint && normalizeTlsFingerprint(pin) !== observedFingerprint && (
            <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
              <p className="text-muted-foreground">
                The controller presented this certificate on the last test. Confirm it with whoever
                runs the controller before trusting it.
              </p>
              <p className="mt-1 break-all font-mono text-foreground">{observedFingerprint}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => onChange({ controllerId, tlsMode, pin: observedFingerprint })}
              >
                Use this fingerprint
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Whether a trust draft can be sent: pinned needs a real fingerprint, the
 * other two need nothing. Mirrors the backend's `validate_tls_trust`, so the
 * form refuses what the API would refuse instead of round-tripping for a
 * NETWORK_INTEGRATION_TLS_PIN_REQUIRED. */
function trustDraftValid(tlsMode: ControllerTlsMode, pin: string): boolean {
  return tlsMode !== "pinned" || normalizeTlsFingerprint(pin) !== null;
}

/** Certificate trust and the Omada ID for an integration that already
 * exists. Test connection here uses the stored credentials and returns the
 * certificate the controller is really presenting, on failure as well as
 * success -- which is how an operator gets a fingerprint to pin without a
 * terminal. */
function TrustSettingsDialog({
  integration,
  onClose,
}: {
  integration: NetworkIntegration;
  onClose: (changed: boolean) => void;
}) {
  const [draft, setDraft] = useState({
    controllerId: integration.controllerId ?? "",
    tlsMode: integration.tlsMode,
    pin: integration.tlsPinnedSha256 ?? "",
  });
  const [observed, setObserved] = useState<string | null>(null);

  const probe = useMutation({
    mutationFn: () => networkIntegrationService.testConnection(integration.id),
    onSuccess: (result) => {
      setObserved(result.tlsFingerprintSha256);
      if (result.ok) toast.success("The controller answered.");
      else toast.error(describeIntegrationError(result.errorCode, result.message));
    },
    onError: (err) => toast.error(errorText(err, "The connection test could not be completed.")),
  });

  const save = useMutation({
    mutationFn: () =>
      networkIntegrationService.update(integration.id, {
        // An Omada ID can be set or changed here but not cleared: nothing
        // could rediscover a cloud controller's, and the API ignores null.
        ...(draft.controllerId.trim() ? { controllerId: draft.controllerId.trim() } : {}),
        tlsMode: draft.tlsMode,
        ...(draft.tlsMode === "pinned" ? { tlsPinnedSha256: draft.pin } : {}),
      }),
    onSuccess: () => {
      toast.success("Saved. The next check will use it.");
      onClose(true);
    },
    onError: (err) => toast.error(errorText(err, "Could not save. Nothing was changed.")),
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Certificate &amp; Omada ID</DialogTitle>
          <DialogDescription>
            How we trust this controller&rsquo;s HTTPS certificate, and which controller a TP-Link
            cloud address means. Changing either sets the integration back to
            &ldquo;Connecting&rdquo; until the next check succeeds.
          </DialogDescription>
        </DialogHeader>
        <TrustFields
          controllerId={draft.controllerId}
          tlsMode={draft.tlsMode}
          pin={draft.pin}
          observedFingerprint={observed}
          onChange={setDraft}
        />
        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={probe.isPending}
            onClick={() => probe.mutate()}
            title="Signs in with the stored credentials and reports the certificate the controller presented."
          >
            {probe.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Test connection
          </Button>
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button
            disabled={!trustDraftValid(draft.tlsMode, draft.pin) || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// The connect wizard.
// ---------------------------------------------------------------------------

/** The step list depends on the auth mode, because two of the five steps are
 * a different job in each: with Open API credentials the site and SSID are
 * picked from the controller, and with operator credentials they are typed
 * in (CR-002). The side rail says which, so the step's own description is not
 * quietly wrong for half of all integrations. */
function wizardSteps(authMode: ControllerAuthMode): StepperItem[] {
  const listable = authModeSupportsInventory(authMode);
  return [
    { key: "provider", title: "Controller type", description: "Which system runs this WiFi" },
    {
      key: "controller",
      title: "Address & sign-in",
      description: "Where it is, and how we get in",
    },
    {
      key: "site",
      title: "Omada site",
      description: listable ? "Pick a site from the controller" : "Type the site name",
    },
    { key: "venue", title: "Wyfy Guest venue", description: "Which venue it belongs to" },
    {
      key: "ssid",
      title: "Guest network",
      description: listable ? "Pick the SSID guests join" : "Type the SSID guests join",
    },
  ];
}

function ConnectWizard({
  resumeIntegration,
  defaultLocationId,
  onClose,
}: {
  /** A row the customer is coming back to finish -- one that
   * `deriveIntegrationSetup` reports as half-configured, which is usually
   * but not always the `unconfigured` status (see that module).
   * When present the wizard opens on the site step — the controller and
   * credentials are already stored and must not be re-asked, and there is no
   * way to re-ask for a credential we cannot read back anyway. */
  resumeIntegration: NetworkIntegration | null;
  defaultLocationId?: string;
  onClose: (createdId: string | null) => void;
}) {
  const locations = useCustomerLocations();
  // Initialised from props once, at mount. See the mount-per-opening note at
  // the call site for why this is not an effect.
  const [step, setStep] = useState(resumeIntegration ? 2 : 0);
  const [name, setName] = useState(resumeIntegration?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(resumeIntegration?.baseUrl ?? "");
  const [authMode, setAuthMode] = useState<ControllerAuthMode>(
    resumeIntegration?.authMode ?? "openapi",
  );
  const [creds, setCreds] = useState<NetworkIntegrationCredentials>({});
  // Certificate trust and the Omada ID. Sent with the pre-save probe as well
  // as the create: a self-signed controller cannot pass a strict test, so a
  // wizard that only applied trust after saving could never get that far.
  const [trust, setTrust] = useState<{
    controllerId: string;
    tlsMode: ControllerTlsMode;
    pin: string;
  }>({ controllerId: "", tlsMode: "strict", pin: "" });
  const [trustOpen, setTrustOpen] = useState(false);
  const [observedFingerprint, setObservedFingerprint] = useState<string | null>(null);
  const [tested, setTested] = useState<{
    version: string | null;
    controllerId: string | null;
  } | null>(
    resumeIntegration
      ? {
          version: resumeIntegration.controllerVersion,
          controllerId: resumeIntegration.controllerId,
        }
      : null,
  );
  const [integrationId, setIntegrationId] = useState<string | null>(resumeIntegration?.id ?? null);
  const [siteId, setSiteId] = useState<string>(resumeIntegration?.externalSiteId ?? "");
  const [siteName, setSiteName] = useState<string>(resumeIntegration?.externalSiteName ?? "");
  const [venueId, setVenueId] = useState<string>(
    resumeIntegration?.locationId ?? defaultLocationId ?? "",
  );
  const [ssidName, setSsidName] = useState<string>(resumeIntegration?.guestSsidName ?? "");
  const [ssidId, setSsidId] = useState<string | null>(resumeIntegration?.guestSsidId ?? null);

  /** CR-002: with operator credentials there is nothing to list, so the
   * picker steps become typed fields and these two reads are never issued.
   * A picker that can never populate is worse than a text box — it looks
   * like a loading bug. */
  const canListInventory = authModeSupportsInventory(authMode);

  const sites = useQuery({
    queryKey: keys.sites(integrationId ?? "none"),
    queryFn: () => networkIntegrationService.listSites(integrationId!),
    enabled: step === 2 && !!integrationId && canListInventory,
    staleTime: 30_000,
    retry: 1,
  });

  const ssids = useQuery({
    queryKey: keys.ssids(integrationId ?? "none"),
    queryFn: () => networkIntegrationService.listSsids(integrationId!),
    enabled: step === 4 && !!integrationId && canListInventory,
    staleTime: 30_000,
    retry: 1,
  });

  const test = useMutation({
    mutationFn: () =>
      networkIntegrationService.testDraftConnection({
        provider: "omada",
        baseUrl: baseUrl.trim(),
        authMode,
        credentials: creds,
        controllerId: trust.controllerId,
        tlsMode: trust.tlsMode,
        tlsPinnedSha256: trust.tlsMode === "pinned" ? trust.pin : null,
      }),
    onSuccess: (result) => {
      // Kept on failure too: an untrusted-certificate answer carries the
      // fingerprint the operator is being asked to trust.
      setObservedFingerprint(result.tlsFingerprintSha256);
      if (!result.ok) {
        setTested(null);
        if (
          result.errorCode === "OMADA_TLS_UNTRUSTED" ||
          result.errorCode === "OMADA_TLS_PIN_MISMATCH"
        ) {
          setTrustOpen(true);
        }
        toast.error(describeIntegrationError(result.errorCode, result.message));
        return;
      }
      setTested({ version: result.controllerVersion, controllerId: result.controllerId });
      toast.success(
        result.controllerVersion
          ? `Connected — Omada ${result.controllerVersion}`
          : "Connected to the controller.",
      );
    },
    onError: (err) => {
      setTested(null);
      toast.error(errorText(err, "Could not connect to that controller."));
    },
  });

  const create = useMutation({
    mutationFn: () =>
      networkIntegrationService.create({
        provider: "omada",
        name: name.trim() || "Omada controller",
        baseUrl: baseUrl.trim(),
        authMode,
        credentials: creds,
        controllerId: trust.controllerId,
        tlsMode: trust.tlsMode,
        tlsPinnedSha256: trust.tlsMode === "pinned" ? trust.pin : null,
        // No venue yet, on purpose. Mapping a venue is what registers the
        // controller as that venue's device, and the venue step below is
        // where the operator actually chooses it -- saving the page's
        // default here would register the device at whichever venue the page
        // was opened on, before the operator had picked one. An unmapped row
        // is still listed on every venue's page, so it cannot be lost.
        locationId: null,
      }),
    onSuccess: (created) => {
      setIntegrationId(created.id);
      // The draft secret has served its purpose and is dropped here rather
      // than at the end of the wizard, so it is not sitting in memory through
      // three more steps of site/venue/SSID picking.
      setCreds({});
      setStep(2);
    },
    onError: (err) => toast.error(errorText(err, "Could not save the integration.")),
  });

  const saveSiteAndVenue = useMutation({
    mutationFn: () =>
      networkIntegrationService.update(integrationId!, {
        externalSiteId: siteId,
        externalSiteName: siteName || siteId,
        locationId: venueId || null,
      }),
    onSuccess: () => setStep(4),
    onError: (err) => toast.error(errorText(err, "Could not save the site mapping.")),
  });

  const finish = useMutation({
    mutationFn: () =>
      networkIntegrationService.update(integrationId!, {
        guestSsidId: ssidId,
        guestSsidName: ssidName,
      }),
    onSuccess: (saved) => {
      // Only claim enforcement when the backend agrees there is nothing left
      // standing between this venue and its first guest.
      if ((saved.portalReadinessGaps ?? []).length === 0) {
        toast.success("Controller connected. Guest logins will be enforced on it from now on.");
      } else {
        toast.warning(
          "Saved — but guests cannot sign in yet. The integration page lists what is still missing.",
        );
      }
      onClose(integrationId);
    },
    onError: (err) => toast.error(errorText(err, "Could not save the guest network.")),
  });

  function handleClose() {
    // An abandoned wizard that already created a row is not a failure state
    // to hide: the row is real, resumable, and shows as "Setup incomplete".
    // Say so, so the customer knows where to pick it up.
    if (integrationId && step < 4) {
      toast.info("Saved as setup incomplete — reopen it from this page to finish.");
    }
    setCreds({});
    onClose(integrationId);
  }

  const busy = test.isPending || create.isPending || saveSiteAndVenue.isPending || finish.isPending;

  const credsComplete =
    credentialsCompleteForMode(authMode, creds) && trustDraftValid(trust.tlsMode, trust.pin);

  return (
    <Dialog open onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Connect a network controller</DialogTitle>
          <DialogDescription>
            Our servers do the talking — this browser never connects to your controller, and the
            credentials you enter are stored encrypted and never shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <Stepper
              steps={wizardSteps(authMode)}
              currentStep={step}
              allowBackwardNavigation={false}
            />
          </div>

          <div className="min-w-0 space-y-4">
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Which system runs this venue's WiFi?
                </p>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex w-full items-start gap-3 rounded-lg border border-primary bg-primary/5 p-4 text-left"
                >
                  <Server className="mt-0.5 h-5 w-5 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">TP-Link Omada</span>
                    <span className="block text-xs text-muted-foreground">
                      Omada software or hardware controller, version 5.0.15 or newer.
                    </span>
                  </span>
                </button>
                <p className="text-xs text-muted-foreground">
                  Other controller types are not supported yet. Nothing about this page assumes
                  Omada beyond this choice — the rest of the platform treats it as one provider
                  among others.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="omada-name">Name</Label>
                  <Input
                    id="omada-name"
                    placeholder="Lobby controller"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only for your own reference on this page.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="omada-url">Controller address</Label>
                  <Input
                    id="omada-url"
                    placeholder="https://controller.example.com:8043"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      // Any edit invalidates the previous test result. A
                      // "Connected" tick left over from a different URL is
                      // worse than no tick.
                      setTested(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be an HTTPS address reachable from the internet. Software controllers are
                    usually on port 8043; hardware controllers on 443.
                  </p>
                </div>
                <AuthModeField
                  value={authMode}
                  onChange={(v) => {
                    setAuthMode(v);
                    setTested(null);
                  }}
                />
                <CredentialFields
                  authMode={authMode}
                  value={creds}
                  onChange={(next) => {
                    setCreds(next);
                    setTested(null);
                  }}
                />

                {/* Collapsed by default: a controller with a public certificate
                    reached directly needs none of it. Opened for the operator
                    when a test comes back with a certificate error, because
                    that is the moment they need it. */}
                <details
                  open={trustOpen}
                  onToggle={(e) => setTrustOpen((e.target as HTMLDetailsElement).open)}
                  className="rounded-lg border border-border p-3"
                >
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    Certificate &amp; Omada ID
                    <span className="ml-2 font-normal text-muted-foreground">
                      self-hosted or TP-Link cloud controllers
                    </span>
                  </summary>
                  <div className="mt-3">
                    <TrustFields
                      controllerId={trust.controllerId}
                      tlsMode={trust.tlsMode}
                      pin={trust.pin}
                      observedFingerprint={observedFingerprint}
                      onChange={(next) => {
                        setTrust(next);
                        setTested(null);
                      }}
                    />
                  </div>
                </details>

                {tested && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-medium text-foreground">The controller let us in.</p>
                      <p className="text-xs text-muted-foreground">
                        {tested.version ? `Omada ${tested.version}` : "Version not reported"}
                        {tested.controllerId ? ` · controller ${tested.controllerId}` : ""}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    disabled={!baseUrl.trim() || !credsComplete || busy}
                    onClick={() => test.mutate()}
                  >
                    {test.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Test connection
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Nothing is saved until this succeeds.
                  </p>
                </div>
              </div>
            )}

            {/* CR-002: the site name cannot be looked up in legacy mode, so
                it is typed in — and the field says exactly where to find the
                right value, because getting it wrong is not obvious until a
                guest fails to get online. Omada puts the site on its own
                portal redirect as the `site` query parameter, which is the
                authoritative spelling: it is the string the authorize call
                will be made with. */}
            {step === 2 && !canListInventory && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Type the Omada site name</p>
                  <p className="text-xs text-muted-foreground">
                    A hotspot operator account cannot list sites, so this one has to be entered by
                    hand. Guest sign-in still works normally.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="omada-site-name">Site</Label>
                  <Input
                    id="omada-site-name"
                    placeholder="Default"
                    value={siteName}
                    onChange={(e) => {
                      setSiteName(e.target.value);
                      // In legacy mode the name IS the identifier -- it is
                      // what Omada's own redirect carries and what the
                      // authorize call sends back. Kept in both fields rather
                      // than inventing an id we do not have.
                      setSiteId(e.target.value.trim());
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match the site exactly as Omada spells it. The reliable way to check: open
                    your guest WiFi on a phone, and read the <code>site=</code> value out of the
                    address bar when the sign-in page appears. Most single-site controllers use{" "}
                    <code>Default</code>.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && canListInventory && (
              <StepList
                title="Which site on the controller covers this venue?"
                description="Omada groups devices into sites. Pick the one whose access points serve your guests."
                loading={sites.isLoading}
                error={sites.isError ? errorText(sites.error) : null}
                onRetry={() => sites.refetch()}
                emptyTitle="No sites returned"
                emptyDescription="The controller did not list any sites for these credentials. Check that the account has access to at least one site."
                items={(sites.data ?? []).map((s) => ({
                  id: s.siteId,
                  title: s.name,
                  subtitle: `${num(s.deviceCount)} devices · ${num(s.clientCount)} clients`,
                }))}
                selectedId={siteId}
                onSelect={(id, title) => {
                  setSiteId(id);
                  setSiteName(title);
                }}
              />
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Which Wyfy Guest venue is this controller for? Guest sessions issued at that venue
                  are the ones this controller will be asked to authorise.
                </p>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a venue…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locations.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                        {l.city ? ` — ${l.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {locations.isLoading && (
                  <p className="text-xs text-muted-foreground">Loading your venues…</p>
                )}
                {!locations.isLoading && (locations.data ?? []).length === 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    No venues are visible to this account, so there is nothing to map to. Add a
                    venue first.
                  </p>
                )}
              </div>
            )}

            {/* Same for the guest SSID: not listable in legacy mode, and the
                value has to match what Omada puts on the redirect
                (`ssidName`), because that is what the authorize call replays
                back to the controller. */}
            {step === 4 && !canListInventory && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Type the guest network name</p>
                  <p className="text-xs text-muted-foreground">
                    A hotspot operator account cannot list wireless networks either, so this is
                    entered by hand too.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="omada-ssid-name">Guest SSID</Label>
                  <Input
                    id="omada-ssid-name"
                    placeholder="Hotel Guest"
                    value={ssidName}
                    onChange={(e) => {
                      setSsidName(e.target.value);
                      // No id exists to store here, and the contract already
                      // allows `guest_ssid_id: null`. Sending the name in an
                      // id field would be a lie the backend would have to
                      // unpick later.
                      setSsidId(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match the SSID exactly as Omada spells it — the <code>ssidName=</code>{" "}
                    value on the same sign-in URL you read the site from.
                  </p>
                </div>
              </div>
            )}

            {step === 4 && canListInventory && (
              <StepList
                title="Which SSID do guests join?"
                description="This is the wireless network the portal sign-in applies to."
                loading={ssids.isLoading}
                error={ssids.isError ? errorText(ssids.error) : null}
                onRetry={() => ssids.refetch()}
                emptyTitle="No networks returned"
                emptyDescription="The controller did not list any SSIDs for the selected site."
                items={(ssids.data ?? []).map((s) => ({
                  id: s.ssidId ?? s.name,
                  title: s.name,
                  subtitle:
                    s.portalEnabled === true
                      ? "Portal enabled on the controller"
                      : s.portalEnabled === false
                        ? "No portal configured on the controller yet"
                        : "The controller did not say whether a portal is configured",
                }))}
                selectedId={ssidId ?? ssidName}
                onSelect={(id, title) => {
                  // The contract allows a null `ssid_id` — some controllers
                  // identify an SSID by name only. Store the id when there is
                  // one and fall back to the name, rather than sending the
                  // name in an id field.
                  setSsidId(id === title ? null : id);
                  setSsidName(title);
                }}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            {integrationId && step < 4 ? "Finish later" : "Cancel"}
          </Button>
          {step === 1 && (
            <Button disabled={!tested || busy} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          )}
          {step === 2 && (
            <Button disabled={!siteId || busy} onClick={() => setStep(3)}>
              Continue
            </Button>
          )}
          {step === 3 && (
            <Button disabled={!venueId || busy} onClick={() => saveSiteAndVenue.mutate()}>
              {saveSiteAndVenue.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          )}
          {step === 4 && (
            <Button disabled={!ssidName || busy} onClick={() => finish.mutate()}>
              {finish.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The site and SSID steps are the same shape — a live list from the
 * controller, with loading / error / empty states that each say something
 * different and true. Shared so those three states cannot drift apart
 * between the two steps. */
function StepList({
  title,
  description,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  items: { id: string; title: string; subtitle: string }[];
  selectedId: string;
  onSelect: (id: string, title: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorState
          title="Could not read from the controller"
          description={error}
          onRetry={onRetry}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={Info} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id, item.title)}
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                item.id === selectedId
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.subtitle}</span>
              </span>
              {item.id === selectedId && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NetworkIntegrationsPage;
