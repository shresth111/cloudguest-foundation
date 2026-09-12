/**
 * The master console's tenancy control: "All organizations", or one of them.
 *
 * ## Why this exists
 *
 * Reading across every tenant used to be what an operator got by *default* --
 * `attachOrganizationScope` in `services/api.ts` skipped the organization
 * header for any session holding a GLOBAL-scoped role, and the backend read
 * that omission as "every organization". Nothing on any screen said so, which
 * is how a founder holding `Super Admin` opened a report about his own venue
 * and read numbers blended across fourteen organizations, most of them demo
 * and QA fixtures. He was entitled to every row; the report was simply about
 * something other than what it said it was.
 *
 * So the estate view is still available and is still one click away -- it is
 * just a thing the operator can now *see* they have chosen, and change. A
 * count blended across fourteen tenants is the worst version of that bug,
 * because unlike a list it shows nothing that would give it away.
 *
 * ## Where the selection goes
 *
 * `setOrganizationScope` writes it; the axios request interceptor reads it on
 * every call and attaches either `X-Organization-Id` or
 * `X-Organization-Scope: all`. Because that value is cached inside React
 * Query's results, changing it must invalidate everything scope-dependent --
 * the same reason and the same query-key list as
 * `WorkspaceContext.setActiveLocationId`, which this deliberately mirrors
 * rather than inventing a second convention.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, Globe2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ALL_ORGANIZATIONS,
  resolveOrganizationScope,
  setOrganizationScope,
  type OrganizationScope,
} from "@/services/api";
import { ORGANIZATIONS_MAX_PAGE_SIZE, organizationService } from "@/services/organization.service";

/** Every query root whose data is scoped by the selected organization. Same
 * list `WorkspaceContext.setActiveLocationId` invalidates -- kept identical on
 * purpose, so the two switchers cannot drift into disagreeing about what
 * "scope-dependent" means. */
const SCOPE_DEPENDENT_QUERY_ROOTS = [
  "permissions",
  "dashboard",
  "routers",
  "guests",
  "analytics",
  "billing",
  "monitoring",
  "portals",
  "audit",
  "notifications",
  "locations",
  "settings",
] as const;

function labelFor(scope: OrganizationScope | null, names: Map<string, string>): string {
  if (!scope || scope.kind === "all") return "All organizations";
  return names.get(scope.organizationId) ?? "Selected organization";
}

export function OrganizationScopePicker() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<OrganizationScope | null>(null);

  // Read on mount rather than during render: `resolveOrganizationScope` reads
  // localStorage, which does not exist during SSR and can throw outright in a
  // captive-network websheet (see api.ts's `safeLocalGet`).
  useEffect(() => setScope(resolveOrganizationScope()), []);

  const { data } = useQuery({
    queryKey: ["organizations", "scope-picker"],
    // 200 here 422'd on every Master page load -- `GET /organizations` caps
    // `page_size` at 100 and FastAPI rejects anything larger before the
    // handler runs. `organizationService.list` now clamps regardless; this
    // asks for what it can actually get.
    queryFn: () => organizationService.list({ page: 1, pageSize: ORGANIZATIONS_MAX_PAGE_SIZE }),
    staleTime: 5 * 60_000,
  });
  // Memoised, not a bare `data?.rows ?? []`: that expression is a new array
  // identity on every render, which would make the `names` map below rebuild
  // every time (and is the exact `react-hooks/exhaustive-deps` warning the
  // repo's eslint ratchet is pinned against).
  const organizations = useMemo(() => data?.rows ?? [], [data]);

  const names = useMemo(() => new Map(organizations.map((o) => [o.id, o.name])), [organizations]);

  function choose(next: OrganizationScope) {
    setOrganizationScope(next);
    setScope(next);
    setOpen(false);
    for (const root of SCOPE_DEPENDENT_QUERY_ROOTS) {
      void queryClient.invalidateQueries({ queryKey: [root] });
    }
  }

  const isAll = !scope || scope.kind === "all";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Data scope: ${labelFor(scope, names)}. Change which organizations this console reads.`}
        className="flex h-9 max-w-[15rem] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {isAll ? (
          <Globe2 className="h-4 w-4 shrink-0" />
        ) : (
          <Building2 className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{labelFor(scope, names)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open ? (
        <>
          {/* Click-away. Sits under the menu, over everything else. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="listbox"
            className="absolute right-0 z-50 mt-1.5 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            <button
              type="button"
              role="option"
              aria-selected={isAll}
              onClick={() => choose({ kind: "all" })}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
                isAll && "font-semibold",
              )}
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">All organizations</span>
              {isAll ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>

            {/* Says what "all" actually means, next to the control that does
                it -- the number of tenants a blended count would be summed
                over is the fact that was missing from every screen. */}
            <p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground">
              {organizations.length > 0
                ? `Counts and charts are summed across all ${organizations.length} organizations.`
                : "Counts and charts are summed across every organization."}
            </p>

            <div className="my-1 h-px bg-border" />

            {organizations.map((org) => {
              const selected = scope?.kind === "organization" && scope.organizationId === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose({ kind: "organization", organizationId: org.id })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
                    selected && "font-semibold",
                  )}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{org.name}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

export { ALL_ORGANIZATIONS };
