import { Link } from "@tanstack/react-router";
import { Building2, ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { legacyRoleBucket } from "@/lib/roles";

export function SpaceContextChip() {
  const { user, roles } = useAuth();
  const { customer, locations, activeLocation } = useWorkspace();
  const location = activeLocation ?? locations[0];

  if (!customer || !location || !user || legacyRoleBucket(roles) === "super_admin") return null;

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className="h-9 gap-2 rounded-full border-border/70 pl-2 pr-3 shadow-sm"
    >
      <Link to="/select-space">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="h-3.5 w-3.5" />
        </span>
        <span className="hidden min-w-0 max-w-[220px] flex-col items-start leading-tight md:flex">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {customer.organizationName}
          </span>
          <span className="flex items-center gap-1 truncate text-xs font-semibold">
            <MapPin className="h-3 w-3" />
            {location.name}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Link>
    </Button>
  );
}
