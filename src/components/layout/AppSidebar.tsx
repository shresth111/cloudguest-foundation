import { Link, useRouterState } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
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
import { groupedNavForRole, ROLE_LABELS, workspaceNavForRole } from "@/lib/roles";

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");
  const workspaceItems = user ? workspaceNavForRole(user.role) : [];
  const groups = user && !inWorkspace ? groupedNavForRole(user.role) : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wifi className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">CloudGuest</span>
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
                {workspaceItems.map((item, idx) => {
                  const active =
                    item.to === "/workspace"
                      ? pathname === "/workspace"
                      : pathname === item.to || pathname.startsWith(item.to + "/");
                  return (
                    <SidebarMenuItem key={`${item.label}-${idx}`}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          groups.map((g) => (
            <SidebarGroup key={g.group}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((item, idx) => {
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={`${item.label}-${idx}`}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
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
