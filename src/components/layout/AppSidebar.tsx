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
import { navForRole, ROLE_LABELS, workspaceNavForRole } from "@/lib/roles";

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");
  const items = user ? (inWorkspace ? workspaceNavForRole(user.role) : navForRole(user.role)) : [];
  const groupLabel = inWorkspace ? "Customer workspace" : "Console";


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
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item, idx) => {
                const active = pathname === item.to && idx === 0;
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
