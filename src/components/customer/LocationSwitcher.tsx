import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, MapPinned, Wifi } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * The venue name in the top bar, as a switcher. Every customer page reads
 * its scope from `useCustomerStore`, so picking a venue here re-scopes the
 * page you are on without a trip through /switch-location. The sidebar no
 * longer repeats the name -- this is the one place it lives.
 *
 * The venue list is read by `VenueOptions`, which only mounts while the menu
 * is open, so an ordinary page load does not pay for the locations fan-out
 * (see scripts/test-customer-dashboard-fetch-count.mjs).
 */
export function LocationSwitcher() {
  const navigate = useNavigate();
  const activeLocation = useCustomerStore((st) => st.activeLocation);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
        <Wifi className="h-5 w-5 shrink-0 text-white/70" />
        <span className="truncate text-sm font-semibold">
          {activeLocation?.name ?? "Select venue"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your venues</DropdownMenuLabel>
        <VenueOptions />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/switch-location" })} className="gap-2">
          <MapPinned className="h-4 w-4" />
          All venues
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VenueOptions() {
  const { activeLocationId, setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading } = useCustomerLocations();

  return (
    <div className="max-h-72 overflow-y-auto">
      {isLoading ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p> : null}
      {(locations ?? []).map((loc) => (
        <DropdownMenuItem
          key={loc.id}
          onSelect={() => {
            if (loc.id !== activeLocationId) setActiveLocation(loc.id, loc);
          }}
          className="gap-2"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{loc.name}</span>
            {loc.city ? (
              <span className="truncate text-xs text-muted-foreground">{loc.city}</span>
            ) : null}
          </span>
          {loc.id === activeLocationId ? <Check className="h-4 w-4 shrink-0" /> : null}
        </DropdownMenuItem>
      ))}
    </div>
  );
}
