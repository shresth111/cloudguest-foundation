import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Menu, LogOut, EyeOff, ChevronsUpDown, ShieldCheck, Inbox, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FEATURE_GROUPS, FEATURE_BY_ID, renderFeature } from "@/config/customerFeatures";
import { useAgentPermissions } from "@/stores/agentPermissionStore";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";

export const Route = createFileRoute("/agent/")({
  component: AgentDashboard,
});

function AgentDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { agents, currentAgentId, setCurrentAgent, grantedFor } = useAgentPermissions();
  const agent = agents.find((a) => a.id === currentAgentId) ?? agents[0] ?? null;

  const granted = useMemo(() => new Set(grantedFor(agent?.id ?? null)), [agent?.id, grantedFor]);
  const groups = useMemo(
    () =>
      FEATURE_GROUPS.map((g) => ({ group: g.group, items: g.items.filter((i) => granted.has(i.id)) }))
        .filter((g) => g.items.length > 0),
    [granted],
  );
  const firstFeature = groups[0]?.items[0]?.id ?? "dashboard";
  const [feature, setFeature] = useState(firstFeature);
  const [mobile, setMobile] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);

  const active = granted.has(feature) ? feature : firstFeature;
  const activeLabel = FEATURE_BY_ID[active]?.label ?? "Dashboard";
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-center">
        <div className="max-w-sm space-y-3">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No agent profile is configured. Ask your business owner to create your agent account under <span className="font-medium text-foreground">Agents</span>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}

      {/* Sidebar -- only granted features */}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-background transition-transform lg:static lg:translate-x-0", mobile ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm"><img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ZIP WiFi</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Agent Workspace</p>
          </div>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g.group} className="space-y-0.5">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.group}</p>
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setFeature(item.id); setMobile(false); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active === item.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t p-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {granted.size} features granted</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{activeLabel}</p>
            <p className="text-xs text-muted-foreground">Agent workspace</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {agent.dataMasking && (
              <Badge variant="secondary" className="gap-1 text-[10px]"><EyeOff className="h-3 w-3" /> Data masked</Badge>
            )}
            {/* Demo: switch which agent we're previewing as */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-accent">
                <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{agent.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                <span className="hidden max-w-[120px] truncate sm:inline">{agent.name}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Switch agent (demo)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {agents.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => { setCurrentAgent(a.id); setFeature("dashboard"); }}>
                    <Avatar className="mr-2 h-6 w-6"><AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{a.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                    <span className="flex-1 truncate">{a.name}</span>
                    {a.id === agent.id && <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setChangePwOpen(true)}><KeyRound className="mr-2 h-4 w-4" /> Change password</DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{renderFeature(active)}</div>
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </div>
  );
}
