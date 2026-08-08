import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePlatformBranding } from "@/context/PlatformBrandingContext";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { branding } = usePlatformBranding();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Same dark indigo/violet/fuchsia identity as login.tsx's hero and
       * the customer dashboard's hero band -- was previously a teal/cyan
       * "aurora" wash that didn't match the rest of the redesigned product. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(80% 80% at 50% 30%, black, transparent 75%)",
          }}
        />
        <motion.div
          className="relative z-10 flex items-center gap-2.5"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* The real, static Wyfy Guest mark -- same asset login.tsx uses,
           * not the Master-Console whitelabel BrandIcon/BrandTitle (which
           * fall back to a generic lucide Wifi glyph with no company name
           * styling when no operator has configured a custom logo, which
           * is always true here: forgot-password/reset-password/verify-otp
           * are pre-auth, org-agnostic pages, wired to that no-op default
           * config with nothing to actually render). Bug report: "forgot
           * password mai dashboard jaisa logo nahi dikhta" (this page's
           * logo didn't look like the dashboard's real one). */}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">Wyfy Guest</span>
        </motion.div>
        <motion.div
          className="relative z-10 max-w-md space-y-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/85 ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.15_190)] shadow-[0_0_8px_oklch(0.78_0.15_190)]" />
            {branding.companyName} Cloud
          </span>
          <h2 className="text-[2rem] font-semibold leading-[1.15] tracking-tight">
            Enterprise-grade guest WiFi, managed from a single pane of glass.
          </h2>
          <p className="text-sm leading-relaxed text-white/75">
            Provision networks, onboard guests, and monitor every location in real time — with
            role-based access built for global teams.
          </p>
        </motion.div>
        <motion.div
          className="relative z-10 text-xs text-white/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          © {new Date().getFullYear()} {branding.companyName}. All rights reserved.
        </motion.div>

      </div>

      {/* Same light-palette pin as login.tsx's form panel -- without this,
       * a visitor whose OS is in dark mode gets this panel rendered in the
       * dark theme (near-black background, teal/cyan primary), which read
       * as "black and green" and clashed with the deliberately dark hero
       * on the left. Forces the light values regardless of system theme. */}
      <div
        className="flex items-center justify-center bg-white px-6 py-12 text-slate-900 sm:px-12"
        style={
          {
            "--background": "oklch(0.984 0.005 220)",
            "--foreground": "oklch(0.22 0.03 235)",
            "--card": "oklch(1 0 0)",
            "--card-foreground": "oklch(0.22 0.03 235)",
            "--popover": "oklch(1 0 0)",
            "--popover-foreground": "oklch(0.22 0.03 235)",
            "--primary": "#4f46e5",
            "--primary-foreground": "#ffffff",
            "--secondary": "oklch(0.955 0.012 216)",
            "--secondary-foreground": "oklch(0.26 0.03 232)",
            "--muted": "oklch(0.962 0.008 218)",
            "--muted-foreground": "oklch(0.5 0.025 230)",
            "--accent": "oklch(0.945 0.022 202)",
            "--accent-foreground": "oklch(0.3 0.06 210)",
            "--destructive": "oklch(0.58 0.21 25)",
            "--destructive-foreground": "oklch(0.99 0.005 250)",
            "--border": "oklch(0.905 0.012 220)",
            "--input": "oklch(0.925 0.012 220)",
            "--ring": "#6366f1",
          } as React.CSSProperties
        }
      >
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Same real static mark as the hero panel above, on the
           * primary-colored box login.tsx's own mobile header uses (this
           * panel is always light/`bg-white`, per the CSS-variable pin
           * just above -- a plain white mark needs a colored box behind it
           * here, unlike the hero panel's already-dark background). */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">Wyfy Guest</span>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </motion.div>
      </div>
    </div>
  );
}
