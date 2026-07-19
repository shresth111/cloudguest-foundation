import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService, type ExistingCustomer } from "@/services/customer.service";
import { useAuth } from "@/context/AuthContext";
import { customerKeys } from "@/hooks/useCustomer";


const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";

interface WorkspaceContextValue {
  isLoading: boolean;
  customer: ExistingCustomer | null;
  locations: ExistingCustomer["locations"];
  activeLocationId: string; // "all" or location id
  activeLocation: ExistingCustomer["locations"][number] | null;
  setActiveLocationId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data: customers, isLoading } = useQuery({
    queryKey: customerKeys.list,
    queryFn: () => customerService.listCustomers(),
  });

  // Pick the customer that matches the signed-in user's email, else first.
  const customer = useMemo<ExistingCustomer | null>(() => {
    if (!customers?.length) return null;
    const email = user?.email?.toLowerCase();
    return (
      customers.find((c) => c.owner.email.toLowerCase() === email) ?? customers[0] ?? null
    );
  }, [customers, user?.email]);

  const [activeLocationId, setActiveLocationIdState] = useState<string>("all");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_LOC_KEY);
      if (stored) setActiveLocationIdState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  // If the stored id no longer belongs to the customer, fall back to "all".
  useEffect(() => {
    if (!customer) return;
    if (activeLocationId === "all") return;
    const belongs = customer.locations.some((l) => l.id === activeLocationId);
    if (!belongs) setActiveLocationIdState("all");
  }, [customer, activeLocationId]);

  const queryClient = useQueryClient();

  const setActiveLocationId = (id: string) => {
    setActiveLocationIdState(id);
    try {
      localStorage.setItem(ACTIVE_LOC_KEY, id);
    } catch {
      /* ignore */
    }
    // Switching location must refresh every scoped surface: permissions
    // (dynamic sidebar / feature flags), dashboards, routers, guests, analytics,
    // billing, monitoring, portals, audit, notifications. Invalidating rather
    // than resetting keeps loading UI stable while data refetches in place.
    queryClient.invalidateQueries({ queryKey: ["permissions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["routers"] });
    queryClient.invalidateQueries({ queryKey: ["guests"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
    queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    queryClient.invalidateQueries({ queryKey: ["portals"] });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["locations"] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };


  const value: WorkspaceContextValue = useMemo(() => {
    const locs = customer?.locations ?? [];
    const activeLocation = locs.find((l) => l.id === activeLocationId) ?? null;
    return {
      isLoading,
      customer,
      locations: locs,
      activeLocationId,
      activeLocation,
      setActiveLocationId,
    };
  }, [customer, activeLocationId, isLoading]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
