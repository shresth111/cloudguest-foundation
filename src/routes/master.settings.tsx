import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Receipt,
  Server,
  ScrollText,
  CircleSlash,
  ArrowRight,
  Users,
  SlidersHorizontal,
  PackageCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MasterShell } from "@/components/master/MasterShell";
import { MPageShell, MSectionHeader } from "@/components/master/MasterKit";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useRbacRoles } from "@/hooks/useRbac";
import {
  usePlanOptions,
  usePlatformFeatures,
  usePlatformSettings,
  useUpdatePlatformSettings,
} from "@/hooks/usePlatformSettings";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master/settings")({ component: SettingsScreen });

const NO_PLAN_VALUE = "__none__";

/** Real Master-scoped configuration areas that already have a fully-built
 * backend + UI elsewhere in the console -- this page links to the real
 * thing instead of duplicating it under a second "Settings" surface. */
const LINKED_AREAS = [
  {
    to: "/master/operators",
    icon: Users,
    title: "Team & Access",
    description: "See who holds each role below, invite new staff, and revoke access.",
  },
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
 * Platform Settings. Once a thin index page (read-only operator roles +
 * link-out cards), it now carries two things the platform-scope review
 * called for:
 *
 *  1. **New-customer defaults** -- a genuine, editable platform setting
 *     (`GET`/`PUT /system-settings`, gated on `system_settings.read`/
 *     `.update` at GLOBAL scope). This is why the sidebar nav gate on this
 *     route is (correctly) `system_settings.read`: the page now really does
 *     exercise that capability, not just `GET /roles`.
 *  2. **Global feature catalog** -- a read-only surface for `GET /features`,
 *     an endpoint that had no Master UI before.
 *
 * The operator-role data (live from `GET /roles`, the same `useRbacRoles()`
 * hook the customer RBAC page uses -- with no `X-Organization-Id` header it
 * resolves GLOBAL scope) and the link-out cards to already-real areas
 * (Billing, NAS, Audit, Team & Access) are kept.
 *
 * White-label branding, platform API keys/webhooks, and notification
 * routing remain honestly left out (not faked as "coming soon"): each
 * exists in this backend only as a per-organization concept, with no
 * platform-wide/GLOBAL equivalent to wire this page to.
 */
function SettingsScreen() {
  return (
    <MasterShell title="Platform Settings">
      <MPageShell>
        <MSectionHeader eyebrow="Configuration" title="Platform Settings" />

        <NewCustomerDefaultsCard />

        <OperatorRolesCard />

        <FeatureCatalogCard />

        <div className="grid gap-3 md:grid-cols-3">
          {LINKED_AREAS.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.to} to={a.to} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="flex-1 text-xs text-muted-foreground">{a.description}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Open{" "}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center gap-3 pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CircleSlash className="h-4.5 w-4.5" />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold">
                Not available at platform scope
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                These exist only per-organization today -- there is no platform-wide equivalent to
                configure here yet.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <p>White-label branding defaults</p>
            <p>Platform-wide API keys &amp; webhooks</p>
            <p>Platform-wide notification routing</p>
          </CardContent>
        </Card>
      </MPageShell>
    </MasterShell>
  );
}

/**
 * The one real, editable platform setting shipped end-to-end: the default
 * plan a newly-provisioned customer organization is placed on. Reads/writes
 * `GET`/`PUT /system-settings`; the plan picker is fed by `GET /plans`.
 * Saving asks for confirmation (this changes what every future customer
 * gets) and surfaces success/error toasts.
 */
function NewCustomerDefaultsCard() {
  const settings = usePlatformSettings();
  const plans = usePlanOptions();
  const update = useUpdatePlatformSettings();

  const savedPlanId = settings.data?.newCustomerDefaultPlanId ?? null;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  // Whether the local pick has been initialised from the server value yet.
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // The effective selection: the user's local pick once they've touched it,
  // otherwise the last-saved server value (so the control reflects reality
  // on first paint and after a refetch without an extra effect).
  const effectivePlanId = touched ? selectedPlanId : savedPlanId;
  const isDirty = touched && selectedPlanId !== savedPlanId;

  const isLoading = settings.isLoading || plans.isLoading;
  const isError = settings.isError || plans.isError;
  const planOptions = useMemo(() => plans.data ?? [], [plans.data]);

  const selectedPlanName = useMemo(
    () => planOptions.find((p) => p.id === effectivePlanId)?.name ?? null,
    [planOptions, effectivePlanId],
  );

  function handleSelect(value: string) {
    setTouched(true);
    setSelectedPlanId(value === NO_PLAN_VALUE ? null : value);
  }

  function handleConfirmSave() {
    setConfirmOpen(false);
    update.mutate(
      // `""` positively clears the default; a real id sets it.
      { newCustomerDefaultPlanId: effectivePlanId ?? "" },
      {
        onSuccess: () => {
          setTouched(false);
          toast.success(
            effectivePlanId
              ? `New customers will default to the "${selectedPlanName ?? "selected"}" plan.`
              : "New-customer default plan cleared.",
          );
        },
        onError: (err) => {
          toast.error((err as unknown as AppError)?.message ?? "Could not save settings.");
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontal className="h-4.5 w-4.5" />
        </span>
        <div>
          <CardTitle className="text-sm font-semibold">New-customer defaults</CardTitle>
          <p className="text-xs text-muted-foreground">
            The plan a newly-provisioned customer organization is placed on by default.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full max-w-sm" />
          </div>
        ) : isError ? (
          <ErrorState
            description={
              ((settings.error ?? plans.error) as unknown as AppError)?.message ??
              "Could not load platform settings."
            }
            onRetry={() => {
              settings.refetch();
              plans.refetch();
            }}
          />
        ) : planOptions.length === 0 ? (
          <EmptyState
            title="No plans to choose from"
            description="Create a billing plan first, then pick one here as the new-customer default."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Default plan</label>
              <Select value={effectivePlanId ?? NO_PLAN_VALUE} onValueChange={handleSelect}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="No default (choose a plan)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PLAN_VALUE}>No default</SelectItem>
                  {planOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.planType ? ` · ${p.planType}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Stored as a platform setting today. Provisioning does not yet consume it
                automatically -- see the release notes.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={!isDirty || update.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                {update.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update new-customer default?"
        description={
          effectivePlanId
            ? `Newly-provisioned customer organizations will default to the "${
                selectedPlanName ?? "selected"
              }" plan. This does not change existing customers.`
            : "The new-customer default plan will be cleared. Newly-provisioned customers will have no default plan applied."
        }
        confirmLabel="Save"
        onConfirm={handleConfirmSave}
      />
    </Card>
  );
}

/** The platform-wide (GLOBAL-scope) operator roles, live from `GET /roles`. */
function OperatorRolesCard() {
  const { data: roles, isLoading, isError, error, refetch } = useRbacRoles();
  const globalRoles = (roles ?? []).filter((r) => r.scopeType === "global");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4.5 w-4.5" />
        </span>
        <div>
          <CardTitle className="text-sm font-semibold">Operator roles &amp; permissions</CardTitle>
          <p className="text-xs text-muted-foreground">
            The platform-wide (GLOBAL-scope) operator roles that can be granted on this console.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState description={(error as unknown as AppError)?.message} onRetry={refetch} />
        ) : globalRoles.length === 0 ? (
          <EmptyState
            title="No platform-wide roles found"
            description="No GLOBAL-scope operator roles are seeded yet."
          />
        ) : (
          <div className="space-y-2">
            {globalRoles.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.name}</span>
                    {r.isSystemRole && <Badge variant="secondary">System</Badge>}
                    {!r.isActive && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  {r.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                  )}
                </div>
                <Badge variant="outline">
                  {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const FEATURE_TYPE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  boolean: "secondary",
  limit: "outline",
  tier: "default",
};

/** Read-only surface for the global feature catalog (`GET /features`) -- the
 * platform's feature keys, categories, types and tier options. No backend
 * change; this simply makes a previously orphaned endpoint visible. */
function FeatureCatalogCard() {
  const { data: features, isLoading, isError, error, refetch } = usePlatformFeatures();
  const rows = features ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PackageCheck className="h-4.5 w-4.5" />
        </span>
        <div>
          <CardTitle className="text-sm font-semibold">Global feature catalog</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every platform feature key plans and entitlements are built from. Read-only.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState description={(error as unknown as AppError)?.message} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No features found"
            description="The platform feature catalog is empty."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              {rows.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{f.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {f.key}
                      </code>
                    </div>
                    {f.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                    )}
                    {f.type === "tier" && f.tierOptions.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Tiers: {f.tierOptions.join(", ")}
                        {f.defaultTierValue ? ` (default: ${f.defaultTierValue})` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{f.category}</Badge>
                    <Badge variant={FEATURE_TYPE_VARIANT[f.type] ?? "secondary"}>{f.type}</Badge>
                    {f.type === "boolean" && (
                      <Badge variant={f.defaultEnabled ? "default" : "outline"}>
                        {f.defaultEnabled ? "On by default" : "Off by default"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
