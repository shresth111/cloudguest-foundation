/**
 * ZONE-1 "Switch zone": a header control and a searchable tree picker. The
 * pick scopes every partner list to that zone and the zones under it; "All
 * zones" removes the filter. It is a view filter on the caller's own scope,
 * never a login and never wider than the caller's customers.
 *
 * Renders nothing when the role cannot read zones, when zones are switched
 * off for this ISP (the tree answers 404), or when there are no zones.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, MapPinned, Search } from "lucide-react";
import api from "@/services/api";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  installZoneScopeInterceptor,
  switchZone,
  useZoneScope,
  useZoneTree,
} from "@/hooks/isp-partner/useZoneTree";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import {
  buildZoneTree,
  filterZoneTree,
  initZoneScope,
  zonePathLabel,
  type ZoneTreeItem,
} from "@/lib/isp-partner/zones";
import { cn } from "@/lib/utils";

function TreeRows({
  items,
  selected,
  onPick,
  open,
  toggle,
  forceOpen,
}: {
  items: ZoneTreeItem[];
  selected: string | null;
  onPick: (id: string) => void;
  open: Set<string>;
  toggle: (id: string) => void;
  forceOpen: boolean;
}) {
  return (
    <ul role="group" className="space-y-0.5">
      {items.map(({ node, children }) => {
        const expanded = forceOpen || open.has(node.id);
        const active = selected === node.id;
        return (
          <li
            key={node.id}
            role="treeitem"
            aria-selected={active}
            aria-expanded={children.length ? expanded : undefined}
          >
            <div
              className={cn(
                "flex items-center gap-1 rounded-lg pr-2",
                active ? "bg-primary/10 text-primary" : "hover:bg-accent",
              )}
            >
              {children.length > 0 ? (
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground"
                  aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                  onClick={() => toggle(node.id)}
                >
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-[22px]" />
              )}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
                onClick={() => onPick(node.id)}
              >
                <span className="truncate font-medium">{node.name}</span>
                {node.city && (
                  <span className="truncate text-xs text-muted-foreground">{node.city}</span>
                )}
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {node.subtree_subscribers} subs
                </span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </div>
            {children.length > 0 && expanded && (
              <div className="ml-4 border-l border-border pl-1">
                <TreeRows
                  items={children}
                  selected={selected}
                  onPick={onPick}
                  open={open}
                  toggle={toggle}
                  forceOpen={forceOpen}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ZoneSwitcher() {
  const { me, can } = usePartner();
  const qc = useQueryClient();
  const allowed = can("isp_zones.read");
  // Synchronous on first render, before any page query starts, so the first
  // requests already carry the saved zone.
  useState(() => {
    installZoneScopeInterceptor(api);
    initZoneScope(me.user.id, typeof window === "undefined" ? "" : window.location.search);
    return true;
  });
  const selected = useZoneScope();
  const tree = useZoneTree(allowed);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const nodes = useMemo(() => tree.data?.items ?? [], [tree.data]);
  const forest = useMemo(() => buildZoneTree(nodes), [nodes]);
  const shown = useMemo(() => filterZoneTree(forest, query), [forest, query]);
  const current = nodes.find((n) => n.id === selected) ?? null;
  const off = !allowed || ispErrorStatus(tree.error) === 404 || ispErrorStatus(tree.error) === 403;

  // A saved zone that is gone (deleted, switched off, another account) must
  // not keep filtering silently.
  useEffect(() => {
    if (!selected) return;
    if (off || (tree.data && !current)) switchZone(qc, null);
  }, [selected, off, tree.data, current, qc]);

  if (off || (tree.data && nodes.length === 0)) return null;

  const pick = (id: string | null) => {
    switchZone(qc, id);
    setPicking(false);
    setQuery("");
  };
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <MButton
        variant="outline"
        className={cn("max-w-[14rem]", current && "border-primary/50 text-primary")}
        onClick={() => {
          // Open the path to the current zone.
          if (current) setOpen(new Set(current.path_ids));
          setPicking(true);
        }}
        title={current ? `Zone: ${zonePathLabel(current)}` : "Switch zone"}
        aria-label={current ? `Zone ${current.name}. Switch zone` : "Switch zone"}
      >
        <MapPinned />
        <span className="truncate">{current ? current.name : "All zones"}</span>
      </MButton>
      <MDialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Switch zone"
        footer={
          <MButton variant="outline" onClick={() => setPicking(false)}>
            Close
          </MButton>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Lists, reports and the subscriber directory show only the zone you pick and the zones
            under it. Your access does not change.
          </p>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              className={`${M_INPUT} pl-8`}
              placeholder="Search zones"
              value={query}
              aria-label="Search zones"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium",
              !selected ? "bg-primary/10 text-primary" : "hover:bg-accent",
            )}
          >
            All zones
            {!selected && <Check className="ml-auto h-4 w-4" />}
          </button>
          <div role="tree" aria-label="Zones" className="max-h-[50vh] overflow-y-auto">
            {tree.isLoading ? (
              <Spinner />
            ) : shown.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">No zone matches.</p>
            ) : (
              <TreeRows
                items={shown}
                selected={selected}
                onPick={pick}
                open={open}
                toggle={toggle}
                forceOpen={!!query.trim()}
              />
            )}
          </div>
        </div>
      </MDialog>
    </>
  );
}
