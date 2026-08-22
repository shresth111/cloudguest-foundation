import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Search,
  Star,
  MapPin,
  Plus,
  Wifi,
  Router,
  Printer,
  Camera,
  HardDrive,
  ArrowRight,
  LogOut,
  Activity,
  Radio,
  Eye,
  RefreshCw,
  Quote,
  X,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerLocations, customerKeys } from "@/hooks/useCustomerDashboard";
import type { CustomerLocationSummary } from "@/services/customer.service";
import {
  FLOORS,
  DEVICE_TYPES,
  formatSince,
  deriveCpu,
  type DeviceType,
} from "@/stores/deviceStore";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { HighlightedText } from "@/components/ui-ext/HighlightedText";

import { isDemo } from "@/services/customer.service";
import { businessTypeIcon } from "@/lib/business-type-icons";
import { toast } from "sonner";
import { requireCustomerSession } from "@/lib/authGuards";
import { customerFeatureHref } from "@/lib/customerNav";
import { IspProviderIcon } from "@/components/icons/isp";
import { LocationWizard } from "@/components/locations/LocationWizard";
import { AddDeviceDialog } from "@/components/customer/AddDeviceDialog";

export const Route = createFileRoute("/switch-location")({
  beforeLoad: ({ context, location }) => requireCustomerSession(context.auth, location),
  component: CustomerHomePage,
});

const DEVICE_TYPE_ICON: Record<DeviceType, typeof Wifi> = {
  "Access Point": Wifi,
  Printer,
  Router,
  Camera,
  Other: HardDrive,
};

/** Per-type chip tint for the compact device-icon summary shown on each
 * location card below (see `filtered.map` in `CustomerHomePage`) -- same
 * dark/glassy translucent-pill language already used for the status pill
 * on these cards (`border-x/20 bg-x/10 text-x`), just keyed by device type
 * instead of online/degraded/offline. */
const DEVICE_TYPE_TINT: Record<DeviceType, string> = {
  "Access Point": "border-sky-500/20 bg-sky-500/10 text-sky-300",
  Printer: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  Router: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
  Camera: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  Other: "border-slate-500/20 bg-slate-500/10 text-slate-300",
};

const DEVICE_TYPE_ACTIVE_TINT: Record<DeviceType, string> = {
  "Access Point": "border-sky-500/40 bg-sky-500/25 text-sky-200 ring-sky-500/40",
  Printer: "border-amber-500/40 bg-amber-500/25 text-amber-200 ring-amber-500/40",
  Router: "border-indigo-500/40 bg-indigo-500/25 text-indigo-200 ring-indigo-500/40",
  Camera: "border-rose-500/40 bg-rose-500/25 text-rose-200 ring-rose-500/40",
  Other: "border-slate-500/40 bg-slate-500/25 text-slate-200 ring-slate-500/40",
};

/** Operator-voice lines, not fabricated testimonials -- on-brand wisdom about
 * why reliable guest WiFi matters, rotated in the hero to give the page some
 * personality without repeating a giant illustration or inventing fake
 * customer quotes. */
const QUOTES = [
  "Guests forgive a slow menu. They don't forgive slow WiFi.",
  "Uptime is a feature nobody thanks you for — until it's gone.",
  "A dropped connection is a dropped guest.",
  "Nobody asks for the password twice at a good hotel.",
  "Check it before a guest has to tell you it's down.",
  "The best network is the one nobody notices.",
];

/** Counts 0 -> target on mount with a spring, respecting reduced motion. */
function CountUp({ target }: { target: number }) {
  const shouldReduceMotion = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  const [text, setText] = useState(shouldReduceMotion ? String(target) : "0");

  useEffect(() => {
    if (shouldReduceMotion) {
      setText(String(target));
      return;
    }
    mv.set(target);
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, shouldReduceMotion]);

  return <>{text}</>;
}

/**
 * Hero illustration: the Wyfy Guest shield-and-signal brand mark as a
 * central monitoring hub, with a radar-style pulse ring and dashed signal
 * lines fanning out to three location nodes -- flat filled shapes (not
 * cartoon figures) so the scene reads as "your network, watched centrally"
 * instead of a person-at-a-desk vignette. Replaces the earlier
 * manager-at-a-monitor illustration (and its cafe/hotel/coworking building
 * badges), which read as consumer/hospitality clip-art rather than
 * enterprise network monitoring.
 *
 * Purely decorative -- aria-hidden. The signal-line draw-on and the radar
 * ping are one-time/looping entrances respectively; both the ping and the
 * hub glow collapse to a static state when the visitor prefers reduced
 * motion.
 */
function HeroManagerIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const nodes = [
    { key: "node-a", x: 336, y: 34, accent: "#f0abfc" },
    { key: "node-b", x: 410, y: 92, accent: "#22d3ee" },
    { key: "node-c", x: 346, y: 148, accent: "#a78bfa" },
  ];
  const hub = { x: 140, y: 112.5 };
  const shieldPath =
    "M140 55 L185.68 73.27 V107.67 C185.68 137.76 166.87 160.33 140 170 " +
    "C113.13 160.33 94.32 137.76 94.32 107.67 V73.27 Z";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 210"
      className="h-auto w-full max-w-[340px]"
      fill="none"
    >
      <defs>
        <filter id="net-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <linearGradient
          id="net-illo-shield"
          x1="94"
          y1="55"
          x2="186"
          y2="170"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <circle
        cx="140"
        cy="112.5"
        r="78"
        fill="#7c3aed"
        opacity="0.18"
        filter="url(#net-illo-glow)"
      />
      <line
        x1="20"
        y1="192"
        x2="500"
        y2="192"
        stroke="white"
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      {/* faint globe meridians behind the hub -- "network topology" flavor,
          low-opacity so it reads as texture, not a competing shape */}
      <ellipse
        cx="140"
        cy="112.5"
        rx="98"
        ry="98"
        stroke="white"
        strokeOpacity="0.07"
        strokeWidth="1"
        fill="none"
      />
      <ellipse
        cx="140"
        cy="112.5"
        rx="40"
        ry="98"
        stroke="white"
        strokeOpacity="0.06"
        strokeWidth="1"
        fill="none"
      />

      {/* one-time radar ping expanding out from the hub */}
      <motion.circle
        cx={hub.x}
        cy={hub.y}
        r="46"
        stroke="#a78bfa"
        strokeWidth="1.5"
        fill="none"
        initial={shouldReduceMotion ? false : { opacity: 0.5, scale: 0.4 }}
        animate={shouldReduceMotion ? { opacity: 0 } : { opacity: [0.5, 0], scale: [0.4, 1.3] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeOut" }
        }
        style={{ transformOrigin: `${hub.x}px ${hub.y}px` }}
      />

      {nodes.map((n, i) => (
        <motion.path
          key={`line-${n.key}`}
          d={`M${hub.x} ${hub.y} Q${(hub.x + n.x) / 2} ${Math.min(hub.y, n.y) - 20} ${n.x} ${n.y + 22}`}
          stroke={n.accent}
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="1 6"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 + i * 0.15, ease: "easeOut" }}
        />
      ))}

      {/* central hub -- the brand shield-and-signal mark, scaled up (same
          proportions as public/brand/mark-*-blue.svg's shield+signal glyph:
          gradient shield fill, solid white signal glyph on top), so the
          hero literally is the logo watching over the network. */}
      <path d={shieldPath} fill="url(#net-illo-shield)" />
      <path
        d="M109.37 98.53a46.22 46.22 0 0 1 61.26 0"
        stroke="#ffffff"
        strokeWidth="9.14"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <path
        d="M121.73 113.58a26.87 26.87 0 0 1 36.54 0"
        stroke="#ffffff"
        strokeWidth="9.14"
        strokeLinecap="round"
        fill="none"
      />
      <motion.circle
        cx="140"
        cy="127.01"
        r="7.26"
        fill="#ffffff"
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0.75, 1, 0.75] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* three location nodes -- a pin + rising signal bars each, standing
          in for "your venues" without a literal building/venue-type icon */}
      {nodes.map((n) => (
        <g key={`badge-${n.key}`} transform={`translate(${n.x}, ${n.y})`}>
          <rect width="54" height="46" rx="12" fill="#2e2a5c" stroke="white" strokeOpacity="0.12" />
          <path d="M20 30c-6-8-9-14-9-19a9 9 0 0 1 18 0c0 5-3 11-9 19z" fill={n.accent} />
          <circle cx="20" cy="11" r="3.4" fill="#1e1b4b" />
          {[0, 1, 2].map((i) => (
            <rect
              key={`bar-${i}`}
              x={34 + i * 6}
              y={30 - (i + 1) * 5}
              width="4"
              height={(i + 1) * 5}
              rx="1.2"
              fill={n.accent}
              fillOpacity={0.45 + i * 0.22}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function CustomerHomePage() {
  const navigate = useNavigate();
  const { user, logout, organizations } = useAuth();
  const { setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading, refetch } = useCustomerLocations();
  const { devices: allDevices, refetch: refetchDevices } = useMonitoredHardware();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cg-favs") ?? "[]");
    } catch {
      return [];
    }
  });
  const [menu, setMenu] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DeviceType | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);

  const [deviceLocationId, setDeviceLocationId] = useState("");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [deviceSheetOpen, setDeviceSheetOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to the venue search from anywhere on the page (ignored while
  // already typing in a field), matching the shortcut used across the admin app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Debounce the raw input so typing doesn't re-filter the grid on every
  // keystroke; `query` is the term the list and highlights actually use.
  const query = useDebouncedValue(search, 250).trim();
  const isSearchPending = search.trim() !== query;

  const filtered = (locations ?? [])
    .filter(
      (l) =>
        !query ||
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.city.toLowerCase().includes(query.toLowerCase()),
    )

    // Starred venues first -- the star was purely decorative before, it never
    // changed the order of the grid it was pinned to.
    .sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));

  // Distinguish "this org genuinely has zero locations" from "the search
  // typed above matched nothing" -- these used to share one empty-state
  // branch keyed off `filtered.length === 0`, which showed "No venues match
  // that search" to a brand-new owner who has never set up a location and
  // never typed a search either. `locations` (pre-filter) is the real
  // signal for the former.
  const hasNoLocationsAtAll = !isLoading && (locations ?? []).length === 0;
  const myOrg = organizations[0];
  const toggleFav = (id: string) => {
    setFavorites((p) => {
      const n = p.includes(id) ? p.filter((f) => f !== id) : [...p, id];
      localStorage.setItem("cg-favs", JSON.stringify(n));
      return n;
    });
  };
  const handleSelect = (loc: CustomerLocationSummary) => {
    setActiveLocation(loc.id, loc);
    navigate({ to: customerFeatureHref("dashboard") });
  };
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };
  const doRefetch = () => {
    refetch();
    setSecondsAgo(0);
  };

  // Each location has its own hardware -- default the monitoring panel to the first
  // location once locations load, rather than mixing every location's devices together.
  const effectiveDeviceLocationId = deviceLocationId || locations?.[0]?.id || "";
  const devices = allDevices.filter((d) => d.locationId === effectiveDeviceLocationId);
  const filteredDevices = devices
    .filter(
      (d) =>
        !deviceSearch ||
        d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        d.mac.toLowerCase().includes(deviceSearch.toLowerCase()),
    )
    .filter((d) => !typeFilter || d.type === typeFilter)
    .filter((d) => !floorFilter || d.floor === floorFilter);
  const downCount = devices.filter((d) => d.status === "down").length;
  const totalDownAcrossLocations = allDevices.filter((d) => d.status === "down").length;

  useEffect(() => {
    setSelectedDeviceIds([]);
  }, [effectiveDeviceLocationId]);

  // Bulk selection is scoped to what's currently visible: switching locations or
  // narrowing filters must never leave invisible rows silently selected.
  const visibleSelectedIds = filteredDevices
    .filter((d) => selectedDeviceIds.includes(d.id))
    .map((d) => d.id);
  const allVisibleSelected =
    filteredDevices.length > 0 && visibleSelectedIds.length === filteredDevices.length;
  const someVisibleSelected = visibleSelectedIds.length > 0 && !allVisibleSelected;
  const selectedDevices = devices.filter((d) => visibleSelectedIds.includes(d.id));
  const toggleDeviceSelected = (id: string) =>
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleSelectAllVisible = () =>
    setSelectedDeviceIds(allVisibleSelected ? [] : filteredDevices.map((d) => d.id));
  const clearDeviceSelection = () => setSelectedDeviceIds([]);
  const runBulkAction = (label: string) => {
    toast.success(
      `${label} — ${selectedDevices.length} device${selectedDevices.length === 1 ? "" : "s"}`,
    );
    clearDeviceSelection();
  };
  const exportSelectedDevices = () => {
    const rows = [
      ["Name", "MAC", "Type", "Floor", "Status"],
      ...selectedDevices.map((d) => [d.name, d.mac, d.type, d.floor, d.status]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "devices.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedDevices.length} devices`);
  };

  const totalLocations = (locations ?? []).length;
  const onlineLocations = (locations ?? []).filter((l) => l.status === "online").length;
  const totalOnlineUsers = (locations ?? []).reduce((sum, l) => sum + (l.onlineUsers ?? 0), 0);
  const heroStats = [
    { label: "Locations", value: totalLocations },
    { label: "Online now", value: onlineLocations },
    { label: "Guests online", value: totalOnlineUsers },
  ];

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#181530] text-white"
      style={
        {
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {/* One solid dark indigo/violet/fuchsia identity for the whole page,
       * top to bottom -- viewport-fixed so it stays present as the page
       * scrolls past a tall grid, instead of a hero band being the only
       * "designed" part and everything below reverting to plain admin UI. */}
      <div
        aria-hidden
        className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[#6C4EFF]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#8B5CF6]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Compact banner -- not a full-screen hero. Search, live stats, and a
       * rotating operator-voice quote sit beside the illustration, so this
       * band earns its height with real content instead of pure decoration. */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#1e1b4b] via-[#2f2a63] to-[#181530]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#1e1b4b]/80 backdrop-blur-xl">
          <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1e1b4b]" />
                </span>
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">Wyfy Guest</p>
                <p className="text-[10px] font-normal tracking-wide text-white/50">
                  Customer Portal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* No locationId yet on this location-picker page, so "view
                  all" has nowhere real to send the click -- the dropdown
                  itself (org-wide recent alerts) is the honest destination. */}
              <span className="[&_button]:text-white/80 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
                <NotificationBell scope="org" />
              </span>
              <div
                className="relative"
                onKeyDown={(e) => {
                  if (e.key === "Escape" && menu) {
                    e.stopPropagation();
                    setMenu(false);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setMenu(!menu)}
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  className="flex items-center gap-2 pl-2 border-l border-white/15 ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-white/15 text-white text-xs font-semibold">
                      {user?.firstName?.[0] ?? "A"}
                      {user?.lastName?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {menu && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/10 bg-[#241f4d] p-1 text-white shadow-xl"
                  >
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user?.name ?? "Admin"}</p>
                      <p className="text-xs text-white/50">{user?.email}</p>
                    </div>
                    <div className="border-t border-white/10 my-1" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
                Every location, watched live
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Which venue are we looking after today?
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <Input
                    ref={searchRef}
                    type="search"
                    placeholder="Search locations…"
                    aria-label="Search locations"
                    aria-describedby="venue-search-hint"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      // Escape clears first; a second Escape (already empty)
                      // hands focus back to the page.
                      if (e.key !== "Escape") return;
                      e.preventDefault();
                      if (search) setSearch("");
                      else searchRef.current?.blur();
                    }}
                    className="h-11 border-white/15 bg-white/10 pl-10 pr-16 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  <span id="venue-search-hint" className="sr-only">
                    Press slash to focus this field, Escape to clear it.
                  </span>
                  {search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        searchRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/45 sm:block">
                      /
                    </kbd>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAddLocationOpen(true)}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] px-4 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Plus className="h-4 w-4" /> Add location
                </button>
              </div>

              {!isLoading && (
                <div className="mt-6 grid max-w-md grid-cols-3 gap-2">
                  {heroStats.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm"
                    >
                      <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
                        <CountUp target={s.value} />
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/55">{s.label}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
                <Quote className="h-3.5 w-3.5 shrink-0 text-white/30" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={quoteIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.4 }}
                  >
                    {QUOTES[quoteIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>

            <motion.div
              className="hidden justify-self-end opacity-95 md:block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 0.95, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              <HeroManagerIllustration />
            </motion.div>
          </div>
        </div>
      </div>

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] shadow-sm shadow-indigo-500/20">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight leading-none">Your venues</h2>
              <p className="mt-1 text-xs text-white/45">
                Every site you manage, one tap from its dashboard.
              </p>
            </div>
            {!isLoading && (
              <span
                className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60 transition-opacity"
                style={{ opacity: isSearchPending ? 0.5 : 1 }}
                aria-live="polite"
              >
                {filtered.length}
                {query ? " matching" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live · updated {secondsAgo}s ago
              <button
                type="button"
                onClick={doRefetch}
                aria-label="Refresh location data"
                className="ml-1 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
            <button
              type="button"
              onClick={() => setDeviceSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Radio className="h-3.5 w-3.5" /> Device health
              {totalDownAcrossLocations > 0 && (
                <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">
                  {totalDownAcrossLocations}
                </span>
              )}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="mt-2 h-3 w-24 rounded bg-white/10" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 rounded bg-white/10" />
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hasNoLocationsAtAll ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                <MapPin className="mb-4 h-12 w-12 text-white/30" />
                <p className="text-base font-semibold text-white">No locations yet</p>
                <p className="mt-1.5 max-w-sm text-sm text-white/40">
                  Add your first location to start managing guest WiFi.
                </p>
                <button
                  type="button"
                  onClick={() => setAddLocationOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/20 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add location
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div
                role="status"
                aria-live="polite"
                className="col-span-full flex flex-col items-center justify-center py-20 text-white/40"
              >
                <MapPin className="mb-4 h-12 w-12 opacity-30" aria-hidden="true" />
                <p className="text-sm">No venues match “{query}”. Try a different name or city.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear search
                </button>
              </div>
            ) : (
              filtered.map((loc, i) => {
                const LocationIcon = businessTypeIcon(loc.propertyType);
                const statusDot =
                  loc.status === "online"
                    ? "bg-emerald-500"
                    : loc.status === "degraded"
                      ? "bg-amber-500"
                      : "bg-rose-500";
                const statusPill =
                  loc.status === "online"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : loc.status === "degraded"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-400";
                const statusLabel =
                  loc.status === "online"
                    ? "Online"
                    : loc.status === "degraded"
                      ? "Degraded"
                      : "Offline";
                const ringColor =
                  loc.status === "online"
                    ? "hover:ring-emerald-500/25"
                    : loc.status === "degraded"
                      ? "hover:ring-amber-500/25"
                      : "hover:ring-rose-500/25";
                // Compact device-type summary right on the card -- the founder's
                // ask was for device icons "on the front page," not just inside
                // the Device health drawer you have to open first. Only shows
                // for locations that actually have hardware set up (most demo
                // locations don't yet -- see deviceStore.ts's SEED_DEVICES
                // comment), so a location with nothing configured stays clean
                // instead of showing an empty/zeroed-out row.
                const locDeviceCounts = DEVICE_TYPES.map((t) => ({
                  type: t,
                  count: allDevices.filter((d) => d.locationId === loc.id && d.type === t).length,
                })).filter((x) => x.count > 0);
                return (
                  <motion.div
                    key={loc.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${loc.name}, ${loc.city}`}
                    onClick={() => handleSelect(loc)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(loc);
                      }
                    }}
                    className={cn(
                      "group relative flex h-full w-full cursor-pointer flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:bg-white/[0.07] hover:shadow-xl hover:shadow-[#6C4EFF]/10 hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                      ringColor,
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={favorites.includes(loc.id)}
                      aria-label={
                        favorites.includes(loc.id)
                          ? `Remove ${loc.name} from favourites`
                          : `Add ${loc.name} to favourites`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFav(loc.id);
                      }}
                      className="absolute right-4 top-4 rounded-md p-1 text-white/40 hover:text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <Star
                        aria-hidden="true"
                        className={cn(
                          "h-4 w-4",
                          favorites.includes(loc.id) && "fill-amber-400 text-amber-400",
                        )}
                      />
                    </button>

                    <div className="flex items-start gap-3">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] shadow-sm shadow-indigo-500/20">
                        <LocationIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="font-display truncate text-lg font-semibold tracking-tight text-white">
                          <HighlightedText text={loc.name} query={query} />
                        </p>
                        <p className="text-xs text-white/50">
                          <HighlightedText text={loc.city} query={query} /> · {loc.organizationName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="font-display text-2xl font-bold tracking-tight tabular-nums text-white">
                          {loc.onlineUsers}
                        </p>
                        <p className="text-[11px] text-white/45">guests online</p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          statusPill,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
                        {statusLabel}
                      </span>
                    </div>

                    {locDeviceCounts.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {locDeviceCounts.map(({ type, count }) => {
                          const Icon = DEVICE_TYPE_ICON[type];
                          return (
                            <span
                              key={type}
                              title={`${count} ${type}${count === 1 ? "" : "s"}`}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                DEVICE_TYPE_TINT[type],
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {count}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* customer.service.ts's real (non-demo) listLocations() has
                     * no per-location ISP provider name to give -- fetching one
                     * means a router lookup then an /isp/links call per router,
                     * which this already-N-calls-per-card picker deliberately
                     * doesn't do (see that file's own fan-out comments). It
                     * fills `isp` with the literal string "Active" as a stand-in
                     * (same placeholder customer.service.ts's getDashboard()
                     * uses for its own "ISP" health pill), which isn't a real
                     * provider name -- showing it next to a brand icon here
                     * read as "your ISP is called Active," so only render the
                     * icon+name when it's an actual brand (demo data has real
                     * ones like "Airtel"/"Jio"), otherwise just show bandwidth. */}
                    {/* mt-auto (not mt-3): the device-chips row just above is
                     * conditional (only locations with hardware set up get one,
                     * see deviceStore.ts's SEED_DEVICES comment), so cards in
                     * the same grid row had this footer sitting at a different
                     * height depending on whether their neighbor had a chips
                     * row -- the ISP/health line and "Open dashboard" hint below
                     * it visibly zig-zagged up and down across a row. The card
                     * is now a flex column filling its grid-stretched height
                     * (h-full flex-col above), so mt-auto pins this footer to
                     * the bottom of every card in a row alike, chips row or not. */}
                    <div
                      title={`Last synced ${loc.lastSync}`}
                      className="mt-auto flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-white/40"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        {loc.isp && loc.isp !== "Active" && loc.isp !== "Unknown" && (
                          <>
                            <IspProviderIcon providerName={loc.isp} className="h-3.5 w-3.5" />
                            {loc.isp} ·{" "}
                          </>
                        )}
                        {loc.bandwidth}
                      </span>
                      <span className="shrink-0">{loc.routerHealth}% health</span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-end text-xs font-medium text-indigo-300 opacity-0 transition-opacity group-hover:opacity-100">
                      Open dashboard <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                  </motion.div>
                );
              })
            )}
            {!hasNoLocationsAtAll && filtered.length > 0 && (
              <button
                type="button"
                onClick={() => setAddLocationOpen(true)}
                className="group flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center transition-colors hover:border-[#8B5CF6]/50 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-colors group-hover:border-[#8B5CF6]/40 group-hover:text-white">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>

                <span className="text-sm font-medium text-white/80">Add a location</span>
                <span className="max-w-[16rem] text-xs text-white/40">
                  Provision a new venue and bring its network online.
                </span>
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-6 text-xs text-white/40 sm:px-6">
        <span>© {new Date().getFullYear()} Wyfy Guest · Customer Portal</span>
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          All systems monitored in real time
        </span>
      </footer>

      {/* Device Monitoring -- moved into a drawer instead of a permanently
       * open, full-width section: it's genuinely different data (per-device,
       * not per-location) and competing with the venue grid for the same
       * vertical rhythm was part of why the page felt like two bolted-
       * together admin panels. Opened from the "Device health" button above
       * (or with an unread-style badge showing the current down count). */}
      <Sheet open={deviceSheetOpen} onOpenChange={setDeviceSheetOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-white/10 bg-[#1a1733] text-white sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle className="text-white">Hardware, floor by floor</SheetTitle>
            <SheetDescription className="text-white/50">
              Access points, routers, and peripherals — search by device, filter by floor.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex items-center gap-2">
            <label className="text-xs text-white/50">Location</label>
            <select
              value={effectiveDeviceLocationId}
              onChange={(e) => setDeviceLocationId(e.target.value)}
              className="h-8 rounded-lg border border-white/15 bg-white/5 px-2 text-xs font-medium text-white"
            >
              {(locations ?? []).map((loc) => (
                <option key={loc.id} value={loc.id} className="text-black">
                  {loc.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAddDeviceOpen(true)}
              disabled={!effectiveDeviceLocationId}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add device
            </button>
          </div>

          {/* A location with zero devices used to render six greyed-out floor
           * tiles plus a nine-column table whose only content was an apology
           * row -- a wall of empty chrome. Show one honest empty state
           * instead, and only build the floor/table UI once hardware exists. */}
          {devices.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6] shadow-lg shadow-indigo-500/20">
                <Router className="h-7 w-7 text-white" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-white">No hardware here yet</p>
              <p className="mt-1.5 max-w-sm text-sm text-white/50">
                Once you add an access point or router to this venue, its floor map, live status and
                CPU health will appear right here.
              </p>
              <button
                type="button"
                onClick={() => setAddDeviceOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1a1733] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add your first device
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {/* Only floors that actually hold hardware -- disabled "No devices"
                 * tiles were pure noise and unclickable by design. */}
                {FLOORS.filter((f) => devices.some((d) => d.floor === f)).map((f) => {
                  const onFloor = devices.filter((d) => d.floor === f);

                  const down = onFloor.filter((d) => d.status === "down").length;
                  const up = onFloor.filter((d) => d.status === "up").length;
                  const typesHere = Array.from(new Set(onFloor.map((d) => d.type)));
                  const floorActive = floorFilter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      title={`Filter: floor ${f}`}
                      aria-pressed={floorActive}
                      onClick={() => setFloorFilter(floorActive ? null : f)}
                      className={cn(
                        "group cursor-pointer rounded-xl border p-3 text-left backdrop-blur-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                        floorActive
                          ? "border-[#6C4EFF]/60 bg-[#6C4EFF]/15 ring-1 ring-[#6C4EFF]/40"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-white">{f}</p>
                        <p className="text-[11px] tabular-nums text-white/40">
                          {onFloor.length} {onFloor.length === 1 ? "device" : "devices"}
                        </p>
                      </div>

                      {/* Health bar reads faster than a sentence: green = up, red = down. */}
                      <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
                        {onFloor.map((d) => (
                          <span
                            key={d.id}
                            className={cn(
                              "h-full flex-1 rounded-full",
                              d.status === "up"
                                ? "bg-emerald-500"
                                : d.status === "down"
                                  ? "bg-rose-500"
                                  : "bg-white/25",
                            )}
                          />
                        ))}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-xs",
                            down > 0 ? "font-medium text-rose-400" : "text-white/45",
                          )}
                        >
                          {down > 0 ? `${down} down` : `${up} online`}
                        </p>
                        {typesHere.length > 0 && (
                          <span className="flex items-center gap-1 text-white/40">
                            {typesHere.map((t) => {
                              const Icon = DEVICE_TYPE_ICON[t];
                              return <Icon key={t} className="h-3 w-3" aria-hidden="true" />;
                            })}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                <div className="mb-3 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-white/50">
                        {downCount} of {devices.length} devices down
                      </p>
                      {(typeFilter || floorFilter || deviceSearch) && (
                        <span className="rounded-full bg-[#6C4EFF]/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                          {filteredDevices.length} shown
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(typeFilter || floorFilter || deviceSearch) && (
                        <button
                          type="button"
                          aria-label="Clear all device filters"
                          onClick={() => {
                            setTypeFilter(null);
                            setFloorFilter(null);
                            setDeviceSearch("");
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                          <X className="h-3 w-3" aria-hidden="true" /> Clear all
                        </button>
                      )}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                        <Input
                          placeholder="Search device or MAC…"
                          value={deviceSearch}
                          onChange={(e) => setDeviceSearch(e.target.value)}
                          className="h-8 w-full border-white/15 bg-white/5 pl-8 text-xs text-white placeholder:text-white/40 sm:w-56"
                        />
                        {deviceSearch && (
                          <button
                            type="button"
                            aria-label="Clear device search"
                            onClick={() => setDeviceSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Device type filter chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-white/40">Type:</span>
                    {DEVICE_TYPES.map((type) => {
                      const count = devices.filter((d) => d.type === type).length;
                      const Icon = DEVICE_TYPE_ICON[type];
                      const active = typeFilter === type;
                      if (count === 0) return null;
                      return (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Filter by ${type} (${count})`}
                          onClick={() => setTypeFilter(active ? null : type)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                            active
                              ? cn("ring-1", DEVICE_TYPE_ACTIVE_TINT[type])
                              : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {type}
                          <span className="ml-0.5 text-[10px] opacity-70">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Floor filter chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-white/40">Floor:</span>
                    {FLOORS.filter((f) => devices.some((d) => d.floor === f)).map((f) => {
                      const count = devices.filter((d) => d.floor === f).length;
                      const active = floorFilter === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Filter by floor ${f} (${count})`}
                          onClick={() => setFloorFilter(active ? null : f)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                            active
                              ? "border-[#6C4EFF]/60 bg-[#6C4EFF]/15 text-indigo-200 ring-1 ring-[#6C4EFF]/40"
                              : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white",
                          )}
                        >
                          {f}
                          <span className="text-[10px] opacity-70">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {visibleSelectedIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#6C4EFF]/40 bg-[#6C4EFF]/10 px-3 py-2">
                    <span className="text-xs font-semibold text-indigo-100">
                      {visibleSelectedIds.length} selected
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      {[
                        { label: "Restart", icon: RefreshCw },
                        { label: "Mark for maintenance", icon: HardDrive },
                      ].map(({ label, icon: Icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => runBulkAction(label)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={exportSelectedDevices}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      >
                        Export CSV
                      </button>
                      <button
                        type="button"
                        onClick={clearDeviceSelection}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      >
                        <X className="h-3 w-3" aria-hidden="true" /> Clear
                      </button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs font-medium uppercase tracking-wide text-white/40">
                        <th className="px-3 py-2">
                          <Checkbox
                            aria-label="Select all devices"
                            checked={
                              allVisibleSelected
                                ? true
                                : someVisibleSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={toggleSelectAllVisible}
                            disabled={filteredDevices.length === 0}
                            className="border-white/30 data-[state=checked]:border-[#6C4EFF] data-[state=checked]:bg-[#6C4EFF]"
                          />
                        </th>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">MAC ID</th>
                        <th className="px-3 py-2">Device</th>
                        <th className="px-3 py-2">Floor</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Status Since</th>
                        <th className="px-3 py-2">CPU Usage</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-xs text-white/40">
                            {devices.length === 0
                              ? "No hardware set up here yet — add your first device from this location's Devices page."
                              : "Nothing matches that search. Check the spelling or clear your filters."}
                          </td>
                        </tr>
                      ) : (
                        filteredDevices.map((d, i) => {
                          const TypeIcon = DEVICE_TYPE_ICON[d.type];
                          // No real CPU/load telemetry exists for arbitrary
                          // monitored hardware (see monitored_hardware's own
                          // module docstring) -- deriveCpu's random-from-MAC
                          // value stays demo-only, real accounts honestly show
                          // "—" via the existing cpu === null fallback below.
                          const cpu =
                            isDemo() && d.status !== "unknown" ? deriveCpu(d.mac, d.status) : null;
                          return (
                            <tr
                              key={d.id}
                              data-state={
                                visibleSelectedIds.includes(d.id) ? "selected" : undefined
                              }
                              className={cn(
                                "border-b border-white/5 last:border-0 hover:bg-white/[0.04]",
                                visibleSelectedIds.includes(d.id) && "bg-[#6C4EFF]/10",
                              )}
                            >
                              <td className="px-3 py-2">
                                <Checkbox
                                  aria-label={`Select ${d.name}`}
                                  checked={visibleSelectedIds.includes(d.id)}
                                  onCheckedChange={() => toggleDeviceSelected(d.id)}
                                  className="border-white/30 data-[state=checked]:border-[#6C4EFF] data-[state=checked]:bg-[#6C4EFF]"
                                />
                              </td>
                              <td className="px-3 py-2 text-xs text-white/40">{i + 1}</td>
                              <td className="px-3 py-2 text-xs font-medium text-white">{d.name}</td>
                              <td className="px-3 py-2 font-mono text-xs text-white/50">{d.mac}</td>
                              <td className="px-3 py-2 text-xs text-white/50">
                                <button
                                  type="button"
                                  title={`Filter: ${d.type}`}
                                  onClick={() =>
                                    setTypeFilter(typeFilter === d.type ? null : d.type)
                                  }
                                  className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  <TypeIcon className="h-3.5 w-3.5 text-indigo-300 transition-transform group-hover:scale-125" />
                                  {d.type}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-xs text-white/50">{d.floor}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                    d.status === "up"
                                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                      : d.status === "down"
                                        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                                        : "border-white/15 bg-white/5 text-white/50",
                                  )}
                                >
                                  <span className="relative flex h-1.5 w-1.5">
                                    {d.status === "up" && (
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                    )}
                                    <span
                                      className={cn(
                                        "relative inline-flex h-1.5 w-1.5 rounded-full",
                                        d.status === "up"
                                          ? "bg-emerald-500"
                                          : d.status === "down"
                                            ? "bg-rose-500"
                                            : "bg-white/30",
                                      )}
                                    />
                                  </span>
                                  {d.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-white/50">
                                {d.status === "up"
                                  ? "Up"
                                  : d.status === "down"
                                    ? "Down"
                                    : "Never observed"}
                                {d.statusChangedAt && ` · ${formatSince(d.statusChangedAt)}`}
                              </td>
                              <td className="px-3 py-2">
                                {cpu === null ? (
                                  <span className="text-xs text-white/40">—</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className={cn(
                                          "h-full rounded-full",
                                          cpu >= 80
                                            ? "bg-rose-500"
                                            : cpu >= 50
                                              ? "bg-amber-500"
                                              : "bg-emerald-500",
                                        )}
                                        style={{ width: `${cpu}%` }}
                                      />
                                    </div>
                                    <span className="text-xs tabular-nums text-white/50">
                                      {cpu}%
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  aria-label={`View history for ${d.name}`}
                                  onClick={() => toast.success(`History for ${d.name}`)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                >
                                  <Eye className="h-3 w-3" aria-hidden="true" />
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddDeviceDialog
        open={addDeviceOpen}
        onOpenChange={setAddDeviceOpen}
        locationId={effectiveDeviceLocationId}
        locationName={(locations ?? []).find((l) => l.id === effectiveDeviceLocationId)?.name}
        onAdded={() => refetchDevices()}
      />

      <LocationWizard
        open={addLocationOpen}
        onOpenChange={setAddLocationOpen}
        lockedOrganizationId={myOrg?.organizationId}
        lockedOrganizationName={myOrg?.organizationName}
        onCreated={() => {
          // Real create, not demo -- refetch the customer's location list so
          // the newly-created venue shows up on this page immediately
          // instead of waiting out useCustomerLocations()'s 30s staleTime.
          qc.invalidateQueries({ queryKey: customerKeys.locations });
        }}
      />
    </div>
  );
}
