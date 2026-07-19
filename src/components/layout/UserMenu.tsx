import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  Clock,
  KeyRound,
  KeySquare,
  LogOut,
  Monitor,
  Settings,
  Settings2,
  ShieldCheck,
  UserCog,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { ROLE_BADGE_VARIANT, ROLE_LABELS } from "@/lib/roles";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  type Section =
    | "profile"
    | "company"
    | "account"
    | "preferences"
    | "security"
    | "password"
    | "two-factor"
    | "sessions"
    | "history"
    | "notifications"
    | "api-tokens";
  const go = (section: Section) => navigate({ to: "/account", search: { section } });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 pl-1 pr-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            <Badge variant={ROLE_BADGE_VARIANT[user.role]} className="mt-1 w-fit">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("profile")}>
          <UserIcon className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("company")}>
          <Building2 className="mr-2 h-4 w-4" /> Company
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("account")}>
          <UserCog className="mr-2 h-4 w-4" /> Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("preferences")}>
          <Settings2 className="mr-2 h-4 w-4" /> Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("security")}>
          <ShieldCheck className="mr-2 h-4 w-4" /> Security
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("password")}>
          <KeyRound className="mr-2 h-4 w-4" /> Change password
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("two-factor")}>
          <ShieldCheck className="mr-2 h-4 w-4" /> Two-factor auth
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("sessions")}>
          <Monitor className="mr-2 h-4 w-4" /> Active sessions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("history")}>
          <Clock className="mr-2 h-4 w-4" /> Login history
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("password")}>
          <KeyRound className="mr-2 h-4 w-4" /> Change password
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("two-factor")}>
          <ShieldCheck className="mr-2 h-4 w-4" /> Two-factor auth
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("sessions")}>
          <Monitor className="mr-2 h-4 w-4" /> Active sessions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("notifications")}>
          <Bell className="mr-2 h-4 w-4" /> Notifications
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("api-tokens")}>
          <KeySquare className="mr-2 h-4 w-4" /> API tokens
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/select-space">
            <Settings className="mr-2 h-4 w-4" /> Switch space
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
