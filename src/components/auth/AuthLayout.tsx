import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePlatformBranding } from "@/context/PlatformBrandingContext";
import { AuthFrame } from "@/components/auth/AuthFrame";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { branding } = usePlatformBranding();
  return (
    // Same frame as LoginPage.tsx (one illustrated canvas, form in a card;
    // see AuthFrame.tsx), because "Forgot password?" swaps this page in place
    // of the login form -- two different frames would jump-cut between the
    // two. Pinned to the light palette for the same reason LoginPage is.
    <AuthFrame
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
      aside={() => (
        <motion.div
          className="flex max-w-lg flex-col gap-5 px-10 pt-20 xl:px-14"
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
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* The real, static Wyfy Guest mark -- same asset LoginPage uses,
         * not the Master-Console whitelabel BrandIcon/BrandTitle (these
         * pre-auth pages are org-agnostic and have no custom logo to show).
         * Bug report: "forgot password mai dashboard jaisa logo nahi
         * dikhta". */}
        <div className="mb-7 flex items-center gap-2.5">
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
        <p className="mt-6 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {branding.companyName}. All rights reserved.
        </p>
      </motion.div>
    </AuthFrame>
  );
}
