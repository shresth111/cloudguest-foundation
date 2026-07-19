import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Brand } from "@/types/branding";

type Device = "desktop" | "tablet" | "mobile";

const WIDTHS: Record<Device, string> = {
  desktop: "w-full",
  tablet: "w-[600px]",
  mobile: "w-[360px]",
};

interface Props {
  brand: Brand;
  variant?: "dashboard" | "login" | "portal";
}

export function LivePreview({ brand, variant = "dashboard" }: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<"light" | "dark">("light");

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border bg-muted/30 p-1">
            {(["desktop", "tablet", "mobile"] as const).map((d) => {
              const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
              return (
                <Button key={d} size="sm" variant={device === d ? "default" : "ghost"} className="h-7 gap-1.5 px-2.5 text-xs capitalize" onClick={() => setDevice(d)}>
                  <Icon className="h-3.5 w-3.5" /> {d}
                </Button>
              );
            })}
          </div>
          <div className="inline-flex rounded-lg border bg-muted/30 p-1">
            {(["light", "dark"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "ghost"} className="h-7 px-2.5 text-xs capitalize" onClick={() => setMode(m)}>{m}</Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center overflow-auto rounded-xl bg-muted/40 p-4">
          <div
            className={cn("overflow-hidden rounded-xl border shadow-xl transition-all", WIDTHS[device])}
            style={{ fontFamily: brand.typography.fontFamily, borderRadius: brand.typography.cardRadius }}
          >
            {variant === "login" && <LoginPreview brand={brand} mode={mode} />}
            {variant === "dashboard" && <DashboardPreview brand={brand} mode={mode} />}
            {variant === "portal" && <PortalPreview brand={brand} mode={mode} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPreview({ brand, mode }: { brand: Brand; mode: "light" | "dark" }) {
  const bg = mode === "dark" ? "#0B1220" : "#F8FAFC";
  const fg = mode === "dark" ? "#F1F5F9" : "#0F172A";
  return (
    <div style={{ background: bg, color: fg, fontSize: brand.typography.fontSize }}>
      <div className="flex">
        <aside className="hidden w-40 shrink-0 p-3 sm:block" style={{ background: brand.colors.sidebar, color: "#F8FAFC" }}>
          <div className="mb-3 flex items-center gap-2">
            <img src={brand.logos.dashboard} alt="" className="h-6 w-6 rounded" />
            <span className="text-xs font-semibold">{brand.name}</span>
          </div>
          {["Dashboard", "Guests", "Routers", "Analytics"].map((it, i) => (
            <div key={it} className="mb-1 rounded px-2 py-1.5 text-xs" style={{ background: i === 0 ? `${brand.colors.primary}30` : "transparent" }}>
              {it}
            </div>
          ))}
        </aside>
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: brand.colors.navbar, color: "#F8FAFC" }}>
            <span className="text-xs font-medium">{brand.companyName}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-70">admin@{brand.companyName.toLowerCase().replace(/\s+/g, "")}</span>
              <div className="h-6 w-6 rounded-full" style={{ background: brand.colors.accent }} />
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {["Active guests", "Sessions", "Uptime", "Revenue"].map((label, i) => (
              <div key={label} className="p-3" style={{ background: brand.colors.cardBg, border: `1px solid ${brand.colors.cardBorder}`, borderRadius: brand.typography.cardRadius, color: mode === "dark" ? "#111" : undefined }}>
                <div className="text-[10px] uppercase tracking-wide opacity-60">{label}</div>
                <div className="mt-1 text-xl font-semibold" style={{ color: brand.colors.primary, fontWeight: brand.typography.headingWeight }}>
                  {[1284, 5820, "99.9%", "$12.4k"][i]}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <button
              className="px-4 py-2 text-xs"
              style={{ background: brand.colors.buttonBg, color: brand.colors.buttonText, borderRadius: brand.typography.borderRadius, fontWeight: brand.typography.buttonWeight }}
            >
              Primary action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPreview({ brand, mode }: { brand: Brand; mode: "light" | "dark" }) {
  const bg = mode === "dark" ? "#0B1220" : "#FFFFFF";
  const fg = mode === "dark" ? "#F1F5F9" : "#0F172A";
  return (
    <div className="grid min-h-[380px] grid-cols-1 md:grid-cols-2" style={{ background: bg, color: fg, fontSize: brand.typography.fontSize }}>
      <div
        className="hidden md:block"
        style={{ backgroundImage: `url(${brand.login.background})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="flex flex-col justify-center gap-4 p-6">
        <img src={brand.logos.login} alt="" className="h-10 w-10 rounded" />
        <div>
          <h3 className="text-lg font-semibold" style={{ color: brand.colors.primary, fontWeight: brand.typography.headingWeight }}>{brand.login.heading}</h3>
          <p className="text-xs opacity-70">{brand.login.description}</p>
        </div>
        <div className="space-y-2">
          <input placeholder="Email" className="w-full border px-3 py-2 text-xs" style={{ borderRadius: brand.typography.borderRadius, background: "transparent", color: fg }} />
          <input placeholder="Password" type="password" className="w-full border px-3 py-2 text-xs" style={{ borderRadius: brand.typography.borderRadius, background: "transparent", color: fg }} />
        </div>
        <button
          className="px-4 py-2 text-xs"
          style={{ background: brand.colors.buttonBg, color: brand.colors.buttonText, borderRadius: brand.typography.borderRadius, fontWeight: brand.typography.buttonWeight }}
        >
          Sign in
        </button>
        <p className="text-[10px] opacity-60">{brand.login.footer}</p>
      </div>
    </div>
  );
}

function PortalPreview({ brand, mode }: { brand: Brand; mode: "light" | "dark" }) {
  const bg = mode === "dark" ? "#0B1220" : "#FFFFFF";
  const fg = mode === "dark" ? "#F1F5F9" : "#0F172A";
  return (
    <div className="relative" style={{ minHeight: 380, background: bg, color: fg, fontSize: brand.typography.fontSize }}>
      <div
        className="absolute inset-0 opacity-70"
        style={{ backgroundImage: `url(${brand.portal.background})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent, ${bg} 80%)` }} />
      <div className="relative flex min-h-[380px] flex-col items-center justify-center gap-3 p-6 text-center">
        <img src={brand.portal.logo} alt="" className="h-12 w-12 rounded-lg" />
        <h3 className="text-xl font-semibold" style={{ color: brand.portal.primary, fontFamily: brand.portal.font }}>{brand.portal.welcomeMessage}</h3>
        <p className="max-w-sm text-xs opacity-70">{brand.portal.terms}</p>
        <button
          className="mt-2 px-5 py-2 text-xs"
          style={{ background: brand.portal.primary, color: "#fff", borderRadius: brand.typography.borderRadius, fontWeight: brand.typography.buttonWeight }}
        >
          Connect to WiFi
        </button>
        <p className="mt-4 text-[10px] opacity-60">{brand.portal.footer}</p>
      </div>
    </div>
  );
}
