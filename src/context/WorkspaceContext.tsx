import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { SiteType } from "@/types/location";
import { useAuth } from "@/context/AuthContext";

const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";

/** The current user's own organization, shaped for the workspace UI --
 * built from real `/organizations/{id}` + `/organizations/{id}/locations`
 * data. There is exactly one of these per workspace (the user's own org),
 * never a list to pick from. */
export interface ExistingCustomer {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  subscription: {
    plan: "trial" | "starter" | "professional" | "enterprise" | "custom";
    billingCycle: "monthly" | "quarterly" | "yearly";
    status: "active" | "trial" | "expired";
    expiryDate: string;
  };
  owner: {
    name: string;
    email: string;
    mobile: string;
    role: "Organization Admin";
    assignedLocations: number;
  };
  locations: Array<{ id: string; name: string; siteType: SiteType; city: string }>;
  status: "active" | "trial" | "suspended";
}

interface WorkspaceContextValue {
  isLoading: boolean;
  customer: ExistingCustomer | null;
  locations: ExistingCustomer["locations"];
  activeLocationId: string; // "all" or location id
  activeLocation: ExistingCustomer["locations"][number] | null;
  setActiveLocationId: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// `SiteType` is a straight alias of the real backend `PropertyType` enum
// (see src/types/location.ts) -- no lossy mapping needed, just a safe
// fallback for locations created before `property_type` existed.
function toSiteType(propertyType: string | null | undefined): SiteType {
  return (propertyType as SiteType) ?? "custom";
}

interface BackendOrganization {
  id: string;
  name: string;
  status: "trial" | "active" | "suspended" | "archived";
  contact_email: string;
  subscription_tier: string | null;
}

interface BackendLocation {
  id: string;
  name: string;
  city: string;
  property_type: string | null;
}

interface BackendLocationList {
  items: BackendLocation[];
}

interface BackendSubscription {
  status: string;
  billing_cycle: string;
  current_period_end: string;
}

const SUBSCRIPTION_STATUS_MAP: Record<string, ExistingCustomer["subscription"]["status"]> = {
  trialing: "trial",
  active: "active",
  past_due: "active", // grace period -- License stays usable, see renewal_service.py
  paused: "expired",
  cancelled: "expired",
};

// GET /subscriptions/{organization_id} -- real, org-scoped (subscriptions.read,
// which both Organization Owner/Admin hold). Tolerant of failure: an
// organization with no subscription row yet (or a caller who somehow lacks
// even read access) falls back to the org-status-derived guess below rather
// than breaking the whole workspace query.
async function fetchOrgSubscription(organizationId: string): Promise<BackendSubscription | null> {
  try {
    const { data } = await api.get<BackendSubscription>(`/subscriptions/${organizationId}`, {
      headers: { "X-Organization-Id": organizationId },
    });
    return data;
  } catch {
    return null;
  }
}

async function fetchActiveCustomer(
  organizationId: string,
  isPrimaryContact: boolean,
  currentUser: { name: string; email: string },
): Promise<ExistingCustomer> {
  const [{ data: org }, { data: locationList }, subscription] = await Promise.all([
    api.get<BackendOrganization>(`/organizations/${organizationId}`, {
      headers: { "X-Organization-Id": organizationId },
    }),
    api.get<BackendLocationList>(`/organizations/${organizationId}/locations`, {
      params: { page_size: 100 },
      headers: { "X-Organization-Id": organizationId },
    }),
    fetchOrgSubscription(organizationId),
  ]);

  const locations = locationList.items.map((loc) => ({
    id: loc.id,
    name: loc.name,
    siteType: toSiteType(loc.property_type),
    city: loc.city,
  }));

  const status: ExistingCustomer["status"] =
    org.status === "trial" ? "trial" : org.status === "active" ? "active" : "suspended";

  return {
    id: org.id,
    name: org.name,
    organizationId: org.id,
    organizationName: org.name,
    subscription: {
      // `plan` still reads the organization's own `subscription_tier`
      // field. `billingCycle`/`status`/`expiryDate` now come from the real
      // Billing domain (GET /subscriptions/{organization_id}) when a
      // subscription row exists; otherwise fall back to the org-status-only
      // guess this always used before that endpoint was wired here.
      plan: (org.subscription_tier as ExistingCustomer["subscription"]["plan"]) || "trial",
      billingCycle: subscription
        ? subscription.billing_cycle === "yearly"
          ? "yearly"
          : "monthly"
        : "yearly",
      status: subscription
        ? (SUBSCRIPTION_STATUS_MAP[subscription.status] ??
          (status === "suspended" ? "expired" : status))
        : status === "suspended"
          ? "expired"
          : status,
      expiryDate: subscription?.current_period_end ?? "",
    },
    owner: {
      name: isPrimaryContact ? currentUser.name : "",
      email: org.contact_email,
      mobile: "",
      role: "Organization Admin",
      assignedLocations: locations.length,
    },
    locations,
    status,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, organizations } = useAuth();
  const activeOrg = organizations[0] ?? null;

  const { data: customer, isLoading } = useQuery({
    queryKey: ["workspace", "customer", activeOrg?.organizationId],
    queryFn: () =>
      fetchActiveCustomer(activeOrg!.organizationId, activeOrg!.isPrimaryContact, {
        name: user?.name ?? "",
        email: user?.email ?? "",
      }),
    enabled: !!activeOrg,
  });

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
      customer: customer ?? null,
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
