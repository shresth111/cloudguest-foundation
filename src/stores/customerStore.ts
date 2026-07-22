import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomerLocationSummary } from "@/services/customer.service";

interface CustomerState {
  activeLocationId: string | null;
  activeLocation: CustomerLocationSummary | null;
  permissions: string[];
  setActiveLocation: (id: string, loc: CustomerLocationSummary) => void;
  clearLocation: () => void;
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      activeLocationId: null,
      activeLocation: null,
      permissions: [
        "view_dashboard", "view_users", "disconnect_users", "export_users",
        "view_analytics", "view_reports", "view_campaigns", "view_portal",
        "manage_vouchers", "view_policies", "view_whitelist", "view_devices",
        "manage_teams", "manage_agents", "view_networking", "view_advanced",
        "view_audit", "view_help",
      ],
      setActiveLocation: (id, loc) => set({ activeLocationId: id, activeLocation: loc }),
      clearLocation: () => set({ activeLocationId: null, activeLocation: null }),
    }),
    { name: "cg-customer" }
  )
);
