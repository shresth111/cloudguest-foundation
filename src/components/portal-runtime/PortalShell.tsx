import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";

interface Props {
  children: ReactNode;
  showHeader?: boolean;
  contentClassName?: string;
}

export function PortalShell({ children, showHeader = true, contentClassName }: Props) {
  const { config, highContrast, largeText } = usePortalRuntime();
  const brand = config?.brand;

  return (
    <div
      className={cn(
        "portal-runtime relative min-h-dvh w-full overflow-hidden text-white",
        highContrast && "contrast-125 saturate-150",
        largeText && "text-[17px]",
      )}
      style={{
        background: brand
          ? `linear-gradient(135deg, var(--pr-bg-from), var(--pr-bg-to))`
          : "linear-gradient(135deg,#0F172A,#1E293B)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: brand?.heroImage }}
      />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-5 sm:max-w-lg">
        {showHeader && (
          <header className="mb-6 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
              >
                {brand?.logoText ?? <Wifi className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{brand?.companyName ?? "CloudGuest"}</p>
                <p className="truncate text-[11px] text-white/60">{brand?.venueName ?? "Guest WiFi"}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageSwitcher />
              <A11yMenu />
            </div>
          </header>
        )}
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={cn("flex flex-1 flex-col", contentClassName)}
        >
          {children}
        </motion.main>
        <footer className="mt-8 text-center text-[11px] text-white/40">
          Powered by CloudGuest · v1.0
        </footer>
      </div>
    </div>
  );
}

export function PortalCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--pr-radius,18px)] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
