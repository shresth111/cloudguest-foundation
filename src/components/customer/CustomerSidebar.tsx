import { cn } from "@/lib/utils";
import { customerNavGroupsForRole, getCustomerLoginRole } from "@/lib/customerNav";

/**
 * The one shared sidebar every `/customer/$locationId/*` page renders --
 * grouped nav (Overview / Engagement / Access & Policy / Devices & Team /
 * Network / Operations / Support & Logs), permission-aware (role-filtered
 * via `customerNavGroupsForRole`) and collapse/mobile-aware. Previously this
 * markup was hand-rolled independently in customer.$locationId.$feature.tsx
 * (which all of Reports/Campaigns/Policies/Vouchers/Portal/Devices/ISP
 * Details/Admin Logs/etc. route through) and, separately and out of sync,
 * in customer.$locationId.dashboard.tsx -- extracted here so the Dashboard
 * page (and any future customer page) can't drift back out of step with
 * its siblings again.
 */
export interface CustomerSidebarProps {
  /** The nav item id that should render active, e.g. "dashboard", "reports". */
  activeId: string;
  /** Collapsed to icon rail (desktop). */
  collapsed: boolean;
  /** Open as an overlay drawer (mobile). */
  mobileOpen: boolean;
  onNavigate: (id: string) => void;
  onToggleCollapsed: () => void;
  /** Shown under the brand mark, e.g. the active location's name. */
  subtitle?: string;
}

export function CustomerSidebar({
  activeId,
  collapsed,
  mobileOpen,
  onNavigate,
  onToggleCollapsed,
  subtitle,
}: CustomerSidebarProps) {
  const role = getCustomerLoginRole();
  const navGroups = customerNavGroupsForRole(role);
  const expanded = !collapsed;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all lg:static lg:z-auto",
        expanded ? "w-60" : "w-0 lg:w-16 overflow-hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
          <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
        </div>
        {expanded && (
          <div>
            <p className="text-sm font-semibold">ZIP WiFi</p>
            <p className="text-[10px] text-muted-foreground">{subtitle ?? "Portal"}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-3 px-2 py-2 overflow-y-auto">
        {navGroups.map((g) => (
          <div key={g.id} className="space-y-0.5">
            {expanded && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {g.label}
              </p>
            )}
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={item.label}
                  className={cn(
                    // A left border on the active item (and a neutral, not
                    // primary-tinted, hover fill) so hovering a nearby item
                    // can never read as "also selected" -- `--accent` sits
                    // close enough to `--primary`'s own hue that hovering
                    // one item while the real active item is highlighted
                    // elsewhere used to look like two items were selected
                    // at once.
                    "flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm text-left transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    !expanded && "justify-center",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {expanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t p-2 hidden lg:block">
        <button
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
        >
          {expanded ? "◄" : "►"}
        </button>
      </div>
    </aside>
  );
}
