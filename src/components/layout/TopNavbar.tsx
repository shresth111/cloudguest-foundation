import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { LifeBuoy, Plus, MapPin, Router as RouterIcon, UserPlus, Ticket, Zap, Activity, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { SpaceContextChip } from "./SpaceContextChip";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OrganizationSwitcher } from "@/components/org-switcher/OrganizationSwitcher";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts/KeyboardShortcutsModal";

interface TopNavbarProps {
  onToggleActivityFeed?: () => void;
}

function QuickActionsMenu() {
  const navigate = useNavigate();
  const go = (to: string) => navigate({ to });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Quick actions">
          <Zap className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("/locations")}>
          <MapPin className="mr-2 h-4 w-4" /> Add location
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/routers")}>
          <RouterIcon className="mr-2 h-4 w-4" /> Register router
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/rbac")}>
          <UserPlus className="mr-2 h-4 w-4" /> Invite user
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/guests")}>
          <Ticket className="mr-2 h-4 w-4" /> Generate voucher
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/organizations")}>
          <Plus className="mr-2 h-4 w-4" /> New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNavbar({ onToggleActivityFeed }: TopNavbarProps) {
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // SpaceContextChip calls useWorkspace(), which throws outside
  // WorkspaceProvider -- that provider only wraps /workspace/* (see
  // src/routes/_authenticated/workspace.tsx), while TopNavbar itself
  // renders on every authenticated page. Mirrors AppSidebar.tsx's own
  // inWorkspace check for the same console-vs-workspace layout split.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />
        <div className="hidden md:block">
          <Breadcrumbs />
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <OrganizationSwitcher />
          {inWorkspace && <SpaceContextChip />}
          <GlobalSearch />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Activity feed"
            onClick={onToggleActivityFeed}
          >
            <Activity className="h-4 w-4" />
          </Button>
          <NotificationBell />
          <QuickActionsMenu />
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 sm:flex"
            aria-label="Keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Help"
            onClick={() => navigate({ to: "/help" })}
          >
            <LifeBuoy className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
