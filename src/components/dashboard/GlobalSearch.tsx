import { useEffect, useState } from "react";
import { Building2, MapPin, Search, Wifi } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { routerService } from "@/services/router.service";
import type { Organization } from "@/types/organization";
import type { Location } from "@/types/location";
import type { RouterDevice } from "@/types/router";

const DEBOUNCE_MS = 300;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [routers, setRouters] = useState<RouterDevice[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounce the query -- every keystroke now fans out to 3 real HTTP calls
  // instead of an instant mock lookup, so we wait for typing to settle.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open || !debouncedQuery) {
      setOrgs([]);
      setLocations([]);
      setRouters([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      organizationService.list({ search: debouncedQuery, page: 1, pageSize: 5 }),
      locationService.list({ search: debouncedQuery, page: 1, pageSize: 5 }),
      routerService.list({ search: debouncedQuery, page: 1, pageSize: 5 }),
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
  }, [debouncedQuery, open]);

  const hasResults = orgs.length > 0 || locations.length > 0 || routers.length > 0;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-64 justify-between gap-2 rounded-lg border-border/70 bg-background/70 px-3 text-muted-foreground md:flex"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span className="text-sm">Search anything…</span>
        </span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium lg:inline">
          ⌘K
        </kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search organizations, locations, routers…" value={query} onValueChange={setQuery} />
        <CommandList>
          {!debouncedQuery && (
            <div className="py-6 text-center text-sm text-muted-foreground">Start typing to search…</div>
          )}
          {debouncedQuery && loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
          )}
          {debouncedQuery && !loading && !hasResults && <CommandEmpty>No results found.</CommandEmpty>}
          {debouncedQuery && !loading && orgs.length > 0 && (
            <CommandGroup heading="Organizations">
              {orgs.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`org-${o.id} ${o.name} ${o.subscriptionTier ?? ""}`}
                  onSelect={() => setOpen(false)}
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{o.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.subscriptionTier ?? o.status}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {debouncedQuery && !loading && locations.length > 0 && (
            <>
              {orgs.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Locations">
                {locations.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={`loc-${l.id} ${l.name} ${l.organizationName} ${l.city}`}
                    onSelect={() => setOpen(false)}
                  >
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{l.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.organizationName} · {l.city}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {debouncedQuery && !loading && routers.length > 0 && (
            <>
              {(orgs.length > 0 || locations.length > 0) && <CommandSeparator />}
              <CommandGroup heading="Routers">
                {routers.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`router-${r.id} ${r.name} ${r.serialNumber} ${r.organizationName}`}
                    onSelect={() => setOpen(false)}
                  >
                    <Wifi className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.serialNumber} · {r.organizationName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
