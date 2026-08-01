import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Search, Star, MapPin, Wifi, Router, Printer, Camera, HardDrive, ArrowRight, LogOut, Activity, Radio, Eye, RefreshCw, Quote } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import type { CustomerLocationSummary } from "@/services/customer.service";
import { useDeviceStore, FLOORS, formatSince, deriveCpu, type DeviceType } from "@/stores/deviceStore";
import { businessTypeIcon } from "@/lib/business-type-icons";
import { toast } from "sonner";
import { requireCustomerSession } from "@/lib/authGuards";

export const Route = createFileRoute("/customer/")({
  beforeLoad: ({ context, location }) => requireCustomerSession(context.auth, location),
  component: CustomerHomePage,
});

const DEVICE_TYPE_ICON: Record<DeviceType, typeof Wifi> = {
  "Access Point": Wifi, Printer, Router, Camera, Other: HardDrive,
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
    if (shouldReduceMotion) { setText(String(target)); return; }
    mv.set(target);
    const unsub = display.on("change", (v) => setText(v));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, shouldReduceMotion]);

  return <>{text}</>;
}

/**
 * Hero illustration: a manager at a monitor, watching over a café, a hotel,
 * and a coworking space -- flat filled shapes (not thin outline strokes)
 * connected to a pulsing WiFi orb by dashed signal lines, so the scene reads
 * as "one person watching over your venues" instead of a generic network
 * diagram. Replaces the earlier line-art router illustration and the
 * separate Coffee/Building2/Briefcase icon strip -- both ideas now live
 * inside this one illustration instead of being shown twice.
 *
 * Purely decorative -- aria-hidden. The signal-line draw-on is a one-time
 * entrance; the orb pulse and steam wisps loop, so both respect
 * useReducedMotion.
 */
function HeroManagerIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const badges = [
    { key: "cafe", x: 336, y: 34, accent: "#f0abfc" },
    { key: "hotel", x: 410, y: 92, accent: "#22d3ee" },
    { key: "coworking", x: 346, y: 148, accent: "#a78bfa" },
  ];
  const orb = { x: 153, y: 88 };

  return (
    <svg aria-hidden="true" viewBox="0 0 520 210" className="h-auto w-full max-w-[300px]" fill="none">
      <defs>
        <filter id="mgr-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <linearGradient id="mgr-monitor-bars" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
      </defs>

      <circle cx="140" cy="130" r="70" fill="#7c3aed" opacity="0.18" filter="url(#mgr-illo-glow)" />
      <line x1="20" y1="192" x2="500" y2="192" stroke="white" strokeOpacity="0.12" strokeWidth="1" />

      {badges.map((b, i) => (
        <motion.path
          key={`line-${b.key}`}
          d={`M${orb.x} ${orb.y} Q${(orb.x + b.x) / 2} ${Math.min(orb.y, b.y) - 20} ${b.x} ${b.y + 22}`}
          stroke={b.accent}
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="1 6"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 + i * 0.15, ease: "easeOut" }}
        />
      ))}

      <rect x="95" y="150" width="112" height="13" rx="6" fill="#2e2a5c" />
      <rect x="95" y="150" width="112" height="4" rx="2" fill="#f0abfc" fillOpacity="0.25" />

      <path d="M113 192c-3-34 5-56 27-56h6c22 0 30 22 27 56z" fill="#f5f0ff" />
      <path d="M119 150c0-14 8-24 21-24s21 10 21 24" fill="#7c3aed" fillOpacity="0.9" />
      <circle cx="140" cy="112" r="18" fill="#f5f0ff" />
      <path d="M122 104c0-11 8-19 18-19s18 8 18 19c-6-4-13-6-18-6s-12 2-18 6z" fill="#7c3aed" />
      <circle cx="134" cy="113" r="1.8" fill="#1e1b4b" />
      <circle cx="146" cy="113" r="1.8" fill="#1e1b4b" />
      <path d="M134 120c2 2 6 2 8 0" stroke="#1e1b4b" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      <path d="M176 146h14a5 5 0 0 1 5 5v3a6 6 0 0 1-6 6h-13a6 6 0 0 1-6-6v-3a5 5 0 0 1 5-5z" fill="#f0abfc" />
      <path d="M195 149h3a3 3 0 0 1 0 6h-3" stroke="#f0abfc" strokeWidth="2" fill="none" />
      {[0, 1].map((i) => (
        <motion.path
          key={`steam-${i}`}
          d={`M${182 + i * 8} 142c2-4-2-6 0-10`}
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          animate={shouldReduceMotion ? { opacity: 0.3 } : { y: [0, -4, 0], opacity: [0.15, 0.4, 0.15] }}
          transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
        />
      ))}

      <rect x="128" y="110" width="48" height="34" rx="5" fill="#1e1b4b" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
      {[0, 1, 2].map((i) => (
        <rect key={`bar-${i}`} x={140 + i * 9} y={136 - (i + 1) * 6} width="5" height={(i + 1) * 6} rx="1.5" fill="url(#mgr-monitor-bars)" />
      ))}

      <motion.circle
        cx={orb.x} cy={orb.y} r="9" fill="#22d3ee" filter="url(#mgr-illo-glow)"
        animate={shouldReduceMotion ? { opacity: 0.35 } : { opacity: [0.2, 0.45, 0.2], scale: [1, 1.25, 1] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx={orb.x} cy={orb.y} r="5" fill="#22d3ee" />

      <g transform={`translate(${badges[0].x}, ${badges[0].y})`}>
        <rect width="54" height="46" rx="12" fill="#2e2a5c" stroke="white" strokeOpacity="0.12" />
        <path d="M15 20h18a4 4 0 0 1 4 4v3a9 9 0 0 1-9 9h-8a9 9 0 0 1-9-9v-3a4 4 0 0 1 4-4z" fill="#f0abfc" />
        <path d="M37 22h3a3 3 0 0 1 0 6h-3" stroke="#f0abfc" strokeWidth="2" fill="none" />
        <path d="M20 14c1-2-1-3 0-5" stroke="white" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </g>

      <g transform={`translate(${badges[1].x}, ${badges[1].y})`}>
        <rect width="54" height="46" rx="12" fill="#2e2a5c" stroke="white" strokeOpacity="0.12" />
        <rect x="14" y="10" width="26" height="28" rx="3" fill="#22d3ee" />
        <rect x="19" y="16" width="4" height="4" fill="#1e1b4b" />
        <rect x="27" y="16" width="4" height="4" fill="#1e1b4b" />
        <rect x="19" y="24" width="4" height="4" fill="#1e1b4b" />
        <rect x="27" y="24" width="4" height="4" fill="#1e1b4b" />
        <rect x="23" y="32" width="8" height="6" fill="#1e1b4b" />
      </g>

      <g transform={`translate(${badges[2].x}, ${badges[2].y})`}>
        <rect width="54" height="46" rx="12" fill="#2e2a5c" stroke="white" strokeOpacity="0.12" />
        <rect x="12" y="16" width="30" height="18" rx="2" fill="#a78bfa" />
        <rect x="16" y="20" width="22" height="10" rx="1" fill="#1e1b4b" />
        <rect x="10" y="34" width="34" height="4" rx="2" fill="#a78bfa" fillOpacity="0.6" />
      </g>
    </svg>
  );
}

function CustomerHomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setActiveLocation } = useCustomerStore();
  const { data: locations, isLoading, refetch } = useCustomerLocations();
  const { devices: allDevices } = useDeviceStore();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("cg-favs") ?? "[]"); } catch { return []; } });
  const [menu, setMenu] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DeviceType | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [deviceLocationId, setDeviceLocationId] = useState("");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [deviceSheetOpen, setDeviceSheetOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const filtered = (locations ?? []).filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()));
  const toggleFav = (id: string) => { setFavorites((p) => { const n = p.includes(id) ? p.filter((f) => f !== id) : [...p, id]; localStorage.setItem("cg-favs", JSON.stringify(n)); return n; }); };
  const handleSelect = (loc: CustomerLocationSummary) => { setActiveLocation(loc.id, loc); navigate({ to: `/customer/${loc.id}/dashboard` }); };
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };
  const doRefetch = () => { refetch(); setSecondsAgo(0); };

  // Each location has its own hardware -- default the monitoring panel to the first
  // location once locations load, rather than mixing every location's devices together.
  const effectiveDeviceLocationId = deviceLocationId || locations?.[0]?.id || "";
  const devices = allDevices.filter((d) => d.locationId === effectiveDeviceLocationId);
  const filteredDevices = devices
    .filter((d) => !deviceSearch || d.name.toLowerCase().includes(deviceSearch.toLowerCase()) || d.mac.toLowerCase().includes(deviceSearch.toLowerCase()))
    .filter((d) => !typeFilter || d.type === typeFilter)
    .filter((d) => !floorFilter || d.floor === floorFilter);
  const downCount = devices.filter((d) => d.status === "down").length;
  const totalDownAcrossLocations = allDevices.filter((d) => d.status === "down").length;

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
      className="relative min-h-screen overflow-x-hidden bg-[#181530] text-white"
      style={
        {
          "--primary": "#4f46e5",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {/* One solid dark indigo/violet/fuchsia identity for the whole page,
       * top to bottom -- viewport-fixed so it stays present as the page
       * scrolls past a tall grid, instead of a hero band being the only
       * "designed" part and everything below reverting to plain admin UI. */}
      <div aria-hidden className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none fixed -bottom-32 -left-16 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Wyfy Guest</p>
                <p className="text-[10px] text-white/60">Customer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* No locationId yet on this location-picker page, so "view
                  all" has nowhere real to send the click -- the dropdown
                  itself (org-wide recent alerts) is the honest destination. */}
              <span className="[&_button]:text-white/80 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
                <NotificationBell scope="org" />
              </span>
              <div className="relative">
                <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 pl-2 border-l border-white/15 ml-1">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-white/15 text-white text-xs font-semibold">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar>
                </button>
                {menu && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/10 bg-[#241f4d] p-1 text-white shadow-xl">
                    <div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-white/50">{user?.email}</p></div>
                    <div className="border-t border-white/10 my-1" />
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"><LogOut className="h-4 w-4" />Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">Every location, watched live</p>
              <h1
                className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
              >
                Which venue are we looking after today?
              </h1>

              <div className="relative mt-5 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <Input
                  placeholder="Search locations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/30"
                />
              </div>

              {!isLoading && (
                <div className="mt-6 flex gap-6">
                  {heroStats.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                    >
                      <p
                        className="text-2xl font-bold tabular-nums"
                        style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
                      >
                        <CountUp target={s.value} />
                      </p>
                      <p className="text-xs text-white/60">{s.label}</p>
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

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight leading-none">Your venues</h2>
              <p className="mt-1 text-xs text-white/45">Every site you manage, one tap from its dashboard.</p>
            </div>
            {!isLoading && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60">{filtered.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
              Live · updated {secondsAgo}s ago
              <button onClick={doRefetch} className="ml-1 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"><RefreshCw className="h-3 w-3" /></button>
            </span>
            <button
              onClick={() => setDeviceSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
            >
              <Radio className="h-3.5 w-3.5" /> Device health
              {totalDownAcrossLocations > 0 && (
                <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-300">{totalDownAcrossLocations}</span>
              )}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="h-4 w-32 rounded bg-white/10" /><div className="mt-2 h-3 w-24 rounded bg-white/10" /><div className="mt-4 space-y-2"><div className="h-3 rounded bg-white/10" /><div className="h-3 w-3/4 rounded bg-white/10" /></div></div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-white/40"><MapPin className="mb-4 h-12 w-12 opacity-30" /><p>No venues match that search. Try a different name or city.</p></div>
            ) : filtered.map((loc, i) => {
              const LocationIcon = businessTypeIcon(loc.propertyType);
              const statusDot = loc.status === "online" ? "bg-emerald-500" : loc.status === "degraded" ? "bg-amber-500" : "bg-rose-500";
              const statusPill = loc.status === "online" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : loc.status === "degraded" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400";
              const statusLabel = loc.status === "online" ? "Online" : loc.status === "degraded" ? "Degraded" : "Offline";
              const ringColor = loc.status === "online" ? "hover:ring-emerald-500/25" : loc.status === "degraded" ? "hover:ring-amber-500/25" : "hover:ring-rose-500/25";
              return (
              <motion.div key={loc.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                role="button" tabIndex={0}
                onClick={() => handleSelect(loc)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(loc); } }}
                className={cn("group relative cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur-sm transition-all hover:bg-white/[0.07] hover:ring-2 w-full", ringColor)}
              >
                <button onClick={(e) => { e.stopPropagation(); toggleFav(loc.id); }} className="absolute right-4 top-4 text-white/40 hover:text-amber-400 transition-colors">
                  <Star className={cn("h-4 w-4", favorites.includes(loc.id) && "fill-amber-400 text-amber-400")} />
                </button>

                <div className="flex items-start gap-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
                    <LocationIcon className="h-5 w-5 text-white" />
                    {loc.status === "online" && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-xl ring-2 ring-emerald-400"
                        animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.18, 1] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-lg font-semibold text-white" style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}>{loc.name}</p>
                    <p className="text-xs text-white/50">{loc.city} · {loc.organizationName}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-white" style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}>{loc.onlineUsers}</p>
                    <p className="text-[11px] text-white/45">guests online</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusPill)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
                    {statusLabel}
                  </span>
                </div>

                <div title={`Last synced ${loc.lastSync}`} className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-white/40">
                  <span className="truncate">{loc.isp} · {loc.bandwidth}</span>
                  <span className="shrink-0">{loc.routerHealth}% health</span>
                </div>

                <div className="mt-2.5 flex items-center justify-end text-xs font-medium text-indigo-300 opacity-0 transition-opacity group-hover:opacity-100">Open dashboard <ArrowRight className="ml-1 h-3 w-3" /></div>
              </motion.div>
              );
            })}
          </div>
        )}
      </main>

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
            <SheetDescription className="text-white/50">Access points, routers, and peripherals — search by device, filter by floor.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex items-center gap-2">
            <label className="text-xs text-white/50">Location</label>
            <select
              value={effectiveDeviceLocationId}
              onChange={(e) => setDeviceLocationId(e.target.value)}
              className="h-8 rounded-lg border border-white/15 bg-white/5 px-2 text-xs font-medium text-white"
            >
              {(locations ?? []).map((loc) => <option key={loc.id} value={loc.id} className="text-black">{loc.name}</option>)}
            </select>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FLOORS.map((f) => {
              const onFloor = devices.filter((d) => d.floor === f);
              const down = onFloor.filter((d) => d.status === "down").length;
              const typesHere = Array.from(new Set(onFloor.map((d) => d.type)));
              const floorActive = floorFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  title={onFloor.length > 0 ? `Filter: floor ${f}` : undefined}
                  disabled={onFloor.length === 0}
                  onClick={() => setFloorFilter(floorActive ? null : f)}
                  className={cn(
                    "rounded-xl border p-3 text-center backdrop-blur-sm transition-all",
                    onFloor.length > 0 ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default opacity-50",
                    floorActive ? "border-[#4f46e5]/60 bg-[#4f46e5]/15 ring-1 ring-[#4f46e5]/40" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
                  )}
                >
                  <p className="text-sm font-bold text-white">{f}</p>
                  {typesHere.length > 0 && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      {typesHere.map((t) => {
                        const Icon = DEVICE_TYPE_ICON[t];
                        const active = typeFilter === t;
                        return (
                          <span
                            key={t}
                            role="button"
                            tabIndex={0}
                            title={`Filter: ${t}`}
                            onClick={(e) => { e.stopPropagation(); setTypeFilter(active ? null : t); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setTypeFilter(active ? null : t); } }}
                            className={cn("rounded-full p-1 transition-all hover:scale-125 hover:bg-white/15 hover:text-white", active ? "bg-[#4f46e5]/30 text-white" : "text-white/50")}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <p className={cn("mt-1 text-xs", down > 0 ? "text-rose-400 font-medium" : "text-white/40")}>{down > 0 ? `${down} of ${onFloor.length} down` : onFloor.length > 0 ? `${onFloor.length} online` : "No devices"}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/50">{downCount} of {devices.length} devices down</p>
                {typeFilter && (
                  <button onClick={() => setTypeFilter(null)} className="inline-flex items-center gap-1 rounded-full bg-[#4f46e5]/20 px-2 py-0.5 text-[11px] font-medium text-indigo-200 hover:bg-[#4f46e5]/30">
                    {typeFilter} <span className="text-indigo-200/60">×</span>
                  </button>
                )}
                {floorFilter && (
                  <button onClick={() => setFloorFilter(null)} className="inline-flex items-center gap-1 rounded-full bg-[#4f46e5]/20 px-2 py-0.5 text-[11px] font-medium text-indigo-200 hover:bg-[#4f46e5]/30">
                    Floor {floorFilter} <span className="text-indigo-200/60">×</span>
                  </button>
                )}
              </div>
              <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" /><Input placeholder="Search device or MAC…" value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} className="h-8 w-full border-white/15 bg-white/5 pl-8 text-xs text-white placeholder:text-white/40 sm:w-56" /></div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs font-medium uppercase tracking-wide text-white/40"><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">MAC ID</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">Floor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Status Since</th><th className="px-3 py-2">CPU Usage</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-xs text-white/40">{devices.length === 0 ? "No hardware set up here yet — add your first device from this location's Devices page." : "Nothing matches that search. Check the spelling or clear your filters."}</td></tr>
                  ) : filteredDevices.map((d, i) => {
                    const TypeIcon = DEVICE_TYPE_ICON[d.type];
                    const cpu = deriveCpu(d.mac, d.status);
                    return (
                      <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.04]">
                        <td className="px-3 py-2 text-xs text-white/40">{i + 1}</td>
                        <td className="px-3 py-2 text-xs font-medium text-white">{d.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-white/50">{d.mac}</td>
                        <td className="px-3 py-2 text-xs text-white/50">
                          <button type="button" title={`Filter: ${d.type}`} onClick={() => setTypeFilter(typeFilter === d.type ? null : d.type)} className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/10 hover:text-white">
                            <TypeIcon className="h-3.5 w-3.5 text-indigo-300 transition-transform group-hover:scale-125" />{d.type}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs text-white/50">{d.floor}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            d.status === "up" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400",
                          )}>
                            <span className="relative flex h-1.5 w-1.5">{d.status === "up" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}<span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", d.status === "up" ? "bg-emerald-500" : "bg-rose-500")} /></span>
                            {d.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-white/50">{d.status === "up" ? "Up" : "Down"} · {formatSince(d.statusChangedAt)}</td>
                        <td className="px-3 py-2">
                          {cpu === null ? (
                            <span className="text-xs text-white/40">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><div className={cn("h-full rounded-full", cpu >= 80 ? "bg-rose-500" : cpu >= 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${cpu}%` }} /></div>
                              <span className="text-xs tabular-nums text-white/50">{cpu}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right"><button onClick={() => toast.success(`History for ${d.name}`)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-300 hover:bg-white/10"><Eye className="h-3 w-3" />View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
