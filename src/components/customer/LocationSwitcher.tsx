import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot, livenessToStatus } from "@/components/customer/console";
import { useConsoleHealth } from "@/components/customer/useConsoleHealth";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { livenessTone } from "@/lib/location-liveness";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * The venue name in the top bar, as a switcher. Every customer page reads
 * its scope from `useCustomerStore`, so picking a venue here re-scopes the
 * page you are on without a trip through /switch-location. The sidebar no
 * longer repeats the name -- this is the one place it lives.
 *
 * The dot on the trigger is the active venue's verdict from
 * `useConsoleHealth` (same source as the health pill; no fetch of its own).
 * The dots in the menu are each venue's own `liveness`, from the same
 * `listLocations()` answer the venue picker page renders.
 *
 * The venue list is read by `VenueOptions`, which only mounts while the menu
 * is open, so an ordinary page load does not pay for the locations fan-out
 * (see scripts/test-customer-dashboard-fetch-count.mjs).
 */
export function LocationSwitcher() {
  const navigate = useNavigate();
  const { t } = useTranslation("nav", { i18n });
  const activeLocation = useCustomerStore((st) => st.activeLocation);
  const health = useConsoleHealth(activeLocation?.id);
  const tone = health ? livenessTone(health.liveness.state) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-wy="site-switcher"
        aria-label={t("consoleShell.switcher.label", "Switch venue")}
        className="group flex h-8 min-w-0 max-w-[13rem] items-center gap-2 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2.5 text-[var(--wy-text)] transition-colors hover:border-[var(--wy-border-strong)] hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] data-[state=open]:border-[var(--wy-border-strong)] data-[state=open]:bg-[var(--wy-surface-2)] sm:max-w-[16rem]"
      >
        {tone && health ? (
          <StatusDot status={livenessToStatus(tone)} label={health.liveness.label} />
        ) : (
          <MapPinned aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--wy-text-faint)]" />
        )}
        <span className="truncate text-[13px] font-semibold">
          {activeLocation?.name ?? t("consoleShell.switcher.select", "Select venue")}
        </span>
        <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--wy-text-faint)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="wy-console w-72 rounded-[var(--wy-radius-lg)] border-[var(--wy-border)] bg-[var(--wy-surface)] p-1 text-[var(--wy-text)]"
      >
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--wy-text-faint)]">
          {t("consoleShell.switcher.heading", "Your venues")}
        </DropdownMenuLabel>
        <VenueOptions />
        <DropdownMenuSeparator className="bg-[var(--wy-border)]" />
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/switch-location" })}
          className="gap-2 rounded-md text-[13px] text-[var(--wy-text-muted)] focus:bg-[var(--wy-surface-2)] focus:text-[var(--wy-text)]"
        >
          <MapPinned className="h-4 w-4" />
          {t("consoleShell.switcher.all", "All venues")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VenueOptions() {
  const { t } = useTranslation("nav", { i18n });
  const { activeLocationId, setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading, isError } = useCustomerLocations();

  return (
    <div className="max-h-80 overflow-y-auto">
      {isLoading ? (
        <p className="px-2 py-1.5 text-[13px] text-[var(--wy-text-muted)]">
          {t("consoleShell.switcher.loading", "Loading…")}
        </p>
      ) : null}
      {isError ? (
        <p className="px-2 py-1.5 text-[13px] text-[var(--wy-text-muted)]">
          {t("consoleShell.switcher.error", "Couldn't load your venues.")}
        </p>
      ) : null}
      {(locations ?? []).map((loc) => {
        const active = loc.id === activeLocationId;
        return (
          <DropdownMenuItem
            key={loc.id}
            onSelect={() => {
              if (!active) setActiveLocation(loc.id, loc);
            }}
            className="gap-2.5 rounded-md py-1.5 focus:bg-[var(--wy-surface-2)] focus:text-[var(--wy-text)]"
          >
            <StatusDot
              status={livenessToStatus(livenessTone(loc.liveness.state))}
              label={loc.liveness.label}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium">{loc.name}</span>
              <span className="truncate text-[11px] text-[var(--wy-text-faint)]">
                {[loc.city, loc.liveness.label].filter(Boolean).join(" · ")}
              </span>
            </span>
            {active ? (
              <Check aria-hidden className="h-4 w-4 shrink-0 text-[var(--wy-accent)]" />
            ) : null}
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}
