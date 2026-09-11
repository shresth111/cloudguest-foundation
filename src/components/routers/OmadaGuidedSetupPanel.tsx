/**
 * Router Fleet's setup screen for a TP-Link Omada controller.
 *
 * This screen used to render "TP-Link Omada support is coming soon -- there's
 * no setup script or provisioning flow" for every Omada row. That was false:
 * an Omada venue is onboarded by `POST /network-integrations/platform/onboard`
 * (which creates the integration and this fleet row together) and its guests
 * are authorized through the controller's hotspot API. The platform owner
 * opened an Omada venue here, read "coming soon", and concluded Omada was
 * never built.
 *
 * What is true is narrower: Omada has no SCRIPT. The controller is
 * configured in its own web UI, with the values below. So this screen shows
 * those values -- the shared `OmadaPortalSetupSteps`, the same block the
 * integration drawer and the Add customer wizard render -- for the
 * integration this device belongs to.
 *
 * ## Finding that integration
 *
 * `GET /network-integrations/platform/integrations`, filtered to this
 * device's organization and to provider `omada`, then joined on the
 * `routerId` the backend stamps into each integration's portal URL (see
 * `lib/omada-integration-for-router.ts` for why that is the join and what
 * happens when there is no URL to read it from).
 *
 * ## Gaps instead of values
 *
 * If the integration is not ready -- no credentials, no site, no venue, no
 * fleet device -- this shows the backend's own reasons and a link to the
 * integration, NOT the values. A copyable URL beside a warning invites the
 * operator to paste it, walk away, and learn from a guest that nobody can
 * get online. Credentials are never shown; the integration response does
 * not carry them.
 */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Loader2, Settings2 } from "lucide-react";
import { OmadaPortalSetupSteps } from "@/components/network-integrations/OmadaPortalSetupSteps";
import { describePortalReadinessGap } from "@/lib/network-integration-readiness";
import { findIntegrationForRouter } from "@/lib/omada-integration-for-router";
import { requestErrorMessage } from "@/services/api";
import { networkIntegrationService } from "@/services/network-integration.service";
import type { NetworkIntegration } from "@/types/network-integration";
import type { RouterDevice } from "@/types/router";

/** The backend's own `page_size` ceiling for this list. */
const PAGE_SIZE = 100;

function IntegrationLink({ name }: { name: string }) {
  return (
    <Link
      to="/master/integrations"
      search={{ q: name }}
      className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
    >
      Open {name} in Network Integrations <ChevronRight className="h-3 w-3" />
    </Link>
  );
}

function Warning({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        {title}
      </p>
      {children}
    </div>
  );
}

/** Why this integration cannot serve a guest, in the backend's words. */
function IntegrationGaps({ integration }: { integration: NetworkIntegration }) {
  const gaps = integration.portalReadinessGaps ?? [];
  return (
    <div className="space-y-1.5" data-testid="omada-integration-gaps">
      <p className="text-muted-foreground">
        <strong className="text-foreground">{integration.name}</strong>{" "}
        {gaps.length > 0
          ? "cannot authorize any guest yet:"
          : "has no guest portal link yet, and the platform gave no reason."}
      </p>
      {gaps.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
          {gaps.map((g) => (
            <li key={g}>{describePortalReadinessGap(g)}</li>
          ))}
        </ul>
      )}
      <IntegrationLink name={integration.name} />
    </div>
  );
}

export function OmadaGuidedSetupPanel({ router }: { router: RouterDevice }) {
  const integrations = useQuery({
    // Under the prefix master.integrations.tsx invalidates, so fixing a gap
    // there refreshes this screen too.
    queryKey: ["master", "network-integrations", "for-router", router.organizationId],
    queryFn: () =>
      networkIntegrationService.listPlatformIntegrations({
        organizationId: router.organizationId,
        provider: "omada",
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 30_000,
    retry: false,
  });

  let body: ReactNode;
  if (integrations.isLoading) {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Looking up this controller&rsquo;s integration…
      </p>
    );
  } else if (integrations.isError || !integrations.data) {
    body = (
      <Warning title="Could not load this controller's network integration">
        <p className="text-muted-foreground">
          {requestErrorMessage(integrations.error, "The integrations list did not load.")}
        </p>
        <IntegrationLink name={router.organizationName} />
      </Warning>
    );
  } else {
    const found = findIntegrationForRouter(integrations.data.rows, router);
    if (found.kind === "none") {
      body = (
        <Warning title="No network integration is linked to this device">
          <p className="text-muted-foreground">
            An Omada venue&rsquo;s integration and its fleet device are created together, from Add
            customer or Router Fleet &rarr; Add device. None of {router.organizationName}&rsquo;s
            Omada integrations names this device
            {integrations.data.hasNext ? ` (only the first ${PAGE_SIZE} were checked)` : ""}.
          </p>
          <IntegrationLink name={router.organizationName} />
        </Warning>
      );
    } else if (found.kind === "unlinked") {
      body = (
        <Warning title="Guests cannot sign in at this venue yet">
          <p className="text-muted-foreground">
            No integration names this device yet.{" "}
            {found.candidates.length === 1
              ? "This one, at the same organization, could be it:"
              : "These, at the same organization, could be it:"}
          </p>
          {found.candidates.map((c) => (
            <IntegrationGaps key={c.id} integration={c} />
          ))}
        </Warning>
      );
    } else {
      const { integration } = found;
      const scheme = integration.portalUrlScheme;
      const hostAndQuery = integration.portalUrlHostAndQuery;
      const gaps = integration.portalReadinessGaps ?? [];
      body =
        scheme && hostAndQuery && gaps.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              From <strong className="text-foreground">{integration.name}</strong>, this
              device&rsquo;s network integration.
            </p>
            <OmadaPortalSetupSteps
              scheme={scheme}
              hostAndQuery={hostAndQuery}
              guestSsidName={integration.guestSsidName}
            />
            <IntegrationLink name={integration.name} />
          </div>
        ) : (
          <Warning title="Guests cannot sign in at this venue yet">
            <IntegrationGaps integration={integration} />
          </Warning>
        );
    }
  }

  return (
    <div
      className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm"
      data-testid="omada-guided-setup"
    >
      <div className="flex items-start gap-3">
        <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            TP-Link Omada is configured on the controller, not by a script
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            There is nothing to paste into a device here. Guest sign-in for this venue runs through
            the Omada controller, which needs the settings below in its own web UI.
          </p>
        </div>
      </div>
      {body}
    </div>
  );
}
