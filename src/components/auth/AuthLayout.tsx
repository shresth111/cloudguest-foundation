import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BrandTitle } from "@/components/brand/BrandTitle";
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
      <div className="relative hidden overflow-hidden bg-[oklch(0.2_0.04_232)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Aurora: layered teal/cyan/blue radial washes over a deep navy. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 12% -8%, oklch(0.66 0.15 192 / 0.55), transparent 55%), radial-gradient(90% 80% at 100% 8%, oklch(0.5 0.14 250 / 0.5), transparent 55%), radial-gradient(80% 70% at 60% 110%, oklch(0.56 0.13 210 / 0.45), transparent 60%)",
          }}
        />
        {/* Faint grid for depth, gently panning -- same aurora-grid keyframe src/routes/login.tsx uses. */}
        <div
          aria-hidden
          className="aurora-grid pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(80% 80% at 50% 30%, black, transparent 75%)",
          }}
        />
        <motion.div
          className="relative z-10 flex items-center gap-2.5"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <BrandIcon className="h-5 w-5 brightness-0 invert" />
          </div>
          <BrandTitle className="text-lg text-white" />
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

        {/* Slow drifting blobs -- identical aurora-drift keyframes to src/routes/login.tsx,
            disabled under prefers-reduced-motion via the same global rule. */}
        <div className="aurora-blob-1 pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="aurora-blob-2 pointer-events-none absolute -bottom-32 -left-28 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <BrandLogo size="h-8 w-8" />
            <BrandTitle className="text-base" />
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
