import { Link, useRouterState } from "@tanstack/react-router";
import { Lock, Wifi } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  groupedNavForRole,
  ROLE_LABELS,
  workspaceNavForRole,
  type NavItem,
} from "@/lib/roles";

export function AppSidebar() {
  const { user } = useAuth();
  const { can, isLocked, isVisible } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");

  const rawWorkspace = user ? workspaceNavForRole(user.role) : [];
  const rawGroups = user && !inWorkspace ? groupedNavForRole(user.role) : [];

  const filterVisible = (items: NavItem[]) => items.filter((i) => isVisible(i.moduleId));
  const workspaceItems = filterVisible(rawWorkspace);
  const groups = rawGroups
    .map((g) => ({ ...g, items: filterVisible(g.items) }))
    .filter((g) => g.items.length > 0);

  const renderItem = (item: NavItem, key: string) => {
    const active =
      item.to === "/workspace"
        ? pathname === "/workspace"
        : pathname === item.to || pathname.startsWith(item.to + "/");
    const locked = isLocked(item.moduleId) && !can(item.moduleId);

    if (locked) {
      return (
        <SidebarMenuItem key={key}>
          <SidebarMenuButton
            disabled
            tooltip={`${item.label} — upgrade required`}
            className="opacity-60"
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1 truncate">{item.label}</span>
            <Lock className="h-3.5 w-3.5 opacity-70" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={key}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
          <Link to={item.to} className="flex items-center gap-2">
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Wifi className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">CloudGuest</span>
            <span className="text-xs text-muted-foreground">Guest WiFi Platform</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {inWorkspace ? (
          <SidebarGroup>
            <SidebarGroupLabel>Customer workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceItems.map((item, idx) => renderItem(item, `${item.label}-${idx}`))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          groups.map((g) => (
            <SidebarGroup key={g.group}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((item, idx) => renderItem(item, `${item.label}-${idx}`))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{ROLE_LABELS[user.role]}</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
