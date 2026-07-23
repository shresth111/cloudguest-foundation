import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Agent { id: string; name: string; email: string; role: string; status: string; updatedAt: string; }
interface Role { id: string; name: string; permissionCount: number; }

const ROLES: Role[] = [
  { id: "r1", name: "Network Engineer", permissionCount: 18 },
  { id: "r2", name: "Support Agent", permissionCount: 12 },
  { id: "r3", name: "Location Manager", permissionCount: 24 },
  { id: "r4", name: "Guest Operator", permissionCount: 8 },
  { id: "r5", name: "Read Only", permissionCount: 4 },
];

const PERMISSIONS = [
  { module: "Dashboard", actions: ["view"] },
  { module: "Users", actions: ["view", "disconnect"] },
  { module: "Analytics", actions: ["view", "export"] },
  { module: "Reports", actions: ["view", "generate", "export"] },
  { module: "Vouchers", actions: ["view", "create", "revoke"] },
  { module: "Devices", actions: ["view", "block", "unblock"] },
  { module: "Audit", actions: ["view"] },
  { module: "Campaigns", actions: ["view", "create", "delete"] },
  { module: "Portal", actions: ["view", "configure"] },
  { module: "Policies", actions: ["view", "create", "edit"] },
  { module: "Whitelist", actions: ["view", "add", "remove"] },
  { module: "Teams", actions: ["view", "create"] },
  { module: "Networking", actions: ["view", "configure"] },
  { module: "Advanced", actions: ["view", "configure"] },
];

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([
    { id: "1", name: "John Support", email: "john@bhaifi.com", role: "Support Agent", status: "active", updatedAt: "2 days ago" },
    { id: "2", name: "Sarah Tech", email: "sarah@bhaifi.com", role: "Network Engineer", status: "active", updatedAt: "5 days ago" },
    { id: "3", name: "Mike Ops", email: "mike@bhaifi.com", role: "Location Manager", status: "inactive", updatedAt: "2 weeks ago" },
  ]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "Support Agent" });
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Record<string, string[]>>({});

  const handleInvite = () => {
    if (!inviteForm.name || !inviteForm.email) return;
    setAgents([...agents, { id: String(Date.now()), ...inviteForm, status: "pending", updatedAt: "Just now" }]);
    setInviteForm({ name: "", email: "", role: "Support Agent" });
    setShowInvite(false);
  };

  const togglePerm = (agentId: string, module: string, action: string) => {
    const current = selectedPerms[agentId] || [];
    const key = `${module}.${action}`;
    setSelectedPerms({
      ...selectedPerms,
      [agentId]: current.includes(key) ? current.filter(k => k !== key) : [...current, key],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agent Management</h2>
          <p className="text-sm text-muted-foreground">Invite agents and assign role-based permissions</p>
        </div>
        <Button onClick={() => setShowInvite(true)}><Plus className="mr-2 h-4 w-4" />Invite Agent</Button>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Invite New Agent</h3>
            <div className="space-y-3">
              <div><Label>Full Name</Label><Input value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="John Doe" /></div>
              <div><Label>Email</Label><Input value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="john@company.com" /></div>
              <div><Label>Role</Label><Select value={inviteForm.role} onValueChange={v => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.id} value={r.name}>{r.name} ({r.permissionCount} permissions)</SelectItem>)}</SelectContent>
              </Select></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button onClick={handleInvite}>Send Invitation</Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="divide-y">
          {agents.map(agent => (
            <div key={agent.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary/10 text-primary">{agent.name.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.email} · {agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agent.status === "active" ? "default" : "secondary"}>{agent.status}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setShowPermissions(showPermissions === agent.id ? null : agent.id)}>
                    Permissions
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setAgents(agents.filter(a => a.id !== agent.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {showPermissions === agent.id && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm font-medium mb-2">Module Permissions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {PERMISSIONS.map(p => (
                      <div key={p.module} className="flex items-center gap-2 rounded-lg border p-2">
                        <Switch
                          checked={selectedPerms[agent.id]?.some(k => k.startsWith(p.module.toLowerCase()))}
                          onCheckedChange={() => togglePerm(agent.id, p.module.toLowerCase(), "view")}
                        />
                        <span className="text-xs">{p.module}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Suggested Roles</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map(role => (
            <div key={role.id} className="rounded-lg border p-3 hover:border-primary/50 transition-colors cursor-pointer">
              <p className="font-medium text-sm">{role.name}</p>
              <p className="text-xs text-muted-foreground">{role.permissionCount} permissions</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">Assign</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
