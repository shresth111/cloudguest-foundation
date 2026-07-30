import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, Download, ImageUp, Sparkles, Smartphone, QrCode, RefreshCw, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { portalService } from "@/services/portal.service";
import { resolveOrgId } from "@/services/customer.service";
import { brandAssetService } from "@/services/brand-asset.service";
import type { PortalLoginMethod } from "@/types/portal";

const SWATCHES = ["#1B57F5", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#0f172a"];
const AUTH_OPTIONS: [PortalLoginMethod, string][] = [["mobile_otp", "Mobile OTP"], ["email_otp", "Email OTP"], ["voucher", "Voucher"], ["social", "Social Login"]];

export function PortalPage({ locationId }: { locationId?: string }) {
  const demo = useIsDemo();
  const [primary, setPrimary] = useState("#1B57F5");
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
        seo: { metaDescription: msg } as any,
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
    <div className="space-y-4">
      {/* Real, shareable preview of the actual guest-facing captive portal
          (background image, branding, live sign-in methods) -- pulls the
          real captive_portal_configs/brandings data for this location, not
          the local mock state this page's own form/"Live Preview" card
          below still runs on. Hidden in demo mode (no real backend/org to
          preview) and until `orgId` has resolved. */}
      {!demo && orgId && locationId && (
        <div className="flex justify-end">
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
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-sm border-0">
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-primary" />Portal Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5"><Label>Welcome Message</Label><Textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} /></div>

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
        <Card className="shadow-sm border-0 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><Smartphone className="h-4 w-4 text-primary" />Live Preview</CardTitle>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh preview from the last saved configuration"
              title="Refresh from saved configuration"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
          </CardHeader>
          <CardContent>
            {/* Phone frame */}
            <div className="mx-auto w-full max-w-[280px] rounded-[2rem] border-8 border-foreground/90 bg-foreground/90 p-1.5 shadow-xl">
              <div className="overflow-hidden rounded-[1.4rem]" style={{ background: `linear-gradient(160deg, ${primary}26, ${primary}0d)` }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={primary + msg + logo}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex min-h-[380px] flex-col items-center justify-center gap-3 p-6 text-center"
                  >
                    <motion.div
                      className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-md"
                      style={{ background: primary, color: "white" }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Wifi className="h-6 w-6" />}
                    </motion.div>
                    <p className="font-semibold leading-snug">{msg}</p>
                    <p className="text-xs text-muted-foreground">Connect to enjoy free WiFi</p>
                    <div className="mt-2 w-full space-y-2">
                      <Input placeholder="Mobile number" className="h-9 bg-background/80" />
                      <Button className="h-9 w-full" style={{ background: primary }}>Continue</Button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                      {authMethods.map((m) => (
                        <span key={m} className="rounded-full border bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m}</span>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">Powered by ZIP WiFi</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              A live mockup of your unsaved edits above. For the real, saved guest experience
              (actual branding, background image, live sign-in methods), use{" "}
              <span className="font-medium text-foreground">Preview Portal</span> at the top of
              this page.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><QrCode className="h-4 w-4 text-primary" />QR Code Access</CardTitle></CardHeader>
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
