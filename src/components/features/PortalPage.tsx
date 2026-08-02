import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ImageUp, Sparkles, Smartphone, QrCode, RefreshCw, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { portalService } from "@/services/portal.service";
import { resolveOrgId } from "@/services/customer.service";
import { brandAssetService } from "@/services/brand-asset.service";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import type { PortalLoginMethod } from "@/types/portal";
import type { RuntimeLanguage, RuntimePortalConfig } from "@/types/portal-runtime";

const SWATCHES = ["#1B57F5", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#0f172a"];
const AUTH_OPTIONS: [PortalLoginMethod, string][] = [["mobile_otp", "Mobile OTP"], ["email_otp", "Email OTP"], ["whatsapp_otp", "WhatsApp OTP"], ["voucher", "Voucher"], ["social", "Social Login"]];

// Same allow-list src/services/portal-runtime.service.ts's resolveConfig
// validates a real backend config's languages against -- this page's free-text
// "Languages" field can contain anything, so the live preview below falls
// back the exact same way a real guest device would for an unrecognized code.
const RUNTIME_LANGUAGES: RuntimeLanguage[] = ["en", "hi", "ar", "fr", "es"];
function toRuntimeLanguage(v: string): RuntimeLanguage {
  return (RUNTIME_LANGUAGES as string[]).includes(v) ? (v as RuntimeLanguage) : "en";
}

function PortalDesignIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 84 52" className="hidden h-12 w-auto shrink-0 sm:block" fill="none">
      <rect x="6" y="6" width="34" height="40" rx="5" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.6" />
      <rect x="11" y="12" width="24" height="14" rx="2" fill="#1e1b4b" />
      <motion.rect
        x="11" y="30" width="24" height="4" rx="2" fill="#4f46e5"
        initial={shouldReduceMotion ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ transformOrigin: "11px 32px" }}
      />
      <circle cx="15" cy="38" r="1.4" fill="#a78bfa" />
      <circle cx="21" cy="38" r="1.4" fill="#a78bfa" fillOpacity="0.6" />
      <circle cx="27" cy="38" r="1.4" fill="#a78bfa" fillOpacity="0.6" />
      <motion.g
        animate={shouldReduceMotion ? { opacity: 0.9 } : { y: [0, -1.5, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="46" y="10" width="30" height="30" rx="6" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="1.8" />
        <path d="M53 25l5 5 12-12" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      {[0, 1].map((i) => (
        <motion.circle
          key={i}
          cx={61} cy={25} r={9 + i * 5}
          stroke="#f0abfc" strokeOpacity={0.35 - i * 0.12} strokeWidth="1.2" fill="none"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

export function PortalPage({ locationId }: { locationId?: string }) {
  const demo = useIsDemo();
  const [primary, setPrimary] = useState("#1B57F5");
  // The actual big heading a guest sees on the sign-in screen (e.g.
  // "Welcome to Haldwani") -- backed by `seo.pageTitle` / `splash_headline`.
  // This is a *different* field from `msg` below (`seo.metaDescription` /
  // `splash_welcome_message`, the smaller subtext under it) -- until this
  // field existed here, editing "Welcome Message" silently saved to the
  // subtext only, so the headline itself could never be changed from this
  // screen (bug report: "welcome to haldwani kyun nahi hat raha hai").
  const [headline, setHeadline] = useState("");
  const [msg, setMsg] = useState("Welcome! Connect to enjoy free WiFi");
  const [authMethods, setAuthMethods] = useState<string[]>(["mobile_otp", "voucher"]);
  const [form, setForm] = useState({ theme: "enterprise", font: "inter", lang: "en, hi, ar", redirectUrl: "https://zipwifi.io/welcome", terms: "By connecting you agree to fair-use terms." });
  const [logo, setLogo] = useState<string | null>(null);
  // True once `logo` is a blob: URL from a real uploaded file (needs
  // URL.revokeObjectURL on the way out, and enables the "Remove" button
  // below) -- false for a plain hotlinkable URL or no logo at all.
  const [logoIsUploaded, setLogoIsUploaded] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Extracted so the (previously decorative, no-op) refresh button can
  // re-run the exact same real load -- bug report: "live preview run nhi
  // kr rha hai or refresh bar bhi nhi kamm kr rha hai". `pageSize: 1` sorted
  // by `updatedAt desc` used to silently grab *any* portal in the whole
  // organization, not this location's -- on an org with more than one
  // location (the real, exercised case) that meant e.g. "coloba"'s Portal
  // tab was actually showing "sector 12"'s saved config. Now fetches every
  // portal in the org and matches this location explicitly, falling back to
  // the org's default (or newest) only when this location truly has none.
  // The logo itself now lives on the real, object-storage-backed
  // org-level branding (app.domains.branding, POST/GET/DELETE
  // /branding/logo -- same MinIO/S3-compatible storage
  // BrandAssetPage.tsx's Background Image already uses), not
  // captive_portal_configs.logo_url -- a plain text column with no
  // upload endpoint at all. Shared org-wide, same reasoning as
  // Background Image: "the login screen doesn't know which location a
  // guest belongs to until after they've connected" (see
  // BrandAssetPage.tsx's own note).
  const loadLogo = async (org: string) => {
    const branding = await brandAssetService.getBranding(org);
    if (!branding?.logoUrl) {
      setLogo(null);
      setLogoIsUploaded(false);
      return;
    }
    if (branding.logoIsUploaded) {
      const blobUrl = await brandAssetService.fetchLogoBlobUrl(org);
      setLogo(blobUrl);
      setLogoIsUploaded(!!blobUrl);
    } else {
      setLogo(branding.logoUrl);
      setLogoIsUploaded(false);
    }
  };

  const loadPortal = async () => {
    if (demo) return;
    const org = await resolveOrgId();
    setOrgId(org);
    loadLogo(org).catch(() => {
      // Leave the logo preview empty -- not fatal to the rest of the page.
    });
    const res = await portalService.list({
      organizationId: org,
      page: 1,
      pageSize: 100,
      sort: { key: "updatedAt", dir: "desc" },
    });
    // Most-specific-wins, mirroring both the backend's own
    // CaptivePortalService.resolve_portal_config order and
    // SmartIdPage.tsx's identical client-side resolution: this
    // location's own config, else the organization's default
    // (Portal.locationId is "" for an org-default row -- see
    // portal.service.ts's toPortal), else none -- never an arbitrary
    // *other* location's config, which is what the original
    // `res.items[0]` (newest overall) bug actually did.
    const p =
      res.items.find((i) => i.locationId === locationId) ??
      res.items.find((i) => i.locationId === "") ??
      null;
    if (!p) {
      setPortalId(null);
      return;
    }
    setPortalId(p.id);
    setHeadline(p.seo.pageTitle || "");
    setMsg(p.seo.metaDescription || "Welcome! Connect to enjoy free WiFi");
    setPrimary(p.branding.primaryColor);
    setForm((f) => ({ ...f, redirectUrl: p.login.redirectUrl || f.redirectUrl, lang: p.languages.join(", "), terms: p.consent.termsUrl || f.terms }));
    setAuthMethods(p.loginMethods);
  };

  useEffect(() => {
    loadPortal().catch(() => {
      // Real fetch failed -- leave the form at its sensible defaults above.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locationId]);

  // Blob URLs are never revoked by the browser on their own -- revoke the
  // previous one whenever a new one replaces it (including on unmount).
  // Mirrors BrandAssetPage.tsx's identical cleanup effect.
  useEffect(() => {
    return () => {
      if (logoIsUploaded && logo) URL.revokeObjectURL(logo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo]);

  const handleRefresh = async () => {
    if (demo) {
      toast.success("Preview refreshed");
      return;
    }
    setRefreshing(true);
    try {
      await loadPortal();
      toast.success("Preview refreshed with the last saved configuration");
    } catch {
      toast.error("Could not refresh — check the connection and try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleAuth = (m: string) => {
    setAuthMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  // The real, unsaved-edits-aware config fed into the actual guest-facing
  // components below (GuestSignInCard/PortalShell) -- built straight from
  // this page's own live form state, not a fetch, so every keystroke/color
  // pick/toggle above re-renders the Live Preview panel with the exact same
  // component a guest's own device runs, immediately, before "Save
  // Configuration" is ever clicked. Shaped as a RuntimePortalConfig (the
  // same type `GET /captive-portal/resolve` returns) so this can never
  // silently drift from what that real component actually expects --
  // see src/routes/preview.portal.$locationId.tsx for the equivalent
  // preview built from the last *saved* config instead of in-progress edits.
  const langList = form.lang.split(",").map((l) => l.trim()).filter(Boolean);
  const livePreviewConfig: RuntimePortalConfig = useMemo(() => ({
    id: portalId ?? "live-preview",
    name: "",
    theme: "light",
    logoUrl: logo,
    backgroundImageUrl: null,
    primaryColor: primary,
    secondaryColor: primary,
    defaultLanguage: toRuntimeLanguage(langList[0] ?? "en"),
    supportedLanguages: langList.length ? langList.map(toRuntimeLanguage) : ["en"],
    advertisementBannerUrl: null,
    advertisementBannerLink: null,
    termsAndConditionsText: form.terms || null,
    termsAndConditionsUrl: null,
    privacyPolicyText: null,
    privacyPolicyUrl: null,
    splashHeadline: headline || null,
    splashWelcomeMessage: msg || null,
    redirectUrl: form.redirectUrl || null,
    otpSmsEnabled: authMethods.includes("mobile_otp"),
    otpEmailEnabled: authMethods.includes("email_otp"),
    otpWhatsappEnabled: authMethods.includes("whatsapp_otp"),
    usernamePasswordEnabled: false,
    voucherEnabled: authMethods.includes("voucher"),
    resolvedViaLocationOverride: true,
    isOpenNow: true,
    businessHoursClosedMessage: null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [portalId, logo, primary, form.lang, form.terms, form.redirectUrl, headline, msg, authMethods]);

  // Real upload, backed by app.domains.branding's MinIO/S3-compatible
  // object storage -- replaces the old flow, which only ever called
  // `URL.createObjectURL(file)` and stopped there: a browser-local
  // blob: URL that `saveConfig` never even included in its patch, so
  // nothing was ever persisted and the logo silently reverted on every
  // reload. Bug report: "portal logo default nhi hai" (no default after
  // refresh). Uploads immediately (like BrandAssetPage.tsx's Background
  // Image), not deferred to "Save Configuration" below.
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (demo) {
      // No real backend exists to talk to for a demo session (same
      // fallback pattern as master.locations.tsx's DEMO_LOCATIONS) --
      // a local-only, un-persisted preview is all a demo can offer.
      setLogo(URL.createObjectURL(file));
      setLogoIsUploaded(true);
      toast.success("Logo uploaded");
      return;
    }
    if (!orgId) return;
    setUploadingLogo(true);
    try {
      await brandAssetService.uploadLogo(file, orgId);
      await loadLogo(orgId);
      toast.success("Logo uploaded");
    } catch {
      toast.error("Could not upload the logo — check the connection and try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (demo) {
      setLogo(null);
      setLogoIsUploaded(false);
      toast.success("Logo removed");
      return;
    }
    if (!orgId) return;
    setUploadingLogo(true);
    try {
      await brandAssetService.deleteLogo(orgId);
      await loadLogo(orgId);
      toast.success("Logo removed");
    } catch {
      toast.error("Could not remove the logo — check the connection and try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveConfig = async () => {
    if (demo) { toast.success("Portal configuration saved"); return; }
    if (!orgId) { toast.error("No organization found for this session."); return; }
    try {
      const patch = {
        // The logo is no longer part of this patch -- it's the real,
        // immediately-persisted org-level upload above, not a
        // captive_portal_configs.logo_url string field.
        branding: { primaryColor: primary } as any,
        login: { redirectUrl: form.redirectUrl } as any,
        loginMethods: authMethods as PortalLoginMethod[],
        seo: { pageTitle: headline, metaDescription: msg } as any,
      };
      if (portalId) {
        await portalService.update(portalId, patch, orgId);
      } else {
        const created = await portalService.create({ name: "Guest Portal", organizationId: orgId, locationId: locationId ?? "", ...patch });
        setPortalId(created.id);
      }
      toast.success("Portal configuration saved");
    } catch {
      toast.error("Could not save — check the connection and try again.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Page intro -- this page previously opened straight into the form
          with no title/context at all, the only page in the redesigned set
          missing one. Icon-badge matches the established pattern (Dashboard
          chart headers, Select Location sections). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] shadow-sm shadow-indigo-500/20">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Portal</h1>
            <p className="text-xs text-muted-foreground">Design what guests see the moment they connect.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Real, shareable preview of the actual guest-facing captive portal
              (background image, branding, live sign-in methods) -- pulls the
              real, currently-*saved* captive_portal_configs/brandings data
              for this location, opened in a new tab. The "Live Preview" card
              below renders that same real component tree too, but fed this
              page's in-progress *unsaved* edits instead -- the two together
              cover both "what does my last save look like" and "what would
              this new edit look like". Hidden in demo mode (no real
              backend/org to preview) and until `orgId` has resolved. */}
          {!demo && orgId && locationId && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/preview/portal/$locationId"
                params={{ locationId }}
                search={{ organizationId: orgId }}
                target="_blank"
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Preview Portal
              </Link>
            </Button>
          )}
          <PortalDesignIllustration />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-sm border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-sm">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
            Portal Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="Welcome to your venue"
            />
            <p className="text-xs text-muted-foreground">The large heading guests see first on the sign-in screen. Leave blank to use the default "Welcome to [venue]".</p>
          </div>
          <div className="space-y-1.5"><Label>Welcome Message</Label><Textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} /><p className="text-xs text-muted-foreground">Smaller subtext shown under the headline.</p></div>

          <div>
            <Label className="mb-2 block">Brand Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setPrimary(c)}
                  aria-label={c}
                  className="relative h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110"
                  style={{ background: c, ["--tw-ring-color" as string]: primary === c ? c : "transparent" }}
                >
                  {primary === c && <motion.span layoutId="swatch-ring" className="absolute inset-0 rounded-full ring-2 ring-foreground/70" transition={{ type: "spring", bounce: 0.3, duration: 0.4 }} />}
                </button>
              ))}
              <div className="ml-1 flex items-center gap-2">
                <Input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="h-9 w-10 p-1" />
                <Input value={primary} onChange={e => setPrimary(e.target.value)} className="font-mono h-9 w-24" />
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Portal Logo</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : logo ? (
                  <img src={logo} alt="Portal logo" className="h-full w-full object-cover" onError={() => setLogo(null)} />
                ) : (
                  <ImageUp className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <ImageUp className="h-3.5 w-3.5" />Upload logo
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploadingLogo} onChange={handleLogoUpload} />
              </label>
              {logo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploadingLogo}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />Remove
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Displayed at 32×32px on the real sign-in screen (inside a rounded color badge) --
              upload a square image, 256×256px, PNG with a transparent background, for a sharp,
              clean result. Shared across every location in this organization, same as the
              Background Image.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Theme</Label><Select value={form.theme} onValueChange={v => setForm({...form, theme: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="enterprise">Enterprise Blue</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Font</Label><Select value={form.font} onValueChange={v => setForm({...form, font: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inter">Inter</SelectItem><SelectItem value="poppins">Poppins</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Languages</Label><Input value={form.lang} onChange={e => setForm({...form, lang: e.target.value})} className="h-9" /></div>
            <div className="space-y-1.5"><Label>Redirect URL</Label><Input value={form.redirectUrl} onChange={e => setForm({...form, redirectUrl: e.target.value})} className="h-9" /></div>
          </div>

          <div className="space-y-1.5"><Label>Auth Methods</Label><div className="flex flex-wrap gap-2">{AUTH_OPTIONS.map(([k,v]) => (
            <motion.div key={k} whileTap={{ scale: 0.96 }} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${authMethods.includes(k) ? "border-primary/50 bg-primary/5" : ""}`}>
              <Switch checked={authMethods.includes(k)} onCheckedChange={() => toggleAuth(k)} />
              <span className="text-xs">{v}</span>
            </motion.div>
          ))}</div></div>

          <div className="space-y-1.5"><Label>Terms &amp; Conditions</Label><Textarea rows={2} value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} /></div>
          <Button className="w-full sm:w-auto" onClick={saveConfig}>Save Configuration</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="shadow-sm border-0 overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#241f52] to-[#2b2461] text-white">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2.5 text-sm text-white">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10"><Smartphone className="h-3.5 w-3.5 text-white" /></div>
              Live Preview
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" /></span>
                Live
              </span>
            </CardTitle>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh preview from the last saved configuration"
              title="Refresh from saved configuration"
              className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
          </CardHeader>
          <CardContent>
            {/* Phone frame -- a real device bezel wrapping the *actual*
                guest-facing components (GuestSignInCard/PortalShell), not a
                hand-drawn approximation of them. `livePreviewConfig` above
                is rebuilt from this page's own live form state on every
                render, so every keystroke/color pick/toggle re-renders this
                exact real component immediately -- previously this panel
                was a fully self-contained mockup (its own hardcoded phone
                UI, an inert "Continue" button, a plain wifi glyph for the
                logo) that never read `authMethods`/`headline` beyond a
                couple of cosmetic props, and was an entirely different
                component tree than what a guest's device actually renders. */}
            <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-8 border-black/80 bg-black/80 p-1.5 shadow-xl">
              <div className="relative min-h-[560px] overflow-hidden rounded-[1.4rem] bg-white">
                <PortalRuntimeProvider
                  organizationId={orgId ?? "preview"}
                  locationId={locationId ?? "preview"}
                  routerId="preview"
                  previewMode
                  presetConfig={livePreviewConfig}
                  presetConfigLoading={false}
                >
                  <PortalShell variant="light" showHeader={false} constrained>
                    <GuestSignInCard />
                  </PortalShell>
                </PortalRuntimeProvider>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/50">
              This is the real guest sign-in component, live-rendered with your unsaved edits
              above. For the exact, currently-saved config a guest would see right now, use{" "}
              <span className="font-medium text-white/80">Preview Portal</span> at the top of
              this page.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]"><QrCode className="h-3.5 w-3.5 text-white" /></div>
              QR Code Access
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="grid h-32 w-32 place-items-center rounded-2xl border-2" style={{ borderColor: `${primary}55`, background: `${primary}0d` }}>
              <QrCode className="h-16 w-16" style={{ color: primary }} />
            </div>
            <p className="text-xs text-muted-foreground">portal.zipwifi.io</p>
            <Button variant="outline" size="sm" onClick={() => toast.success("QR code downloaded")}><Download className="mr-1.5 h-3.5 w-3.5" />Download QR</Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
