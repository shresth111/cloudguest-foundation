import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CornerDownLeft, Moon, PanelLeft, Search, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { StatusDot, livenessToStatus } from "@/components/customer/console";
import { useTheme } from "@/context/ThemeContext";
import { livenessTone } from "@/lib/location-liveness";
import { useCustomerStore } from "@/stores/customerStore";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  customerFeatureHref,
  customerNavGroupsForRole,
  getCustomerLoginRole,
} from "@/lib/customerNav";
import { filterNavGroupsByPermissions } from "@/lib/customerNavPermissions";
import { customerPaletteFloor, rankCustomerPaletteMatch } from "@/lib/customerPaletteFilter";
import { cn } from "@/lib/utils";
import { useCustomerLocations, useMyPermissions } from "@/hooks/useCustomerDashboard";

/**
 * Cmd/Ctrl-K over every customer feature, by name.
 *
 * Every screen is its own entry, by its own name, under its section's
 * heading -- including the ones that are tabs rather than sidebar rows
 * (docs/design/nav-consolidation.md). Typing "vouchers" lists Vouchers, not
 * "Guests".
 *
 * This arrived with the nav restructure that folded 26 sidebar rows into
 * nine, as the escape hatch that made the folding survivable. The folding
 * was reverted; this was not. Typing "port forwarding" beating scrolling a
 * 26-row sidebar to find it is true of the long menu too -- more so, since
 * the long menu is the one that runs past the fold.
 *
 * Deliberately separate from `components/command-palette/CommandPalette.tsx`,
 * which is the Master Console's and hardcodes platform-only routes
 * (/organizations, /rbac, /branding). Those must never be reachable from a
 * customer session, which is the same boundary AppSidebar and TopNavbar
 * already enforce; sharing one palette across both shells would be the
 * easiest possible way to break it.
 *
 * Scoped by the same expression as the sidebar -- role first, then real
 * grants, failing open on "we don't know" -- and grouped by the same
 * groups, so what you can search is exactly what you can see and the group
 * heading beside a hit tells you where to find it next time. A feature the
 * sidebar would not offer is not searchable here either: this is a shortcut
 * past the scrolling, not past the permission model.
 *
 * Labels come from the same `nav` keys the sidebar renders, so a Hindi
 * session searches the names it can actually see.
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
  const groups = filterNavGroupsByPermissions(customerNavGroupsForRole(role), permissions);
  const { t } = useTranslation("nav", { i18n });

  // Controlled so the ranking can see the whole list (customerPaletteFloor):
  // only the best band of matches is shown, so Enter opens a screen typed by
  // its own name, never one that merely shares letters with it.
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);
  const entryOf = (
    group: (typeof groups)[number],
    item: (typeof groups)[number]["items"][number],
  ) => {
    const label = t(`customerItem.${item.id}`, item.label);
    const groupLabel = t(`customerGroup.${group.id}`, group.label);
    return {
      value: `${label} ${groupLabel} ${item.label} ${group.label}`,
      keywords: item.keywords ? [...item.keywords] : undefined,
    };
  };
  const floor = customerPaletteFloor(
    search,
    groups.flatMap((g) => g.items.map((item) => entryOf(g, item))),
  );
  const filter = (value: string, s: string, keywords?: string[]) => {
    const score = rankCustomerPaletteMatch(value, s, keywords);
    return score >= floor ? score : 0;
  };

  // The console look needs classes on the dialog itself, which the shared
  // `CommandDialog` does not take, so it is composed here from the same
  // three primitives (Dialog > DialogContent > Command). `wy-console` on the
  // content because Radix portals it to <body>, outside the page wrapper.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wy-console top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-[var(--wy-radius-lg)] border-[var(--wy-border)] bg-[var(--wy-surface)] p-0 text-[var(--wy-text)] shadow-2xl [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{t("commandPalette.trigger", "Search")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("consoleShell.palette.hint", "Type to find a page, a venue or an action.")}
        </DialogDescription>
        <Command
          filter={filter}
          className="bg-transparent text-[var(--wy-text)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--wy-text-faint)] [&_[cmdk-group]]:px-1.5 [&_[cmdk-input-wrapper]]:border-[var(--wy-border)] [&_[cmdk-input]]:h-12 [&_[cmdk-input]]:text-[14px] [&_[cmdk-item]]:h-9 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:text-[13px] [&_[cmdk-item][data-selected=true]]:bg-[var(--wy-surface-2)] [&_[cmdk-item][data-selected=true]]:text-[var(--wy-text)]"
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t(
              "commandPalette.placeholder",
              "Search for anything — guests, offers, vouchers, staff…",
            )}
          />
          <CommandList className="max-h-[min(60vh,26rem)]">
            <CommandEmpty>
              {t("commandPalette.empty", "Nothing matches that. Try “guests”, “offer” or “WiFi”.")}
            </CommandEmpty>
            {groups.map((group) => {
              const groupLabel = t(`customerGroup.${group.id}`, group.label);
              return (
                <CommandGroup key={group.id} heading={groupLabel}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const label = t(`customerItem.${item.id}`, item.label);
                    return (
                      <CommandItem
                        key={item.id}
                        // cmdk matches on `value`, so the group name is folded in:
                        // someone who remembers only "that thing under Network"
                        // still finds Port Forwarding. The English names ride
                        // along with the translated ones: a Hindi session that
                        // types "guests" (the word on every help doc and support
                        // call) still lands on मेहमान. In English they repeat,
                        // which is harmless.
                        //
                        // The screen's synonyms ride separately as `keywords`,
                        // ranked below the names by `rankCustomerPaletteMatch`:
                        // now that most screens are tabs inside a section, this
                        // is how "coupon" or "whatsapp" still goes straight to
                        // Vouchers or Guest Messaging, without a synonym list
                        // outranking a screen typed by its own name.
                        value={`${label} ${groupLabel} ${item.label} ${group.label}`}
                        keywords={item.keywords ? [...item.keywords] : undefined}
                        onSelect={() => {
                          onOpenChange(false);
                          navigate({ to: customerFeatureHref(item.id) });
                        }}
                      >
                        <Icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                        <span>{label}</span>
                        <span className="ml-auto pl-3 text-xs text-muted-foreground">
                          {groupLabel}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
            <PaletteVenues onDone={() => onOpenChange(false)} />
            <PaletteActions onDone={() => onOpenChange(false)} />
          </CommandList>
          <PaletteFooter />
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** Venues, by name. Mounted only while the palette is open (the dialog
 * unmounts its content when closed), so it costs the locations read only
 * when someone is actually searching -- the same rule as LocationSwitcher. */
function PaletteVenues({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("nav", { i18n });
  const { activeLocationId, setActiveLocation } = useCustomerStore();
  const { data: locations } = useCustomerLocations();
  if (!locations || locations.length < 2) return null;
  const heading = t("consoleShell.palette.venues", "Venues");
  return (
    <CommandGroup heading={heading}>
      {locations.map((loc) => (
        <CommandItem
          key={loc.id}
          value={`venue ${loc.name} ${loc.city ?? ""} ${heading}`}
          onSelect={() => {
            onDone();
            if (loc.id !== activeLocationId) setActiveLocation(loc.id, loc);
          }}
        >
          <StatusDot
            status={livenessToStatus(livenessTone(loc.liveness.state))}
            label={loc.liveness.label}
            className="mr-2.5 ml-1"
          />
          <span className="truncate">{loc.name}</span>
          <span className="ml-auto pl-3 text-xs text-[var(--wy-text-faint)]">
            {loc.id === activeLocationId
              ? t("consoleShell.palette.current", "Current")
              : loc.liveness.label}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/** Two shell actions that already have controls elsewhere, so a keyboard
 * user never has to leave the palette for them. */
function PaletteActions({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("nav", { i18n });
  const theme = useTheme();
  const { toggleSidebar } = useSidebar();
  const heading = t("consoleShell.palette.actions", "Actions");
  const mod = useModKey();
  return (
    <CommandGroup heading={heading}>
      {theme && (
        <CommandItem
          value={`theme dark light mode ${heading}`}
          onSelect={() => {
            onDone();
            theme.toggle();
          }}
        >
          {theme.theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          ) : (
            <Moon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          )}
          <span>
            {theme.theme === "dark"
              ? t("consoleShell.account.lightMode", "Light mode")
              : t("consoleShell.account.darkMode", "Dark mode")}
          </span>
        </CommandItem>
      )}
      <CommandItem
        value={`sidebar collapse expand menu ${heading}`}
        onSelect={() => {
          onDone();
          toggleSidebar();
        }}
      >
        <PanelLeft className="mr-2 h-4 w-4 shrink-0 opacity-70" />
        <span>{t("consoleShell.palette.toggleSidebar", "Collapse or expand the menu")}</span>
        <Kbd className="ml-auto">{mod}B</Kbd>
      </CommandItem>
    </CommandGroup>
  );
}

function PaletteFooter() {
  const { t } = useTranslation("nav", { i18n });
  return (
    <div className="flex items-center gap-4 border-t border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-3 py-2 text-[11px] text-[var(--wy-text-faint)]">
      <span className="flex items-center gap-1.5">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {t("consoleShell.palette.navigate", "to move")}
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>
          <CornerDownLeft aria-hidden className="h-3 w-3" />
        </Kbd>
        {t("consoleShell.palette.open", "to open")}
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>esc</Kbd>
        {t("consoleShell.palette.close", "to close")}
      </span>
    </div>
  );
}

/** Mac shows the Command glyph; everything else spells Ctrl. Decided after
 * mount so the server render and the first client render agree. */
function useModKey(): string {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform ?? "")) setMod("Ctrl ");
  }, []);
  return mod;
}

function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--wy-border)] bg-[var(--wy-surface)] px-1 font-[family-name:var(--wy-font-mono)] text-[10px] font-medium text-[var(--wy-text-muted)]",
        className,
      )}
    >
      {children}
    </kbd>
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
  const { t } = useTranslation("nav", { i18n });
  const label = t("commandPalette.trigger", "Search");
  const mod = useModKey();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-8 shrink-0 items-center gap-2 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-2 text-[13px] text-[var(--wy-text-faint)] transition-colors hover:border-[var(--wy-border-strong)] hover:text-[var(--wy-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] max-sm:w-8 max-sm:justify-center max-sm:bg-transparent max-sm:border-transparent max-sm:px-0 sm:w-44 lg:w-56"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden flex-1 text-left sm:inline">{label}</span>
      {/* Not shown on touch, where there is no key to press. */}
      <Kbd className="hidden lg:inline-flex">{mod}K</Kbd>
    </button>
  );
}
