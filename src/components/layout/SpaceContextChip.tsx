import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerService } from "@/services/customer.service";
import { customerKeys } from "@/hooks/useCustomer";
import { useAuth } from "@/context/AuthContext";

const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";

export function SpaceContextChip() {
  const { user } = useAuth();
  const { data: customers } = useQuery({
    queryKey: customerKeys.list,
    queryFn: () => customerService.listCustomers(),
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setActiveId(localStorage.getItem(ACTIVE_LOC_KEY));
    } catch {
      /* ignore */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_LOC_KEY) setActiveId(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!customers?.length || !user || user.role === "super_admin") return null;

  const email = user.email.toLowerCase();
  const customer =
    customers.find((c) => c.owner.email.toLowerCase() === email) ?? customers[0];
  const location =
    customer?.locations.find((l) => l.id === activeId) ?? customer?.locations[0];

  if (!customer || !location) return null;

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
