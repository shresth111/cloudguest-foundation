import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Loader2, MapPin, Router as RouterIcon, Search } from "lucide-react";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { routerService } from "@/services/router.service";
import type { Organization } from "@/types/organization";
import type { Location } from "@/types/location";
import type { RouterDevice } from "@/types/router";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 6;

/**
 * The Master Console header's "Search platform…" input used to be purely
 * decorative -- an uncontrolled `<input>` with no `value`/`onChange`/state
 * of any kind, so typing into it visibly accepted keystrokes (the browser's
 * own default input behaviour) but triggered nothing: no filtering, no
 * network call, no results. Same "fake control sitting in a real shell"
 * pattern found elsewhere in the console today.
 *
 * This wires it to the same three real, already-used list endpoints the
 * Customers/Locations/Router Fleet pages themselves call
 * (organizationService/locationService/routerService `.list()`, which
 * already fan out across every organization the operator can see -- see
 * location.service.ts's `fetchAllLocations()` doc comment), searching
 * organizations, locations and routers by name in parallel and letting a
 * result be clicked straight through to that record's real page/drawer.
 */
export function MasterSearch() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [routers, setRouters] = useState<RouterDevice[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setOrgs([]);
      setLocations([]);
      setRouters([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      organizationService.list({ search: debouncedQuery, page: 1, pageSize: PAGE_SIZE }),
      locationService.list({ search: debouncedQuery, page: 1, pageSize: PAGE_SIZE }),
      routerService.list({ search: debouncedQuery, page: 1, pageSize: PAGE_SIZE }),
    ]).then(([orgResult, locationResult, routerResult]) => {
      if (cancelled) return;
      setOrgs(orgResult.status === "fulfilled" ? orgResult.value.rows : []);
      setLocations(locationResult.status === "fulfilled" ? locationResult.value.rows : []);
      setRouters(routerResult.status === "fulfilled" ? routerResult.value.rows : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function goToOrg(o: Organization) {
    close();
    // Customers page selects/opens its detail drawer from local table state
    // only -- no URL-addressable customer detail route exists (see
    // master.customers.tsx). `open` tells that route which row to
    // auto-select once its own data has loaded.
    navigate({ to: "/master/customers", search: { open: o.id } });
  }

  function goToLocation(l: Location) {
    close();
    // All Locations has no per-row detail drawer at all -- its own search
    // box just filters the table by free text. Reuse that: land on the
    // page with the location's own code/name pre-filled as the filter.
    navigate({ to: "/master/locations", search: { q: l.locationCode ?? l.name } });
  }

  function goToRouter(r: RouterDevice) {
    close();
    navigate({ to: "/master/routers", search: { open: r.id } });
  }

  const hasResults = orgs.length > 0 || locations.length > 0 || routers.length > 0;
  const showPanel = open && debouncedQuery.length > 0;

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search platform…"
          className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground lg:w-56"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches for &quot;{debouncedQuery}&quot;.
            </div>
          )}
          {!loading && hasResults && (
            <div className="max-h-96 overflow-y-auto py-1.5">
              {orgs.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Customers
                  </p>
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => goToOrg(o)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.subscriptionTier ?? o.status}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {locations.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Locations
                  </p>
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => goToLocation(l)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.organizationName} · {l.city}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {routers.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Routers
                  </p>
                  {routers.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => goToRouter(r)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent"
                    >
                      <RouterIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.serialNumber} · {r.organizationName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
