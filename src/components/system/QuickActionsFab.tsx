import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Plus, MapPin, Router, UserPlus, Ticket, QrCode, FileBarChart, RefreshCw, HardDriveDownload, Store,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ACTIONS = [
  { label: "Add location", icon: MapPin, href: "/locations" },
  { label: "Register router", icon: Router, href: "/routers" },
  { label: "Invite user", icon: UserPlus, href: "/rbac" },
  { label: "Create voucher", icon: Ticket, action: "voucher" },
  { label: "Generate QR", icon: QrCode, action: "qr" },
  { label: "Generate report", icon: FileBarChart, href: "/analytics" },
  { label: "Restart router", icon: RefreshCw, action: "restart" },
  { label: "Backup router", icon: HardDriveDownload, action: "backup" },
  { label: "Open marketplace", icon: Store, href: "/marketplace" },
] as const;

export function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 print:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="pointer-events-auto h-12 w-12 rounded-full shadow-lg shadow-primary/20"
            aria-label="Quick actions"
          >
            <Plus className={`h-5 w-5 transition-transform ${open ? "rotate-45" : ""}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-64 p-2">
          <div className="grid gap-1">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const inner = (
                <span className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {a.label}
                </span>
              );
              if ("href" in a) {
                return (
                  <Link key={a.label} to={a.href} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={a.label}
                  className="text-left"
                  onClick={() => {
                    toast.success(`${a.label} queued`, { description: "This action is mocked in the demo environment." });
                    setOpen(false);
                  }}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
