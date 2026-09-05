import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { customerFeatureHref, getCustomerLoginRole } from "@/lib/customerNav";
import { CUSTOMER_DESTINATIONS, sectionsFor } from "@/lib/customerDestinations";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";

/**
 * Cmd/Ctrl-K over every customer feature, by name.
 *
 * This is not a nice-to-have bolted onto the nav restructure -- it is what
 * makes the restructure safe. The sidebar went from 26 destinations to 9 by
 * folding 17 features into tabs inside the other nine. For a venue owner
 * that is strictly better: they never wanted a feature catalogue. For the
 * person who had already learned where "Port Forwarding" lived -- an
 * installer, a support agent on a call, the one owner in fifty who does run
 * their own network -- it is a regression unless every one of the 26 is
 * still reachable by typing its name. So it is.
 *
 * Deliberately separate from `components/command-palette/CommandPalette.tsx`,
 * which is the Master Console's and hardcodes platform-only routes
 * (/organizations, /rbac, /branding). Those must never be reachable from a
 * customer session, which is the same boundary AppSidebar and TopNavbar
 * already enforce; sharing one palette across both shells would be the
 * easiest possible way to break it.
 *
 * Scoped by the same rules as the sidebar: role first, then real grants,
 * failing open on "we don't know". A feature the sidebar would not offer is
 * not searchable here either -- this is a shortcut past the *grouping*, not
 * past the permission model.
 */
export function CustomerCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const role = getCustomerLoginRole();
  const { data: permissions } = useMyPermissions();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search for anything — guests, offers, vouchers, staff…" />
      <CommandList>
        <CommandEmpty>Nothing matches that. Try “guests”, “offer” or “WiFi”.</CommandEmpty>
        {CUSTOMER_DESTINATIONS.map((destination) => {
          const sections = sectionsFor(destination, role, permissions);
          if (sections.length === 0) return null;
          return (
            <CommandGroup key={destination.id} heading={destination.label}>
              {sections.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    // cmdk matches on `value`, so the destination name is
                    // folded in: someone who remembers only "that thing under
                    // Settings" still finds Port Forwarding, and someone
                    // typing the old group name ("Network") still lands
                    // somewhere sensible.
                    value={`${item.label} ${destination.label} ${destination.blurb}`}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate({ to: customerFeatureHref(item.id) });
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                    <span>{item.label}</span>
                    {item.label !== destination.label && (
                      <span className="ml-auto pl-3 text-xs text-muted-foreground">
                        {destination.label}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

/** Owns the open state and the Cmd/Ctrl-K binding, so a shell only has to
 * render one element. Returns the trigger button too -- a keyboard shortcut
 * nobody can see is a shortcut for people who already knew about it, which
 * is the population this palette is least needed by. */
export function useCustomerCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      className="flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:px-3"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Search</span>
      {/* Not shown on touch, where there is no key to press. */}
      <kbd className="hidden rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}
