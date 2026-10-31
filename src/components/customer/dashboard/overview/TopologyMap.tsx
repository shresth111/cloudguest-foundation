/**
 * The venue's network chain as an interactive map: ISP link(s) -> router /
 * gateway -> access points and other hardware -> guests online.
 *
 * Plain SVG for the links, real <button>s for the nodes (so Tab, Enter and
 * screen readers work without an SVG focus model). Every node comes from
 * `buildTopology`, which only ever turns rows the page already fetched into
 * nodes -- see topology-model.ts. Junctions are drawn as a shared bus rather
 * than node-to-node lines on purpose: we do not know which AP hangs off which
 * router port, and a line from router A to AP 3 would claim we do.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  HardDrive,
  MoreHorizontal,
  Network,
  Router as RouterIcon,
  Users,
  Wifi,
} from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { STATUS_TEXT, STATUS_VAR, StatusDot, type OverviewStatus } from "./console-ui";
import type { TopoFact, TopoKind, TopoNode, TopologyModel } from "./topology-model";

const NODE_W = 236;
const NODE_H = 46;
const GAP = 10;
const PAD_Y = 6;
/** Below this width the map stacks vertically. */
const STACK_BELOW = 640;

type Tier = "isp" | "gateway" | "downstream" | "clients";

/** A placeholder card: an honest "nothing here" in the chain's place. */
interface GhostNode {
  id: string;
  ghost: true;
  tier: Tier;
  title: string;
  body: string;
  target: TopoNode["target"];
  status: OverviewStatus;
}

type Cell = (TopoNode & { ghost?: false }) | GhostNode;

const KIND_ICON: Record<TopoKind, typeof Globe> = {
  isp: Globe,
  gateway: RouterIcon,
  ap: Wifi,
  switch: Network,
  device: HardDrive,
  clients: Users,
  more: MoreHorizontal,
};

export function relativeTime(iso: string, lang: string, now = Date.now()): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const sec = Math.round((ms - now) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  if (abs < 60) return rtf.format(sec, "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function TopologyMap({
  model,
  onOpen,
}: {
  model: TopologyModel;
  /** Navigate to a feature page (`customerFeatureHref` id). */
  onOpen: (target: NonNullable<TopoNode["target"]>) => void;
}) {
  const { t, i18n: inst } = useTranslation("dashboard", { i18n });
  const lang = inst.language || "en";
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const tipId = useId();

  const statusWord = (s: OverviewStatus) =>
    t(
      `topology.status.${s}`,
      {
        ok: "Online",
        warn: "Degraded",
        crit: "Down",
        info: "Info",
        offline: "Offline",
        unknown: "Unknown",
      }[s],
    );

  // --- Columns, with honest placeholders where a tier has nothing.
  const columns = useMemo(() => {
    const ghost = (
      tier: Tier,
      key: string,
      title: string,
      body: string,
      target: TopoNode["target"],
      status: OverviewStatus = "unknown",
    ): GhostNode => ({
      id: `ghost:${tier}:${key}`,
      ghost: true,
      tier,
      title,
      body,
      target,
      status,
    });

    const isp: Cell[] =
      model.ispState === "ready"
        ? model.isps
        : model.ispState === "loading"
          ? [ghost("isp", "loading", t("topology.checking", "Checking…"), "", null)]
          : [
              ghost(
                "isp",
                "none",
                t("topology.ghost.noIsp", "No ISP added"),
                t("topology.ghost.noIspBody", "Add your internet line"),
                "isp-details",
              ),
            ];

    const gateway: Cell[] =
      model.gatewayState === "ready"
        ? model.gateways
        : model.gatewayState === "loading"
          ? [ghost("gateway", "loading", t("topology.checking", "Checking…"), "", null)]
          : model.gatewayState === "none"
            ? [
                ghost(
                  "gateway",
                  "none",
                  t("topology.ghost.noRouter", "No router yet"),
                  t("topology.ghost.noRouterBody", "Set up a router to go live"),
                  "devices",
                  "offline",
                ),
              ]
            : [
                ghost(
                  "gateway",
                  "unreadable",
                  t("topology.ghost.routersUnreadable", "Can't read routers"),
                  t("topology.ghost.routersUnreadableBody", "Status unknown right now"),
                  "devices",
                ),
              ];

    const downstream: Cell[] =
      model.downstreamState === "ready"
        ? model.downstream
        : model.downstreamState === "loading"
          ? [ghost("downstream", "loading", t("topology.checking", "Checking…"), "", null)]
          : model.downstreamState === "unmeasured"
            ? [
                ghost(
                  "downstream",
                  "unmeasured",
                  t("topology.ghost.apsUnmeasured", "Access points not visible"),
                  t("topology.ghost.apsUnmeasuredBody", "Managed in your vendor's app"),
                  "devices",
                ),
              ]
            : model.downstreamState === "controller-unreachable"
              ? [
                  ghost(
                    "downstream",
                    "ctl",
                    t("topology.ghost.controllerDown", "Controller not answering"),
                    t("topology.ghost.controllerDownBody", "Access point status unknown"),
                    "devices",
                    "warn",
                  ),
                ]
              : [
                  ghost(
                    "downstream",
                    "none",
                    t("topology.ghost.noAps", "No access points added"),
                    t("topology.ghost.noApsBody", "Add one by MAC address"),
                    "devices",
                  ),
                ];

    const clients: Cell[] = model.clients ? [model.clients] : [];
    return { isp, gateway, downstream, clients };
  }, [model, t]);

  const all: Cell[] = [
    ...columns.isp,
    ...columns.gateway,
    ...columns.downstream,
    ...columns.clients,
  ];
  const activeCell = all.find((c) => c.id === active) ?? null;

  // Esc closes the hover card from anywhere on the page.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const factLabel = (k: TopoFact["key"]) =>
    t(
      `topology.fact.${k}`,
      {
        role: "Role",
        interface: "Port",
        gatewayIp: "Gateway IP",
        latency: "Latency",
        loss: "Packet loss",
        plan: "Plan",
        lastChecked: "Last checked",
        vendor: "Vendor",
        state: "State",
        lastContact: "Last contact",
        model: "Model",
        ip: "IP",
        mac: "MAC",
        uptime: "Uptime",
        clients: "Clients",
        firmware: "Firmware",
        type: "Type",
        floor: "Floor",
        detail: "Detail",
        lastSeen: "Last seen",
        source: "Reported by",
      }[k],
    );

  const factValue = (f: TopoFact) => {
    if (f.time) return relativeTime(f.value, lang);
    if (f.key === "role")
      return f.value === "primary"
        ? t("topology.role.primary", "Primary")
        : t("topology.role.backup", "Backup");
    if (f.key === "source") return t("topology.source.controller", "Your controller");
    return f.value;
  };

  const nodeTitle = (c: Cell) => {
    if (c.ghost) return c.title;
    if (c.kind === "clients")
      return t("topology.guestsOnline", {
        count: c.count ?? 0,
        defaultValue_one: "{{count}} guest online",
        defaultValue_other: "{{count}} guests online",
      });
    if (c.kind === "more")
      return t("topology.more", { count: c.count ?? 0, defaultValue: "+{{count}} more" });
    return c.label;
  };

  const nodeSub = (c: Cell) => {
    if (c.ghost) return c.body;
    if (c.kind === "clients") return t("topology.clientsSub", "Signed in right now");
    if (c.kind === "more") return t("topology.moreSub", "Open Devices to see all");
    const word = statusWord(c.status);
    if (c.kind === "isp")
      return [word, c.active ? t("topology.activeUplink", "carrying traffic") : null]
        .filter(Boolean)
        .join(" · ");
    return [word, c.sub].filter(Boolean).join(" · ");
  };

  const ariaFor = (c: Cell) => {
    const parts = [nodeTitle(c), nodeSub(c)];
    if (c.target) parts.push(t(`topology.open.${c.target}`, OPEN_DEFAULT[c.target]));
    return parts.filter(Boolean).join(". ");
  };

  // --- Screen-reader summary of the whole chain.
  const srSummary = [
    `${t("topology.tier.isp", "Internet")}: ${columns.isp.map((c) => `${nodeTitle(c)} (${c.ghost ? c.body || "" : statusWord(c.status)})`).join(", ")}.`,
    `${t("topology.tier.gateway", "Router")}: ${columns.gateway.map((c) => `${nodeTitle(c)} (${c.ghost ? c.body || "" : statusWord(c.status)})`).join(", ")}.`,
    `${t("topology.tier.downstream", "Access points and devices")}: ${
      model.downstreamTotal > 0
        ? t("topology.srDownstream", {
            total: model.downstreamTotal,
            up: model.downstreamCounts.ok,
            defaultValue: "{{up}} of {{total}} up",
          })
        : columns.downstream.map((c) => nodeTitle(c)).join(", ")
    }.`,
    model.clients ? `${nodeTitle(model.clients)}.` : "",
  ].join(" ");

  const stacked = width > 0 && width < STACK_BELOW;

  const renderNode = (c: Cell, style?: React.CSSProperties, className?: string) => {
    const Icon = c.ghost
      ? c.tier === "isp"
        ? Globe
        : c.tier === "gateway"
          ? RouterIcon
          : Wifi
      : KIND_ICON[c.kind];
    const clickable = !!c.target;
    const isActive = active === c.id;
    const live = !c.ghost && c.status === "ok" && (c.kind === "gateway" || c.kind === "isp");
    return (
      <button
        key={c.id}
        type="button"
        data-topology-node={c.id}
        data-status={c.status}
        aria-label={ariaFor(c)}
        aria-describedby={isActive && !c.ghost && c.facts.length ? tipId : undefined}
        disabled={!clickable}
        onClick={() => c.target && onOpen(c.target)}
        onMouseEnter={() => setActive(c.id)}
        onMouseLeave={() => setActive((a) => (a === c.id ? null : a))}
        onFocus={() => setActive(c.id)}
        onBlur={() => setActive((a) => (a === c.id ? null : a))}
        style={style}
        className={cn(
          "group flex items-center gap-2.5 rounded-[var(--wy-radius)] border px-2.5 text-left transition-[border-color,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] disabled:cursor-default",
          c.ghost
            ? "border-dashed border-[var(--wy-border-strong)] bg-transparent"
            : "border-[var(--wy-border)] bg-[var(--wy-surface)] shadow-[var(--wy-shadow)]",
          clickable && "hover:border-[var(--wy-border-strong)] hover:bg-[var(--wy-surface-2)]",
          isActive && !c.ghost && "border-[var(--wy-accent)]",
          className,
        )}
      >
        <span
          className={cn(
            "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            c.ghost ? "text-[var(--wy-text-faint)]" : "bg-[var(--wy-surface-2)]",
            !c.ghost && STATUS_TEXT[c.status === "ok" ? "ok" : c.status],
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {!c.ghost && c.kind !== "more" && (
            <StatusDot
              status={c.status}
              live={live}
              className="absolute -right-0.5 -top-0.5 ring-2 ring-[var(--wy-surface)] [&>span]:rounded-full"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-xs font-semibold",
              c.ghost ? "text-[var(--wy-text-muted)]" : "text-[var(--wy-text)]",
            )}
          >
            {nodeTitle(c)}
          </span>
          {nodeSub(c) && (
            <span className="block truncate text-[11px] text-[var(--wy-text-faint)]">
              {nodeSub(c)}
            </span>
          )}
        </span>
      </button>
    );
  };

  const hoverCard = (c: Cell, pos: { left: number; top: number } | null) => {
    if (c.ghost || c.facts.length === 0) return null;
    return (
      <div
        id={tipId}
        role="tooltip"
        data-testid="topology-tooltip"
        className="pointer-events-none absolute z-20 w-60 rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] p-3 text-xs shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]"
        style={pos ?? undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{c.label}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium",
              STATUS_TEXT[c.status],
            )}
          >
            <StatusDot status={c.status} />
            {statusWord(c.status)}
          </span>
        </div>
        {c.statusText && c.statusText.toLowerCase() !== statusWord(c.status).toLowerCase() && (
          <p className="mt-0.5 text-[11px] text-[var(--wy-text-muted)]">{c.statusText}</p>
        )}
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {c.facts.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-[var(--wy-text-faint)]">{factLabel(f.key)}</dt>
              <dd
                className={cn(
                  "truncate text-right text-[var(--wy-text)]",
                  f.mono && "font-[family-name:var(--wy-font-mono)] text-[11px]",
                )}
              >
                {factValue(f)}
              </dd>
            </div>
          ))}
        </dl>
        {c.target && (
          <p className="mt-2 border-t border-[var(--wy-border)] pt-1.5 text-[11px] text-[var(--wy-accent)]">
            {t(`topology.open.${c.target}`, OPEN_DEFAULT[c.target])} →
          </p>
        )}
      </div>
    );
  };

  // --- Stacked (mobile) layout.
  if (stacked) {
    const tiers: [Tier, Cell[], string][] = [
      ["isp", columns.isp, t("topology.tier.isp", "Internet")],
      ["gateway", columns.gateway, t("topology.tier.gateway", "Router")],
      [
        "downstream",
        columns.downstream,
        t("topology.tier.downstream", "Access points and devices"),
      ],
      ["clients", columns.clients, t("topology.tier.clients", "Guests")],
    ];
    return (
      <div ref={wrapRef} className="relative" data-layout="stacked">
        <p className="sr-only">{srSummary}</p>
        <ol className="space-y-0">
          {tiers
            .filter(([, cells]) => cells.length > 0)
            .map(([tier, cells, label], i, arr) => (
              <li key={tier} className="relative pb-3 pl-4">
                {i < arr.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[5px] top-3 w-px bg-[var(--wy-border-strong)]"
                  />
                )}
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-[var(--wy-border-strong)] bg-[var(--wy-surface)]"
                />
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--wy-text-muted)]">
                  {label}
                </p>
                <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
                  {cells.map((c) => renderNode(c, { height: NODE_H }))}
                </div>
              </li>
            ))}
        </ol>
      </div>
    );
  }

  // --- Wide layout: four columns, buses between them.
  const cols: Cell[][] = [columns.isp, columns.gateway, columns.downstream, columns.clients];
  const nCols = columns.clients.length ? 4 : 3;
  const W = Math.max(width, STACK_BELOW);
  const nodeW = Math.min(NODE_W, (W - (nCols - 1) * 48) / nCols);
  const step = (W - nodeW) / (nCols - 1);
  const rows = Math.max(...cols.slice(0, nCols).map((c) => c.length), 1);
  const H = rows * (NODE_H + GAP) - GAP + PAD_Y * 2;

  type Placed = { cell: Cell; x: number; y: number; col: number };
  const placed: Placed[] = [];
  cols.slice(0, nCols).forEach((list, col) => {
    const block = list.length * (NODE_H + GAP) - GAP;
    const top0 = (H - block) / 2;
    list.forEach((cell, j) =>
      placed.push({ cell, col, x: col * step, y: top0 + j * (NODE_H + GAP) }),
    );
  });

  const linkColor = (c: Cell) =>
    c.ghost
      ? "var(--wy-border-strong)"
      : c.status === "unknown"
        ? "var(--wy-border-strong)"
        : STATUS_VAR[c.status];

  const paths: { d: string; color: string; dashed: boolean; flow: boolean; key: string }[] = [];
  for (let col = 0; col < nCols - 1; col++) {
    const left = placed.filter((p) => p.col === col);
    const right = placed.filter((p) => p.col === col + 1);
    if (!left.length || !right.length) continue;
    const busX = col * step + nodeW + (step - nodeW) / 2;
    const ys = [...left, ...right].map((p) => p.y + NODE_H / 2);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (maxY - minY > 0.5)
      paths.push({
        key: `bus-${col}`,
        d: `M${busX},${minY} V${maxY}`,
        color: "var(--wy-border-strong)",
        dashed: false,
        flow: false,
      });
    // Which side's status colours a stub: the upstream side for ISPs (it is
    // the ISP's line), the downstream side everywhere else.
    for (const p of left) {
      const y = p.y + NODE_H / 2;
      const isIsp = col === 0;
      const ghostish = p.cell.ghost;
      paths.push({
        key: `l-${p.cell.id}`,
        d: `M${p.x + nodeW},${y} H${busX}`,
        color: isIsp ? linkColor(p.cell) : "var(--wy-border-strong)",
        dashed: !!ghostish || (isIsp && !p.cell.ghost && p.cell.kind === "isp" && !p.cell.active),
        flow: isIsp && !p.cell.ghost && p.cell.status === "ok" && !!(p.cell as TopoNode).active,
      });
    }
    for (const p of right) {
      const y = p.y + NODE_H / 2;
      const toClients = col + 1 === 3;
      paths.push({
        key: `r-${p.cell.id}`,
        d: `M${busX},${y} H${p.x}`,
        color: col === 0 || toClients ? "var(--wy-border-strong)" : linkColor(p.cell),
        dashed: !!p.cell.ghost,
        flow: false,
      });
    }
  }

  const activePlaced = placed.find((p) => p.cell.id === active) ?? null;
  const tipPos = activePlaced
    ? (() => {
        const right = activePlaced.x + nodeW + 8;
        const left = right + 240 > W ? Math.max(0, activePlaced.x - 248) : right;
        const top = Math.max(0, Math.min(activePlaced.y - 4, H - 190));
        return { left, top };
      })()
    : null;

  const flowClass = `wy-topo-flow-${tipId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div ref={wrapRef} className="relative" data-layout="wide">
      <p className="sr-only">{srSummary}</p>
      <div
        className="relative mb-2 h-4 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--wy-text-faint)]"
        aria-hidden
      >
        {[
          t("topology.tier.isp", "Internet"),
          t("topology.tier.gateway", "Router"),
          t("topology.tier.downstream", "Access points and devices"),
          nCols === 4 ? t("topology.tier.clients", "Guests") : "",
        ]
          .slice(0, nCols)
          .map((label, i) => (
            <span key={i} className="absolute truncate" style={{ left: i * step, width: nodeW }}>
              {label}
            </span>
          ))}
      </div>
      <div className="relative" style={{ height: H }}>
        <svg
          aria-hidden
          width={W}
          height={H}
          className="pointer-events-none absolute inset-0 overflow-visible"
        >
          <style>{`
            .${flowClass} { stroke-dasharray: 0.1 14; animation: ${flowClass}-k 1.6s linear infinite; }
            @keyframes ${flowClass}-k { to { stroke-dashoffset: -28.2; } }
            @media (prefers-reduced-motion: reduce) { .${flowClass} { display: none; } }
          `}</style>
          {paths.map((p) => (
            <g key={p.key}>
              <path
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={p.flow ? 2 : 1.5}
                strokeLinecap="round"
                strokeDasharray={p.dashed ? "4 4" : undefined}
                strokeOpacity={p.dashed ? 0.55 : 1}
                style={{ transition: "stroke 200ms" }}
              />
              {/* Live traffic on the uplink carrying it: a slow dotted
                  overlay, off under reduced motion. */}
              {p.flow && (
                <path
                  d={p.d}
                  fill="none"
                  stroke="var(--wy-surface)"
                  strokeOpacity={0.9}
                  strokeWidth={3}
                  strokeLinecap="round"
                  className={flowClass}
                />
              )}
            </g>
          ))}
        </svg>
        {placed.map((p) =>
          renderNode(p.cell, { left: p.x, top: p.y, width: nodeW, height: NODE_H }, "absolute"),
        )}
        {activeCell && hoverCard(activeCell, tipPos)}
      </div>
    </div>
  );
}

const OPEN_DEFAULT: Record<NonNullable<TopoNode["target"]>, string> = {
  "isp-details": "Open Internet Connection",
  devices: "Open Devices",
  users: "Open Guests",
};
