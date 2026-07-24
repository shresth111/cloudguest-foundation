import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CORE_FEATURE_IDS } from "@/config/customerFeatureCatalog";

/**
 * Per-agent feature grants configured by the customer business owner. The
 * agent's dynamic dashboard (/agent) renders exactly the intersection of the
 * feature catalog with the agent's *role* permissions (plus always-on core
 * features). This is the seam a `GET /customer/agents` + `GET /customer/
 * agent-roles` + `PATCH .../permissions` set replaces; shape mirrors that
 * response.
 */
export interface AgentRole {
  id: string;
  name: string;
  /** Granted feature ids for this role (owner-controlled, excludes always-on core). */
  features: string[];
  /** The seeded Read-Only role -- name/permissions can't be edited or deleted. */
  locked?: boolean;
}

export interface AgentRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  status: "active" | "inactive" | "pending";
  dataMasking: boolean;
  roleId: string;
  /** Location ids this agent can access. */
  locations: string[];
}

export const READ_ONLY_ROLE_ID = "role-read-only";
export const LOCATIONS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];

const SEED_ROLES: AgentRole[] = [
  { id: READ_ONLY_ROLE_ID, name: "Read-Only", features: ["policies", "whitelist"], locked: true },
  { id: "role-front-desk", name: "Front Desk", features: ["users", "vouchers", "devices", "alerts", "reports"] },
  { id: "role-net-eng", name: "Network Engineer", features: ["hotspot", "dhcp", "vlans", "port-forwarding", "voip", "isp-routing", "isp-details", "devices", "alerts", "debugging"] },
  { id: "role-marketing", name: "Marketing", features: ["campaigns", "portal", "reports"] },
];

const SEED_AGENTS: AgentRecord[] = [
  { id: "ag-1", name: "Front Desk", email: "frontdesk@stay.com", mobile: "+919876543210", status: "active", dataMasking: true, roleId: "role-front-desk", locations: ["Marina Bay Hotel"] },
  { id: "ag-2", name: "Network Engineer", email: "neteng@stay.com", mobile: "+919812345678", status: "active", dataMasking: false, roleId: "role-net-eng", locations: LOCATIONS },
  { id: "ag-3", name: "Marketing", email: "marketing@stay.com", mobile: "+919900001111", status: "active", dataMasking: true, roleId: "role-marketing", locations: ["Marina Bay Hotel", "Downtown CoWork"] },
];

interface AgentPermissionState {
  agents: AgentRecord[];
  roles: AgentRole[];
  /** Which agent the /agent surface is currently viewing as (demo/preview). */
  currentAgentId: string | null;
  addAgent: (a: Omit<AgentRecord, "id">) => string;
  updateAgent: (id: string, patch: Partial<AgentRecord>) => void;
  removeAgent: (id: string) => void;
  setCurrentAgent: (id: string | null) => void;
  addRole: (name: string) => string;
  updateRoleFeatures: (id: string, features: string[]) => void;
  renameRole: (id: string, name: string) => void;
  removeRole: (id: string) => void;
  /** Effective granted set for an agent (role's features ∪ core). */
  grantedFor: (id: string | null) => string[];
}

export const useAgentPermissions = create<AgentPermissionState>()(
  persist(
    (set, get) => ({
      agents: SEED_AGENTS,
      roles: SEED_ROLES,
      currentAgentId: SEED_AGENTS[0].id,
      addAgent: (a) => {
        const id = `ag-${get().agents.length + 1}-${a.email.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
        set((s) => ({ agents: [...s.agents, { ...a, id }] }));
        return id;
      },
      updateAgent: (id, patch) =>
        set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          currentAgentId: s.currentAgentId === id ? null : s.currentAgentId,
        })),
      setCurrentAgent: (id) => set({ currentAgentId: id }),
      addRole: (name) => {
        const id = `role-${Date.now()}`;
        set((s) => ({ roles: [...s.roles, { id, name, features: [] }] }));
        return id;
      },
      updateRoleFeatures: (id, features) =>
        set((s) => ({ roles: s.roles.map((r) => (r.id === id && !r.locked ? { ...r, features } : r)) })),
      renameRole: (id, name) =>
        set((s) => ({ roles: s.roles.map((r) => (r.id === id && !r.locked ? { ...r, name } : r)) })),
      removeRole: (id) =>
        set((s) => ({
          roles: s.roles.filter((r) => r.id !== id || r.locked),
          agents: s.agents.map((a) => (a.roleId === id ? { ...a, roleId: READ_ONLY_ROLE_ID } : a)),
        })),
      grantedFor: (id) => {
        const agent = get().agents.find((a) => a.id === id);
        const role = get().roles.find((r) => r.id === agent?.roleId);
        const granted = new Set([...(role?.features ?? []), ...CORE_FEATURE_IDS]);
        return [...granted];
      },
    }),
    { name: "cg-agent-permissions", version: 2 },
  ),
);
