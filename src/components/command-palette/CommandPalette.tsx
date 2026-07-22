import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell, Building2, FileText, Globe, MapPin, Monitor, Palette, Receipt, Router, Shield, Settings,
  ShieldCheck, Ticket, UserPlus, Users, Wifi, Zap,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

// Platform Console commands -- never shown while inWorkspace (see below).
// These jump straight into Super Admin/platform-only areas
// (organizations, platform settings, branding, etc.), so they must stay
// out of reach from the customer workspace, same boundary AppSidebar/
// TopNavbar already enforce for their own nav.
const PLATFORM_NAV_COMMANDS = [
  { id: "dashboard", label: "Open Dashboard", icon: Monitor, to: "/dashboard" },
  { id: "locations", label: "Open Locations", icon: MapPin, to: "/locations" },
  { id: "routers", label: "Open Routers", icon: Router, to: "/routers" },
  { id: "reports", label: "Open Reports", icon: Globe, to: "/analytics" },
  { id: "monitoring", label: "Open Monitoring", icon: Shield, to: "/monitoring" },
  { id: "settings", label: "Open Settings", icon: Settings, to: "/settings" },
  { id: "branding", label: "Open Branding", icon: Palette, to: "/branding" },
  { id: "guests", label: "Open Guests", icon: Wifi, to: "/guests" },
];

const PLATFORM_ACTION_COMMANDS = [
  { id: "create-location", label: "Create Location", icon: MapPin, to: "/locations" },
  { id: "create-vlan", label: "Create VLAN", icon: Zap, to: "/network/vlan" },
  { id: "create-user", label: "Create User", icon: UserPlus, to: "/rbac" },
  { id: "generate-voucher", label: "Generate Voucher", icon: Ticket, to: "/guests" },
  { id: "reboot-device", label: "Reboot Device", icon: Router, to: "/routers" },
  { id: "new-org", label: "New Organization", icon: Building2, to: "/organizations" },
];

// Customer workspace commands -- only ever link within /workspace/*, never
// out to a platform-only page.
const WORKSPACE_NAV_COMMANDS = [
  { id: "ws-overview", label: "Workspace overview", icon: Monitor, to: "/workspace" },
  { id: "ws-locations", label: "Locations", icon: MapPin, to: "/workspace/locations" },
  { id: "ws-routers", label: "Routers", icon: Router, to: "/workspace/routers" },
  { id: "ws-guests", label: "Guests", icon: Users, to: "/workspace/guests" },
  { id: "ws-analytics", label: "Analytics", icon: Globe, to: "/workspace/analytics" },
  { id: "ws-reports", label: "Reports", icon: FileText, to: "/workspace/reports" },
  { id: "ws-billing", label: "Billing", icon: Receipt, to: "/workspace/billing" },
  { id: "ws-notifications", label: "Notifications", icon: Bell, to: "/workspace/notifications" },
  { id: "ws-agent", label: "Agent dashboard", icon: ShieldCheck, to: "/workspace/agent" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    navigate({ to });
    setOpen(false);
  };

  const navCommands = inWorkspace ? WORKSPACE_NAV_COMMANDS : PLATFORM_NAV_COMMANDS;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navCommands.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.id} onSelect={() => go(cmd.to)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {!inWorkspace && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {PLATFORM_ACTION_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem key={cmd.id} onSelect={() => go(cmd.to)}>
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{cmd.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
