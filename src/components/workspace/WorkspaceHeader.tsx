import { Building2, ChevronDown, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/context/WorkspaceContext";

export function WorkspaceHeader() {
  const { customer, locations, activeLocationId, activeLocation, setActiveLocationId } =
    useWorkspace();

  if (!customer) return null;

  const activeLabel =
    activeLocationId === "all" ? "All locations" : activeLocation?.name ?? "All locations";

  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4 md:flex md:flex-wrap md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold sm:text-base">{customer.name}</span>
            <Badge variant="secondary" className="capitalize">
              {customer.subscription.plan}
            </Badge>
            <Badge
              variant={
                customer.status === "active"
                  ? "default"
                  : customer.status === "trial"
                    ? "secondary"
                    : "destructive"
              }
              className="capitalize"
            >
              {customer.status}
            </Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {customer.organizationName} · {locations.length} location
            {locations.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="col-span-2 justify-between md:col-span-1 md:size-default md:w-72">
            <span className="flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{activeLabel}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Switch location</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setActiveLocationId("all")}>
            <MapPin className="mr-2 h-4 w-4" /> All locations
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {locations.map((l) => (
            <DropdownMenuItem key={l.id} onSelect={() => setActiveLocationId(l.id)}>
              <MapPin className="mr-2 h-4 w-4 opacity-70" />
              <div className="flex flex-col">
                <span>{l.name}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {l.siteType} · {l.city}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
          {locations.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No locations yet
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
