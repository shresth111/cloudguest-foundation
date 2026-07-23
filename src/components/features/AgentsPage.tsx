/**
 * Owner-side agent & role manager. Roles carry the feature grants; agents
 * are mapped to a role plus status/masking/locations. The Default "Read-Only"
 * role is seeded locked (Dashboard, Policies & Whitelist only) and can't be
 * renamed, re-permissioned, or deleted. Backed by the shared
 * agentPermissionStore so the /agent surface reflects changes immediately.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, ShieldCheck, Eye, ExternalLink, Check, Lock, Users2, UserCog2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FEATURE_GROUPS, ALL_FEATURES } from "@/config/customerFeatureCatalog";
import { useAgentPermissions, LOCATIONS } from "@/stores/agentPermissionStore";

const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

function passwordStrength(pw: string): { label: string; pct: number; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too weak", color: "bg-rose-500" },
    { label: "Weak", color: "bg-rose-500" },
    { label: "Fair", color: "bg-amber-500" },
    { label: "Good", color: "bg-amber-500" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Very strong", color: "bg-emerald-500" },
  ];
  const lvl = levels[Math.min(score, levels.length - 1)];
  return { ...lvl, pct: pw ? (score / 5) * 100 : 0 };
}

export function AgentsPage() {
  const navigate = useNavigate();
  const { agents, roles, addAgent, updateAgent, removeAgent, setCurrentAgent, addRole, updateRoleFeatures, renameRole, removeRole } = useAgentPermissions();
  const [tab, setTab] = useState<"agents" | "roles">("agents");

  const [selectedId, setSelectedId] = useState<string | null>(agents[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", roleId: roles[0]?.id ?? "", locations: [] as string[] });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0]?.id ?? null);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  const selected = agents.find((a) => a.id === selectedId) ?? null;
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const strength = passwordStrength(form.password);

  const create = () => {
    if (!form.name || !form.email || !form.password || !form.roleId) { toast.error("Fill in name, email, password and role."); return; }
    const id = addAgent({ name: form.name, email: form.email, mobile: form.mobile, status: "pending", dataMasking: true, roleId: form.roleId, locations: form.locations });
    setForm({ name: "", email: "", mobile: "", password: "", roleId: roles[0]?.id ?? "", locations: [] });
    setCreating(false);
    setSelectedId(id);
    toast.success("Agent created");
  };

  const toggleLocation = (loc: string) => {
    setForm((f) => ({ ...f, locations: f.locations.includes(loc) ? f.locations.filter((l) => l !== loc) : [...f.locations, loc] }));
  };

  const previewAs = (id: string) => {
    setCurrentAgent(id);
    navigate({ to: "/agent" });
  };

  const toggleRoleFeature = (id: string) => {
    if (!selectedRole || selectedRole.locked) return;
    const has = selectedRole.features.includes(id);
    updateRoleFeatures(selectedRole.id, has ? selectedRole.features.filter((f) => f !== id) : [...selectedRole.features, id]);
  };

  const createRole = () => {
    if (!newRoleName.trim()) return;
    const id = addRole(newRoleName.trim());
    setNewRoleName(""); setAddingRole(false);
    setSelectedRoleId(id);
    setTab("roles");
    toast.success("Role created");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><ShieldCheck className="h-6 w-6 text-primary" /> Manage Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use role-based access control to limit the features your team can access.</p>
      </div>

      <div className="inline-flex rounded-xl border bg-muted/40 p-1">
        <button onClick={() => setTab("agents")} className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors", tab === "agents" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Users2 className="h-4 w-4" />Manage Agents
        </button>
        <button onClick={() => setTab("roles")} className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors", tab === "roles" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <UserCog2 className="h-4 w-4" />Manage Roles
        </button>
      </div>

      {tab === "roles" && (
        <div className="space-y-3">
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Default Agent Role is a Read-Only role &amp; can't be modified. Its permissions are limited to Dashboard, Fair Usage Policy &amp; Whitelisting by default.</p>
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Roles</h3>
                <Button size="sm" variant="outline" className="h-8" onClick={() => setAddingRole((v) => !v)}><Plus className="h-4 w-4" /> Add New Role</Button>
              </div>
              {addingRole && (
                <Card className="rounded-2xl border-primary/40"><CardContent className="space-y-2 p-4">
                  <Input placeholder="Role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="h-9" />
                  <div className="flex gap-2"><Button size="sm" className="h-8 flex-1" onClick={createRole}>Create</Button><Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingRole(false)}>Cancel</Button></div>
                </CardContent></Card>
              )}
              <div className="space-y-2">
                {roles.map((r) => (
                  <button key={r.id} onClick={() => setSelectedRoleId(r.id)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors", selectedRoleId === r.id ? "border-primary bg-primary/5" : "hover:bg-accent")}>
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", r.locked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>{r.locked ? <Lock className="h-4 w-4" /> : <UserCog2 className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.features.length} permissions{r.locked ? " · locked" : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedRole ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("grid h-11 w-11 place-items-center rounded-xl", selectedRole.locked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>{selectedRole.locked ? <Lock className="h-5 w-5" /> : <UserCog2 className="h-5 w-5" />}</span>
                    {selectedRole.locked ? (
                      <p className="font-semibold">{selectedRole.name}</p>
                    ) : (
                      <input defaultValue={selectedRole.name} onBlur={(e) => e.target.value.trim() && renameRole(selectedRole.id, e.target.value.trim())} className="rounded-lg border border-transparent bg-transparent px-1 font-semibold outline-none hover:border-input focus:border-primary" />
                    )}
                  </div>
                  {!selectedRole.locked && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => updateRoleFeatures(selectedRole.id, ALL_FEATURES.filter((f) => !f.core).map((f) => f.id))}>Select All</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => updateRoleFeatures(selectedRole.id, [])}>Deselect All</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => { removeRole(selectedRole.id); setSelectedRoleId(roles[0]?.id ?? null); toast.success("Role deleted"); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>

                <Card className="rounded-2xl">
                  <CardHeader><CardTitle className="text-base">Select Permissions</CardTitle></CardHeader>
                  <CardContent className="space-y-5">
                    {FEATURE_GROUPS.map((g) => (
                      <div key={g.group}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {g.items.map((item) => {
                            const Icon = item.icon;
                            const on = item.core || selectedRole.features.includes(item.id);
                            const disabled = item.core || selectedRole.locked;
                            return (
                              <button
                                key={item.id}
                                disabled={disabled}
                                onClick={() => toggleRoleFeature(item.id)}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm transition-colors",
                                  on ? "border-primary/50 bg-primary/5" : "hover:bg-accent",
                                  disabled && !item.core && "cursor-not-allowed opacity-60",
                                  item.core && "opacity-70",
                                )}
                              >
                                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}><Icon className="h-4 w-4" /></span>
                                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                                {item.core ? (
                                  <Badge variant="outline" className="text-[9px]">Core</Badge>
                                ) : (
                                  <span className={cn("grid h-5 w-5 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="h-3.5 w-3.5" />}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed p-16 text-sm text-muted-foreground">Select or create a role to edit its permissions.</div>
            )}
          </div>
        </div>
      )}

      {tab === "agents" && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Agent list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agents</h3>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setCreating((v) => !v)}><Plus className="h-4 w-4" /> Add</Button>
            </div>

            {creating && (
              <Card className="rounded-2xl border-primary/40">
                <CardContent className="space-y-3 p-4">
                  <div><label className={labelCls}>Name</label><Input placeholder="Enter Agent Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" /></div>
                  <div><label className={labelCls}>Email</label><Input placeholder="Enter Agent Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" /></div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <Input type="password" placeholder="Choose Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-9" />
                    {form.password && (
                      <div className="mt-1.5">
                        <div className="h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", strength.color)} style={{ width: `${strength.pct}%` }} /></div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Password strength: {strength.label}</p>
                      </div>
                    )}
                  </div>
                  <div><label className={labelCls}>Mobile No.</label><Input placeholder="Enter Agent's Mobile Number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="h-9" /></div>
                  <div>
                    <label className={labelCls}>Agent Role</label>
                    <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className={inputCls}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Select Locations</label>
                    <div className="flex flex-wrap gap-1.5">
                      {LOCATIONS.map((loc) => (
                        <button key={loc} type="button" onClick={() => toggleLocation(loc)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", form.locations.includes(loc) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>{loc}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 flex-1" onClick={create}>Create</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreating(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {agents.map((a) => {
                const role = roles.find((r) => r.id === a.roleId);
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      selectedId === a.id ? "border-primary bg-primary/5" : "hover:bg-accent",
                    )}
                  >
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{a.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{role?.name ?? "No role"}</p>
                    </div>
                    <Badge variant={a.status === "active" ? "default" : a.status === "pending" ? "secondary" : "outline"} className="text-[10px] capitalize">{a.status}</Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agent detail */}
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11"><AvatarFallback className="bg-primary/10 font-semibold text-primary">{selected.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.email}{selected.mobile ? ` · ${selected.mobile}` : ""}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={selected.status === "active"} onCheckedChange={(v) => updateAgent(selected.id, { status: v ? "active" : "inactive" })} /> Active</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={selected.dataMasking} onCheckedChange={(v) => updateAgent(selected.id, { dataMasking: v })} /> Data masking</label>
                  <Button size="sm" variant="outline" onClick={() => previewAs(selected.id)}><Eye className="h-4 w-4" /> Preview as agent <ExternalLink className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { removeAgent(selected.id); setSelectedId(null); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <Card className="rounded-2xl">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Agent Role</label>
                    <select value={selected.roleId} onChange={(e) => updateAgent(selected.id, { roleId: e.target.value })} className={inputCls}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Select Locations</label>
                    <div className="flex flex-wrap gap-1.5">
                      {LOCATIONS.map((loc) => {
                        const on = selected.locations.includes(loc);
                        return (
                          <button key={loc} onClick={() => updateAgent(selected.id, { locations: on ? selected.locations.filter((l) => l !== loc) : [...selected.locations, loc] })} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>{loc}</button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Permissions from role: {roles.find((r) => r.id === selected.roleId)?.name}</CardTitle>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setTab("roles")}>Edit role permissions</Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  {FEATURE_GROUPS.map((g) => {
                    const role = roles.find((r) => r.id === selected.roleId);
                    const items = g.items.filter((i) => i.core || role?.features.includes(i.id));
                    if (items.length === 0) return null;
                    return (
                      <div key={g.group}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.id} className="flex items-center gap-2.5 rounded-xl border border-primary/50 bg-primary/5 p-2.5 text-sm">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                                {item.core && <Badge variant="outline" className="text-[9px]">Core</Badge>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-dashed p-16 text-sm text-muted-foreground">Select or create an agent to manage access.</div>
          )}
        </div>
      )}
    </div>
  );
}
