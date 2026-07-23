import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search, Power, RefreshCw, ArrowUpCircle, RotateCcw, Network, Shield, Waypoints,
  MapPinned, ScrollText, TerminalSquare, Router as RouterIcon,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MSectionHeader, MSeg, MTag, MTable, MTh, MTd, MTr, MDrawer, MButton,
} from "@/components/master/MasterKit";
import { ROUTERS, type FleetRouter } from "@/lib/masterData";

export const Route = createFileRoute("/master/routers")({
  component: RouterFleetScreen,
});

type Filter = "all" | "online" | "degraded" | "offline";

function ControlButton({ icon: Icon, label, onClick }: { icon: typeof Power; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-accent"
    >
      <Icon className="h-4 w-4 text-primary" /> {label}
    </button>
  );
}

function RouterFleetScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<FleetRouter | null>(null);

  const rows = useMemo(
    () =>
      ROUTERS.filter((r) => (filter === "all" ? true : r.status === filter)).filter(
        (r) => !q || `${r.name} ${r.ip} ${r.customer} ${r.location}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [filter, q],
  );

  const act = (msg: string) => toast.success(msg);

  return (
    <MasterShell title="Router Fleet">
      <MSectionHeader eyebrow="Infrastructure" title="Router Fleet" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MSeg
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "online", label: "Online" },
            { value: "degraded", label: "Degraded" },
            { value: "offline", label: "Offline" },
          ]}
        />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, IP, customer…" className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <MTable head={<><MTh>Router</MTh><MTh className="hidden md:table-cell">Model</MTh><MTh className="hidden sm:table-cell">Customer</MTh><MTh>Firmware</MTh><MTh>Clients</MTh><MTh>Uptime</MTh><MTh>Status</MTh></>}>
        {rows.map((r) => (
          <MTr key={r.id} onClick={() => setSel(r)}>
            <MTd>
              <p className="font-semibold">{r.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{r.ip} · {r.location}</p>
            </MTd>
            <MTd className="hidden text-sm md:table-cell">{r.model}</MTd>
            <MTd className="hidden text-sm sm:table-cell">{r.customer}</MTd>
            <MTd>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-xs">{r.firmware}</span>
                {r.firmwareLatest ? <MTag label="Latest" tone="online" /> : <MTag label="Update" tone="due" />}
              </span>
            </MTd>
            <MTd className="tabular-nums">{r.clients}</MTd>
            <MTd className="tabular-nums">{r.uptime}</MTd>
            <MTd><MTag label={r.status} /></MTd>
          </MTr>
        ))}
      </MTable>

      <MDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.name ?? ""}
        subtitle={sel ? `${sel.model} · ${sel.ip} · ${sel.customer} / ${sel.location}` : ""}
        footer={sel && <MButton variant="primary" className="w-full justify-center" onClick={() => act(`Opening remote console for ${sel.name}`)}><TerminalSquare /> Open Remote Console</MButton>}
      >
        {sel && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border p-2.5 text-center"><p className="text-[11px] font-medium text-muted-foreground">Clients</p><p className="text-lg font-semibold tabular-nums">{sel.clients}</p></div>
              <div className="rounded-lg border border-border p-2.5 text-center"><p className="text-[11px] font-medium text-muted-foreground">Uptime</p><p className="text-lg font-semibold tabular-nums">{sel.uptime}</p></div>
              <div className="rounded-lg border border-border p-2.5 text-center"><p className="text-[11px] font-medium text-muted-foreground">Firmware</p><p className="text-lg font-semibold">{sel.firmware}</p></div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Power &amp; Firmware</p>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton icon={RotateCcw} label="Restart" onClick={() => act(`${sel.name}: restart queued`)} />
                <ControlButton icon={Power} label="Reboot" onClick={() => act(`${sel.name}: reboot queued`)} />
                <ControlButton icon={ArrowUpCircle} label="Upgrade" onClick={() => act(`${sel.name}: firmware upgrade started`)} />
                <ControlButton icon={RefreshCw} label="Sync Config" onClick={() => act(`${sel.name}: config synced`)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Network</p>
              <div className="grid grid-cols-2 gap-2">
                <ControlButton icon={Network} label="VLAN & DHCP" onClick={() => act("Opening VLAN & DHCP")} />
                <ControlButton icon={Shield} label="Firewall" onClick={() => act("Opening firewall rules")} />
                <ControlButton icon={RefreshCw} label="Reset Sessions" onClick={() => act(`${sel.name}: sessions reset`)} />
                <ControlButton icon={Waypoints} label="WireGuard" onClick={() => act("Opening WireGuard tunnel")} />
                <ControlButton icon={MapPinned} label="Move Location" onClick={() => act("Move location")} />
                <ControlButton icon={ScrollText} label="View Logs" onClick={() => act(`Fetching logs for ${sel.name}`)} />
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><RouterIcon className="h-3.5 w-3.5" /> Safe business-level operations only.</p>
          </div>
        )}
      </MDrawer>
    </MasterShell>
  );
}
