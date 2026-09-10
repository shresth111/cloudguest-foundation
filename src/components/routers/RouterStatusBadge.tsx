import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthStatus, RouterStatus } from "@/types/router";
import { ROUTER_STATUS_LABEL } from "@/types/router";
import { isControllerManaged, routerVendorLabel } from "@/lib/router-vendors";

const STATUS_STYLES: Record<RouterStatus, string> = {
  pending_provisioning: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  provisioning: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  online: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  offline: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  suspended: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400",
  decommissioned: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
};

export function RouterStatusBadge({ status }: { status: RouterStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {ROUTER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** A router with no stored API credentials can never actually connect --
 * no speed test, no health checks, no queue/device management -- but
 * `RouterWizard`'s credentials step is optional (a real, common path when
 * the physical device isn't reachable yet at registration time), and
 * `pending_provisioning`'s own neutral zinc badge above doesn't
 * distinguish "about to come online" from "silently stuck with nothing
 * ever entered." Confirmed live: a real customer's router sat exactly in
 * that second state for days with zero signal anywhere in the console.
 * This renders next to `RouterStatusBadge` specifically for that gap --
 * never for `online`/`offline` routers that already proved they can
 * connect at some point, even if credentials were later cleared. */
export function MissingCredentialsBadge({
  hasApiCredentials,
  status,
  vendor,
}: {
  hasApiCredentials: boolean;
  status: RouterStatus;
  /** Contract §11.5. A controller-managed row legitimately has no API
   * credentials on `routers` -- the ones that matter live encrypted on its
   * network integration, and no page offers to add them "from its own
   * detail page" as this badge's tooltip promises. Showing it here would
   * send an operator to a form that does not exist, to fix a state that is
   * not broken. Optional so existing call sites are unaffected. */
  vendor?: string | null;
}) {
  if (hasApiCredentials || status === "decommissioned") return null;
  if (isControllerManaged(vendor)) return null;
  return (
    <Badge
      variant="outline"
      className="rounded-full font-medium bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
      title="No API credentials on file -- this router cannot connect until they're added from its own detail page"
    >
      Needs credentials
    </Badge>
  );
}

/**
 * Marks a row that this platform reaches through a vendor controller rather
 * than through its own agent -- contract §11.5.
 *
 * It is here to answer the question the rest of the row provokes. A
 * controller sits at `pending_provisioning` forever, has never been "seen",
 * and has no health status, because none of those things are measured for
 * it. Without a label saying so, that reads as a device someone forgot to
 * finish setting up; with one, it reads as what it is.
 *
 * Neutral styling on purpose. Amber or red would say something is wrong,
 * and nothing is.
 */
export function ControllerManagedBadge({ vendor }: { vendor?: string | null }) {
  if (!isControllerManaged(vendor)) return null;
  return (
    <Badge
      variant="outline"
      className="rounded-full font-medium bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400"
      title={`Managed through its own ${routerVendorLabel(vendor)} controller. This platform integrates with it rather than provisioning it, so agent status, health checks and provisioning do not apply.`}
    >
      {routerVendorLabel(vendor)}
    </Badge>
  );
}

const HEALTH_STYLES: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  unhealthy: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  unknown: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
};

/** `null` (never health-checked) renders as an honest "Unknown", not a
 * fabricated healthy/unhealthy guess. */
export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const key = status ?? "unknown";
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", HEALTH_STYLES[key])}>
      {key}
    </Badge>
  );
}
