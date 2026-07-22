import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2, Globe, MapPin, Monitor, Palette, Router, Shield, Settings, Ticket, UserPlus, Wifi, Zap,
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

const NAV_COMMANDS = [
  { id: "dashboard", label: "Open Dashboard", icon: Monitor, to: "/dashboard" },
  { id: "locations", label: "Open Locations", icon: MapPin, to: "/locations" },
  { id: "routers", label: "Open Routers", icon: Router, to: "/routers" },
  { id: "reports", label: "Open Reports", icon: Globe, to: "/analytics" },
  { id: "monitoring", label: "Open Monitoring", icon: Shield, to: "/monitoring" },
  { id: "settings", label: "Open Settings", icon: Settings, to: "/settings" },
  { id: "branding", label: "Open Branding", icon: Palette, to: "/branding" },
  { id: "guests", label: "Open Guests", icon: Wifi, to: "/guests" },
];

const ACTION_COMMANDS = [
  { id: "create-location", label: "Create Location", icon: MapPin },
  { id: "create-vlan", label: "Create VLAN", icon: Zap },
  { id: "create-user", label: "Create User", icon: UserPlus },
  { id: "generate-voucher", label: "Generate Voucher", icon: Ticket },
  { id: "reboot-device", label: "Reboot Device", icon: Router },
  { id: "new-org", label: "New Organization", icon: Building2 },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAV_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.id} onSelect={() => go(cmd.to)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {ACTION_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.id} onSelect={() => {
                if (cmd.id === "create-location") go("/locations");
                else if (cmd.id === "create-vlan") go("/network/vlan");
                else if (cmd.id === "create-user") go("/rbac");
                else if (cmd.id === "generate-voucher") go("/guests");
                else if (cmd.id === "reboot-device") go("/routers");
                else if (cmd.id === "new-org") go("/organizations");
              }}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
