import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MOCK = [
  { id: 1, title: "New guest registered", time: "2m ago" },
  { id: 2, title: "Access point offline: AP-04", time: "18m ago" },
  { id: 3, title: "Monthly usage report ready", time: "1h ago" },
];

export function NotificationBell() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MOCK.map((n) => (
          <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-2">
            <span className="text-sm font-medium">{n.title}</span>
            <span className="text-xs text-muted-foreground">{n.time}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
