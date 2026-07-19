import { QRCodeSVG } from "qrcode.react";
import type { Portal, PortalComponent } from "@/types/portal";
import { LOGIN_METHOD_LABEL } from "@/types/portal";

interface Props {
  portal: Portal;
  device?: "desktop" | "tablet" | "mobile";
}

const shadowMap = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,.15)",
  md: "0 10px 30px -10px rgba(0,0,0,.35)",
  lg: "0 30px 60px -20px rgba(0,0,0,.55)",
};

function bg(portal: Portal): string {
  const b = portal.branding;
  if (b.backgroundType === "image" && b.backgroundUrl)
    return `url(${b.backgroundUrl}) center/cover no-repeat`;
  if (b.backgroundType === "video") return `linear-gradient(135deg, ${b.gradientFrom}, ${b.gradientTo})`;
  if (b.backgroundType === "color") return b.gradientFrom;
  return `linear-gradient(135deg, ${b.gradientFrom}, ${b.gradientTo})`;
}

function LoginCard({ portal }: { portal: Portal }) {
  const b = portal.branding;
  const method = portal.primaryLoginMethod;
  const cardBg = b.cardStyle === "glass"
    ? "rgba(255,255,255,.12)"
    : b.cardStyle === "flat"
    ? "rgba(255,255,255,.9)"
    : "#ffffff";
  const cardColor = b.cardStyle === "glass" ? "#ffffff" : "#0f172a";
  return (
    <div
      style={{
        background: cardBg,
        color: cardColor,
        backdropFilter: b.cardStyle === "glass" ? "blur(12px)" : undefined,
        borderRadius: b.borderRadius,
        boxShadow: shadowMap[b.shadow],
        padding: 24,
        width: "100%",
        maxWidth: 380,
      }}
    >
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide opacity-70">Sign in with</div>
        <div className="mt-1 text-sm font-semibold">{LOGIN_METHOD_LABEL[method]}</div>
      </div>
      <div className="mt-4 space-y-2">
        {method === "mobile_otp" && (
          <input placeholder="+1 (555) 123-4567" className="w-full rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm" />
        )}
        {method === "email_otp" && (
          <input placeholder="you@company.com" className="w-full rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm" />
        )}
        {method === "voucher" && (
          <input placeholder="Enter voucher code" className="w-full rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm" />
        )}
        {method === "pms" && (
          <>
            <input placeholder="Room number" className="w-full rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm" />
            <input placeholder="Last name" className="w-full rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm" />
          </>
        )}
        {method === "social" && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {["Google", "Facebook", "Apple", "LinkedIn"].map((s) => (
              <button key={s} className="rounded-md border border-black/10 bg-white/70 px-2 py-2">{s}</button>
            ))}
          </div>
        )}
        <button
          className="w-full rounded-md px-3 py-2 text-sm font-semibold"
          style={{
            background: b.buttonStyle === "solid" ? b.primaryColor : "transparent",
            border: b.buttonStyle !== "solid" ? `1px solid ${b.primaryColor}` : "none",
            color: b.buttonStyle === "solid" ? "#fff" : b.primaryColor,
          }}
        >
          {method === "click_through" ? "Connect to WiFi" : "Continue"}
        </button>
        {portal.consent.termsRequired && (
          <label className="mt-2 flex items-start gap-2 text-[11px] opacity-80">
            <input type="checkbox" className="mt-[2px]" />
            <span>I agree to the terms and privacy policy.</span>
          </label>
        )}
      </div>
    </div>
  );
}

function renderComponent(c: PortalComponent, portal: Portal, key: string) {
  const b = portal.branding;
  switch (c.type) {
    case "logo":
      return (
        <div key={key} className="flex justify-center">
          {portal.branding.logoUrl ? (
            <img src={portal.branding.logoUrl} alt="logo" style={{ height: 56 }} />
          ) : (
            <div
              style={{
                width: 56, height: 56, borderRadius: 12, background: b.primaryColor,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 20,
              }}
            >
              CG
            </div>
          )}
        </div>
      );
    case "heading":
      return (
        <h1 key={key} className="text-center font-semibold" style={{ color: "#fff" }}>
          {(c.props.text as string) || "Welcome"}
        </h1>
      );
    case "text":
      return (
        <p key={key} className="text-center text-sm opacity-80" style={{ color: "#fff" }}>
          {(c.props.text as string) || "Sign in to access WiFi."}
        </p>
      );
    case "image":
      return (
        <img key={key} src={(c.props.src as string) || "https://picsum.photos/seed/portal/600/220"} alt="banner"
          className="w-full rounded-lg object-cover" style={{ maxHeight: 160 }} />
      );
    case "video":
      return (
        <div key={key} className="rounded-lg bg-black/40 p-6 text-center text-xs text-white/70">
          Video placeholder
        </div>
      );
    case "button":
      return (
        <button key={key} className="mx-auto block rounded-md px-4 py-2 text-sm font-semibold"
          style={{ background: b.primaryColor, color: "#fff" }}>
          {(c.props.label as string) || "Learn more"}
        </button>
      );
    case "divider":
      return <div key={key} className="my-2 h-px bg-white/20" />;
    case "form":
    case "login_card":
      return <div key={key} className="flex justify-center"><LoginCard portal={portal} /></div>;
    case "otp_input":
      return (
        <div key={key} className="flex justify-center gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-8 rounded-md border border-white/30 bg-white/10" />
          ))}
        </div>
      );
    case "voucher_input":
      return (
        <input key={key} placeholder="Voucher code" className="mx-auto block w-64 rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60" />
      );
    case "pms_login":
      return (
        <div key={key} className="mx-auto grid w-64 gap-2">
          <input placeholder="Room number" className="rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60" />
          <input placeholder="Last name" className="rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60" />
        </div>
      );
    case "social_login":
      return (
        <div key={key} className="mx-auto grid w-64 grid-cols-2 gap-2 text-xs text-white">
          {["Google", "Facebook", "Apple", "LinkedIn"].map((s) => (
            <button key={s} className="rounded-md border border-white/30 bg-white/10 px-2 py-2">{s}</button>
          ))}
        </div>
      );
    case "qr_code":
      return (
        <div key={key} className="flex justify-center">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={`https://portal.cloudguest.io/${portal.id}`} size={110} />
          </div>
        </div>
      );
    case "ad_banner":
      return (
        <div key={key} className="overflow-hidden rounded-lg">
          <img src={portal.ads[0]?.mediaUrl ?? "https://picsum.photos/seed/ad/600/120"} alt="ad" className="h-24 w-full object-cover" />
        </div>
      );
    case "footer":
      return (
        <div key={key} className="pt-4 text-center text-[11px] opacity-70" style={{ color: "#fff" }}>
          {(c.props.text as string) || "Powered by CloudGuest"}
        </div>
      );
    case "contact":
      return (
        <div key={key} className="text-center text-xs opacity-80" style={{ color: "#fff" }}>
          Need help? support@{portal.organizationName.toLowerCase().replace(/\s+/g, "")}.com
        </div>
      );
    case "map":
      return (
        <div key={key} className="rounded-lg border border-white/20 bg-white/10 p-6 text-center text-xs text-white/70">
          Map placeholder — {portal.locationName}
        </div>
      );
    case "html_block":
      return (
        <div key={key} className="rounded-md border border-dashed border-white/30 p-3 text-center text-[11px] text-white/70">
          Custom HTML block (placeholder)
        </div>
      );
    default:
      return null;
  }
}

export function PortalLivePreview({ portal, device = "desktop" }: Props) {
  const width = device === "mobile" ? 375 : device === "tablet" ? 768 : "100%";
  const height = device === "mobile" ? 720 : device === "tablet" ? 800 : 620;
  return (
    <div className="flex justify-center">
      <div
        className="overflow-auto rounded-2xl border shadow-inner"
        style={{
          width,
          height,
          maxWidth: "100%",
          fontFamily: portal.branding.fontFamily,
          background: bg(portal),
        }}
      >
        <div className="flex min-h-full flex-col justify-center gap-4 p-6">
          {portal.components.map((c) => renderComponent(c, portal, c.id))}
        </div>
      </div>
    </div>
  );
}
