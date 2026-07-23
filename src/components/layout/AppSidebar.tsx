import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandTitle } from "@/components/brand/BrandTitle";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { resolveIcon } from "@/lib/icons";
import { primaryRoleLabel } from "@/lib/roles";
import type { SidebarGroupDef, SidebarNode } from "@/types/permissions";

export function AppSidebar() {
  const { user, roles } = useAuth();
  const { sidebar, isLoading } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");

  const groups: SidebarGroupDef[] = inWorkspace ? sidebar.workspace : sidebar.console;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <BrandLogo size="h-8 w-8" />
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <BrandTitle className="text-sm text-sidebar-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
              Guest WiFi Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isLoading && groups.length === 0 ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md bg-sidebar-accent/60" />
            ))}
          </div>
        ) : (
          groups.map((g) => (
            <SidebarGroup key={g.id}>
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {g.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[...g.items]
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <SidebarNodeRow key={item.id} item={item} pathname={pathname} />
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <div className="px-2 py-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Signed in as{" "}
            <span className="font-medium text-sidebar-foreground">{primaryRoleLabel(roles)}</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarNodeRow({ item, pathname }: { item: SidebarNode; pathname: string }) {
  const Icon = resolveIcon(item.icon);
  const to = item.to ?? "#";
  const active =
    to === "/workspace"
      ? pathname === "/workspace"
      : pathname === to || pathname.startsWith(to + "/");

  if (item.locked) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled
          tooltip={`${item.label} — Access restricted. Contact your Administrator.`}
          className="opacity-60"
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 truncate">{item.label}</span>
          <Lock className="h-3.5 w-3.5 opacity-70" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const badgeTone =
    item.badge?.tone === "primary" ? "default" :
    item.badge?.tone === "success" ? "default" :
    item.badge?.tone === "warning" ? "secondary" :
    item.badge?.tone === "danger" ? "destructive" : "outline";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(
          "relative transition-colors",
          active &&
            "bg-sidebar-accent/70 font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-primary before:shadow-[0_0_12px_var(--sidebar-primary)] [&>a>svg]:text-sidebar-primary",
        )}
      >
        <Link to={to} className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="flex-1 truncate">{item.label}</span>
          {typeof item.counter === "number" && item.counter > 0 && (
            <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground">
              {item.counter > 99 ? "99+" : item.counter}
            </span>
          )}
          {item.badge && (
            <Badge variant={badgeTone} className="ml-auto h-4 px-1.5 text-[10px]">
              {item.badge.text}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
