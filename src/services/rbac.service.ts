import type {
  RbacUser,
  RbacRole,
  RbacDepartment,
  RbacUserGroup,
  RbacInvitation,
  RbacSession,
  RbacLoginEvent,
  RbacLocationNode,
  RbacKpis,
  RbacPasswordPolicy,
  RbacMfaState,
  RbacPermissions,
  PermissionAction,
} from "@/types/rbac";
import { PERMISSION_ACTIONS, RBAC_MODULES } from "@/types/rbac";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

const ORGS: Array<[string, string]> = [
  ["ORG-01000", "Nimbus Hospitality"],
  ["ORG-01001", "Vertex Retail"],
  ["ORG-01002", "Halo Group"],
  ["ORG-01003", "Orbit Holdings"],
];

const LOCATION_TREE: RbacLocationNode[] = [
  {
    id: "ORG-01000",
    name: "Nimbus Hospitality",
    children: [
      { id: "LOC-DEL", name: "Hotel Delhi" },
      { id: "LOC-BOM", name: "Hotel Mumbai" },
      { id: "LOC-GOA", name: "Hotel Goa" },
      { id: "LOC-JAI", name: "Hotel Jaipur" },
    ],
  },
  {
    id: "ORG-01001",
    name: "Vertex Retail",
    children: [
      { id: "LOC-NYC", name: "Vertex NYC Central" },
      { id: "LOC-CHI", name: "Vertex Chicago" },
    ],
  },
];

const DEPARTMENTS: RbacDepartment[] = [
  { id: "dep-it", name: "IT", members: 12 },
  { id: "dep-net", name: "Network", members: 8 },
  { id: "dep-ops", name: "Operations", members: 20 },
  { id: "dep-mkt", name: "Marketing", members: 7 },
  { id: "dep-fin", name: "Finance", members: 5 },
  { id: "dep-rec", name: "Reception", members: 14 },
  { id: "dep-mgt", name: "Management", members: 4 },
  { id: "dep-sup", name: "Support", members: 9 },
];

function allTrue(): RbacPermissions {
  const out: RbacPermissions = {};
  for (const m of RBAC_MODULES) {
    out[m.key] = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, true])) as Record<PermissionAction, boolean>;
  }
  return out;
}
function readOnly(): RbacPermissions {
  const out: RbacPermissions = {};
  for (const m of RBAC_MODULES) out[m.key] = { view: true, export: true };
  return out;
}
function subset(view: Partial<Record<PermissionAction, boolean>>, modules: string[]): RbacPermissions {
  const out: RbacPermissions = {};
  for (const k of modules) (out as Record<string, typeof view>)[k] = { ...view };
  return out;
}

const ROLES: RbacRole[] = [
  { id: "role-super", name: "Super Admin", description: "Full platform access.", isSystem: true, usersAssigned: 3, status: "active", createdAt: Date.now() - 8.64e7 * 90, permissions: allTrue() },
  { id: "role-plat", name: "Platform Admin", description: "Platform-wide administration.", isSystem: true, usersAssigned: 6, status: "active", createdAt: Date.now() - 8.64e7 * 80, permissions: allTrue() },
  { id: "role-org", name: "Organization Admin", description: "Manage a single organization.", isSystem: true, usersAssigned: 22, status: "active", createdAt: Date.now() - 8.64e7 * 60, permissions: subset({ view: true, create: true, edit: true, delete: true, export: true, configure: true }, ["dashboard","locations","routers","guests","portal","monitoring","analytics","billing","white_label","audit","settings"]) },
  { id: "role-hotel", name: "Hotel Manager", description: "Manages one hotel property.", isSystem: true, usersAssigned: 40, status: "active", createdAt: Date.now() - 8.64e7 * 50, permissions: subset({ view: true, edit: true, export: true }, ["dashboard","locations","routers","guests","portal","monitoring","analytics"]) },
  { id: "role-branch", name: "Branch Manager", description: "Manages a single branch.", isSystem: true, usersAssigned: 32, status: "active", createdAt: Date.now() - 8.64e7 * 45, permissions: subset({ view: true, edit: true }, ["dashboard","locations","routers","guests","portal","monitoring"]) },
  { id: "role-net", name: "Network Administrator", description: "Network and infrastructure control.", isSystem: true, usersAssigned: 18, status: "active", createdAt: Date.now() - 8.64e7 * 40, permissions: subset({ view: true, create: true, edit: true, configure: true }, ["routers","monitoring","settings","integrations","api"]) },
  { id: "role-it", name: "IT Administrator", description: "IT operations and support.", isSystem: true, usersAssigned: 15, status: "active", createdAt: Date.now() - 8.64e7 * 35, permissions: subset({ view: true, edit: true, configure: true }, ["routers","monitoring","settings","integrations","support","audit"]) },
  { id: "role-recept", name: "Receptionist", description: "Front-desk guest handling.", isSystem: true, usersAssigned: 55, status: "active", createdAt: Date.now() - 8.64e7 * 30, permissions: subset({ view: true, create: true }, ["guests","portal"]) },
  { id: "role-mkt", name: "Marketing Manager", description: "Portal branding and campaigns.", isSystem: true, usersAssigned: 12, status: "active", createdAt: Date.now() - 8.64e7 * 25, permissions: subset({ view: true, create: true, edit: true, publish: true }, ["portal","white_label","analytics"]) },
  { id: "role-bill", name: "Billing Manager", description: "Billing and subscriptions.", isSystem: true, usersAssigned: 6, status: "active", createdAt: Date.now() - 8.64e7 * 22, permissions: subset({ view: true, create: true, edit: true, approve: true, export: true }, ["billing","analytics","organizations"]) },
  { id: "role-sup", name: "Support Engineer", description: "Tenant-level support.", isSystem: true, usersAssigned: 10, status: "active", createdAt: Date.now() - 8.64e7 * 18, permissions: subset({ view: true, edit: true }, ["dashboard","routers","guests","monitoring","support","audit"]) },
  { id: "role-ro", name: "Read Only User", description: "View-only access.", isSystem: true, usersAssigned: 24, status: "active", createdAt: Date.now() - 8.64e7 * 10, permissions: readOnly() },
];

const AVATARS = ["#0EA5E9", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];
const FIRST = ["Ava", "Liam", "Priya", "Diego", "Yuki", "Noah", "Aisha", "Zara", "Mateo", "Kai", "Elena", "Rohan", "Anya", "Omar", "Sofia", "Ethan"];
const LAST = ["Chen", "Patel", "Reyes", "Kim", "Nakamura", "Silva", "Khan", "Ortega", "Rossi", "Sato", "Novak", "Iyer", "Volkov", "Ali", "Costa", "Park"];
const LANGS = ["en", "hi", "fr", "es"];
const TZS = ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Singapore"];

const USERS: RbacUser[] = Array.from({ length: 48 }).map((_, i) => {
  const org = ORGS[i % ORGS.length];
  const role = ROLES[i % ROLES.length];
  const dep = DEPARTMENTS[i % DEPARTMENTS.length];
  const fn = FIRST[i % FIRST.length];
  const ln = LAST[(i * 3) % LAST.length];
  return {
    id: `USR-${(1000 + i).toString()}`,
    firstName: fn,
    lastName: ln,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${org[1].split(" ")[0].toLowerCase()}.io`,
    mobile: `+1 555 010 ${(2200 + i).toString().padStart(4, "0")}`,
    organizationId: org[0],
    organizationName: org[1],
    locationIds: i % 5 === 0 ? [] : [LOCATION_TREE[i % 2].children![i % LOCATION_TREE[i % 2].children!.length].id],
    departmentId: dep.id,
    departmentName: dep.name,
    designation: ["Manager", "Engineer", "Analyst", "Lead", "Specialist"][i % 5],
    roleId: role.id,
    roleName: role.name,
    status: (i % 11 === 0 ? "disabled" : i % 13 === 0 ? "invited" : i % 17 === 0 ? "locked" : "active") as RbacUser["status"],
    lastLoginAt: Date.now() - i * 3.6e6,
    mfaEnabled: i % 3 !== 0,
    language: LANGS[i % LANGS.length],
    timezone: TZS[i % TZS.length],
    avatarColor: AVATARS[i % AVATARS.length],
    createdAt: Date.now() - i * 8.64e7,
  };
});

const GROUPS: RbacUserGroup[] = [
  { id: "grp-1", name: "Front Desk NA", description: "North America reception team", memberIds: USERS.slice(0, 6).map((u) => u.id), roleId: "role-recept" },
  { id: "grp-2", name: "Global Network Ops", description: "Tier-2 network engineering", memberIds: USERS.slice(6, 11).map((u) => u.id), roleId: "role-net" },
  { id: "grp-3", name: "Marketing Growth", description: "Campaigns and portal experience", memberIds: USERS.slice(11, 14).map((u) => u.id), roleId: "role-mkt" },
];

const INVITES: RbacInvitation[] = [
  { id: "inv-1", email: "priya.sharma@nimbus.io", roleId: "role-hotel", roleName: "Hotel Manager", organizationName: "Nimbus Hospitality", status: "pending", invitedBy: "Ava Chen", invitedAt: Date.now() - 6 * 3.6e6, expiresAt: Date.now() + 6 * 8.64e7 },
  { id: "inv-2", email: "diego.reyes@vertex.io", roleId: "role-branch", roleName: "Branch Manager", organizationName: "Vertex Retail", status: "pending", invitedBy: "Liam Patel", invitedAt: Date.now() - 26 * 3.6e6, expiresAt: Date.now() + 4 * 8.64e7 },
  { id: "inv-3", email: "yuki.nakamura@halo.io", roleId: "role-sup", roleName: "Support Engineer", organizationName: "Halo Group", status: "accepted", invitedBy: "Ava Chen", invitedAt: Date.now() - 4 * 8.64e7, expiresAt: Date.now() + 3 * 8.64e7 },
  { id: "inv-4", email: "omar.khan@orbit.io", roleId: "role-ro", roleName: "Read Only User", organizationName: "Orbit Holdings", status: "expired", invitedBy: "Noah Silva", invitedAt: Date.now() - 22 * 8.64e7, expiresAt: Date.now() - 8 * 8.64e7 },
];

const SESSIONS: RbacSession[] = USERS.slice(0, 12).map((u, i) => ({
  id: `SES-${uid()}`,
  userId: u.id,
  userName: `${u.firstName} ${u.lastName}`,
  device: ["MacBook Pro", "iPhone 15", "Windows 11", "iPad Pro", "Pixel 8"][i % 5],
  browser: ["Chrome 129", "Safari 17", "Firefox 130", "Edge 128"][i % 4],
  os: ["macOS 14", "iOS 17", "Windows 11", "Android 14"][i % 4],
  ipAddress: `10.42.${i}.${100 + i}`,
  location: ["San Francisco", "Mumbai", "London", "Tokyo", "Dubai"][i % 5],
  loginAt: Date.now() - i * 45 * 60_000,
  current: i === 0,
}));

const LOGIN_HISTORY: RbacLoginEvent[] = Array.from({ length: 80 }).map((_, i) => {
  const u = USERS[i % USERS.length];
  const outcome: RbacLoginEvent["outcome"] = i % 9 === 0 ? "failed" : "success";
  return {
    id: `LGE-${1000 + i}`,
    userId: u.id,
    userName: `${u.firstName} ${u.lastName}`,
    loginAt: Date.now() - i * 45 * 60_000,
    logoutAt: outcome === "success" ? Date.now() - (i * 45 - 30) * 60_000 : undefined,
    browser: ["Chrome 129", "Safari 17", "Firefox 130", "Edge 128"][i % 4],
    device: ["MacBook Pro", "iPhone 15", "Windows 11"][i % 3],
    os: ["macOS 14", "iOS 17", "Windows 11"][i % 3],
    ipAddress: `10.42.${i % 40}.${20 + (i % 200)}`,
    mfaUsed: i % 4 !== 0,
    outcome,
    reason: outcome === "failed" ? ["Wrong password", "MFA denied", "Unknown device"][i % 3] : undefined,
  };
});

let PASSWORD_POLICY: RbacPasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
  expiryDays: 90,
  historyCount: 5,
  lockoutAttempts: 5,
  lockoutMinutes: 30,
};

let MFA_STATE: RbacMfaState = {
  enabled: true,
  methods: ["authenticator", "email"],
  lastVerifiedAt: Date.now() - 6 * 3.6e6,
  backupCodesRemaining: 6,
};

function computeKpis(): RbacKpis {
  return {
    totalUsers: USERS.length,
    activeUsers: USERS.filter((u) => u.status === "active").length,
    disabledUsers: USERS.filter((u) => u.status === "disabled").length,
    totalRoles: ROLES.length,
    customRoles: ROLES.filter((r) => !r.isSystem).length,
    pendingInvites: INVITES.filter((i) => i.status === "pending").length,
    activeSessions: SESSIONS.length,
    failedLogins24h: LOGIN_HISTORY.filter((e) => e.outcome === "failed" && Date.now() - e.loginAt < 86_400_000).length,
  };
}

export const rbacService = {
  async getKpis() { await delay(150); return computeKpis(); },
  async getUsers() { await delay(200); return [...USERS]; },
  async getRoles() { await delay(200); return [...ROLES]; },
  async getDepartments() { await delay(120); return [...DEPARTMENTS]; },
  async getGroups() { await delay(150); return [...GROUPS]; },
  async getInvitations() { await delay(120); return [...INVITES]; },
  async getSessions() { await delay(150); return [...SESSIONS]; },
  async getLoginHistory() { await delay(180); return [...LOGIN_HISTORY]; },
  async getLocationTree() { await delay(80); return LOCATION_TREE; },
  async getOrganizations() { await delay(50); return ORGS.map(([id, name]) => ({ id, name })); },
  async getPasswordPolicy() { await delay(100); return PASSWORD_POLICY; },
  async savePasswordPolicy(next: RbacPasswordPolicy) { await delay(300); PASSWORD_POLICY = next; return next; },
  async getMfaState() { await delay(100); return MFA_STATE; },
  async setMfa(next: Partial<RbacMfaState>) { await delay(250); MFA_STATE = { ...MFA_STATE, ...next }; return MFA_STATE; },

  async createUser(input: Omit<RbacUser, "id" | "createdAt" | "avatarColor" | "organizationName" | "departmentName" | "roleName" | "mfaEnabled" | "status">) {
    await delay(400);
    const org = ORGS.find((o) => o[0] === input.organizationId)!;
    const dep = DEPARTMENTS.find((d) => d.id === input.departmentId)!;
    const role = ROLES.find((r) => r.id === input.roleId)!;
    const user: RbacUser = {
      ...input,
      id: `USR-${1000 + USERS.length}`,
      organizationName: org[1],
      departmentName: dep.name,
      roleName: role.name,
      status: "invited",
      mfaEnabled: false,
      avatarColor: AVATARS[USERS.length % AVATARS.length],
      createdAt: Date.now(),
    };
    USERS.unshift(user);
    role.usersAssigned += 1;
    return user;
  },
  async updateUser(id: string, patch: Partial<RbacUser>) {
    await delay(300);
    const idx = USERS.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error("User not found");
    USERS[idx] = { ...USERS[idx], ...patch };
    return USERS[idx];
  },
  async deleteUser(id: string) { await delay(300); const idx = USERS.findIndex((u) => u.id === id); if (idx >= 0) USERS.splice(idx, 1); return true; },
  async resetPassword(id: string) { await delay(400); return { ok: true, id }; },
  async resetMfa(id: string) { await delay(400); const u = USERS.find((x) => x.id === id); if (u) u.mfaEnabled = false; return { ok: true }; },
  async setUserStatus(id: string, status: RbacUser["status"]) { await delay(200); const u = USERS.find((x) => x.id === id); if (u) u.status = status; return u; },
  async bulkUpdateStatus(ids: string[], status: RbacUser["status"]) { await delay(300); ids.forEach((id) => { const u = USERS.find((x) => x.id === id); if (u) u.status = status; }); return ids.length; },

  async saveRole(role: RbacRole) {
    await delay(300);
    const idx = ROLES.findIndex((r) => r.id === role.id);
    if (idx >= 0) ROLES[idx] = role; else ROLES.unshift({ ...role, id: `role-${uid()}`, createdAt: Date.now(), usersAssigned: 0, isSystem: false });
    return role;
  },
  async duplicateRole(id: string) { await delay(250); const src = ROLES.find((r) => r.id === id); if (!src) throw new Error("Role not found"); const copy: RbacRole = { ...src, id: `role-${uid()}`, name: `${src.name} (Copy)`, isSystem: false, usersAssigned: 0, createdAt: Date.now(), status: "active" }; ROLES.unshift(copy); return copy; },
  async archiveRole(id: string) { await delay(200); const r = ROLES.find((x) => x.id === id); if (r && !r.isSystem) r.status = "archived"; return r; },
  async deleteRole(id: string) { await delay(200); const idx = ROLES.findIndex((r) => r.id === id); if (idx >= 0 && !ROLES[idx].isSystem) ROLES.splice(idx, 1); return true; },

  async createInvitation(email: string, roleId: string) {
    await delay(300);
    const role = ROLES.find((r) => r.id === roleId)!;
    const inv: RbacInvitation = { id: `inv-${uid()}`, email, roleId, roleName: role.name, organizationName: ORGS[0][1], status: "pending", invitedBy: "You", invitedAt: Date.now(), expiresAt: Date.now() + 7 * 8.64e7 };
    INVITES.unshift(inv);
    return inv;
  },
  async resendInvitation(id: string) { await delay(250); return { ok: true, id }; },
  async cancelInvitation(id: string) { await delay(200); const idx = INVITES.findIndex((i) => i.id === id); if (idx >= 0) INVITES.splice(idx, 1); return true; },

  async terminateSession(id: string) { await delay(200); const idx = SESSIONS.findIndex((s) => s.id === id); if (idx >= 0) SESSIONS.splice(idx, 1); return true; },
  async terminateAllSessions() { await delay(300); const kept = SESSIONS.filter((s) => s.current); SESSIONS.length = 0; SESSIONS.push(...kept); return true; },
};
