import { useEffect, useState } from "react";
import { Building2, LifeBuoy, MapPin, Search, User, Wifi } from "lucide-react";
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
import { superAdminService } from "@/services/superadmin.service";
import type { SearchResult } from "@/types/dashboard";

const ICON = {
  organization: Building2,
  location: MapPin,
  router: Wifi,
  guest: User,
  ticket: LifeBuoy,
} as const;

const GROUP_LABEL = {
  organization: "Organizations",
  location: "Locations",
  router: "Routers",
  guest: "Guests",
  ticket: "Tickets",
} as const;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    superAdminService.search(query).then((r) => {
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, open]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ||= []).push(r);
    return acc;
  }, {});

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
          {loading && <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
          {!loading &&
            Object.entries(grouped).map(([type, items], idx) => {
              const Icon = ICON[type as keyof typeof ICON];
              return (
                <div key={type}>
                  {idx > 0 && <CommandSeparator />}
                  <CommandGroup heading={GROUP_LABEL[type as keyof typeof GROUP_LABEL]}>
                    {items.map((r) => (
                      <CommandItem key={r.id} value={`${r.title} ${r.subtitle}`} onSelect={() => setOpen(false)}>
                        <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{r.title}</span>
                          <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
