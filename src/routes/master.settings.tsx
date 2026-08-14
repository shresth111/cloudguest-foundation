import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, Receipt, Server, ScrollText, CircleSlash, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader } from "@/components/master/MasterKit";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useRbacRoles } from "@/hooks/useRbac";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master/settings")({ component: SettingsScreen });

/** Real Master-scoped configuration areas that already have a fully-built
 * backend + UI elsewhere in the console -- this page links to the real
 * thing instead of duplicating it under a second "Settings" surface. */
const LINKED_AREAS = [
  {
    to: "/master/billing",
    icon: Receipt,
    title: "Billing & tax settings",
    description: "GST/tax rates, coupons, plan catalog -- see the Billing console's own tabs.",
  },
  {
    to: "/master/nas",
    icon: Server,
    title: "RADIUS / NAS configuration",
    description: "Register and manage RADIUS NAS clients and shared secrets.",
  },
  {
    to: "/master/audit",
    icon: ScrollText,
    title: "Audit logs",
    description: "Every operator/customer write action, across every organization.",
  },
] as const;

/**
 * This used to be an `MStubPanel` -- a static bullet list ("Operator roles &
 * permissions", "White-label branding defaults", "RADIUS / WireGuard
 * cluster config", "Billing & tax settings", "Webhooks & API keys",
 * "Notification routing") with zero data and zero links, despite three of
 * those six already being fully real, already-built features elsewhere in
 * this console (RBAC's own GLOBAL-scope system roles via `GET /roles`,
 * Billing & tax under /master/billing, RADIUS/NAS under /master/nas, audit
 * under /master/audit). Now: the real operator-role data (live from
 * `GET /roles`, the same `useRbacRoles()` hook the customer RBAC page
 * itself uses -- with no `X-Organization-Id` header this call resolves
 * GLOBAL scope, per rbac.service.ts's own "listRoles(): infers GLOBAL scope
 * whenever X-Organization-Id is absent" comment) is shown directly, and the
 * three already-real configuration areas link to where they actually live
 * rather than being re-built here.
 *
 * White-label branding, platform API keys/webhooks, and notification
 * routing are honestly left out (not faked as "coming soon" bullets): each
 * exists in this backend only as a per-organization concept
 * (`app/domains/*` white_label/api_keys/notifications are all
 * ORGANIZATION-or-narrower scoped -- see `PermissionModule`'s own
 * `MODULE_NARROWEST_SCOPE`), with no platform-wide/GLOBAL equivalent to
 * wire this page to. Building one would be new backend scope, not a wiring
 * fix -- a product decision, not something to invent here.
 */
function SettingsScreen() {
  const { data: roles, isLoading, isError, error, refetch } = useRbacRoles();
  const globalRoles = (roles ?? []).filter((r) => r.scopeType === "global");

  return (
    <MasterShell title="Platform Settings">
      <MSectionHeader eyebrow="Configuration" title="Platform Settings" />

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4.5 w-4.5" /></span>
          <div>
            <CardTitle className="text-sm font-semibold">Operator roles &amp; permissions</CardTitle>
            <p className="text-xs text-muted-foreground">The platform-wide (GLOBAL-scope) operator roles that can be granted on this console.</p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : isError ? (
            <ErrorState description={(error as unknown as AppError)?.message} onRetry={refetch} />
          ) : globalRoles.length === 0 ? (
            <EmptyState title="No platform-wide roles found" description="No GLOBAL-scope operator roles are seeded yet." />
          ) : (
            <div className="space-y-2">
              {globalRoles.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{r.name}</span>
                      {r.isSystemRole && <Badge variant="secondary">System</Badge>}
                      {!r.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    {r.description && <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                  <Badge variant="outline">{r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {LINKED_AREAS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4.5 w-4.5" /></span>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="flex-1 text-xs text-muted-foreground">{a.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><CircleSlash className="h-4.5 w-4.5" /></span>
          <div>
            <CardTitle className="text-sm font-semibold">Not available at platform scope</CardTitle>
            <p className="text-xs text-muted-foreground">These exist only per-organization today -- there is no platform-wide equivalent to configure here yet.</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <p>White-label branding defaults</p>
          <p>Platform-wide API keys &amp; webhooks</p>
          <p>Platform-wide notification routing</p>
        </CardContent>
      </Card>
    </MasterShell>
  );
}
