import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomerLocation {
  id: string;
  name: string;
  city: string;
  status: "online" | "offline" | "degraded";
  onlineUsers: number;
  routerHealth: number;
  bandwidth: string;
  isp: string;
  lastSync: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  device: string;
  mac: string;
  ip: string;
  loginTime: string;
  sessionDuration: string;
  download: string;
  upload: string;
  status: "online" | "offline" | "idle";
}

interface CustomerState {
  activeLocationId: string | null;
  activeLocation: CustomerLocation | null;
  permissions: string[];
  setActiveLocation: (id: string, loc: CustomerLocation) => void;
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
