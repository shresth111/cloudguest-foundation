/**
 * `/partner/users` (PRD §4.11, TASKS FE-11): the ISP's own staff only.
 * There is no way here to create a user for a customer.
 *
 * Client-side rules mirror the backend's (which enforces them regardless):
 * only an Owner grants Owner/Admin; an Admin cannot touch an Owner; owners
 * and admins are never confined.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, LogOut, Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import {
  MButton,
  MDialog,
  MDrawer,
  MEmptyState,
  MSectionHeader,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  CopyField,
  ErrorBlock,
  FormError,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useCreateIspUser,
  useForceLogoutIspUser,
  useIspCustomerOptions,
  useIspUsers,
  useResetIspUserPassword,
  useSetIspUserDisabled,
  useSetIspUserScope,
  useUpdateIspUser,
} from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import { ROLE_LABEL, formatAgo, roleLabel } from "@/lib/isp-partner/format";
import type { IspRoleSlug, IspUser } from "@/services/isp-partner/types";
import { customerLabels } from "@/lib/isp-partner/customer-label";

const CONFINABLE: IspRoleSlug[] = ["isp-noc", "isp-technician", "isp-viewer", "isp-billing"];
const ROLE_HELP: Record<IspRoleSlug, string> = {
  "isp-owner": "Runs the ISP. Everything, including staff.",
  "isp-admin": "Everything except managing Owners.",
  "isp-noc": "Watches routers and devices, reads logs, reboots devices.",
  "isp-technician": "Adds locations and routers, runs setup scripts, places devices.",
  "isp-viewer": "Read-only: overview, reports.",
  "isp-billing": "Invoices, payments and dues; can suspend a customer for dues.",
};

function grantableRoles(callerRole: string): IspRoleSlug[] {
  return callerRole === "isp-owner"
    ? ["isp-owner", "isp-admin", "isp-noc", "isp-technician", "isp-viewer", "isp-billing"]
    : ["isp-noc", "isp-technician", "isp-viewer", "isp-billing"];
}

function CustomerPicker({
  value,
  onChange,
}: {
  /** null = all customers. */
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const customers = useIspCustomerOptions();
  const labels = customerLabels(customers.data ?? []);
  const all = value === null;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => onChange(e.target.checked ? null : [])}
        />
        All customers
      </label>
      {!all && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {customers.isLoading && <Spinner />}
          {(customers.data ?? []).map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.includes(c.id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, c.id] : value.filter((id) => id !== c.id))
                }
              />
              {labels.get(c.id) ?? c.name}
            </label>
          ))}
          {customers.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">No customers yet.</p>
          )}
        </div>
      )}
      {!all && value.length === 0 && (
        <p className="text-[11px] text-destructive">
          Pick at least one customer, or tick “All customers”.
        </p>
      )}
    </div>
  );
}

function TempPasswordDialog({
  open,
  onClose,
  who,
  password,
}: {
  open: boolean;
  onClose: () => void;
  who: string;
  password: string;
}) {
  return (
    <MDialog
      open={open}
      onClose={onClose}
      title="Temporary password"
      footer={<MButton onClick={onClose}>I have copied it</MButton>}
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Give this to {who}. It is shown only now. They must choose their own password at first
          sign-in on network.wyfyguest.com.
        </p>
        <CopyField label="Temporary password" value={password} />
      </div>
    </MDialog>
  );
}

function CreateUserDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = usePartner();
  const roles = grantableRoles(me.user.role);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<IspRoleSlug>("isp-technician");
  const [scope, setScope] = useState<string[] | null>(null);
  const [welcome, setWelcome] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ who: string; password: string } | null>(null);
  const create = useCreateIspUser();

  useEffect(() => {
    if (open) {
      setFirst("");
      setLast("");
      setEmail("");
      setPhone("");
      setRole("isp-technician");
      setScope(null);
      setWelcome(true);
      setError(null);
      setFieldErrors({});
    }
  }, [open]);

  const confinable = CONFINABLE.includes(role);
  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!first.trim()) errs.first_name = "Required.";
    if (!last.trim()) errs.last_name = "Required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    if (confinable && scope !== null && scope.length === 0) return;
    setError(null);
    try {
      const res = await create.mutateAsync({
        first_name: first.trim(),
        last_name: last.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role,
        customer_ids: confinable ? scope : null,
        send_welcome_email: welcome,
      });
      toast.success(`${res.user.first_name} added as ${roleLabel(res.user.role)}.`);
      setCreated({
        who: `${res.user.first_name} ${res.user.last_name}`,
        password: res.temporary_password,
      });
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not add the user."));
    }
  };

  return (
    <>
      <MDrawer
        open={open}
        onClose={onClose}
        title="Add staff user"
        subtitle={`A member of ${me.isp.name}'s own team.`}
        footer={
          <div className="flex justify-end gap-2">
            <MButton variant="outline" onClick={onClose}>
              Cancel
            </MButton>
            <MButton onClick={submit} disabled={create.isPending}>
              {create.isPending && <Spinner />} Add user
            </MButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="First name"
              required
              value={first}
              onChange={setFirst}
              error={fieldErrors.first_name}
            />
            <TextField
              label="Last name"
              required
              value={last}
              onChange={setLast}
              error={fieldErrors.last_name}
            />
          </div>
          <TextField
            label="Email"
            required
            type="email"
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
          />
          <TextField label="Phone" value={phone} onChange={setPhone} error={fieldErrors.phone} />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <select
              className={M_INPUT}
              value={role}
              onChange={(e) => setRole(e.target.value as IspRoleSlug)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-muted-foreground">{ROLE_HELP[role]}</span>
          </label>
          {confinable ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Customers this user can see
              </span>
              <CustomerPicker value={scope} onChange={setScope} />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Owners and admins always see every customer.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={welcome}
              onChange={(e) => setWelcome(e.target.checked)}
            />
            Email them a welcome message with the sign-in link
          </label>
          <FormError message={error} />
        </div>
      </MDrawer>
      <TempPasswordDialog
        open={created !== null}
        onClose={() => setCreated(null)}
        who={created?.who ?? ""}
        password={created?.password ?? ""}
      />
    </>
  );
}

function EditUserDrawer({ user, onClose }: { user: IspUser | null; onClose: () => void }) {
  const { me } = usePartner();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<IspRoleSlug>("isp-viewer");
  const [scope, setScope] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateIspUser();
  const setUserScope = useSetIspUserScope();

  useEffect(() => {
    if (user) {
      setFirst(user.first_name);
      setLast(user.last_name);
      setPhone(user.phone ?? "");
      setRole(user.role as IspRoleSlug);
      setScope(user.customer_scope ? user.customer_scope.map((c) => c.isp_customer_id) : null);
      setError(null);
    }
  }, [user]);

  if (!user) return null;
  const roles = Array.from(new Set([...grantableRoles(me.user.role), user.role as IspRoleSlug]));
  const confinable = CONFINABLE.includes(role);
  const busy = update.isPending || setUserScope.isPending;

  const save = async () => {
    if (confinable && scope !== null && scope.length === 0) return;
    setError(null);
    try {
      await update.mutateAsync({
        id: user.id,
        body: {
          first_name: first.trim(),
          last_name: last.trim(),
          phone: phone.trim() || null,
          role,
        },
      });
      const before = user.customer_scope
        ? user.customer_scope.map((c) => c.isp_customer_id).sort()
        : null;
      const after = confinable ? (scope ? [...scope].sort() : null) : null;
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await setUserScope.mutateAsync({ id: user.id, customerIds: after });
      }
      toast.success("User saved.");
      onClose();
    } catch (err) {
      setError(ispErrorMessage(err, "Could not save the user."));
    }
  };

  return (
    <MDrawer
      open
      onClose={onClose}
      title={`Edit ${user.first_name} ${user.last_name}`}
      subtitle={user.email}
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton onClick={save} disabled={busy}>
            {busy && <Spinner />} Save
          </MButton>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name" value={first} onChange={setFirst} />
          <TextField label="Last name" value={last} onChange={setLast} />
        </div>
        <TextField label="Phone" value={phone} onChange={setPhone} />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <select
            className={M_INPUT}
            value={role}
            onChange={(e) => setRole(e.target.value as IspRoleSlug)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </label>
        {confinable && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Customers this user can see
            </span>
            <CustomerPicker value={scope} onChange={setScope} />
          </div>
        )}
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}

type Pending = { kind: "disable" | "enable" | "reset" | "logout"; user: IspUser };

export function UsersPage() {
  const { me } = usePartner();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useIspUsers({ page, page_size: 25, search: debounced || undefined });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IspUser | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ who: string; password: string } | null>(null);
  const disable = useSetIspUserDisabled();
  const reset = useResetIspUserPassword();
  const logout = useForceLogoutIspUser();
  const data = q.data;

  /** An Admin cannot change, disable or reset an Owner. */
  const mayManage = (u: IspUser) =>
    u.id !== me.user.id && (me.user.role === "isp-owner" || u.role !== "isp-owner");

  const runPending = async () => {
    if (!pending) return;
    const { kind, user } = pending;
    setActionError(null);
    try {
      if (kind === "disable" || kind === "enable") {
        await disable.mutateAsync({ id: user.id, disable: kind === "disable" });
        toast.success(kind === "disable" ? "User disabled." : "User enabled.");
      } else if (kind === "reset") {
        const res = await reset.mutateAsync(user.id);
        setTempPassword({
          who: `${user.first_name} ${user.last_name}`,
          password: res.temporary_password,
        });
      } else {
        await logout.mutateAsync(user.id);
        toast.success("Signed out on every device.");
      }
      setPending(null);
    } catch (err) {
      setActionError(ispErrorMessage(err));
    }
  };
  const busy = disable.isPending || reset.isPending || logout.isPending;

  const PENDING_TEXT: Record<Pending["kind"], { title: string; body: string; cta: string }> = {
    disable: {
      title: "Disable this user?",
      body: "They are signed out and cannot sign in until enabled again.",
      cta: "Disable",
    },
    enable: { title: "Enable this user?", body: "They can sign in again.", cta: "Enable" },
    reset: {
      title: "Reset this user's password?",
      body: "Their current password stops working. You get a temporary password to hand over; they choose a new one at sign-in.",
      cta: "Reset password",
    },
    logout: {
      title: "Sign this user out everywhere?",
      body: "Every open session of theirs ends now.",
      cta: "Sign out",
    },
  };

  return (
    <>
      <MSectionHeader
        eyebrow="Staff"
        title="Staff users"
        description="People on your team who use this console. Customers never get accounts."
        actions={
          <MButton onClick={() => setCreating(true)}>
            <Plus /> Add user
          </MButton>
        }
      />
      <input
        className={`${M_INPUT} max-w-xs`}
        placeholder="Search name or email"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="staff users" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState icon={Users} title="No users match" />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>User</MTh>
                <MTh>Role</MTh>
                <MTh>Customers</MTh>
                <MTh>Status</MTh>
                <MTh>Last sign-in</MTh>
                <MTh className="text-right">Actions</MTh>
              </>
            }
          >
            {data?.items.map((u) => (
              <MTr key={u.id}>
                <MTd>
                  <p className="font-medium">
                    {u.first_name} {u.last_name}
                    {u.id === me.user.id && (
                      <span className="text-xs text-muted-foreground"> (you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </MTd>
                <MTd className="text-xs">{roleLabel(u.role)}</MTd>
                <MTd className="text-xs">
                  {u.customer_scope === null
                    ? "All"
                    : u.customer_scope.map((c) => c.name).join(", ") || "None"}
                </MTd>
                <MTd>
                  <MTag label={u.status} tone={u.status === "active" ? "active" : "suspended"} />
                </MTd>
                <MTd className="text-xs text-muted-foreground">{formatAgo(u.last_login_at)}</MTd>
                <MTd className="text-right">
                  {mayManage(u) ? (
                    <div className="flex justify-end gap-0.5">
                      <MButton
                        variant="ghost"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => setEditing(u)}
                      >
                        <Pencil />
                      </MButton>
                      <MButton
                        variant="ghost"
                        title="Reset password"
                        aria-label="Reset password"
                        onClick={() => setPending({ kind: "reset", user: u })}
                      >
                        <KeyRound />
                      </MButton>
                      <MButton
                        variant="ghost"
                        title="Sign out everywhere"
                        aria-label="Sign out everywhere"
                        onClick={() => setPending({ kind: "logout", user: u })}
                      >
                        <LogOut />
                      </MButton>
                      {u.status === "active" ? (
                        <MButton
                          variant="ghost"
                          title="Disable"
                          aria-label="Disable"
                          onClick={() => setPending({ kind: "disable", user: u })}
                        >
                          <UserX />
                        </MButton>
                      ) : (
                        <MButton
                          variant="ghost"
                          title="Enable"
                          aria-label="Enable"
                          onClick={() => setPending({ kind: "enable", user: u })}
                        >
                          <UserCheck />
                        </MButton>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">–</span>
                  )}
                </MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}

      <CreateUserDrawer open={creating} onClose={() => setCreating(false)} />
      <EditUserDrawer user={editing} onClose={() => setEditing(null)} />
      <MDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? PENDING_TEXT[pending.kind].title : ""}
        footer={
          <>
            <MButton variant="outline" onClick={() => setPending(null)}>
              Cancel
            </MButton>
            <MButton onClick={runPending} disabled={busy}>
              {busy && <Spinner />} {pending ? PENDING_TEXT[pending.kind].cta : ""}
            </MButton>
          </>
        }
      >
        {pending && (
          <p className="text-sm text-muted-foreground">
            {pending.user.first_name} {pending.user.last_name}: {PENDING_TEXT[pending.kind].body}
          </p>
        )}
        <div className="mt-3">
          <FormError message={actionError} />
        </div>
      </MDialog>
      <TempPasswordDialog
        open={tempPassword !== null}
        onClose={() => setTempPassword(null)}
        who={tempPassword?.who ?? ""}
        password={tempPassword?.password ?? ""}
      />
    </>
  );
}
