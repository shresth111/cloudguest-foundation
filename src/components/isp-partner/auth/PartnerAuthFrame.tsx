/**
 * The frame for the ISP Partner console's signed-out pages: sign in, forgot
 * password, reset password (founder ask 2026-10-23: "ISP Partner karke").
 *
 * Same design language as the Master sign-in (`MasterLoginPage`): a
 * deep-indigo brand panel beside the form on lg+, the violet `master-theme`
 * tokens, the real Wyfy Guest mark. Small screens get a compact brand band
 * over the card instead of the panel. It follows the console's light/dark
 * toggle the way `PartnerShell` does (the toggle sits top-right).
 *
 * The network drawing is plain inline SVG (no extra chunk, no layout shift);
 * its pulse is a Tailwind `animate-pulse`, which `motion-reduce` turns off.
 */
import type { ReactNode } from "react";
import { Building2, Network, ScrollText, Ticket } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Building2,
    title: "Customers & venues",
    body: "Onboard a venue, add its routers, see it live.",
  },
  {
    icon: Ticket,
    title: "Plans, coupons & billing",
    body: "Speed plans, coupon batches and invoices.",
  },
  {
    icon: ScrollText,
    title: "Logs & reports",
    body: "NetLogs and session reports, ready to export.",
  },
] as const;

/** Venue nodes around the ISP core: [x, y, r]. */
const NODES: ReadonlyArray<readonly [number, number, number]> = [
  [60, 46, 7],
  [262, 38, 6],
  [300, 150, 8],
  [244, 252, 6],
  [70, 246, 8],
  [24, 150, 6],
];

function NetworkArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 324 292" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pa-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6C4EFF" />
        </radialGradient>
      </defs>
      <circle cx="162" cy="146" r="118" fill="none" stroke="white" strokeOpacity="0.07" />
      <circle cx="162" cy="146" r="72" fill="none" stroke="white" strokeOpacity="0.09" />
      {NODES.map(([x, y], i) => (
        <line
          key={`l${i}`}
          x1="162"
          y1="146"
          x2={x}
          y2={y}
          stroke="#a78bfa"
          strokeOpacity="0.45"
          strokeWidth="1.25"
          strokeDasharray="3 5"
        />
      ))}
      {NODES.map(([x, y, r], i) => (
        <g key={`n${i}`}>
          <circle cx={x} cy={y} r={r + 7} fill="#22d3ee" fillOpacity="0.08" />
          <circle cx={x} cy={y} r={r} fill="#14113a" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx={x} cy={y} r={2} fill="#22d3ee" />
        </g>
      ))}
      <circle
        cx="162"
        cy="146"
        r="40"
        fill="#6C4EFF"
        fillOpacity="0.18"
        className="animate-pulse motion-reduce:animate-none"
      />
      <circle cx="162" cy="146" r="26" fill="url(#pa-core)" />
      <image href="/brand/mark-compact-white.svg" x="150" y="134" width="24" height="24" />
    </svg>
  );
}

function BrandLine({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15",
          compact ? "h-9 w-9" : "h-11 w-11",
        )}
      >
        <img
          src="/brand/mark-compact-white.svg"
          alt=""
          className={compact ? "h-5 w-5" : "h-6 w-6"}
        />
      </span>
      <div className="leading-tight">
        <p className={cn("font-semibold", compact ? "text-sm" : "text-base")}>Wyfy Guest</p>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#c4b5fd]">
          ISP Partner
        </p>
      </div>
    </div>
  );
}

export function PartnerAuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const year = new Date().getFullYear();
  return (
    <div className={cn("master-theme", theme?.theme === "dark" && "dark")}>
      <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
        {/* lg+: brand panel */}
        <aside
          aria-label="About the ISP Partner Console"
          className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#241f5c] via-[#1e1b4b] to-[#0f0d2a] p-12 text-white lg:flex [@media(max-height:800px)]:py-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-[#6C4EFF]/30 blur-[110px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-[#22d3ee]/15 blur-[110px]"
          />
          <div className="relative z-10">
            <BrandLine />
          </div>

          <div className="relative z-10 max-w-md space-y-6 [@media(max-height:800px)]:space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75">
              <Network className="h-3.5 w-3.5 text-[#22d3ee]" /> ISP Partner Console
            </span>
            <h2 className="text-balance text-[2.25rem] font-bold leading-[1.15] tracking-tight">
              Every venue on your network, in one console.
            </h2>
            <p className="text-sm leading-relaxed text-white/65">
              For internet service providers who resell Wyfy Guest WiFi to cafés, hotels and
              co-working spaces.
            </p>
            <NetworkArt className="h-auto w-full max-w-[300px] [@media(max-height:800px)]:max-w-[220px]" />
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] ring-1 ring-white/10">
                    <f.icon className="h-4 w-4 text-[#c4b5fd]" />
                  </span>
                  <span className="text-sm">
                    <span className="block font-medium text-white">{f.title}</span>
                    <span className="block text-white/55">{f.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 text-xs text-white/40">
            © {year} Wyfy Guest · ISP Partner Console
          </p>
        </aside>

        {/* Small screens: brand band */}
        <header className="relative overflow-hidden bg-gradient-to-br from-[#241f5c] via-[#1e1b4b] to-[#0f0d2a] px-4 pb-11 pt-5 text-white lg:hidden">
          <NetworkArt className="pointer-events-none absolute -right-10 -top-6 h-44 w-auto opacity-40" />
          <div className="relative flex items-center justify-between">
            <BrandLine compact />
            <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />
          </div>
        </header>

        {/* The form */}
        <main className="relative flex w-full flex-1 items-start justify-center px-4 lg:w-1/2 lg:items-center lg:px-12 lg:py-12">
          <div className="absolute right-4 top-4 hidden lg:block">
            <ThemeToggle />
          </div>
          <div className="-mt-6 mb-10 w-full max-w-[400px] rounded-2xl border border-border bg-card p-6 shadow-[0_24px_60px_-24px_rgba(30,27,75,0.35)] sm:p-8 lg:mb-0 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                <Network className="h-3 w-3" /> ISP Partner
              </span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
            {footer && (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
