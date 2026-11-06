/**
 * Owner-side agent & role manager. Roles carry the feature grants; agents
 * are mapped to a role plus status/masking/locations. The Default "Read-Only"
 * role is seeded locked (Dashboard, Policies & Whitelist only) and can't be
 * renamed, re-permissioned, or deleted. Backed by the shared
 * agentPermissionStore so the /agent surface reflects changes immediately.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ShieldCheck,
  Eye,
  ExternalLink,
  Check,
  Lock,
  Pencil,
  Users2,
  UserCog2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Callout,
  EmptyState,
  FilterChip,
  FormField,
  PageHeader,
  Panel,
  StatusBadge,
  SubTabs,
  type ConsoleStatus,
  type PageScope,
} from "@/components/customer/console";
import { cn } from "@/lib/utils";
import { FEATURE_GROUPS, ALL_FEATURES } from "@/config/customerFeatureCatalog";
import { useAgentPermissions, LOCATIONS } from "@/stores/agentPermissionStore";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { useAuth } from "@/context/AuthContext";
import { rbacService } from "@/services/rbac.service";
import { rbacKeys } from "@/hooks/useRbac";
import {
  DeleteRoleDialog,
  EditRoleDialog,
  RoleForm,
  type RoleFormValue,
} from "@/components/features/StaffAccessRoleForm";
import { isBuiltInRole, isProtectedOwnerRole } from "@/lib/staffAccessRoles";
import { resolveOrgId } from "@/services/customer.service";
import type { AppError } from "@/services/api";
import type { Permission, PermissionGroup, Role as RbacRole, ScopeType } from "@/types/rbac";
import { SCOPE_TYPE_LABEL } from "@/types/rbac";

/** Real users/roles shown in place of the local demo store once logged in
 * for real. Role *permission editing* (the checkbox grid) is real too, but
 * driven by the real RBAC permission catalog (`rbacService.listPermissionGroups`
 * / `listPermissions`, fine-grained keys like "campaigns.read") rather than
 * this file's local `FEATURE_GROUPS`/`ALL_FEATURES` catalog -- the two
 * vocabularies don't map 1:1, so the demo catalog is only ever used for the
 * `demo` branch below, never for real accounts. */
interface RealAgent {
  id: string;
  name: string;
  email: string;
  mobile: string;
  status: "active" | "inactive" | "pending";
  roleId: string;
  roleName: string;
  dataMasking: boolean;
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "role"
  );
}

const EMPTY_ROLE_FORM: RoleFormValue = {
  name: "",
  scopeType: "organization",
  permissionKeys: new Set(),
};

/** The backend's own reason (e.g. "Role 'X' is still assigned to 2 staff
 * members...") when there is one, else a generic fallback. */
function roleErrorMessage(err: unknown, fallback: string): string {
  const message = (err as Partial<AppError> | null)?.message;
  return message ? message : `${fallback} Check the connection and try again.`;
}

/** A native <select> dressed as the console's Input. */
const SELECT_CLS =
  "flex h-9 w-full rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-3 text-sm text-[var(--wy-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] max-sm:h-10";

/** A selectable list row (a staff member, a role): accent outline + soft
 * fill when selected, visible focus ring. */
function selectRowCls(selected: boolean) {
  return cn(
    "flex min-h-11 w-full items-center gap-3 rounded-[var(--wy-radius)] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
    selected
      ? "border-[var(--wy-accent)] bg-[var(--wy-accent-soft)]"
      : "border-[var(--wy-border)] bg-[var(--wy-surface)] hover:bg-[var(--wy-surface-2)]",
  );
}

/** One permission in a checklist: icon/label + a check box. */
function permRowCls(on: boolean) {
  return cn(
    "flex min-h-10 items-center gap-2.5 rounded-[var(--wy-radius)] border px-2.5 py-2 text-left text-[13px]",
    on
      ? "border-[color-mix(in_srgb,var(--wy-accent)_40%,transparent)] bg-[var(--wy-accent-soft)]"
      : "border-[var(--wy-border)] bg-[var(--wy-surface)]",
  );
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border",
        on
          ? "border-[var(--wy-accent)] bg-[var(--wy-accent)] text-[var(--wy-accent-fg)]"
          : "border-[var(--wy-border-strong)]",
      )}
    >
      {on && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}

/** A role's icon tile: neutral when locked, accent otherwise. */
function iconTileCls(locked: boolean, size: "sm" | "lg" = "sm") {
  return cn(
    "grid shrink-0 place-items-center rounded-[var(--wy-radius)]",
    size === "lg" ? "h-10 w-10" : "h-9 w-9",
    locked
      ? "bg-[var(--wy-surface-2)] text-[var(--wy-text-faint)]"
      : "bg-[var(--wy-accent-soft)] text-[var(--wy-accent)]",
  );
}

const GROUP_LABEL =
  "mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--wy-text-faint)]";
const LIST_HEADING =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--wy-text-faint)]";
const DETAIL_CARD =
  "flex flex-wrap items-center justify-between gap-3 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-4 shadow-[var(--wy-shadow)]";
const DASHED_EMPTY =
  "flex items-center justify-center rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border-strong)] p-16 text-center text-[13px] text-[var(--wy-text-muted)]";
const CORE_TAG =
  "rounded-full border border-[var(--wy-border)] px-1.5 text-[11px] font-medium text-[var(--wy-text-faint)]";

/** Staff status -> console status (was Badge default/secondary/outline). */
const STAFF_STATUS: Record<string, ConsoleStatus> = {
  active: "ok",
  pending: "info",
  inactive: "offline",
};

function passwordStrength(pw: string): { label: string; pct: number; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too weak", color: "bg-[var(--wy-crit)]" },
    { label: "Weak", color: "bg-[var(--wy-crit)]" },
    { label: "Fair", color: "bg-[var(--wy-warn)]" },
    { label: "Good", color: "bg-[var(--wy-warn)]" },
    { label: "Strong", color: "bg-[var(--wy-ok)]" },
    { label: "Very strong", color: "bg-[var(--wy-ok)]" },
  ];
  const lvl = levels[Math.min(score, levels.length - 1)];
  return { ...lvl, pct: pw ? (score / 5) * 100 : 0 };
}

export function AgentsPage({ locationId, scope }: { locationId?: string; scope?: PageScope } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const demo = useIsDemo();
  const { user: currentUser } = useAuth();
  const {
    agents: storeAgents,
    roles,
    addAgent,
    updateAgent: updateStoreAgent,
    removeAgent: removeStoreAgent,
    setCurrentAgent,
    addRole,
    updateRoleFeatures,
    renameRole,
    removeRole,
  } = useAgentPermissions();
  const [tab, setTab] = useState<"agents" | "roles">("agents");

  const [realAgents, setRealAgents] = useState<RealAgent[]>([]);
  const [realRoles, setRealRoles] = useState<RbacRole[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [realPermissionGroups, setRealPermissionGroups] = useState<PermissionGroup[]>([]);
  const [realPermissions, setRealPermissions] = useState<Permission[]>([]);

  /** Loads (or reloads) the real users/roles/permission catalog. Re-run
   * after a role edit or delete rather than patching local state: editing a
   * built-in role replaces it with an organization-owned copy under a new
   * id and moves staff onto it, so both lists change at once. */
  const loadRealData = useCallback(async () => {
    try {
      const org = await resolveOrgId();
      setOrgId(org);
      const [users, roleList, groups, perms] = await Promise.all([
        rbacService.listUsers({ page: 1, pageSize: 50 }, org),
        rbacService.listRoles(org),
        rbacService.listPermissionGroups(org),
        rbacService.listPermissions(undefined, org),
      ]);
      setRealRoles(roleList);
      // Resolve each user's actual assigned role (GET /users doesn't
      // return it inline -- a separate GET /users/{id}/roles per row is
      // the only way) so the list shows the real role name -- notably
      // "Organization Owner" for whoever holds it, instead of every real
      // agent always reading "No role" -- and so isOwnerRole below can
      // reliably tell the Owner's own row apart from every other agent.
      const withRoles = await Promise.all(
        users.items.map(async (u): Promise<RealAgent> => {
          const base = {
            id: u.id,
            name: u.fullName,
            email: u.email,
            mobile: u.phone ?? "",
            status: (u.isActive ? "active" : "inactive") as RealAgent["status"],
            dataMasking: u.dataMaskingEnabled,
          };
          try {
            const assignments = await rbacService.listUserRoleAssignments(u.id, org);
            const active = assignments.find((a) => a.isActive && a.organizationId === org);
            const role = active ? roleList.find((r) => r.id === active.roleId) : undefined;
            return { ...base, roleId: role?.id ?? "", roleName: role?.name ?? "—" };
          } catch {
            return { ...base, roleId: "", roleName: "—" };
          }
        }),
      );
      // The Organization Owner is the one granting/managing agent access
      // from this very page -- not one of the agents being managed --
      // so exclude that row from the list entirely rather than just
      // hiding its delete button (see isOwnerRole below, kept as a
      // defense-in-depth guard in case this filter ever misses a row,
      // e.g. a role lookup that failed above).
      setRealAgents(
        withRoles.filter(
          (a) => roleList.find((r) => r.id === a.roleId)?.slug !== "organization-owner",
        ),
      );
      setRealPermissionGroups(groups.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setRealPermissions(perms.filter((p) => p.isActive));
    } catch {
      // Leave real lists empty -- the "no agents yet" state is accurate.
    }
  }, []);

  useEffect(() => {
    if (demo) return;
    void loadRealData();
  }, [demo, loadRealData]);

  const agents = demo ? storeAgents : realAgents.map((a) => ({ ...a, locations: [] as string[] }));
  const roleOptions = demo
    ? roles.map((r) => ({ id: r.id, name: r.name }))
    : realRoles.map((r) => ({ id: r.id, name: r.name }));

  /** A role can only be assigned at the single scope it was created for
   * (see Role.scopeType) -- e.g. "Helpdesk" is location-scoped, "Organization
   * Owner" is organization-scoped; the backend 400s ("Role 'X' cannot be
   * assigned at 'organization' scope") if you send the wrong one. Real
   * roles carry their own scopeType; this resolves the right
   * organizationId/locationId pair to send for whichever role got picked. */
  function scopeArgsForRole(roleId: string): {
    scopeType: ScopeType;
    organizationId?: string;
    locationId?: string;
  } {
    const role = realRoles.find((r) => r.id === roleId);
    const scopeType = role?.scopeType ?? "organization";
    if (scopeType === "location" && locationId) return { scopeType, locationId };
    return { scopeType: "organization" as ScopeType, organizationId: orgId ?? undefined };
  }

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    roleId: "",
    locations: [] as string[],
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0]?.id ?? null);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  // -- Real (non-demo) role editor: driven by the real permission catalog,
  // not the local store/feature catalog above. See the module docstring.
  const [selectedRealRoleId, setSelectedRealRoleId] = useState<string | null>(null);
  const [creatingRealRole, setCreatingRealRole] = useState(false);
  const [newRealRole, setNewRealRole] = useState<RoleFormValue>(EMPTY_ROLE_FORM);
  const [creatingRealRoleBusy, setCreatingRealRoleBusy] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<RbacRole | null>(null);

  const selectedRealRole = realRoles.find((r) => r.id === selectedRealRoleId) ?? null;

  // Default to the first role once the real list loads, and fall back to it
  // again when the selected role disappears (deleted, or replaced by this
  // organization's own copy after an edit).
  useEffect(() => {
    if (demo || realRoles.length === 0) return;
    if (!selectedRealRoleId || !realRoles.some((r) => r.id === selectedRealRoleId))
      setSelectedRealRoleId(realRoles[0].id);
  }, [demo, realRoles, selectedRealRoleId]);

  /** Edit and delete refetch the page's lists and anything else reading
   * roles through react-query (the Master console's role table). */
  const refreshAfterRoleChange = async () => {
    await loadRealData();
    queryClient.invalidateQueries({ queryKey: rbacKeys.roles });
    queryClient.invalidateQueries({ queryKey: rbacKeys.kpis });
  };

  const saveEditedRole = async (role: RbacRole, value: RoleFormValue) => {
    try {
      const updated = await rbacService.updateRole(
        role.id,
        {
          name: value.name.trim() || role.name,
          permissionKeys: Array.from(value.permissionKeys),
        },
        orgId ?? undefined,
      );
      setEditingRole(null);
      toast.success(
        updated.id === role.id
          ? "Role saved"
          : `Saved "${updated.name}" as your organization's own role`,
      );
      await refreshAfterRoleChange();
      // A built-in role comes back as this organization's copy under a new
      // id. Selected only after the refetch: the fallback-to-first-role
      // effect above would otherwise reset a selection the old list lacks.
      setSelectedRealRoleId(updated.id);
    } catch (err) {
      toast.error(roleErrorMessage(err, "Could not save the role."));
      throw err;
    }
  };

  const confirmDeleteRole = async (role: RbacRole) => {
    try {
      await rbacService.deleteRole(role.id, orgId ?? undefined);
      setDeletingRole(null);
      toast.success("Role deleted");
      await refreshAfterRoleChange();
    } catch (err) {
      // e.g. 409 "Role 'X' is still assigned to 2 staff members. Reassign
      // them to another role first" -- the backend's reason is the message.
      toast.error(roleErrorMessage(err, "Could not delete the role."));
      throw err;
    }
  };

  const createRealRole = async () => {
    if (!newRealRole.name.trim()) {
      toast.error("Give the role a name.");
      return;
    }
    if (!orgId) {
      toast.error("No organization found for this session.");
      return;
    }
    if (newRealRole.scopeType === "location" && !locationId) {
      toast.error("Open this page from a specific location to create a location-scoped role.");
      return;
    }
    setCreatingRealRoleBusy(true);
    try {
      const role = await rbacService.createRole(
        {
          name: newRealRole.name.trim(),
          slug: `${slugify(newRealRole.name)}-${Math.random().toString(36).slice(2, 6)}`,
          scopeType: newRealRole.scopeType,
          organizationId: orgId,
          permissionKeys: Array.from(newRealRole.permissionKeys),
        },
        orgId,
      );
      setRealRoles((p) => [role, ...p]);
      setSelectedRealRoleId(role.id);
      setCreatingRealRole(false);
      setNewRealRole(EMPTY_ROLE_FORM);
      toast.success("Role created");
    } catch (err) {
      toast.error(roleErrorMessage(err, "Could not create the role."));
    } finally {
      setCreatingRealRoleBusy(false);
    }
  };

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0] ?? null;
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  // Changing your own role here can strip the very roles.assign/users.read
  // permission this page needs, self-locking you out before a replacement
  // role is even in place (see updateAgent's ordering fix's comment) --
  // simplest safe guard is to just not let it happen from this panel.
  // Someone else with admin access can change it instead.
  const isSelf = !demo && !!currentUser && selected?.id === currentUser.id;
  // The Organization Owner row (real accounts only -- the demo store has no
  // real-RBAC "organization-owner" slug to key off of): the backend already
  // refuses to remove an org's sole Owner (LastOrganizationOwnerError), so a
  // delete button here would recreate exactly the "looks like it works but
  // doesn't" problem the roles-tab's own missing delete affordance (see the
  // comment above createRealRole) was written to avoid.
  const isOwnerRole =
    !demo &&
    !!selected &&
    realRoles.find((r) => r.id === selected.roleId)?.slug === "organization-owner";
  const strength = passwordStrength(form.password);

  const create = async () => {
    if (!form.name || !form.email || (demo && !form.password) || !form.roleId) {
      toast.error(`Fill in name, email${demo ? ", password" : ""} and role.`);
      return;
    }
    if (demo) {
      const id = addAgent({
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        status: "pending",
        dataMasking: true,
        roleId: form.roleId,
        locations: form.locations,
      });
      setForm({
        name: "",
        email: "",
        mobile: "",
        password: "",
        roleId: roleOptions[0]?.id ?? "",
        locations: [],
      });
      setCreating(false);
      setSelectedId(id);
      toast.success("Staff member created");
      return;
    }
    if (!orgId) {
      toast.error("No organization found for this session.");
      return;
    }
    try {
      const [firstName, ...rest] = form.name.trim().split(" ");
      const roleScope = scopeArgsForRole(form.roleId);
      // POST /users/invite's initial_role_id only ever assigns at
      // ORGANIZATION scope (backend constraint) -- pass it there only when
      // that's actually the role's scope; otherwise invite with no role and
      // assign it as a separate call so a location-scoped role (e.g.
      // "Helpdesk") lands correctly instead of 400ing.
      const invited = await rbacService.inviteUser({
        firstName,
        lastName: rest.join(" ") || firstName,
        email: form.email,
        username: form.email.split("@")[0],
        phone: form.mobile || null,
        organizationId: orgId,
        initialRoleId: roleScope.scopeType === "organization" ? form.roleId : undefined,
      });
      if (roleScope.scopeType !== "organization") {
        await rbacService.assignRole(invited.user.id, { roleId: form.roleId, ...roleScope }, orgId);
      }
      setRealAgents((p) => [
        {
          id: invited.user.id,
          name: invited.user.fullName,
          email: invited.user.email,
          mobile: invited.user.phone ?? "",
          status: "pending",
          roleId: form.roleId,
          roleName: roleOptions.find((r) => r.id === form.roleId)?.name ?? "—",
          dataMasking: invited.user.dataMaskingEnabled,
        },
        ...p,
      ]);
      setForm({
        name: "",
        email: "",
        mobile: "",
        password: "",
        roleId: roleOptions[0]?.id ?? "",
        locations: [],
      });
      setCreating(false);
      setSelectedId(invited.user.id);
      toast.success("Staff member invited");
    } catch {
      toast.error("Could not invite the staff member — check the connection and try again.");
    }
  };

  const updateAgent = (
    id: string,
    patch: {
      status?: "active" | "inactive" | "pending";
      dataMasking?: boolean;
      roleId?: string;
      locations?: string[];
    },
  ) => {
    if (demo) {
      updateStoreAgent(id, patch);
      return;
    }
    const prev = realAgents.find((a) => a.id === id);
    const prevRole = prev?.roleId;
    setRealAgents((p) =>
      p.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              roleName: patch.roleId
                ? (roleOptions.find((r) => r.id === patch.roleId)?.name ?? "—")
                : a.roleName,
            }
          : a,
      ),
    );
    (async () => {
      try {
        if (patch.status === "active") await rbacService.activateUser(id, orgId ?? undefined);
        else if (patch.status === "inactive")
          await rbacService.deactivateUser(id, orgId ?? undefined);
        if (patch.dataMasking !== undefined)
          await rbacService.updateUser(
            id,
            { dataMaskingEnabled: patch.dataMasking },
            orgId ?? undefined,
          );
        if (patch.roleId && patch.roleId !== prevRole && orgId) {
          // Selecting a role in this dropdown replaces whatever role this
          // agent held in this org, it doesn't add a second one. Assign the
          // new role BEFORE revoking the old one -- not the other way
          // around: if the caller is changing their *own* role, revoking
          // first can strip the very roles.assign/users.read permission the
          // next step needs, self-locking them out before the new role is
          // even in place. Assigning first means the permission check for
          // that call still sees the (soon-to-be-old) role active.
          const existing = await rbacService.listUserRoleAssignments(id, orgId);
          await rbacService.assignRole(
            id,
            { roleId: patch.roleId, ...scopeArgsForRole(patch.roleId) },
            orgId,
          );
          // The revoke half of a downgrade can be legitimately rejected --
          // e.g. the backend's LastOrganizationOwnerError guard refusing to
          // strip an organization's sole remaining Organization Owner role
          // (see RBACService._assert_not_last_organization_owner). Surface
          // that instead of swallowing it as a generic failure below, and
          // don't leave the optimistic UI showing a role change that the
          // server only half-applied.
          await Promise.all(
            existing
              .filter(
                (a) => a.isActive && (a.organizationId === orgId || a.locationId === locationId),
              )
              .map((a) => rbacService.revokeRoleAssignment(id, a.id, orgId)),
          );
          toast.success("Role updated");
        }
      } catch (err) {
        // Roll back the optimistic patch above -- the server rejected (or
        // only partially applied) this change, so the list/detail view must
        // not keep showing a role/status/masking value that isn't actually
        // in effect.
        if (prev) setRealAgents((p) => p.map((a) => (a.id === id ? prev : a)));
        toast.error((err as AppError).message || "Could not update on the server.");
      }
    })();
  };

  const removeAgent = (id: string) => {
    if (demo) {
      removeStoreAgent(id);
      return;
    }
    // Optimistic, so restore the row if the server refuses: it used to stay
    // gone until a refresh while the staff member was still active.
    const removed = realAgents.find((a) => a.id === id);
    const index = realAgents.findIndex((a) => a.id === id);
    setRealAgents((p) => p.filter((a) => a.id !== id));
    rbacService.deactivateUser(id, orgId ?? undefined).catch((err) => {
      if (removed) {
        setRealAgents((p) => {
          if (p.some((a) => a.id === id)) return p;
          const next = [...p];
          next.splice(Math.min(Math.max(index, 0), next.length), 0, removed);
          return next;
        });
      }
      toast.error((err as AppError).message || "Could not deactivate on the server.");
    });
  };

  const toggleLocation = (loc: string) => {
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(loc)
        ? f.locations.filter((l) => l !== loc)
        : [...f.locations, loc],
    }));
  };

  const previewAs = (id: string) => {
    setCurrentAgent(id);
    navigate({ to: "/agent" });
  };

  const toggleRoleFeature = (id: string) => {
    if (!selectedRole || selectedRole.locked) return;
    const has = selectedRole.features.includes(id);
    updateRoleFeatures(
      selectedRole.id,
      has ? selectedRole.features.filter((f) => f !== id) : [...selectedRole.features, id],
    );
  };

  const createRole = () => {
    if (!newRoleName.trim()) return;
    const id = addRole(newRoleName.trim());
    setNewRoleName("");
    setAddingRole(false);
    setSelectedRoleId(id);
    setTab("roles");
    toast.success("Role created");
  };

  return (
    <div className="wy-console space-y-5">
      {/* The page's only header (the shell hands over the tab name + venue;
          the agent view mounts it bare). Icon tile and illustration gone. */}
      <PageHeader
        title={scope?.title ?? "Staff Access"}
        venue={scope?.venue}
        description="Use role-based access control to limit the features your team can access."
      />

      <SubTabs
        ariaLabel="Staff Access"
        idPrefix="staff-access"
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "agents",
            label: (
              <>
                <Users2 aria-hidden className="h-4 w-4" />
                Staff
              </>
            ),
          },
          {
            value: "roles",
            label: (
              <>
                <UserCog2 aria-hidden className="h-4 w-4" />
                Roles
              </>
            ),
          },
        ]}
      />

      <div
        role="tabpanel"
        id="staff-access-panel"
        aria-labelledby={`staff-access-tab-${tab}`}
        className="space-y-5"
      >
        {tab === "roles" && demo && (
          <div className="space-y-3">
            <Callout tone="info">
              Default Staff Role is a Read-Only role &amp; can't be modified. Its permissions are
              limited to Dashboard, Usage Limits &amp; Guest Allow-list by default.
            </Callout>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr] [&>*]:min-w-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={LIST_HEADING}>Roles</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setAddingRole((v) => !v)}
                  >
                    <Plus className="h-4 w-4" /> Add New Role
                  </Button>
                </div>
                {addingRole && (
                  <div className="space-y-2 rounded-[var(--wy-radius)] border border-[var(--wy-accent)] bg-[var(--wy-surface)] p-4">
                    <Input
                      aria-label="Role name"
                      placeholder="Role name"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="h-9"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 flex-1" onClick={createRole}>
                        Create
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setAddingRole(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={selectedRoleId === r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      className={selectRowCls(selectedRoleId === r.id)}
                    >
                      <span className={iconTileCls(!!r.locked)}>
                        {r.locked ? <Lock className="h-4 w-4" /> : <UserCog2 className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{r.name}</p>
                        <p className="truncate text-xs text-[var(--wy-text-muted)]">
                          {r.features.length} permissions{r.locked ? " · locked" : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedRole ? (
                <div className="space-y-4">
                  <div className={DETAIL_CARD}>
                    <div className="flex items-center gap-3">
                      <span className={iconTileCls(!!selectedRole.locked, "lg")}>
                        {selectedRole.locked ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <UserCog2 className="h-5 w-5" />
                        )}
                      </span>
                      {selectedRole.locked ? (
                        <p className="font-semibold">{selectedRole.name}</p>
                      ) : (
                        <input
                          aria-label="Role name"
                          defaultValue={selectedRole.name}
                          onBlur={(e) =>
                            e.target.value.trim() &&
                            renameRole(selectedRole.id, e.target.value.trim())
                          }
                          className="rounded-[var(--wy-radius)] border border-transparent bg-transparent px-1 font-semibold outline-none hover:border-[var(--wy-border-strong)] focus-visible:border-[var(--wy-accent)] focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                        />
                      )}
                    </div>
                    {!selectedRole.locked && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() =>
                            updateRoleFeatures(
                              selectedRole.id,
                              ALL_FEATURES.filter((f) => !f.core).map((f) => f.id),
                            )
                          }
                        >
                          Select All
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => updateRoleFeatures(selectedRole.id, [])}
                        >
                          Deselect All
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete role"
                          className="h-8 text-xs text-[var(--wy-crit)] max-sm:h-10"
                          onClick={() => {
                            removeRole(selectedRole.id);
                            setSelectedRoleId(roles[0]?.id ?? null);
                            toast.success("Role deleted");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Panel title="Select Permissions" bodyClassName="space-y-5">
                    {FEATURE_GROUPS.map((g) => (
                      <div key={g.group}>
                        <p className={GROUP_LABEL}>{g.group}</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {g.items.map((item) => {
                            const Icon = item.icon;
                            const on = item.core || selectedRole.features.includes(item.id);
                            const disabled = item.core || selectedRole.locked;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                disabled={disabled}
                                onClick={() => toggleRoleFeature(item.id)}
                                className={cn(
                                  permRowCls(on),
                                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
                                  !on && !disabled && "hover:bg-[var(--wy-surface-2)]",
                                  disabled && !item.core && "cursor-not-allowed opacity-60",
                                  item.core && "opacity-70",
                                )}
                              >
                                <Icon
                                  aria-hidden
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    on ? "text-[var(--wy-accent)]" : "text-[var(--wy-text-faint)]",
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {item.label}
                                </span>
                                {item.core ? (
                                  <span className={CORE_TAG}>Core</span>
                                ) : (
                                  <CheckBox on={on} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </Panel>
                </div>
              ) : (
                <div className={DASHED_EMPTY}>Select or create a role to edit its permissions.</div>
              )}
            </div>
          </div>
        )}

        {tab === "roles" && !demo && (
          <div className="space-y-3">
            <Callout tone="info">
              Roles here are real RBAC roles — permissions are the platform's fine-grained
              permission keys (e.g.{" "}
              <code className="rounded bg-[var(--wy-surface)] px-1 py-0.5 font-mono text-xs">
                campaigns.read
              </code>
              ), grouped below by module. A role's scope (Organization vs Location) is fixed at
              creation and can't be changed later. Built-in roles can be edited too: saving one
              creates your organization's own copy, so other organizations aren't affected.
            </Callout>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr] [&>*]:min-w-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={LIST_HEADING}>Roles</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setCreatingRealRole((v) => !v)}
                  >
                    <Plus className="h-4 w-4" /> Add New Role
                  </Button>
                </div>

                {creatingRealRole && (
                  <div className="space-y-2 rounded-[var(--wy-radius)] border border-[var(--wy-accent)] bg-[var(--wy-surface)] p-4">
                    <RoleForm
                      value={newRealRole}
                      onChange={setNewRealRole}
                      permissionGroups={realPermissionGroups}
                      permissions={realPermissions}
                      locationId={locationId}
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-8 flex-1"
                        onClick={createRealRole}
                        disabled={creatingRealRoleBusy}
                      >
                        {creatingRealRoleBusy ? "Creating…" : "Create"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setCreatingRealRole(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {realRoles.length === 0 && (
                    <EmptyState
                      icon={UserCog2}
                      title="No roles yet"
                      description="Create a role above to grant your team access."
                    />
                  )}
                  {realRoles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={selectedRealRoleId === r.id}
                      onClick={() => setSelectedRealRoleId(r.id)}
                      className={selectRowCls(selectedRealRoleId === r.id)}
                    >
                      <span className={iconTileCls(isProtectedOwnerRole(r))}>
                        {isProtectedOwnerRole(r) ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <UserCog2 className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{r.name}</p>
                        <p className="truncate text-xs text-[var(--wy-text-muted)]">
                          {r.permissions.length} permissions · {SCOPE_TYPE_LABEL[r.scopeType]}
                          {isBuiltInRole(r) ? " · built-in" : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedRealRole ? (
                <div className="space-y-4">
                  <div className={DETAIL_CARD}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={iconTileCls(isProtectedOwnerRole(selectedRealRole), "lg")}>
                        {isProtectedOwnerRole(selectedRealRole) ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <UserCog2 className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{selectedRealRole.name}</p>
                        <p className="text-xs text-[var(--wy-text-muted)]">
                          {SCOPE_TYPE_LABEL[selectedRealRole.scopeType]} scope
                          {isBuiltInRole(selectedRealRole) ? " · built-in role" : ""}
                          {isProtectedOwnerRole(selectedRealRole)
                            ? " · locked, it keeps your organization able to manage staff access"
                            : ""}
                        </p>
                      </div>
                    </div>
                    {!isProtectedOwnerRole(selectedRealRole) && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setEditingRole(selectedRealRole)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-[var(--wy-crit)] max-sm:h-10"
                          onClick={() => setDeletingRole(selectedRealRole)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  <Panel title="Permissions" bodyClassName="space-y-5">
                    {realPermissionGroups.map((g) => {
                      const items = realPermissions.filter((p) => p.permissionGroupId === g.id);
                      if (items.length === 0) return null;
                      return (
                        <div key={g.id}>
                          <p className={GROUP_LABEL}>{g.name}</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((p) => {
                              const on = selectedRealRole.permissions.includes(p.key);
                              return (
                                <div
                                  key={p.id}
                                  title={p.description ?? p.key}
                                  className={cn(permRowCls(on), !on && "opacity-60")}
                                >
                                  <span className="min-w-0 flex-1 truncate font-medium">
                                    {p.name}
                                  </span>
                                  <CheckBox on={on} />
                                  <span className="sr-only">{on ? "granted" : "not granted"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </Panel>
                </div>
              ) : (
                <div className={DASHED_EMPTY}>Select or create a role to see its permissions.</div>
              )}
            </div>

            <EditRoleDialog
              role={editingRole}
              onClose={() => setEditingRole(null)}
              onSave={saveEditedRole}
              permissionGroups={realPermissionGroups}
              permissions={realPermissions}
              locationId={locationId}
            />
            <DeleteRoleDialog
              role={deletingRole}
              onClose={() => setDeletingRole(null)}
              onConfirm={confirmDeleteRole}
            />
          </div>
        )}

        {tab === "agents" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr] [&>*]:min-w-0">
            {/* Agent list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={LIST_HEADING}>Staff</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setCreating((v) => !v)}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              {creating && (
                <div className="space-y-3 rounded-[var(--wy-radius)] border border-[var(--wy-accent)] bg-[var(--wy-surface)] p-4">
                  <FormField label="Name" htmlFor="staff-new-name">
                    <Input
                      id="staff-new-name"
                      placeholder="Enter Staff Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-9"
                    />
                  </FormField>
                  <FormField label="Email" htmlFor="staff-new-email">
                    <Input
                      id="staff-new-email"
                      placeholder="Enter Staff Email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="h-9"
                    />
                  </FormField>
                  {demo && (
                    <FormField label="Password" htmlFor="staff-new-password">
                      <Input
                        id="staff-new-password"
                        type="password"
                        placeholder="Choose Password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="h-9"
                      />
                      {form.password && (
                        <div className="mt-1.5">
                          <div className="h-1 overflow-hidden rounded-full bg-[var(--wy-surface-2)]">
                            <div
                              className={cn("h-full rounded-full transition-all", strength.color)}
                              style={{ width: `${strength.pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--wy-text-muted)]">
                            Password strength: {strength.label}
                          </p>
                        </div>
                      )}
                    </FormField>
                  )}
                  {!demo && (
                    <Callout tone="info" className="text-xs">
                      A temporary password will be generated and the staff member invited by email.
                    </Callout>
                  )}
                  <FormField label="Mobile No." htmlFor="staff-new-mobile">
                    <Input
                      id="staff-new-mobile"
                      placeholder="Enter Staff's Mobile Number"
                      value={form.mobile}
                      onChange={(e) =>
                        setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })
                      }
                      className="h-9"
                    />
                  </FormField>
                  <FormField label="Staff Role" htmlFor="staff-new-role">
                    <select
                      id="staff-new-role"
                      value={form.roleId}
                      onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                      className={SELECT_CLS}
                    >
                      <option value="">Choose a role</option>
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {demo && (
                    <fieldset className="min-w-0">
                      <legend className="mb-1.5 text-xs font-medium text-[var(--wy-text)]">
                        Select Locations
                      </legend>
                      <div className="flex flex-wrap gap-1.5">
                        {LOCATIONS.map((loc) => (
                          <FilterChip
                            key={loc}
                            pressed={form.locations.includes(loc)}
                            onClick={() => toggleLocation(loc)}
                          >
                            {loc}
                          </FilterChip>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 flex-1" onClick={create}>
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setCreating(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {agents.length === 0 && (
                  <EmptyState
                    icon={Users2}
                    title="No staff yet"
                    description="Add a staff member above to invite them to your team."
                  />
                )}
                {agents.map((a) => {
                  const role = roleOptions.find((r) => r.id === a.roleId);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={selectedId === a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={selectRowCls(selectedId === a.id)}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-[var(--wy-accent-soft)] text-xs font-semibold text-[var(--wy-accent)]">
                          {a.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{a.name}</p>
                        <p className="truncate text-xs text-[var(--wy-text-muted)]">
                          {role?.name ?? "No role"}
                        </p>
                      </div>
                      <StatusBadge
                        status={STAFF_STATUS[a.status] ?? "offline"}
                        className="capitalize"
                      >
                        {a.status}
                      </StatusBadge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agent detail */}
            {selected ? (
              <div className="space-y-4">
                <div className={DETAIL_CARD}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[var(--wy-accent-soft)] font-semibold text-[var(--wy-accent)]">
                        {selected.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{selected.name}</p>
                      <p className="break-all text-xs text-[var(--wy-text-muted)]">
                        {selected.email}
                        {selected.mobile ? ` · ${selected.mobile}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={selected.status === "active"}
                        onCheckedChange={(v) =>
                          updateAgent(selected.id, { status: v ? "active" : "inactive" })
                        }
                      />{" "}
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={selected.dataMasking}
                        onCheckedChange={(v) => updateAgent(selected.id, { dataMasking: v })}
                      />{" "}
                      Data masking
                    </label>
                    {demo && (
                      <Button size="sm" variant="outline" onClick={() => previewAs(selected.id)}>
                        <Eye className="h-4 w-4" /> Preview as staff{" "}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!isOwnerRole && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Remove staff member"
                        className="text-[var(--wy-crit)] max-sm:h-10"
                        onClick={() => {
                          removeAgent(selected.id);
                          setSelectedId(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <Panel bodyClassName="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Staff Role"
                    htmlFor="staff-role"
                    hint={
                      isSelf
                        ? "You can't change your own role here -- ask another admin to do it."
                        : undefined
                    }
                  >
                    <select
                      id="staff-role"
                      value={selected.roleId}
                      disabled={isSelf}
                      onChange={(e) => updateAgent(selected.id, { roleId: e.target.value })}
                      className={cn(SELECT_CLS, isSelf && "cursor-not-allowed opacity-60")}
                      title={
                        isSelf
                          ? "You can't change your own role -- ask another admin to change it for you."
                          : undefined
                      }
                    >
                      <option value="">No role</option>
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {demo && (
                    <fieldset className="min-w-0">
                      <legend className="mb-1.5 text-xs font-medium text-[var(--wy-text)]">
                        Select Locations
                      </legend>
                      <div className="flex flex-wrap gap-1.5">
                        {LOCATIONS.map((loc) => {
                          const on = selected.locations.includes(loc);
                          return (
                            <FilterChip
                              key={loc}
                              pressed={on}
                              onClick={() =>
                                updateAgent(selected.id, {
                                  locations: on
                                    ? selected.locations.filter((l) => l !== loc)
                                    : [...selected.locations, loc],
                                })
                              }
                            >
                              {loc}
                            </FilterChip>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                </Panel>

                {!demo && (
                  <Panel bodyClassName="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--wy-text-muted)]">
                    <span>
                      Permissions are set by the role you assign to this staff member, not by this
                      page.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setTab("roles")}
                    >
                      View role permissions
                    </Button>
                  </Panel>
                )}

                {demo && (
                  <Panel
                    title={
                      <span className="flex items-center gap-2">
                        <ShieldCheck aria-hidden className="h-4 w-4 text-[var(--wy-accent)]" />
                        Permissions from role: {roles.find((r) => r.id === selected.roleId)?.name}
                      </span>
                    }
                    bodyClassName="space-y-5"
                    actions={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => setTab("roles")}
                      >
                        Edit role permissions
                      </Button>
                    }
                  >
                    {FEATURE_GROUPS.map((g) => {
                      const role = roles.find((r) => r.id === selected.roleId);
                      const items = g.items.filter((i) => i.core || role?.features.includes(i.id));
                      if (items.length === 0) return null;
                      return (
                        <div key={g.group}>
                          <p className={GROUP_LABEL}>{g.group}</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((item) => {
                              const Icon = item.icon;
                              return (
                                <div key={item.id} className={permRowCls(true)}>
                                  <Icon
                                    aria-hidden
                                    className="h-4 w-4 shrink-0 text-[var(--wy-accent)]"
                                  />
                                  <span className="min-w-0 flex-1 truncate font-medium">
                                    {item.label}
                                  </span>
                                  {item.core && <span className={CORE_TAG}>Core</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </Panel>
                )}
              </div>
            ) : (
              <div className={DASHED_EMPTY}>Select or create a staff member to manage access.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
