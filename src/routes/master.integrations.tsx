import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Plug,
  Power,
  PowerOff,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";

import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  M_INPUT,
} from "@/components/master/MasterKit";
import { relativeTime } from "@/lib/friendly";
import {
  deriveIntegrationSetup,
  halfConfiguredIntegrations,
} from "@/lib/network-integration-readiness";
import type { AppError } from "@/services/api";
import { networkIntegrationService } from "@/services/network-integration.service";
import { organizationService } from "@/services/organization.service";
import {
  authModeSupportsInventory,
  CONTROLLER_AUTH_MODE_LABEL,
  describeIntegrationError,
  NETWORK_INTEGRATION_STATUS_DETAIL,
  NETWORK_INTEGRATION_STATUS_LABEL,
  NETWORK_INTEGRATION_STATUS_TONE,
  type NetworkIntegration,
  type NetworkIntegrationStatus,
  type NetworkIntegrationStatusTone,
} from "@/types/network-integration";

/**
 * `/master/integrations` — every customer's own network controller, in one
 * cross-tenant table.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE CUSTOMER PAGE
 * ------------------------------------------------
 * The customer's own screen answers "is my WiFi working?". This one answers
 * a support question: "which venues are broken right now, and why?". Those
 * need different data (every tenant, not one) and different verbs (an
 * operator can disable an integration that is hammering a controller; a
 * customer cannot be expected to diagnose that). So this reads the
 * `platform/*` routes, which are `ScopeType.GLOBAL`.
 *
 * AN OMADA INTEGRATION HANGS OFF A LOCATION, NOT A ROUTER
 * -------------------------------------------------------
 * MikroTik and Omada are parallel deployments, not one mixed topology: an
 * Omada venue has no MikroTik router in the path. So this table is keyed on
 * customer + location and deliberately offers no link into Router Fleet, no
 * router-health column and no NAS/RADIUS reference -- on an Omada venue those
 * do not exist, and an operator following one during an incident would be
 * chasing hardware that was never there. `Router Fleet` next door remains the
 * place for the MikroTik estate. (The `master.nas.tsx` mention below is a
 * pointer to the wording of a destructive confirmation, not to a NAS.)
 *
 * THE UNSCOPED READ IS THE POINT HERE, AND ONLY HERE
 * --------------------------------------------------
 * `network-integration.service.ts`'s `platform*` methods deliberately send no
 * `X-Organization-Id`. On the backend a GLOBAL caller resolves
 * `CurrentOrganization = None`, and `None` means "no org filter" downstream —
 * which has produced a real cross-tenant leak in this codebase before, and is
 * why CONTRACT.md §3 asks for the unscoped read to be explicit and
 * intentional on the platform routes and an error everywhere else. This page
 * is the one surface where spanning every tenant is the requirement; the
 * customer page next door must never do it, and does not.
 *
 * NO SECOND ANALYTICS STACK
 * -------------------------
 * Tiles are `MStat`, the table is `MTable`/`MTr`/`MTd`, the detail view is
 * `MDrawer` — the same MasterKit primitives the other sixteen `/master/*`
 * routes use. Nothing here charts anything: the numbers on this page are
 * counts the backend already computes, and a sparkline over a count we poll
 * every few minutes would be decoration pretending to be a trend.
 */
/**
 * `?q=` exists so that the fleet drawer can *link* here rather than tell an
 * operator to come and find the row themselves. A controller in Router Fleet
 * has almost nothing true to say about itself (contract §11.5) and its whole
 * honest answer is "the integration knows" — a pointer that lands on the
 * unfiltered list of every tenant's controllers is a weaker version of that
 * sentence. Optional, and the page behaves exactly as before without it.
 */
const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/master/integrations")({
  validateSearch: searchSchema,
  component: PlatformIntegrationsScreen,
});

const PAGE_SIZE = 25;

/** Cache keys. The filter values are part of the key because they are part of
 * the *request* — these filters are applied server-side (CONTRACT.md §3), so
 * a key that ignored them would serve one filter's answer for another's. That
 * is the opposite failure from the customer page, where the org id is a header
 * and has no business in a key. Both follow the same rule: the key describes
 * the request and nothing else. */
const keys = {
  summary: ["master", "network-integrations", "summary"] as const,
  list: (f: {
    organizationId?: string;
    status?: string;
    provider?: string;
    q?: string;
    page: number;
  }) =>
    [
      "master",
      "network-integrations",
      "list",
      f.organizationId ?? null,
      f.status ?? null,
      f.provider ?? null,
      f.q ?? null,
      f.page,
    ] as const,
  events: (id: string) => ["master", "network-integrations", id, "events"] as const,
  organizations: ["master", "network-integrations", "organizations"] as const,
};

/** MasterKit's `MTag` takes its own tone vocabulary (the `TAG_STYLES` table in
 * MasterKit.tsx). Mapping through the semantic tone from
 * `types/network-integration.ts` rather than hardcoding tag names here is
 * what keeps this console and the customer console from painting the same
 * status two different colours. */
const TAG_TONE: Record<NetworkIntegrationStatusTone, string> = {
  success: "active",
  warning: "warning",
  danger: "offline",
  neutral: "normal",
  info: "info",
};

function StatusTag({ status }: { status: NetworkIntegrationStatus }) {
  const tone = NETWORK_INTEGRATION_STATUS_TONE[status] ?? "neutral";
  return (
    <MTag label={NETWORK_INTEGRATION_STATUS_LABEL[status] ?? "Unknown"} tone={TAG_TONE[tone]} />
  );
}

function errorText(err: unknown, fallback: string): string {
  const e = err as AppError | undefined;
  const described = describeIntegrationError(e?.code ? e.code.toUpperCase() : null, e?.message);
  return described === describeIntegrationError(null, null) ? fallback : described;
}

const STATUS_OPTIONS: { value: "" | NetworkIntegrationStatus; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "connected", label: NETWORK_INTEGRATION_STATUS_LABEL.connected },
  { value: "connecting", label: NETWORK_INTEGRATION_STATUS_LABEL.connecting },
  { value: "auth_failed", label: NETWORK_INTEGRATION_STATUS_LABEL.auth_failed },
  { value: "connection_failed", label: NETWORK_INTEGRATION_STATUS_LABEL.connection_failed },
  { value: "sync_error", label: NETWORK_INTEGRATION_STATUS_LABEL.sync_error },
  { value: "unconfigured", label: NETWORK_INTEGRATION_STATUS_LABEL.unconfigured },
  { value: "disabled", label: NETWORK_INTEGRATION_STATUS_LABEL.disabled },
];

function PlatformIntegrationsScreen() {
  const qc = useQueryClient();
  const { q: initialQ } = Route.useSearch();
  // Seeded from the URL, then owned by the input. Deliberately NOT synced
  // back from `initialQ` on every render: that would fight an operator who
  // edits the box, which is the failure mode a `useEffect` mirror always has.
  const [search, setSearch] = useState(initialQ ?? "");
  const [q, setQ] = useState(initialQ ?? "");
  const [status, setStatus] = useState<"" | NetworkIntegrationStatus>("");
  const [organizationId, setOrganizationId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounced, because this filter is applied server-side: keying the query
  // directly on `search` would issue one cross-tenant request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(
    () => ({
      organizationId: organizationId || undefined,
      status: status || undefined,
      q: q || undefined,
      page,
    }),
    [organizationId, status, q, page],
  );

  const summary = useQuery({
    queryKey: keys.summary,
    queryFn: () => networkIntegrationService.getPlatformSummary(),
    staleTime: 30_000,
    retry: 1,
  });

  const list = useQuery({
    queryKey: keys.list(filters),
    queryFn: () =>
      networkIntegrationService.listPlatformIntegrations({
        organizationId: filters.organizationId,
        status: filters.status,
        q: filters.q,
        page: filters.page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 15_000,
    retry: 1,
  });

  /** The tenant picker's options come from the real organization list, not
   * from the customer names on the current page of results. Deriving them
   * from the rows would silently limit the filter to whoever happened to be
   * in the first 25, which is a filter that looks complete and is not. */
  const organizations = useQuery({
    queryKey: keys.organizations,
    queryFn: () => organizationService.list({ page: 1, pageSize: 100 }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const rows = list.data?.rows ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["master", "network-integrations"] });
  }

  return (
    <MasterShell title="Network Integrations">
      <MPageShell>
        <MSectionHeader
          eyebrow="Infrastructure"
          title="Network Integrations"
          description="Customer-owned network controllers this platform authorises guests through. Read-only apart from the enable/disable switch and a connectivity probe."
          actions={
            <MButton variant="outline" onClick={refresh} disabled={list.isFetching}>
              {list.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </MButton>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat
            label="Tenants connected"
            value={summary.data?.tenantCount ?? 0}
            icon={Building2}
            loading={summary.isLoading}
          />
          <MStat
            label="Integrations"
            value={summary.data?.integrationCount ?? 0}
            icon={Plug}
            loading={summary.isLoading}
          />
          <MStat
            label="Connected"
            value={summary.data?.connectedCount ?? 0}
            icon={CheckCircle2}
            tone="success"
            loading={summary.isLoading}
          />
          <MStat
            label="Needs attention"
            value={summary.data?.errorCount ?? 0}
            icon={AlertTriangle}
            // Toned by what the number IS, not by a fixed colour: a zero
            // error count painted red trains operators to ignore red.
            tone={(summary.data?.errorCount ?? 0) > 0 ? "danger" : "default"}
            accent={(summary.data?.errorCount ?? 0) > 0}
            loading={summary.isLoading}
          />
          <MStat
            label="Switched off"
            value={summary.data?.disabledCount ?? 0}
            icon={PowerOff}
            loading={summary.isLoading}
          />
          <MStat
            label="Controller devices"
            value={summary.data?.deviceCount ?? 0}
            icon={RadioTower}
            loading={summary.isLoading}
          />
          <MStat
            label="Clients seen"
            value={summary.data?.clientCount ?? 0}
            icon={Wifi}
            tone="info"
            loading={summary.isLoading}
          />
          <MStat
            label="Active guest sessions"
            value={summary.data?.activeAuthorizationCount ?? 0}
            icon={Users}
            tone="success"
            delta={
              summary.data?.lastSyncAt
                ? `Fleet last synced ${relativeTime(summary.data.lastSyncAt)}`
                : "No sync recorded yet"
            }
            loading={summary.isLoading}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, venue, controller name or address…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select
            className={`${M_INPUT} w-auto`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | NetworkIntegrationStatus);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={`${M_INPUT} w-auto`}
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any customer</option>
            {(organizations.data?.rows ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {/* Provider is a single-value filter today and rendering a select
              with one option would be a control that cannot do anything. It
              is shown as a static chip instead, so the page still says what
              it is filtered to -- and the service already accepts the
              parameter for the day a second vendor lands. */}
          <MTag label="TP-Link Omada" tone="brand" />
        </div>

        {list.isError ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Could not load integrations</p>
              <p className="text-muted-foreground">
                {errorText(list.error, "The platform list could not be read. Try again.")}
              </p>
              <MButton variant="outline" className="mt-2" onClick={() => list.refetch()}>
                Try again
              </MButton>
            </div>
          </div>
        ) : (
          <>
            {/* An integration in this state looks entirely healthy from a
                distance: a row, a tenant, a controller address, an amber
                status word among six other status words. What is actually
                true is that every guest at that venue finishes signing in
                and gets no internet, and the venue reads that as the
                platform being broken. Counted over THIS PAGE of results
                only, and it says so -- the platform summary has no such
                count, and quietly implying a fleet-wide number from 25 rows
                would be a fabricated measurement. */}
            {!list.isLoading && halfConfiguredIntegrations(rows).length > 0 && (
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium">
                      {halfConfiguredIntegrations(rows).length} of the {rows.length} integrations on
                      this page authorise nobody
                    </p>
                    <p className="text-muted-foreground">
                      Each was connected to its controller and then left unfinished. Guests at these
                      venues can complete the whole sign-in and still have no internet.
                    </p>
                  </div>
                </div>
                <ul className="ml-6 space-y-0.5 text-muted-foreground">
                  {halfConfiguredIntegrations(rows).map((r) => {
                    const setup = deriveIntegrationSetup(r);
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className="text-left underline-offset-2 hover:underline"
                        >
                          <span className="font-medium text-foreground">
                            {r.organizationName || "Unknown customer"} ·{" "}
                            {r.locationName || "no venue"}
                          </span>{" "}
                          — missing {setup.gaps.map((g) => g.label.toLowerCase()).join(", ")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <MTable
              loading={list.isLoading}
              head={
                <>
                  <MTh>Customer</MTh>
                  <MTh>Controller</MTh>
                  <MTh>Status</MTh>
                  <MTh className="hidden lg:table-cell">Devices</MTh>
                  <MTh className="hidden lg:table-cell">Clients</MTh>
                  <MTh className="hidden xl:table-cell">Sessions</MTh>
                  <MTh>Last sync</MTh>
                  <MTh className="hidden xl:table-cell">Last error</MTh>
                </>
              }
            >
              {!list.isLoading &&
                rows.map((r) => (
                  <MTr key={r.id} onClick={() => setSelectedId(r.id)}>
                    <MTd>
                      <div className="font-semibold">{r.organizationName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.locationName || "Not mapped to a venue"}
                      </div>
                    </MTd>
                    <MTd>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.baseUrl}</div>
                    </MTd>
                    <MTd>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusTag status={r.status} />
                        {/* Derived from the site/SSID/venue/credential
                            columns, not from the status word. A row still
                            reading `Connecting` with no site mapped is
                            exactly as dead as an `unconfigured` one, and its
                            status tag says nothing is wrong. */}
                        {deriveIntegrationSetup(r).isHalfConfigured && (
                          <MTag label="Authorising nobody" tone="offline" />
                        )}
                      </div>
                    </MTd>
                    {/* CR-002: an integration on hotspot operator
                        credentials cannot read inventory at all, so its
                        stored counts are permanently 0. Rendering that 0
                        here would read as "this venue has no access
                        points", which is a false statement about a working
                        venue -- and on a cross-tenant table it is the kind
                        of false statement that starts an investigation. */}
                    <MTd className="hidden text-sm lg:table-cell">
                      {authModeSupportsInventory(r.authMode) ? r.deviceCount : "—"}
                    </MTd>
                    <MTd className="hidden text-sm lg:table-cell">
                      {authModeSupportsInventory(r.authMode) ? r.clientCount : "—"}
                    </MTd>
                    <MTd className="hidden text-sm xl:table-cell">{r.activeAuthorizationCount}</MTd>
                    <MTd className="whitespace-nowrap text-xs text-muted-foreground">
                      {r.lastSyncAt ? relativeTime(r.lastSyncAt) : "Never"}
                    </MTd>
                    <MTd className="hidden max-w-xs xl:table-cell">
                      {r.lastErrorCode ? (
                        <span className="text-xs text-muted-foreground">
                          {describeIntegrationError(r.lastErrorCode, r.lastErrorMessage)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </MTd>
                  </MTr>
                ))}
            </MTable>

            {!list.isLoading && rows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {q || status || organizationId
                  ? "No integrations match these filters."
                  : "No customer has connected a network controller yet."}
              </p>
            )}

            {(list.data?.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Page {page} of {list.data?.totalPages ?? 1} · {list.data?.total ?? 0} integrations
                </span>
                <div className="flex gap-2">
                  <MButton
                    variant="outline"
                    disabled={!list.data?.hasPrevious}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </MButton>
                  <MButton
                    variant="outline"
                    disabled={!list.data?.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </MButton>
                </div>
              </div>
            )}
          </>
        )}

        {selected && (
          <IntegrationDrawer
            integration={selected}
            onClose={() => setSelectedId(null)}
            onChanged={refresh}
          />
        )}
      </MPageShell>
    </MasterShell>
  );
}

function IntegrationDrawer({
  integration,
  onClose,
  onChanged,
}: {
  integration: NetworkIntegration;
  onClose: () => void;
  onChanged: () => void;
}) {
  const id = integration.id;

  const events = useQuery({
    queryKey: keys.events(id),
    queryFn: () => networkIntegrationService.listPlatformEvents(id, { page: 1, pageSize: 25 }),
    staleTime: 30_000,
    retry: 1,
  });

  const test = useMutation({
    mutationFn: () => networkIntegrationService.testPlatformConnection(id),
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
    onError: (err) => toast.error(errorText(err, "The probe could not be completed.")),
  });

  const setEnabled = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? networkIntegrationService.enablePlatformIntegration(id)
        : networkIntegrationService.disablePlatformIntegration(id),
    onSuccess: (_data, next) => {
      if (next) toast.success("Integration enabled.");
      // Not a success toast for the off direction. Disabling stops guest
      // authorisation at somebody else's venue, and the wording says whose
      // and what -- same rule master.nas.tsx applies to disabling a NAS.
      else
        toast.warning(
          `Disabled — guest logins at ${integration.locationName || "this venue"} are no longer sent to the controller.`,
        );
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "Could not change this integration.")),
  });

  const busy = test.isPending || setEnabled.isPending;
  const setup = deriveIntegrationSetup(integration);

  return (
    <MDrawer
      open
      onClose={onClose}
      title={integration.name}
      subtitle={`${integration.organizationName || "Unknown customer"} · ${integration.locationName || "no venue mapped"}`}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <MButton variant="outline" disabled={busy} onClick={() => test.mutate()}>
            {test.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Test
            connectivity
          </MButton>
          {integration.isEnabled ? (
            <MButton
              variant="outline"
              disabled={busy}
              onClick={() => {
                // THE CONFIRMATION STATES THE CONSEQUENCE. An operator
                // clicking this is acting on a customer's live venue, so the
                // prompt names the venue and the effect rather than asking
                // "are you sure?".
                if (
                  !window.confirm(
                    `Disable "${integration.name}"?\n\n` +
                      `${integration.locationName || "This venue"}'s guests will stop being authorised ` +
                      `on their controller from the moment this returns, and nothing the guest can see ` +
                      `will say why. Reversible with Enable.`,
                  )
                )
                  return;
                setEnabled.mutate(false);
              }}
            >
              {setEnabled.isPending ? <Loader2 className="animate-spin" /> : <PowerOff />} Disable
            </MButton>
          ) : (
            <MButton variant="primary" disabled={busy} onClick={() => setEnabled.mutate(true)}>
              {setEnabled.isPending ? <Loader2 className="animate-spin" /> : <Power />} Enable
            </MButton>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag status={integration.status} />
            {!integration.isEnabled && integration.status !== "disabled" && (
              <MTag label="Switched off" tone="normal" />
            )}
            {setup.isHalfConfigured && <MTag label="Authorising nobody" tone="offline" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {NETWORK_INTEGRATION_STATUS_DETAIL[integration.status] ??
              "This integration is in a state this console does not recognise, so nothing is assumed about it."}
          </p>
          {/* The status sentence above is one sentence for a state with up
              to four separate causes. This says which, and what each one
              costs the venue -- the operator reading this drawer is usually
              the only person who can tell the customer. */}
          {setup.isHalfConfigured && (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <p className="font-medium">{setup.title}</p>
              <p className="text-muted-foreground">{setup.summary}</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {setup.gaps.map((g) => (
                  <li key={g.key}>
                    <span className="font-medium text-foreground">{g.label}</span> — {g.detail}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Only the customer can finish this: the site and guest network are chosen from their
                own dashboard, under Network → Network Integrations.
              </p>
            </div>
          )}
        </div>

        <DrawerSection title="Controller health">
          <Row label="Address" value={integration.baseUrl} mono />
          <Row
            label="Sign-in mode"
            value={
              authModeSupportsInventory(integration.authMode)
                ? CONTROLLER_AUTH_MODE_LABEL[integration.authMode]
                : `${CONTROLLER_AUTH_MODE_LABEL[integration.authMode]} — portal only`
            }
          />
          <Row
            label="Software"
            value={integration.controllerVersion ? `Omada ${integration.controllerVersion}` : "—"}
          />
          <Row label="Controller ID" value={integration.controllerId || "—"} mono />
          <Row label="Omada site" value={integration.externalSiteName || "—"} />
          <Row label="Guest SSID" value={integration.guestSsidName || "—"} />
          <Row
            label="Credentials"
            value={integration.hasCredentials ? "On file (encrypted server-side)" : "Not set"}
          />
          <Row
            label="Devices / clients"
            value={
              authModeSupportsInventory(integration.authMode)
                ? `${integration.deviceCount} / ${integration.clientCount}`
                : "Not readable with operator credentials"
            }
          />
          <Row label="Active guest sessions" value={String(integration.activeAuthorizationCount)} />
        </DrawerSection>

        <DrawerSection title="Sync">
          <Row
            label="Last sync"
            value={integration.lastSyncAt ? relativeTime(integration.lastSyncAt) : "Never"}
          />
          <Row
            label="Last result"
            value={
              integration.lastSyncStatus === "ok"
                ? "Succeeded"
                : integration.lastSyncStatus === "error"
                  ? "Failed"
                  : "Never run"
            }
          />
          <Row label="Interval" value={`${integration.syncIntervalSeconds}s`} />
          <Row label="Guest session length" value={`${integration.sessionDurationSeconds}s`} />
        </DrawerSection>

        <DrawerSection title="Last error">
          {integration.lastErrorCode ? (
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                {describeIntegrationError(integration.lastErrorCode, integration.lastErrorMessage)}
              </p>
              {integration.lastErrorAt && (
                <p className="text-xs text-muted-foreground">
                  {relativeTime(integration.lastErrorAt)}
                </p>
              )}
              {/* The raw normalized code, and ONLY here. This drawer is
                  operator-only and the code is what an engineer greps the
                  backend logs for; the customer-facing page never shows it,
                  and neither surface ever shows a stack trace or a raw
                  controller response. */}
              <p className="font-mono text-[11px] text-muted-foreground">
                {integration.lastErrorCode}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No error recorded.</p>
          )}
        </DrawerSection>

        <DrawerSection title="Recent events">
          {events.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.isError ? (
            <p className="text-sm text-muted-foreground">
              {errorText(events.error, "The event feed could not be read.")}
            </p>
          ) : (events.data?.rows.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {(events.data?.rows ?? []).map((e) => (
                <li key={e.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize">
                      {e.eventType.replace(/[_-]+/g, " ")}
                    </span>
                    <MTag
                      label={e.errorCode || e.status === "error" ? "Failed" : "OK"}
                      tone={e.errorCode || e.status === "error" ? "offline" : "active"}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.errorCode || e.message
                      ? describeIntegrationError(e.errorCode, e.message)
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {relativeTime(e.createdAt)}
                    {e.errorCode ? ` · ${e.errorCode}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DrawerSection>
      </div>
    </MDrawer>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "break-all text-right font-mono text-xs" : "text-right"}>
        {value}
      </span>
    </div>
  );
}
