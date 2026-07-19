import type { ReactNode } from "react";
import { Wifi } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 p-10 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <Wifi className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">CloudGuest</span>
        </div>
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Enterprise-grade guest WiFi, managed from a single pane of glass.
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Provision networks, onboard guests, and monitor every location in real time — with
            role-based access built for global teams.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} CloudGuest. All rights reserved.
        </div>
        <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wifi className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold">CloudGuest</span>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
