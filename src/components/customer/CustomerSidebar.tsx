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
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-gradient-to-b from-[#1e1b4b] to-[#181530] text-white transition-all lg:static lg:z-auto",
        expanded ? "w-60" : "w-0 lg:w-16 overflow-hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] shadow-sm">
          <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1e1b4b]" />
          </span>
        </div>
        {expanded && (
          <div>
            <p className="text-sm font-bold tracking-tight">Wyfy Guest</p>
            <p className="text-[10px] font-normal tracking-wide text-white/45">{subtitle ?? "Portal"}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-4 px-2.5 py-3 overflow-y-auto">
        {navGroups.map((g) => (
          <div key={g.id} className="space-y-1">
            {expanded && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
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
                    // A left indicator bar + soft tinted background/glow on
                    // the active item (never used for hover, so hovering a
                    // nearby item can never read as "also selected"), each
                    // icon riding in its own rounded chip so the rail reads
                    // as a set of distinct rows instead of same-weight
                    // plain-white glyphs floating in a list.
                    "group relative flex w-full items-center gap-3 rounded-lg border-l-[3px] px-2.5 py-2.5 text-sm text-left transition-all duration-150",
                    active
                      ? "border-[#6C4EFF] bg-gradient-to-r from-[#6C4EFF]/25 via-[#6C4EFF]/10 to-transparent text-white font-medium shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_4px_14px_-4px_rgba(108,78,255,0.55)]"
                      : "border-transparent text-white/60 hover:bg-white/[0.06] hover:text-white",
                    !expanded && "justify-center px-0",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                      active
                        ? "bg-white/15 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </span>
                  {expanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-2 hidden lg:block">
        <button
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white"
        >
          {expanded ? "◄" : "►"}
        </button>
      </div>
    </aside>
  );
}
