import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePlatformBranding } from "@/context/PlatformBrandingContext";
import { AuthScenePanel, AUTH_SKY_TEXT } from "@/components/auth/AuthScenePanel";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { branding } = usePlatformBranding();
  return (
    // Same frame as LoginPage.tsx (form left, illustrated sky panel right,
    // compact scene band above the form on small screens), because "Forgot
    // password?" swaps this page in place of the login form -- two different
    // frames would jump-cut between the two. Pinned to the light palette for
    // the same reason LoginPage is.
    <div
      className="min-h-screen bg-white text-slate-900 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
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
      <div className="flex min-h-screen flex-col">
        <div aria-hidden="true" className="lg:hidden">
          <AuthScenePanel variant="band" className="aspect-[5/2] max-h-[360px] w-full" />
        </div>
        <motion.header
          className="flex items-center gap-2.5 px-6 pt-6 sm:px-10 lg:px-12 lg:pt-10"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* The real, static Wyfy Guest mark -- same asset LoginPage uses,
           * not the Master-Console whitelabel BrandIcon/BrandTitle (these
           * pre-auth pages are org-agnostic and have no custom logo to show).
           * Bug report: "forgot password mai dashboard jaisa logo nahi
           * dikhta". */}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Wyfy Guest</span>
        </motion.header>
        <main className="flex flex-1 items-start justify-center px-6 pt-8 pb-10 sm:px-12 lg:items-center lg:py-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
            {footer && (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            )}
          </motion.div>
        </main>
        <footer className="px-6 pb-6 text-xs text-muted-foreground sm:px-10 lg:px-12 lg:pb-8">
          © {new Date().getFullYear()} {branding.companyName}. All rights reserved.
        </footer>
      </div>

      <aside aria-label="About Wyfy Guest" className="hidden p-3 lg:block">
        <AuthScenePanel variant="panel" className="h-full min-h-[calc(100vh-1.5rem)] rounded-2xl">
          {(tone) => (
            <motion.div
              className="flex max-w-md flex-col gap-5 p-10 xl:p-12"
              style={{ color: AUTH_SKY_TEXT[tone] }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-current/25 px-3 py-1 text-xs font-medium tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
                {branding.companyName} Cloud
              </span>
              <h2 className="text-balance text-[2rem] font-semibold leading-[1.15] tracking-tight">
                Enterprise-grade guest WiFi, managed from a single pane of glass.
              </h2>
              <p className="text-sm leading-relaxed opacity-85">
                Provision networks, onboard guests, and monitor every location in real time — with
                role-based access built for global teams.
              </p>
            </motion.div>
          )}
        </AuthScenePanel>
      </aside>
    </div>
  );
}
