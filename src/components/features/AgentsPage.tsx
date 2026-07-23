/**
 * Owner-side agent & permission manager. The customer business owner creates
 * agents (employees) and grants each a subset of features; those grants drive
 * the agent's dynamic dashboard at /agent. Backed by the shared
 * agentPermissionStore so the /agent surface reflects changes immediately.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, ShieldCheck, Eye, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FEATURE_GROUPS, CORE_FEATURE_IDS, ALL_FEATURES } from "@/config/customerFeatureCatalog";
import { useAgentPermissions, type AgentRecord } from "@/stores/agentPermissionStore";

const GRANTABLE = ALL_FEATURES.filter((f) => !f.core).length;

export function AgentsPage() {
  const navigate = useNavigate();
  const { agents, addAgent, updateAgent, setAgentFeatures, removeAgent, setCurrentAgent } = useAgentPermissions();
  const [selectedId, setSelectedId] = useState<string | null>(agents[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  const create = () => {
    if (!form.name || !form.email) return;
    const id = addAgent({ name: form.name, email: form.email, status: "pending", dataMasking: true, features: ["users", "vouchers"] });
    setForm({ name: "", email: "" });
    setCreating(false);
    setSelectedId(id);
    toast.success("Agent created");
  };

  const toggleFeature = (agent: AgentRecord, id: string) => {
    const has = agent.features.includes(id);
    setAgentFeatures(agent.id, has ? agent.features.filter((f) => f !== id) : [...agent.features, id]);
  };

  const previewAs = (id: string) => {
    setCurrentAgent(id);
    navigate({ to: "/agent" });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* Agent list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agents</h3>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setCreating((v) => !v)}><Plus className="h-4 w-4" /> Add</Button>
        </div>

        {creating && (
          <Card className="rounded-2xl border-primary/40">
            <CardContent className="space-y-2 p-4">
              <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" />
              <Input placeholder="name@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" />
              <div className="flex gap-2">
                <Button size="sm" className="h-8 flex-1" onClick={create}>Create</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {agents.map((a) => {
            const granted = a.features.filter((f) => !CORE_FEATURE_IDS.includes(f)).length;
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
                  <p className="truncate text-xs text-muted-foreground">{granted}/{GRANTABLE} features</p>
                </div>
                <Badge variant={a.status === "active" ? "default" : a.status === "pending" ? "secondary" : "outline"} className="text-[10px] capitalize">{a.status}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Permission editor */}
      {selected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11"><AvatarFallback className="bg-primary/10 font-semibold text-primary">{selected.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Feature permissions</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAgentFeatures(selected.id, ALL_FEATURES.filter((f) => !f.core).map((f) => f.id))}>Grant all</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAgentFeatures(selected.id, [])}>Clear</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {FEATURE_GROUPS.map((g) => (
                <div key={g.group}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const on = item.core || selected.features.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          disabled={item.core}
                          onClick={() => toggleFeature(selected, item.id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm transition-colors",
                            on ? "border-primary/50 bg-primary/5" : "hover:bg-accent",
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
        <div className="flex items-center justify-center rounded-2xl border border-dashed p-16 text-sm text-muted-foreground">Select or create an agent to manage permissions.</div>
      )}
    </div>
  );
}
