import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plug,
  Power,
  PowerOff,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
} from "lucide-react";

import { MasterShell } from "@/components/master/MasterShell";
import { OmadaPortalSetupSteps } from "@/components/network-integrations/OmadaPortalSetupSteps";
import { OmadaSiteMapping } from "@/components/network-integrations/OmadaSiteMapping";
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
  MDialog,
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
  CONTROLLER_CONFIGURE_OUTCOME_LABEL,
  CONTROLLER_CONFIGURE_STEP_LABEL,
  CONTROLLER_SETUP_GAP_COPY,
  CONTROLLER_SETUP_GAP_ORDER,
  credentialsCompleteForMode,
  isControllerSetupGap,
  describeIntegrationError,
  NETWORK_INTEGRATION_STATUS_DETAIL,
  NETWORK_INTEGRATION_STATUS_LABEL,
  NETWORK_INTEGRATION_STATUS_TONE,
  type ControllerSetupOutcome,
  type NetworkIntegration,
  type NetworkIntegrationCredentials,
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

/** Gaps in the backend's documented fix order, with anything unrecognised
 * last rather than dropped. The order is a dependency chain: choosing a site
 * before storing the credentials that can list sites sends an operator to a
 * screen that cannot answer. */
function orderedGaps(gaps: string[]): string[] {
  const rank = (g: string) => {
    const i = CONTROLLER_SETUP_GAP_ORDER.indexOf(g as never);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...gaps].sort((a, b) => rank(a) - rank(b));
}

/**
 * A count, or an em dash when there is no count to show.
 *
 * `?? 0` is the shape this page shipped with, and it is a claim: "zero
 * tenants have connected a controller" is a statement about the estate, and
 * it was being made whenever `/platform/summary` had not answered or had
 * failed. Against a table that simultaneously showed a row, it read as the
 * page contradicting itself -- which is exactly how it was reported.
 *
 * An unresolved number is not zero. Same rule the rest of this codebase
 * follows for `null` health, `null` metrics source and an unread router list:
 * an absence is rendered as an absence.
 */
function statValue(n: number | null | undefined): string | number {
  return typeof n === "number" ? n : "—";
}

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
          description="Customer-owned network controllers this platform authorises guests through. Open a row to probe it, replace its credentials, switch it off or remove it."
          actions={
            <MButton variant="outline" onClick={refresh} disabled={list.isFetching}>
              {list.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </MButton>
          }
        />

        {/* THE TILES AND THE TABLE ARE TWO DIFFERENT REQUESTS, and they were
            allowed to contradict each other. `/platform/summary` and
            `/platform/integrations` are separate endpoints with separate
            caches, so the tiles read 0 / 0 / 0 on one load and 1 / 1 / 1 on
            the next with the SAME single row in the table both times.

            The mechanism was `?? 0`. A summary that has not resolved, or that
            failed outright, rendered as a confident zero -- "no tenants have
            connected a controller" is a statement, and it was being made
            about a request that had not answered. `loading` only covered the
            first case, and only while `isLoading` was true.

            `statValue` renders an em dash for both absences instead. A tile
            that cannot answer must not answer. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat
            label="Tenants connected"
            value={statValue(summary.data?.tenantCount)}
            icon={Building2}
            loading={summary.isLoading}
          />
          <MStat
            label="Integrations"
            value={statValue(summary.data?.integrationCount)}
            icon={Plug}
            loading={summary.isLoading}
          />
          <MStat
            label="Connected"
            value={statValue(summary.data?.connectedCount)}
            icon={CheckCircle2}
            tone="success"
            loading={summary.isLoading}
          />
          <MStat
            label="Needs attention"
            value={statValue(summary.data?.errorCount)}
            icon={AlertTriangle}
            // Toned by what the number IS, not by a fixed colour: a zero
            // error count painted red trains operators to ignore red. An
            // UNKNOWN count is not zero either, so it is not painted calm.
            tone={(summary.data?.errorCount ?? 0) > 0 ? "danger" : "default"}
            accent={(summary.data?.errorCount ?? 0) > 0}
            loading={summary.isLoading}
          />
          <MStat
            label="Switched off"
            value={statValue(summary.data?.disabledCount)}
            icon={PowerOff}
            loading={summary.isLoading}
          />
          <MStat
            label="Controller devices"
            value={statValue(summary.data?.deviceCount)}
            icon={RadioTower}
            loading={summary.isLoading}
          />
          <MStat
            label="Clients seen"
            value={statValue(summary.data?.clientCount)}
            icon={Wifi}
            tone="info"
            loading={summary.isLoading}
          />
          <MStat
            label="Active guest sessions"
            value={statValue(summary.data?.activeAuthorizationCount)}
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

  /**
   * Automatic controller setup -- the thing the backend has always been able
   * to do and no console ever called.
   *
   * `_configure_controller` writes the External Portal Server URL onto the
   * SSID, adds the Pre-Authentication Access entry, and creates the hotspot
   * operator account itself, generating and encrypting the password. Because
   * nothing invoked it, operators were being walked through all of that by
   * hand -- including inventing and remembering an operator password the
   * platform was willing to generate for them. "Provision a TP-Link customer
   * and nothing appears on the Omada side" is that gap, exactly.
   *
   * PREVIEW BEFORE APPLY IS ENFORCED, not suggested. `outcome` has to hold a
   * dry run before Apply is enabled. This writes to a customer's live
   * controller; an operator should read what it intends to do first. It is
   * also how the real response shape gets observed -- see
   * `ControllerSetupOutcome`, which is deliberately loose because that shape
   * could not be read from any source available when this was written.
   */
  const [outcome, setOutcome] = useState<ControllerSetupOutcome | null>(null);
  const [previewed, setPreviewed] = useState(false);
  /**
   * Preconditions the backend refused on, read off a 409 rather than a
   * response body.
   *
   * A refusal before any write -- an unmet precondition, a foreign portal on
   * the SSID, a shared site -- comes back as `409` with a typed `data.code`,
   * and never as a `ControllerConfigureResponse`. So a gap list read off the
   * success body would be permanently empty: a body only exists for a run that
   * already got past its preconditions.
   */
  const [configureGaps, setConfigureGaps] = useState<string[]>([]);
  const [takeOver, setTakeOver] = useState(false);
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);

  const configure = useMutation({
    mutationFn: (dryRun: boolean) =>
      networkIntegrationService.configurePlatformController(integration, {
        dryRun,
        takeOverSsidPortal: takeOver,
      }),
    onSuccess: (result, dryRun) => {
      setOutcome(result);
      // Got far enough to return a body, so nothing is blocking it any more.
      setConfigureGaps([]);
      if (dryRun) {
        setPreviewed(true);
        toast.success("Preview complete — nothing was changed on the controller.");
      } else {
        // NOT "the venue is live". This changed the controller's
        // configuration, which is a different claim from a guest being able
        // to get online: the portal URL can be right and the venue still down
        // for reasons this never touched. The probe and a real guest are
        // separate proofs, and the copy says so rather than letting a green
        // toast imply the whole chain works.
        toast.success(
          "Controller configuration applied. That is not yet proof a guest can get online — run Test connectivity, then try a real device.",
        );
        onChanged();
      }
    },
    onError: (err) => {
      // The 409 path, and BOTH halves of it matter -- verified against the
      // live QA venue on 2026-09-12, where this rendered
      // "NETWORK_INTEGRATION_AUTOCONFIG_PRECONDITIONS - this build does not
      // recognise that precondition" instead of the one gap that was
      // actually unmet.
      //
      //   {"data": {"code": "NETWORK_INTEGRATION_AUTOCONFIG_PRECONDITIONS",
      //             "missing": ["openapi_required"]}}
      //
      // `data.code` names the REFUSAL; `data.missing` is the gap list. They
      // are different things, and rendering the code as a gap produces an
      // amber panel that names no fix -- the precise failure the panel exists
      // to prevent. `missing` is absent on the other pre-write refusals (a
      // foreign portal on the SSID, a shared site), so the code stays as the
      // fallback rather than leaving those silent.
      //
      // Casing is the second half: the backend emits `ControllerSetupGap`
      // values lowercase (`openapi_required`) while `CONTROLLER_SETUP_GAP_COPY`
      // and `CONTROLLER_SETUP_GAP_ORDER` are keyed on the uppercase union.
      // Without this normalisation a correct list still renders as
      // unrecognised, so the two bugs hid each other.
      const e = err as unknown as AppError;
      const typed = (e?.data?.code ?? e?.code) as string | undefined;
      const rawMissing = e?.data?.missing;
      const missing = Array.isArray(rawMissing)
        ? rawMissing.filter((g): g is string => typeof g === "string").map((g) => g.toUpperCase())
        : [];
      if (e?.status === 409 && (missing.length > 0 || typed)) {
        setConfigureGaps(missing.length > 0 ? missing : [typed as string]);
        // A stale preview describes a run that is now refused, and leaving it
        // on screen under a fresh refusal reads as though it still applies.
        setOutcome(null);
        setPreviewed(false);
        return;
      }
      toast.error(errorText(err, "The controller could not be configured."));
    },
  });

  /**
   * Credential replacement -- the action the `auth_failed` status text has
   * always named and no console has ever offered.
   *
   * "The controller rejected our sign-in. The stored credentials are no longer
   * valid -- replace them to reconnect." That sentence was true, and the only
   * UI that could act on it was the customer Network Integrations page, which
   * FIX-PLAN FE-0 retires because every route it calls is GLOBAL-scoped and
   * 403s for a venue owner. Without this, retiring that page leaves a rejected
   * controller unfixable by anyone, from anywhere.
   */
  const [creds, setCreds] = useState<NetworkIntegrationCredentials>({});
  // Open already when the integration is in the state this form exists to
  // repair. An operator who opened this drawer because the row said
  // "sign-in rejected" should not have to find the control as well.
  const [credsOpen, setCredsOpen] = useState(integration.status === "auth_failed");
  const replaceCreds = useMutation({
    mutationFn: () =>
      networkIntegrationService.replacePlatformCredentials(
        integration,
        integration.authMode,
        creds,
      ),
    onSuccess: () => {
      // Deliberately not "reconnected". This stores the new secret; it does
      // not prove the controller accepts it. Claiming otherwise would be a
      // green toast with nothing behind it, which is the defect class this
      // console keeps being fixed for. The probe is one button away, and the
      // copy points at it.
      toast.success(
        "New credentials stored. Run Test connectivity to confirm the controller takes them.",
      );
      setCreds({});
      setCredsOpen(false);
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "Could not replace the credentials.")),
  });

  /**
   * Delete. `DELETE /{integration_id}` has existed all along with nothing in
   * this console calling it, so even the fallback -- remove it and re-run
   * provisioning -- was unavailable.
   *
   * Guarded by typing the name, the same bar `/master/locations` uses for
   * deleting a venue and for the same reason: this strands a venue's guest
   * sign-in entirely, the rows read near-identically, and the failure mode is
   * acting on the wrong one rather than not meaning to act at all.
   */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const deleteConfirmed =
    deleteTyped.trim().toLowerCase() === integration.name.trim().toLowerCase();
  const remove = useMutation({
    mutationFn: () => networkIntegrationService.deletePlatformIntegration(integration),
    onSuccess: () => {
      toast.warning(
        `Deleted — ${integration.locationName || "this venue"} has no controller integration now, and its guests cannot be signed in until one is connected again.`,
      );
      setConfirmDelete(false);
      setDeleteTyped("");
      onClose();
      onChanged();
    },
    onError: (err) => toast.error(errorText(err, "Could not delete this integration.")),
  });

  /** Operator pair always; app pair additionally for `openapi`. The same
   * predicate the connect wizard validates with, so the two cannot disagree
   * about what a complete credential set is. */
  const credsComplete = credentialsCompleteForMode(integration.authMode, creds);

  // Every operation that can be in flight, so a control is never live
  // while another one is mid-write against the same controller. Both
  // sides of this merge defined their own `busy`; keeping either alone
  // would leave the other's buttons clickable during its own run.
  const busy =
    test.isPending ||
    setEnabled.isPending ||
    configure.isPending ||
    replaceCreds.isPending ||
    remove.isPending;
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
          <MButton
            variant="outline"
            disabled={busy}
            className="text-destructive hover:border-destructive hover:bg-destructive/10"
            onClick={() => {
              setDeleteTyped("");
              setConfirmDelete(true);
            }}
          >
            <Trash2 /> Delete
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

        {/* CREDENTIAL REPLACEMENT, placed directly under the status sentence
            that asks for it. `auth_failed` reads "the stored credentials are
            no longer valid -- replace them to reconnect", and until now that
            instruction had no control anywhere in any console to carry it
            out. Collapsed by default so it does not sit open over a healthy
            integration, and opened automatically when the status IS the one
            this repairs. */}
        <DrawerSection title="Credentials">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Stored encrypted and never shown again — replacing them is the only way to change
              them. {CONTROLLER_AUTH_MODE_LABEL[integration.authMode]} mode
              {integration.authMode === "openapi"
                ? " needs the Open API client pair and the hotspot operator account."
                : " needs the hotspot operator account."}
            </p>
            {!credsOpen ? (
              <MButton variant="outline" disabled={busy} onClick={() => setCredsOpen(true)}>
                <KeyRound /> Replace credentials
              </MButton>
            ) : (
              <div className="space-y-3 rounded-lg border border-border p-3">
                {integration.authMode === "openapi" && (
                  <>
                    <CredField
                      label="Client ID"
                      value={creds.clientId ?? ""}
                      onChange={(v) => setCreds((c) => ({ ...c, clientId: v }))}
                    />
                    <CredField
                      label="Client secret"
                      secret
                      value={creds.clientSecret ?? ""}
                      onChange={(v) => setCreds((c) => ({ ...c, clientSecret: v }))}
                    />
                  </>
                )}
                <CredField
                  label="Operator username"
                  value={creds.username ?? ""}
                  onChange={(v) => setCreds((c) => ({ ...c, username: v }))}
                />
                <CredField
                  label="Operator password"
                  secret
                  value={creds.password ?? ""}
                  onChange={(v) => setCreds((c) => ({ ...c, password: v }))}
                />
                <p className="text-xs text-muted-foreground">
                  Saving stores them. It does not prove the controller accepts them — run Test
                  connectivity afterwards.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <MButton
                    variant="outline"
                    disabled={replaceCreds.isPending}
                    onClick={() => {
                      setCreds({});
                      setCredsOpen(false);
                    }}
                  >
                    Cancel
                  </MButton>
                  <MButton
                    variant="primary"
                    disabled={!credsComplete || busy}
                    aria-disabled={!credsComplete || busy}
                    title={
                      credsComplete
                        ? undefined
                        : integration.authMode === "openapi"
                          ? "Fill in the client pair and the operator account."
                          : "Fill in the operator username and password."
                    }
                    onClick={() => replaceCreds.mutate()}
                  >
                    {replaceCreds.isPending && <Loader2 className="animate-spin" />}
                    Save credentials
                  </MButton>
                </div>
              </div>
            )}
          </div>
        </DrawerSection>

        <DrawerSection title="Configure the controller">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sets the guest portal URL on the SSID, adds the pre-authentication access rule, and
              creates the hotspot operator account on the controller — the steps otherwise done by
              hand in Omada. Preview first; nothing is written until you apply.
            </p>

            {/* GAPS COME FROM THE 409, NOT FROM THE SUCCESS BODY. A refusal
                before any write -- an unmet precondition, a foreign portal on
                the SSID, a shared site -- is a 409 carrying a typed
                `data.code`, and never a `ControllerConfigureResponse`. Reading
                gaps off the response would mean they never appeared at all,
                because a response only exists for a run that got past them. */}
            {configureGaps.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-sm font-medium">Not ready yet — fix this first:</p>
                <ol className="space-y-1.5">
                  {orderedGaps(configureGaps).map((g) => {
                    const copy = isControllerSetupGap(g) ? CONTROLLER_SETUP_GAP_COPY[g] : null;
                    return (
                      <li key={g} className="text-sm">
                        <span className="font-medium">{copy?.title ?? g}</span>
                        <span className="block text-xs text-muted-foreground">
                          {/* An unrecognised precondition is printed verbatim
                              rather than dropped: one nobody renders is a
                              refusal with no reason given. */}
                          {copy?.fix ??
                            "This build does not recognise that precondition — ask support."}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {outcome && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">
                  {outcome.dryRun
                    ? "What this would change"
                    : outcome.changed
                      ? "What was changed"
                      : "Nothing needed changing"}
                </p>

                {/* `ok: false` arrives with HTTP 200 and a false envelope, so
                    the steps are the only place the reason exists. Surfaced
                    loudly rather than left to the toast, which is gone by the
                    time anyone reads the detail. */}
                {!outcome.ok && (
                  <p className="text-sm font-medium text-destructive">
                    {outcome.dryRun
                      ? "Some steps would fail. The controller is unchanged."
                      : "Some steps failed — the controller is only partly configured."}
                  </p>
                )}

                {outcome.steps.length > 0 ? (
                  <ul className="space-y-1.5">
                    {outcome.steps.map((st, i) => (
                      <li key={`${st.step}-${i}`} className="text-sm">
                        <span className="font-medium">
                          {CONTROLLER_CONFIGURE_STEP_LABEL[st.step] ?? st.step}
                        </span>{" "}
                        <span
                          className={
                            st.outcome === "failed" ? "text-destructive" : "text-muted-foreground"
                          }
                        >
                          — {CONTROLLER_CONFIGURE_OUTCOME_LABEL[st.outcome] ?? st.outcome}
                        </span>
                        {st.message && (
                          <span className="block text-xs text-muted-foreground">{st.message}</span>
                        )}
                        {/* The controller's own error number, for the support
                            conversation that follows a failure. */}
                        {st.outcome === "failed" && st.providerCode != null && (
                          <span className="block text-xs text-muted-foreground">
                            Controller error code {st.providerCode}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">The controller reported no steps.</p>
                )}

                {/* Kept from the version written before the schema was known.
                    This is a response an operator may need verbatim during an
                    incident, and a field added server-side should reach the
                    screen without a frontend release. */}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Exactly what the controller reported
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(outcome.raw, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={takeOver}
                onChange={(e) => {
                  // Turning it ON is a decision; turning it off is not.
                  if (e.target.checked) setConfirmTakeOver(true);
                  else setTakeOver(false);
                }}
              />
              <span>
                Take over the SSID&rsquo;s existing portal
                <span className="block text-xs text-muted-foreground">
                  Overwrites a portal configuration already on that guest network.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <MButton variant="outline" disabled={busy} onClick={() => configure.mutate(true)}>
                {configure.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                Preview changes
              </MButton>
              <MButton
                variant="primary"
                disabled={!previewed || busy}
                aria-disabled={!previewed || busy}
                title={
                  previewed
                    ? undefined
                    : "Run the preview first — this writes to a live controller."
                }
                onClick={() => configure.mutate(false)}
              >
                Apply to controller
              </MButton>
            </div>
          </div>
        </DrawerSection>

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

        {/*
          Correction after the fact, which the Master console could not do
          at all: the site/SSID editor lived only on the customer dashboard,
          and its `PATCH /network-integrations/{id}` is org-scoped -- a call
          a global-scope operator cannot make, because `resolveOrganizationId`
          throws for a session with no organization. So a wrong site on a
          customer's controller meant signing in as that customer to fix it.
          `updatePlatformIntegration` is the global-scope twin.

          Keyed by id so switching drawers rebuilds the form: without it the
          previous controller's site would sit in these fields as though it
          belonged to this one.
        */}
        <DrawerSection title="Site & guest network">
          <OmadaSiteMapping
            key={integration.id}
            integrationId={integration.id}
            authMode={integration.authMode}
            initialSiteId={integration.externalSiteId}
            initialSiteName={integration.externalSiteName}
            initialSsidId={integration.guestSsidId}
            initialSsidName={integration.guestSsidName}
            onSaved={onChanged}
          />
        </DrawerSection>

        <PortalLinkSection integration={integration} />

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

      {/* Taking over an SSID's portal overwrites configuration somebody else
          put there -- possibly the customer's own IT, possibly another
          vendor. It is off by default and turning it on is confirmed, because
          the damage is invisible from here: the run reports success either
          way, and what broke is whatever the previous portal was doing. */}
      <MDialog
        open={confirmTakeOver}
        onClose={() => setConfirmTakeOver(false)}
        title="Take over this SSID's portal?"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            {integration.guestSsidName ? (
              <>
                <span className="font-semibold text-foreground">{integration.guestSsidName}</span>{" "}
                already has a portal configured on it.
              </>
            ) : (
              "The guest network may already have a portal configured on it."
            )}{" "}
            Applying with this on replaces that configuration with ours. Whatever it was doing
            stops, and nothing on this screen will be able to tell you what it was.
          </p>
          <p className="text-sm text-muted-foreground">
            Leave it off unless you know the existing portal is ours or is unused.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <MButton variant="outline" onClick={() => setConfirmTakeOver(false)}>
              Leave it alone
            </MButton>
            <MButton
              variant="primary"
              onClick={() => {
                setTakeOver(true);
                setConfirmTakeOver(false);
                // A previous preview was computed without take-over, so it no
                // longer describes what Apply would do.
                setPreviewed(false);
                setOutcome(null);
              }}
            >
              Take it over
            </MButton>
          </div>
        </div>
      </MDialog>

      {/* Typed-name guard, the same bar `/master/locations` uses for deleting
          a venue. Deleting an integration is not undoing a setting: guests at
          that venue stop being able to sign in at all, and nothing they see
          says why. The rows on this page read near-identically (same provider,
          similar names, one per tenant), so the failure mode is acting on the
          wrong one rather than not meaning to act. */}
      <MDialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setDeleteTyped("");
        }}
        title="Delete this integration?"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm">
            <span className="font-semibold">{integration.name}</span>
            <span className="block text-sm text-muted-foreground">
              {integration.organizationName || "Unknown customer"} ·{" "}
              {integration.locationName || "no venue mapped"}
            </span>
          </p>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              Guests at this venue stop being signed in.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This removes the connection to the customer&rsquo;s controller, its stored credentials
              and its site and guest-network mapping. Nothing a guest sees will say why. It is
              undone only by connecting the controller again from the start.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              If the controller is only rejecting our sign-in, Replace credentials above fixes that
              without this.
            </p>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-delete-integration"
              className="block text-xs font-medium text-muted-foreground"
            >
              Type <span className="font-semibold text-foreground">{integration.name}</span> to
              confirm
            </label>
            <input
              id="confirm-delete-integration"
              className={M_INPUT}
              autoComplete="off"
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <MButton
              variant="outline"
              onClick={() => {
                setConfirmDelete(false);
                setDeleteTyped("");
              }}
            >
              Cancel
            </MButton>
            <MButton
              variant="primary"
              className="bg-destructive text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!deleteConfirmed || remove.isPending}
              aria-disabled={!deleteConfirmed || remove.isPending}
              title={deleteConfirmed ? undefined : "Type the integration's name to confirm."}
              onClick={() => remove.mutate()}
            >
              {remove.isPending && <Loader2 className="animate-spin" />}
              Delete this integration
            </MButton>
          </div>
        </div>
      </MDialog>
    </MDrawer>
  );
}

/**
 * The External Portal Server URL, on the Master console too.
 *
 * ## Why it is on BOTH dashboards and not only the customer one
 *
 * The Master-driven onboarding path
 * (`create_integration_with_fleet_device`) is the only one that creates the
 * synthetic fleet row, and therefore the only one that produces an
 * integration a guest can actually sign in at. The person finishing that
 * onboarding is standing in this console, not the customer's — so if the
 * URL only existed on the customer page, the operator who most needs it
 * would have to log in as the tenant to read it.
 *
 * It is the same two values, from the same API fields, decided once in
 * `validators.build_external_portal_url`. Nothing is re-derived here: a
 * second place that builds this string is a second place that can drift
 * from the route the guest portal is actually mounted at.
 *
 * ## Why it is read-only here, exactly as it is there
 *
 * There is no rotate, no regenerate and no edit. The URL is a pure function
 * of the venue's own ids; the only way it changes is if the integration is
 * re-mapped, in which case it changes on its own and the old one stops
 * naming that venue. A "new link" button would exist only to break a
 * working venue until someone re-pasted it.
 */
function PortalLinkSection({ integration }: { integration: NetworkIntegration }) {
  const scheme = integration.portalUrlScheme;
  const hostAndQuery = integration.portalUrlHostAndQuery;
  const gaps = integration.portalReadinessGaps ?? [];

  if (!scheme || !hostAndQuery) {
    return (
      <DrawerSection title="Guest portal link">
        <p className="text-sm text-muted-foreground">
          {gaps.includes("fleet_device_missing")
            ? "No link: this integration has no fleet device, so no guest session can be created for it. Onboard the controller from Router Fleet to pair one."
            : gaps.includes("location_not_mapped")
              ? "No link: this integration is not mapped to a location, so no venue's guests resolve to it."
              : "No link is available for this integration yet."}
        </p>
      </DrawerSection>
    );
  }

  return (
    <DrawerSection title="Guest portal setup">
      <OmadaPortalSetupSteps
        scheme={scheme}
        hostAndQuery={hostAndQuery}
        guestSsidName={integration.guestSsidName}
      />
    </DrawerSection>
  );
}

/**
 * One credential input.
 *
 * `type="password"` plus `autoComplete="off"` on the secret halves: not
 * theatre, but the difference between an operator's browser offering to save
 * a customer's controller secret into a shared machine's password manager and
 * it not doing that. The value lives in the drawer's `useState` and is cleared
 * on success and on cancel -- it is a draft in flight, never state this page
 * keeps.
 */
function CredField({
  label,
  value,
  onChange,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        className={M_INPUT}
        type={secret ? "password" : "text"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
