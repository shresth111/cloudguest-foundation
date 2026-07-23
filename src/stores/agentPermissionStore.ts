import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CORE_FEATURE_IDS } from "@/config/customerFeatureCatalog";

/**
 * Per-agent feature grants configured by the customer business owner. The
 * agent's dynamic dashboard (/agent) renders exactly the intersection of the
 * feature catalog with `features` (plus always-on core features). This is
 * the seam a `GET /customer/agents` + `PATCH /customer/agents/:id/permissions`
 * pair replaces; shape mirrors that response.
 */
export interface AgentRecord {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "pending";
  dataMasking: boolean;
  /** Granted feature ids (owner-controlled, excludes always-on core). */
  features: string[];
}

interface AgentPermissionState {
  agents: AgentRecord[];
  /** Which agent the /agent surface is currently viewing as (demo/preview). */
  currentAgentId: string | null;
  addAgent: (a: Omit<AgentRecord, "id">) => string;
  updateAgent: (id: string, patch: Partial<AgentRecord>) => void;
  setAgentFeatures: (id: string, features: string[]) => void;
  removeAgent: (id: string) => void;
  setCurrentAgent: (id: string | null) => void;
  /** Effective granted set for an agent (granted ∪ core). */
  grantedFor: (id: string | null) => string[];
}

const SEED: AgentRecord[] = [
  { id: "ag-1", name: "Front Desk", email: "frontdesk@stay.com", status: "active", dataMasking: true, features: ["users", "vouchers", "devices", "alerts", "reports"] },
  { id: "ag-2", name: "Network Engineer", email: "neteng@stay.com", status: "active", dataMasking: false, features: ["networking", "hotspot", "dhcp", "vlans", "port-forwarding", "voip", "isp-routing", "isp-details", "devices", "alerts", "debugging"] },
  { id: "ag-3", name: "Marketing", email: "marketing@stay.com", status: "active", dataMasking: true, features: ["campaigns", "portal", "analytics", "reports"] },
];

export const useAgentPermissions = create<AgentPermissionState>()(
  persist(
    (set, get) => ({
      agents: SEED,
      currentAgentId: SEED[0].id,
      addAgent: (a) => {
        const id = `ag-${get().agents.length + 1}-${a.email.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
        set((s) => ({ agents: [...s.agents, { ...a, id }] }));
        return id;
      },
      updateAgent: (id, patch) =>
        set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      setAgentFeatures: (id, features) =>
        set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, features } : a)) })),
      removeAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          currentAgentId: s.currentAgentId === id ? null : s.currentAgentId,
        })),
      setCurrentAgent: (id) => set({ currentAgentId: id }),
      grantedFor: (id) => {
        const agent = get().agents.find((a) => a.id === id);
        const granted = new Set([...(agent?.features ?? []), ...CORE_FEATURE_IDS]);
        return [...granted];
      },
    }),
    { name: "cg-agent-permissions" },
  ),
);
