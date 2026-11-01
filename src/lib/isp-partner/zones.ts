/**
 * ZONE-1: zone tree helpers and the "Switch zone" selection.
 *
 * Pure functions (tree building, search, descendants, the request rule) plus a
 * tiny external store for the selected zone, persisted per user in
 * localStorage and seeded from `?zone=`. The store is read by the axios
 * interceptor that adds `scope_zone_id` to `/isp/*` calls, and by React through
 * `useSyncExternalStore`. A zone has no login: this is a view filter that the
 * backend applies as a narrowing of the caller's own customer scope.
 */
import type { ZoneNode } from "@/services/isp-partner/zones-types";

export interface ZoneTreeItem {
  node: ZoneNode;
  children: ZoneTreeItem[];
}

/** Flat list (any order) -> forest. A node whose parent is missing (deleted,
 * or outside the list) becomes a root, so nothing disappears. Siblings are
 * sorted by name, case-insensitively. */
export function buildZoneTree(nodes: ZoneNode[]): ZoneTreeItem[] {
  const byId = new Map<string, ZoneTreeItem>();
  for (const n of nodes) byId.set(n.id, { node: n, children: [] });
  const roots: ZoneTreeItem[] = [];
  for (const item of byId.values()) {
    const p = item.node.parent_id ? byId.get(item.node.parent_id) : undefined;
    if (p && p !== item) p.children.push(item);
    else roots.push(item);
  }
  const sort = (xs: ZoneTreeItem[]) => {
    xs.sort((a, b) => a.node.name.localeCompare(b.node.name, "en", { sensitivity: "base" }));
    xs.forEach((x) => sort(x.children));
  };
  sort(roots);
  return roots;
}

/** The zone and every zone under it (ids), cycle-safe. */
export function zoneDescendantIds(nodes: ZoneNode[], zoneId: string): string[] {
  const kids = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parent_id) continue;
    const list = kids.get(n.parent_id) ?? [];
    list.push(n.id);
    kids.set(n.parent_id, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [zoneId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(kids.get(id) ?? []));
  }
  return out;
}

/** Parents a zone may move under: any zone except itself and its subtree. */
export function allowedParents(nodes: ZoneNode[], zoneId: string): ZoneNode[] {
  const banned = new Set(zoneDescendantIds(nodes, zoneId));
  return nodes.filter((n) => !banned.has(n.id));
}

/** Search keeps every match and the ancestors needed to reach it. Empty
 * query = the whole tree. */
export function filterZoneTree(tree: ZoneTreeItem[], query: string): ZoneTreeItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;
  const walk = (items: ZoneTreeItem[]): ZoneTreeItem[] =>
    items.flatMap((it) => {
      const hit =
        it.node.name.toLowerCase().includes(q) || (it.node.city ?? "").toLowerCase().includes(q);
      const kids = walk(it.children);
      if (hit) return [{ node: it.node, children: it.children }];
      if (kids.length) return [{ node: it.node, children: kids }];
      return [];
    });
  return walk(tree);
}

/** "North › Sector 12 › Block B". */
export function zonePathLabel(node: Pick<ZoneNode, "name" | "path_names">): string {
  const parts = node.path_names?.length ? node.path_names : [node.name];
  return parts.join(" › ");
}

/** Which partner calls carry the zone. `/isp/me` must keep the caller's real
 * scope; `/isp/zones/*` is the tree itself (picking a zone must not hide its
 * siblings). Anything outside `/isp/` (venue twins before the shim rewrites
 * them, auth, public) is never touched. */
export function shouldScopeRequest(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/v1/, "");
  if (!path.startsWith("/isp/")) return false;
  if (path === "/isp/me" || path.startsWith("/isp/me?") || path.startsWith("/isp/me/"))
    return false;
  if (path.startsWith("/isp/zones")) return false;
  // ONBOARD-1: the form's options (feature flags, next circuit id) are
  // ISP-wide, never zone-narrowed. The submit itself is narrowed normally.
  if (path === "/isp/onboarding/options" || path.startsWith("/isp/onboarding/options?"))
    return false;
  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isZoneId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export const zoneStorageKey = (userId: string) => `wyfy.isp.zone.${userId}`;

// ---------------------------------------------------------------- the store

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

let selected: string | null = null;
let ownerKey: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function storage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Load the user's saved zone; `?zone=` wins and is saved (`all` clears).
 * Call once per signed-in user. */
export function initZoneScope(userId: string, search: string, store = storage()): string | null {
  ownerKey = zoneStorageKey(userId);
  const param = new URLSearchParams(search).get("zone");
  if (param === "all") {
    store?.removeItem(ownerKey);
    selected = null;
  } else if (isZoneId(param)) {
    store?.setItem(ownerKey, param);
    selected = param;
  } else {
    const saved = store?.getItem(ownerKey) ?? null;
    selected = isZoneId(saved) ? saved : null;
  }
  emit();
  return selected;
}

export function getZoneScope(): string | null {
  return selected;
}

export function setZoneScope(zoneId: string | null, store = storage()): void {
  const next = isZoneId(zoneId) ? zoneId : null;
  if (next === selected) return;
  selected = next;
  if (ownerKey) {
    if (next) store?.setItem(ownerKey, next);
    else store?.removeItem(ownerKey);
  }
  emit();
}

/** Forget the selection in memory only (sign-out, flag off). */
export function resetZoneScope(): void {
  selected = null;
  ownerKey = null;
  emit();
}

export function subscribeZoneScope(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Totals rows in tree order (parent, then its children by name). Rows whose
 * parent is missing are roots. Cycle-safe. */
export function orderTotalsDepthFirst<
  T extends { zone_id: string; parent_id: string | null; name: string },
>(rows: T[]): T[] {
  const ids = new Set(rows.map((r) => r.zone_id));
  const kids = new Map<string | null, T[]>();
  for (const r of rows) {
    const p = r.parent_id && ids.has(r.parent_id) && r.parent_id !== r.zone_id ? r.parent_id : null;
    const list = kids.get(p) ?? [];
    list.push(r);
    kids.set(p, list);
  }
  for (const list of kids.values())
    list.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const out: T[] = [];
  const seen = new Set<string>();
  const walk = (p: string | null) => {
    for (const r of kids.get(p) ?? []) {
      if (seen.has(r.zone_id)) continue;
      seen.add(r.zone_id);
      out.push(r);
      walk(r.zone_id);
    }
  };
  walk(null);
  // Anything only reachable through a cycle is appended rather than lost.
  for (const r of rows) if (!seen.has(r.zone_id)) out.push(r);
  return out;
}

/** UX-PASS: `search` without `zone=`, so a pick in the switcher is not undone
 * on reload by a stale `?zone=<id>` (initZoneScope lets the URL win). Returns
 * "" or "?a=b". */
export function stripZoneParam(search: string): string {
  const p = new URLSearchParams(search);
  if (!p.has("zone")) return search.startsWith("?") || search === "" ? search : `?${search}`;
  p.delete("zone");
  const s = p.toString();
  return s ? `?${s}` : "";
}
