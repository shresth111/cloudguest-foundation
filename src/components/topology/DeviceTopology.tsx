import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud, Building2, MapPin, Router, Wifi, Users, GitCompareArrows,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TopologyNode {
  id: string;
  label: string;
  type: "cloud" | "org" | "location" | "router" | "switch" | "ap" | "client";
  icon: typeof Cloud;
  status: "online" | "degraded" | "offline";
  count?: number;
  children?: TopologyNode[];
}

const SWITCH = GitCompareArrows;

const TOPOLOGY: TopologyNode[] = [
  {
    id: "cloud", label: "CloudGuest Cloud", type: "cloud", icon: Cloud, status: "online",
    children: [
      {
        id: "org", label: "Acme Corp", type: "org", icon: Building2, status: "online",
        children: [
          {
            id: "loc-1", label: "Mumbai HQ", type: "location", icon: MapPin, status: "online",
            children: [
              {
                id: "rtr-1", label: "GW-01 (Mumbai)", type: "router", icon: Router, status: "online",
                children: [
                  { id: "sw-1", label: "SW-Floor-1", type: "switch", icon: SWITCH, status: "online", children: [
                    { id: "ap-1", label: "AP-Lobby", type: "ap", icon: Wifi, status: "online" },
                    { id: "ap-2", label: "AP-Floor-2", type: "ap", icon: Wifi, status: "degraded" },
                    { id: "ap-3", label: "AP-Floor-3", type: "ap", icon: Wifi, status: "online" },
                  ]},
                  { id: "sw-2", label: "SW-Floor-2", type: "switch", icon: SWITCH, status: "degraded" },
                ],
              },
              { id: "rtr-2", label: "GW-02 (Mumbai)", type: "router", icon: Router, status: "offline" },
            ],
          },
          {
            id: "loc-2", label: "Delhi Office", type: "location", icon: MapPin, status: "online",
            children: [
              { id: "rtr-3", label: "GW-03 (Delhi)", type: "router", icon: Router, status: "online",
                children: [
                  { id: "sw-3", label: "SW-Ground", type: "switch", icon: SWITCH, status: "online" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const STATUS_COLORS = {
  online: { dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-600", border: "border-emerald-500/30" },
  degraded: { dot: "bg-amber-500", bg: "bg-amber-500/10 text-amber-600", border: "border-amber-500/30" },
  offline: { dot: "bg-rose-500", bg: "bg-rose-500/10 text-rose-600", border: "border-rose-500/30" },
};

const LEVEL_ICONS = [Cloud, Building2, MapPin, Router, SWITCH, Wifi, Users] as const;
const LEVEL_LABELS = ["Cloud", "Organization", "Location", "Router", "Switch", "Access Point", "Clients"] as const;

function NodeRow({ node, depth = 0 }: { node: TopologyNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = node.icon;
  const colors = STATUS_COLORS[node.status];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.05 }}
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md",
          colors.border,
        )}
        style={{ marginLeft: depth * 32 }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            colors.bg,
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{node.label}</span>
            <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
            <Badge variant="outline" className={cn("h-4 px-1 text-[9px] capitalize", colors.bg)}>
              {node.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
        </div>
        {node.count && <span className="text-xs text-muted-foreground">{node.count} devices</span>}
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </motion.div>
      {hasChildren && expanded && (
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-[calc(32px_+_depth_*_32px_+_18px)] top-0 bottom-0 w-px bg-gradient-to-b from-border via-border/50 to-transparent" />
          {node.children!.map((child) => (
            <NodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DeviceTopology() {
  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Status:</span>
        {(["online", "degraded", "offline"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[s].dot)} />
            <span className="capitalize">{s}</span>
          </span>
        ))}
      </div>

      {/* Hierarchy levels indicator */}
      <div className="flex flex-wrap gap-2">
        {LEVEL_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
            {i > 0 && <span className="text-muted-foreground/40">→</span>}
            {label}
          </div>
        ))}
      </div>

      {/* Topology tree */}
      <div className="space-y-3">
        {TOPOLOGY.map((node) => (
          <NodeRow key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
