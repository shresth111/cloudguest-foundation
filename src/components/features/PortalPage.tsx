import { useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  ImageUp,
  Sparkles,
  Smartphone,
  QrCode,
  RefreshCw,
  ExternalLink,
  Info,
  Loader2,
  MessageSquareText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { portalService } from "@/services/portal.service";
import { resolveOrgId } from "@/services/customer.service";
import { brandAssetService } from "@/services/brand-asset.service";
import { toAppError } from "@/services/api";
import { SplashCharCounter } from "@/components/portals/SplashCharCounter";
import {
  SPLASH_HEADLINE_MAX,
  SPLASH_WELCOME_MAX,
  splashLimitErrorMessage,
  splashOverLimitBlocked,
} from "@/lib/splash-limits";
import {
  POST_LOGIN_HTML_MAX_BYTES,
  hasPostLoginHtml,
  postLoginHtmlByteLength,
  postLoginHtmlLimitErrorMessage,
  postLoginHtmlOverLimit,
} from "@/lib/post-login-html";
import { PostLoginHtmlFrame } from "@/components/portal-runtime/PostLoginHtmlFrame";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import {
  ConnectedPreview,
  type ConnectedPreviewScenario,
} from "@/components/portal-runtime/ConnectedPreview";
import {
  DEFAULT_FEEDBACK_DWELL_MINUTES,
  MAX_POST_CONNECT_ASKS,
  countPostConnectAsks,
  isSafeGoogleReviewUrl,
} from "@/lib/portal-post-connect";
import { DEMO_PORTAL_PREVIEW_STORAGE_KEY } from "@/lib/portal-preview-storage";
import { BRAND_ASSET_ACCEPT_ATTR, brandAssetRejectionReason } from "@/lib/brand-asset-limits";
import type { PortalLanguage, PortalLoginMethod } from "@/types/portal";
import {
  resolveLanguageSelection,
  type PortalContentMode,
  type RuntimePortalConfig,
} from "@/types/portal-runtime";

const SWATCHES = [
  "#1B57F5",
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#0f172a",
];
/** The three guests the Connected preview can be pointed at. Each is a real
 * state a real guest is in -- not a "show me card X" switch: the preview
 * runs the same resolver a phone does and shows whichever single card that
 * guest would actually get. Lives here, next to the control that renders
 * it, rather than in the preview component, which then only exports a
 * component. */
const CONNECTED_PREVIEW_SCENARIOS: { id: ConnectedPreviewScenario; label: string }[] = [
  { id: "first_visit", label: "First visit" },
  { id: "returning", label: "Returning guest" },
  { id: "dwell", label: "30 minutes in" },
];

/** One entry per possible number of post-connect asks. The wording is the
 * whole point -- it is what makes an owner feel a fourth switch before they
 * flip it, and it is a statement about their own settings rather than a
 * claim about guest behaviour, so it needs no data behind it and can never
 * be wrong. */
const ASK_METER = [
  { label: "Nothing extra is asked.", tone: "text-muted-foreground", dot: "bg-muted-foreground" },
  { label: "One ask. Barely noticeable.", tone: "text-emerald-600", dot: "bg-emerald-500" },
  { label: "Two is comfortable.", tone: "text-emerald-600", dot: "bg-emerald-500" },
  {
    label: "Three asks. Most guests will ignore the last one.",
    tone: "text-amber-600",
    dot: "bg-amber-500",
  },
  { label: "Four asks. This will feel like a form.", tone: "text-destructive", dot: "bg-red-500" },
];

const AUTH_OPTIONS: [PortalLoginMethod, string][] = [
  ["mobile_otp", "Mobile OTP"],
  ["email_otp", "Email OTP"],
  ["whatsapp_otp", "WhatsApp OTP"],
  ["voucher", "Voucher"],
  ["social", "Social Login"],
];

function PortalDesignIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="6"
        y="6"
        width="34"
        height="40"
        rx="5"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.6"
      />
      <rect x="11" y="12" width="24" height="14" rx="2" fill="#1e1b4b" />
      <motion.rect
        x="11"
        y="30"
        width="24"
        height="4"
        rx="2"
        fill="#4f46e5"
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
        transition={
          shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <rect
          x="46"
          y="10"
          width="30"
          height="30"
          rx="6"
          fill="#1e1b4b"
          stroke="#22d3ee"
          strokeWidth="1.8"
        />
        <path
          d="M53 25l5 5 12-12"
          stroke="#22d3ee"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
      {[0, 1].map((i) => (
        <motion.circle
          key={i}
          cx={61}
          cy={25}
          r={9 + i * 5}
          stroke="#f0abfc"
          strokeOpacity={0.35 - i * 0.12}
          strokeWidth="1.2"
          fill="none"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

/**
 * One settings row on the "After they connect" card -- title and
 * description left, `Switch` right, expandable detail underneath. Same
 * shape as the `OpenHoursView` row this dashboard already uses for
 * settings toggles, so the card reads as part of the product rather than a
 * new idiom.
 */
function PostConnectRow({
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
      </div>
      {checked && children ? <div className="mt-3 space-y-2 border-t pt-3">{children}</div> : null}
    </div>
  );
}

/**
 * The honest empty state for every per-row funnel number on this card.
 *
 * NOT a zero, not a dash, not a placeholder chart. The server-side counters
 * these lines will read (`profile_prompt_shown` / `_saved` / `_declined` /
 * `_save_failed`, and `review_link_opened`) do not exist yet, and
 * `CampaignsPage` has already shipped this exact bug once -- its own code
 * comment records that the table "used to hard code 0 for every campaign on
 * a real account" while demo fixtures showed 2841/423. Reintroducing it one
 * card over would be worse, because it would be deliberate.
 *
 * And there is no benchmark here either: every captive-portal conversion
 * statistic located in research was vendor marketing with no published
 * methodology, sample definition or audit. A number under a toggle would be
 * repeated to customers by sales and indefensible when someone asked where
 * it came from.
 */
/** The placeholder that stands where each row's own count will go.
 *
 * It carries the reach caveat, and that placement is deliberate: this is
 * the spot a venue owner looks at to answer "is this working", so it is
 * the spot where the denominator has to be honest. Every post-connect card
 * lives on `/portal/session`, and iPhone and iPad guests never load that
 * page -- `portal.success.tsx` hands them to `captive.apple.com` on
 * purpose, because that is the only thing that makes iOS's Captive Network
 * Assistant dismiss itself and release the guest's traffic. So these
 * counts are over Android and desktop guests, always.
 *
 * Saying it here rather than only in a code comment or a help article is
 * the whole point. A count labelled plainly, that silently excludes every
 * iPhone in the venue, is how an owner concludes the feature does not work
 * and switches it off -- or worse, concludes it works better than it does.
 * When the real numbers land they replace `No data yet` and this line
 * stays. */
function NoDataYet() {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        No data yet. Numbers appear here once we are counting them.
      </p>
      <p className="text-xs text-muted-foreground">
        Counts cover guests on Android and laptops. iPhone and iPad guests go straight online
        without opening this screen.
      </p>
    </div>
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
  // Last-loaded (or last-successfully-saved) values of the two
  // backend-length-limited splash fields (see src/lib/splash-limits.ts for
  // the PR #39 contract) -- the baseline for the grandfathering rule below:
  // the backend only rejects an over-limit value when that field itself is
  // being CHANGED, so an existing over-limit row shows its counter in the
  // destructive tone immediately on load but never blocks saving OTHER
  // fields. Save is disabled only when the user edits an over-limit field
  // and leaves it over.
  const [savedSplash, setSavedSplash] = useState({ headline: "", msg: "" });
  const [authMethods, setAuthMethods] = useState<string[]>(["mobile_otp", "voucher"]);
  // Content mode + its per-mode source fields (see PortalContentBlock /
  // constants.PortalContentMode). "login" (default) leaves the sign-in
  // screen exactly as it is; image/text/redirect each feed the Live Preview
  // below live, on every edit. Guest surveys are Campaigns-only now (a
  // "Survey & Feedback" campaign), so "survey" is no longer a content mode
  // here -- a legacy row still in that mode is coerced to "login" on load.
  const [contentMode, setContentMode] = useState<PortalContentMode>("login");
  const [contentHeading, setContentHeading] = useState("");
  const [contentBody, setContentBody] = useState("");
  const [contentImageUrl, setContentImageUrl] = useState("");
  // The venue's own POST-login page (`login.postLoginHtml` /
  // `post_login_html`) -- what a guest sees after a successful sign-in,
  // instead of only being bounced to `redirectUrl`. Deliberately NOT one of
  // the content modes above: those are the pre-login surface and this is the
  // post-login one, and a venue can set both. "" means "no post-login page",
  // which leaves `/portal/redirect` exactly as it was before this existed.
  const [postLoginHtml, setPostLoginHtml] = useState("");
  // What the preview iframe below is actually showing, trailing the textarea
  // by a beat. Changing an iframe's `srcdoc` RELOADS the document, so binding
  // it straight to `postLoginHtml` would tear down and re-parse the whole
  // page on every keystroke -- visible flicker, and up to 64 KB of re-parse
  // per character on a big page. Everything else on this screen still
  // updates instantly; only this one input has a reload behind it.
  const [previewHtml, setPreviewHtml] = useState("");
  // The organization's login-screen background (app.domains.branding),
  // loaded as a blob URL for real accounts so it shows in the Live Preview
  // exactly as a guest sees it. Null in demo mode / when no image is set.
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [form, setForm] = useState({
    theme: "enterprise",
    font: "inter",
    lang: "en, hi, ar",
    redirectUrl: "https://wyfyguest.com/welcome",
    terms: "By connecting you agree to fair-use terms.",
  });
  const [logo, setLogo] = useState<string | null>(null);
  // True once `logo` is a blob: URL from a real uploaded file (needs
  // URL.revokeObjectURL on the way out, and enables the "Remove" button
  // below) -- false for a plain hotlinkable URL or no logo at all.
  const [logoIsUploaded, setLogoIsUploaded] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  // ===== "After they connect" =====
  // Local state, one explicit Save at the bottom of the card rather than
  // save-on-toggle -- the same shape as every other settings-toggle row in
  // this dashboard. Every one of these defaults OFF, including for venues
  // that already exist.
  // The venue's real name, used by the Connected preview for the `{venue}`
  // slot in the DPDP purpose line and the review subtitle. Sourced from the
  // resolved location, never invented -- with no name the cards that would
  // have interpolated it simply omit that line, which is also what a guest
  // would see.
  const [venueName, setVenueName] = useState("");
  const [collectGuestName, setCollectGuestName] = useState(false);
  const [collectGuestEmail, setCollectGuestEmail] = useState(false);
  const [reviewCardEnabled, setReviewCardEnabled] = useState(false);
  const [reviewUrl, setReviewUrl] = useState("");
  const [guestFeedbackEnabled, setGuestFeedbackEnabled] = useState(false);
  // Which screen the Live Preview is showing. Focusing anything in the
  // "After they connect" card flips this to "connected" automatically --
  // every setting in that card is invisible on the sign-in screen, and a
  // preview that does not move while a venue flips switches is worse than
  // no preview.
  const [previewTab, setPreviewTab] = useState<"signin" | "connected">("signin");
  const [previewScenario, setPreviewScenario] = useState<ConnectedPreviewScenario>("first_visit");

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
  // /branding/logo -- the same MinIO/S3-compatible storage the
  // background image below uses), not
  // captive_portal_configs.logo_url -- a plain text column with no
  // upload endpoint at all. Shared org-wide, same reasoning as
  // background image: "the login screen doesn't know which location a
  // guest belongs to until after they've connected" (see
  // brand-asset.service.ts's own note).
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

  // The org's login-screen background, loaded the same authenticated-blob
  // way usePortalPreview already does (an <img>/CSS bg can't
  // attach the headers /branding/background-image/raw needs). Feeds the Live
  // Preview so an operator sees the real backdrop a guest gets, not a blank.
  const loadBackground = async (org: string) => {
    const branding = await brandAssetService.getBranding(org);
    if (!branding?.hasBackgroundImage) {
      setBgImage(null);
      return;
    }
    const blobUrl = await brandAssetService.fetchBackgroundImageBlobUrl(org);
    setBgImage(blobUrl);
  };

  const loadPortal = async () => {
    if (demo) return;
    const org = await resolveOrgId();
    setOrgId(org);
    loadLogo(org).catch(() => {
      // Leave the logo preview empty -- not fatal to the rest of the page.
    });
    loadBackground(org).catch(() => {
      // Leave the background preview empty -- not fatal to the rest of the page.
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
    setSavedSplash({
      headline: p.seo.pageTitle || "",
      msg: p.seo.metaDescription || "Welcome! Connect to enjoy free WiFi",
    });
    setPrimary(p.branding.primaryColor);
    setForm((f) => ({
      ...f,
      redirectUrl: p.login.redirectUrl || f.redirectUrl,
      lang: p.languages.join(", "),
      terms: p.consent.termsUrl || f.terms,
    }));
    setAuthMethods(p.loginMethods);
    // "survey" is a retired content mode (guest surveys are Campaigns-only
    // now); `portalService` already coerces a legacy `content_mode: "survey"`
    // row to "login" via `toPortalContentMode`, so `p.content.mode` is always
    // one of the live modes here and never lands the editor in a dead state.
    setContentMode(p.content.mode);
    setContentHeading(p.content.heading);
    setContentBody(p.content.body);
    setContentImageUrl(p.content.imageUrl);
    setPostLoginHtml(p.login.postLoginHtml || "");
    setVenueName(p.locationId ? p.locationName : "");
    setCollectGuestName(p.postConnect.collectGuestName);
    setCollectGuestEmail(p.postConnect.collectGuestEmail);
    setReviewUrl(p.postConnect.reviewUrl);
    // The switch is its OWN stored column, not something derived from the
    // URL. Deriving it was a real design mistake: it made "pause the ask"
    // and "delete the link" the same gesture, so a venue pausing for a
    // refurbishment had to throw away a link they would then have to go
    // and find again in Business Profile. The venue's intent and the
    // material it needs are two different facts and the backend stores
    // them as two columns.
    setReviewCardEnabled(p.postConnect.reviewCardEnabled);
    setGuestFeedbackEnabled(p.postConnect.guestFeedbackEnabled);
  };

  useEffect(() => {
    loadPortal().catch(() => {
      // Real fetch failed -- leave the form at its sensible defaults above.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, locationId]);

  // See `previewHtml` above. 350ms is the usual "stopped typing" threshold --
  // long enough that a burst of typing costs one reload, short enough that
  // the preview never feels detached from the field.
  useEffect(() => {
    const id = setTimeout(() => setPreviewHtml(postLoginHtml), 350);
    return () => clearTimeout(id);
  }, [postLoginHtml]);

  // Blob URLs are never revoked by the browser on their own -- revoke the
  // previous one whenever a new one replaces it (including on unmount).
  // Same contract fetchLogoBlobUrl/fetchBackgroundImageBlobUrl document:
  // the caller owns the blob URL's lifetime.
  useEffect(() => {
    return () => {
      if (logoIsUploaded && logo) URL.revokeObjectURL(logo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo]);

  // Same blob-URL cleanup for the background image (always a real blob when
  // set -- fetchBackgroundImageBlobUrl only ever returns one).
  useEffect(() => {
    return () => {
      if (bgImage) URL.revokeObjectURL(bgImage);
    };
  }, [bgImage]);

  // Shared by the "Preview Portal" button (top of the page) and the
  // external-link icon on the Live Preview card's own header below --
  // previously two separate, duplicated Button blocks (one real, one
  // demo), which made it easy to update one and miss the other. Real
  // accounts open the actual shareable route with a real org/location;
  // demo hands /preview/portal/demo a localStorage snapshot instead
  // (see that route's own docstring, and DEMO_PORTAL_PREVIEW_STORAGE_KEY).
  // `window.open` with a plain URL string (not a router `Link`) so the
  // same handler covers both branches identically -- the resulting URL is
  // the same either way, this just avoids two different call shapes.
  const openExternalPreview = () => {
    if (demo) {
      localStorage.setItem(DEMO_PORTAL_PREVIEW_STORAGE_KEY, JSON.stringify(livePreviewConfig));
      window.open("/preview/portal/demo", "_blank", "noopener,noreferrer");
      return;
    }
    if (!orgId || !locationId) return;
    window.open(
      `/preview/portal/${locationId}?organizationId=${encodeURIComponent(orgId)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleRefresh = async () => {
    if (demo) {
      toast.success("Preview refreshed");
      return;
    }
    setRefreshing(true);
    try {
      await loadPortal();
      toast.success("Preview refreshed with the last saved configuration");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? toAppError(err).message
          : "Could not refresh — check the connection and try again.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const toggleAuth = (m: string) => {
    setAuthMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
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
  const langList = form.lang
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const livePreviewConfig: RuntimePortalConfig = useMemo(
    () => ({
      id: portalId ?? "live-preview",
      name: venueName,
      theme: "light",
      logoUrl: logo,
      // The org's real login-screen background (loaded above), so the Live
      // Preview shows the actual backdrop a guest sees rather than a blank.
      backgroundImageUrl: bgImage,
      primaryColor: primary,
      secondaryColor: primary,
      // This page's "Languages" field is free text and can contain anything,
      // so the live preview resolves it through the exact same function a
      // real guest device does (`resolveLanguageSelection`, shared from
      // types/portal-runtime.ts) rather than a second local copy of the
      // rule -- this file's copy had already drifted from the service's.
      // Unrecognized codes are dropped, not coerced to "en", which is what
      // stops "en, ar, fr" from previewing as three "English" entries.
      ...resolveLanguageSelection(langList[0], langList),
      advertisementBannerUrl: null,
      advertisementBannerLink: null,
      termsAndConditionsText: form.terms || null,
      termsAndConditionsUrl: null,
      privacyPolicyText: null,
      privacyPolicyUrl: null,
      splashHeadline: headline || null,
      splashWelcomeMessage: msg || null,
      redirectUrl: form.redirectUrl || null,
      // Post-login page. Carried on the runtime config so the shareable
      // /preview/portal/demo tab (which serializes this exact object) stays
      // in sync -- note that neither preview route renders a post-login
      // surface today; the authoring preview under the editor below is what
      // actually shows this. See the editor block's own comment.
      postLoginHtml: postLoginHtml || null,
      // Content mode + its source fields -- every edit rebuilds this memo and
      // re-renders PortalContentBlock in the preview immediately (task 4).
      contentMode,
      contentHeading: contentHeading || null,
      contentBody: contentBody || null,
      contentImageUrl: contentImageUrl || null,
      // Surveys are Campaigns-only now; the content-mode survey is retired.
      survey: null,
      otpSmsEnabled: authMethods.includes("mobile_otp"),
      otpEmailEnabled: authMethods.includes("email_otp"),
      otpWhatsappEnabled: authMethods.includes("whatsapp_otp"),
      usernamePasswordEnabled: false,
      voucherEnabled: authMethods.includes("voucher"),
      resolvedViaLocationOverride: true,
      isOpenNow: true,
      businessHoursClosedMessage: null,
      // captive-portal-v6-design-spec.md §7 -- this in-progress-edit preview
      // has no wizard field for either yet, so both stay at the same
      // zero-visual-diff defaults the real backend uses for an unset venue.
      guestFontChoice: "system",
      backgroundOverlayStrength: 55,
      // captive-portal-v7-design-spec.md §1.4 C3/C4/C5 -- 50/25 reproduce the
      // previous hardcoded `background-position: center 25%` exactly. The three
      // measurements are `null` because nothing has measured this preview's
      // image, and `null` is the correct value rather than a placeholder: it is
      // the same "not measured" state every real venue is in today (production
      // has zero backfilled branding rows), so the preview shows the
      // unconditional §1.3 scrim floor -- which is exactly what that venue will
      // see. See `toBackgroundMetric` for why 0 would have been wrong.
      // The "After they connect" settings, live. This is what makes the
      // Connected tab of the preview move as the venue flips switches --
      // before Save, on every keystroke, exactly as the sign-in tab already
      // does for the headline and colours.
      collectGuestName,
      collectGuestEmail,
      // Both, unconditionally -- the preview applies the same
      // `reviewCardEnabled && reviewUrl` rule a guest's portal does
      // (`reviewCardEligible`), rather than this page pre-collapsing them
      // into one nullable field and teaching the preview a second rule.
      reviewUrl: reviewUrl.trim() || null,
      reviewCardEnabled,
      guestFeedbackEnabled,
      feedbackDwellMinutes: DEFAULT_FEEDBACK_DWELL_MINUTES,
      backgroundFocalX: 50,
      backgroundFocalY: 25,
      backgroundLuminance: null,
      backgroundTopLuminance: null,
      backgroundEntropy: null,
      pinLoginEnabled: false,
      // v7 Part 3 P4: the builder has no white-label toggle yet; `true` is
      // the only value a non-entitled venue can have.
      poweredByEnabled: true,
      locationCountry: null,
    }),
    [
      portalId,
      venueName,
      logo,
      bgImage,
      primary,
      form.lang,
      form.terms,
      form.redirectUrl,
      headline,
      msg,
      authMethods,
      contentMode,
      contentHeading,
      contentBody,
      contentImageUrl,
      postLoginHtml,
      collectGuestName,
      collectGuestEmail,
      reviewCardEnabled,
      reviewUrl,
      guestFeedbackEnabled,
    ],
  );

  // Real upload, backed by app.domains.branding's MinIO/S3-compatible
  // object storage -- replaces the old flow, which only ever called
  // `URL.createObjectURL(file)` and stopped there: a browser-local
  // blob: URL that `saveConfig` never even included in its patch, so
  // nothing was ever persisted and the logo silently reverted on every
  // reload. Bug report: "portal logo default nhi hai" (no default after
  // refresh). Uploads immediately, like the background image below, not
  // deferred to "Save Configuration".
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Fail fast on the two rejections the backend would issue anyway --
    // the `accept` attribute above is a filter, not a guarantee (drag-drop
    // and "All Files" in the OS picker both walk straight past it).
    const rejection = brandAssetRejectionReason(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }
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
    } catch (err) {
      // Real incident: a plain "check the connection" here for every
      // failure swallowed a real 402 (plan doesn't include the
      // 'white_label' feature) behind a misleading network-error message
      // -- surfacing the backend's own real message (toAppError) instead
      // whenever this genuinely was a server response, not just a dropped
      // connection.
      toast.error(
        axios.isAxiosError(err)
          ? toAppError(err).message
          : "Could not upload the logo — check the connection and try again.",
      );
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
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? toAppError(err).message
          : "Could not remove the logo — check the connection and try again.",
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  // The login-screen background image, editable right here rather than
  // only on the separate "Background Image" page -- the Portal tab is
  // where an operator is already choosing the headline, brand colour and
  // logo, and it is the only surface with the Live Preview that shows
  // what the backdrop actually does to that text. Same org-scoped
  // endpoints the retired standalone "Background Image" page used
  // (POST/DELETE /branding/background-image, app.domains.branding's
  // MinIO/S3-compatible storage): there is exactly one background per
  // organization, not one per location -- the login screen doesn't know
  // which location a guest belongs to until after they've connected (see
  // brand-asset.service.ts's own note).
  //
  // Uploads immediately on pick, like the logo above -- it is not part of
  // the "Save Configuration" patch, because the bytes live on the branding
  // row, not on captive_portal_configs.
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const rejection = brandAssetRejectionReason(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    if (demo) {
      // No backend to talk to in a demo session -- a local, un-persisted
      // preview is all a demo can offer (same fallback as the logo above).
      setBgImage(URL.createObjectURL(file));
      toast.success("Background image uploaded");
      return;
    }
    if (!orgId) return;
    setUploadingBg(true);
    try {
      await brandAssetService.uploadBackgroundImage(file);
      await loadBackground(orgId);
      toast.success("Background image uploaded");
    } catch (err) {
      // Surface the backend's own message when there was a real response
      // -- a 402 here means the plan doesn't include 'white_label', which
      // a generic "check the connection" would hide (see handleLogoUpload).
      toast.error(
        axios.isAxiosError(err)
          ? toAppError(err).message
          : "Could not upload the background image — check the connection and try again.",
      );
    } finally {
      setUploadingBg(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (demo) {
      setBgImage(null);
      toast.success("Background image removed");
      return;
    }
    if (!orgId) return;
    setUploadingBg(true);
    try {
      await brandAssetService.deleteBackgroundImage();
      await loadBackground(orgId);
      toast.success("Background image removed");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? toAppError(err).message
          : "Could not remove the background image — check the connection and try again.",
      );
    } finally {
      setUploadingBg(false);
    }
  };

  // Mirrors the backend's accept/reject rule exactly (splashOverLimitBlocked:
  // code points over the trimmed value, and only when changed from the last
  // loaded/saved value) -- refuse at authoring time with a visible reason
  // instead of silently truncating, or letting the save 400.
  const headlineBlocked = splashOverLimitBlocked(
    headline,
    SPLASH_HEADLINE_MAX,
    savedSplash.headline,
  );
  const msgBlocked = splashOverLimitBlocked(msg, SPLASH_WELCOME_MAX, savedSplash.msg);
  const splashBlocked = headlineBlocked || msgBlocked;

  // The post-login page's own gate. Same principle as the splash limits
  // above -- refuse at authoring time with a visible reason rather than
  // letting the backend's 64 KiB cap come back as an opaque 400 after the
  // venue has typed a whole page. No grandfathering clause here (unlike
  // splash): the cap is enforced on write, so no stored row can already be
  // over it. See src/lib/post-login-html.ts.
  const postLoginBytes = postLoginHtmlByteLength(postLoginHtml);
  const postLoginBlocked = postLoginHtmlOverLimit(postLoginHtml);
  const saveBlocked = splashBlocked || postLoginBlocked;

  // ===== The ask budget, computed from the venue's own live settings =====
  // Dish ratings contribute 0 because they cannot be enabled -- see the
  // disabled row's own comment. Recomputed on every render so the meter
  // moves as toggles move, before anything is saved.
  const askCount = countPostConnectAsks({
    collectGuestName,
    collectGuestEmail,
    // The switch AND a link, because that pair is what a guest actually
    // meets. Counting the switch alone would tell a venue they are making
    // three asks when the third one cannot render.
    reviewCardEnabled: reviewCardEnabled && !!reviewUrl.trim(),
    guestFeedbackEnabled,
    dishRatingsEnabled: false,
  });
  const askMeter = ASK_METER[Math.min(askCount, MAX_POST_CONNECT_ASKS)];

  // The same guard the guest card applies before this URL ever reaches an
  // `href` -- surfaced here so a venue finds out at authoring time rather
  // than by wondering why no guest ever saw the card.
  const reviewUrlInvalid =
    reviewCardEnabled && !!reviewUrl.trim() && !isSafeGoogleReviewUrl(reviewUrl);

  const saveConfig = async () => {
    // The Save button is disabled while blocked; this guard just keeps the
    // rule airtight if another code path ever calls saveConfig directly.
    if (saveBlocked) return;
    if (demo) {
      toast.success("Portal configuration saved");
      return;
    }
    if (!orgId) {
      toast.error("No organization found for this session.");
      return;
    }
    try {
      const patch = {
        // The logo is no longer part of this patch -- it's the real,
        // immediately-persisted org-level upload above, not a
        // captive_portal_configs.logo_url string field.
        branding: { primaryColor: primary },
        // Both post-login destinations travel together: the external URL and
        // the venue's own page. `portal.service.ts` maps BOTH directions for
        // `postLoginHtml` (toPortal on read, create()/update() on write) --
        // a field mapped on read only is silently dropped here, which is the
        // bug `fontFamily` shipped with.
        login: { redirectUrl: form.redirectUrl, postLoginHtml },
        loginMethods: authMethods as PortalLoginMethod[],
        seo: { pageTitle: headline, metaDescription: msg },
        content: {
          mode: contentMode,
          heading: contentHeading,
          body: contentBody,
          imageUrl: contentImageUrl,
          // Surveys are Campaigns-only now; never persist a content-mode survey.
          survey: null,
        },
        // Real bug: this field was missing from the patch entirely, so the
        // "Languages" input above -- which does round-trip on load (line
        // ~166) and does drive the Live Preview in real time (langList
        // feeds livePreviewConfig.supportedLanguages just above) -- never
        // actually reached the backend on Save. An admin could type "hi"
        // here, watch the live preview render it, click "Save
        // Configuration", get the success toast, and the real captive
        // portal a guest hits would still resolve `supported_languages:
        // ["en"]` forever. Same normalization already used for the live
        // preview (unrecognized codes are dropped; an empty result degrades
        // to ["en"]) so what's saved always matches what was just previewed.
        languages: resolveLanguageSelection(langList[0], langList)
          .supportedLanguages as PortalLanguage[],
        // Both halves of every one of these is mapped in portal.service.ts
        // (toPortal on read, create()/update() on write) -- see that file's
        // note on the `fontFamily` bug for why a read-only mapping is worse
        // than no mapping at all.
        postConnect: {
          collectGuestName,
          collectGuestEmail,
          // The link is saved WHATEVER the switch says, and the switch is
          // saved as its own column. Turning the ask off used to clear the
          // stored URL on the theory that a venue resuming should
          // re-confirm it; in practice that made pausing destructive, and
          // the venue's punishment for a two-week pause was a trip back
          // into Business Profile to find the link again. Pausing is now
          // just the switch.
          reviewUrl: reviewUrl.trim(),
          reviewCardEnabled,
          guestFeedbackEnabled,
          feedbackDwellMinutes: DEFAULT_FEEDBACK_DWELL_MINUTES,
        },
      };
      let saved;
      if (portalId) {
        saved = await portalService.update(portalId, patch, orgId);
      } else {
        saved = await portalService.create({
          name: "Guest Portal",
          organizationId: orgId,
          locationId: locationId ?? "",
          ...patch,
        });
        setPortalId(saved.id);
      }
      setSavedSplash({ headline, msg });
      toast.success("Portal configuration saved");

      // Repaint the post-login editor from the STORED, SANITIZED value the
      // save returned. The backend sanitizes on write and echoes back what it
      // actually kept, so this is the one moment a venue can be shown what
      // was stripped -- leaving the textarea holding markup that is not in
      // the database would be a quiet lie, and the venue would only discover
      // it on the next reload with no explanation attached.
      //
      // `sent` is what update()/create() actually put on the wire (trimmed),
      // so trailing whitespace alone never reads as "the sanitizer changed
      // something".
      const sent = postLoginHtml.trim();
      const stored = saved.login.postLoginHtml;
      if (sent && !stored) {
        // Ambiguous, and the two readings call for opposite actions: either
        // the sanitizer rejected the whole document (a paste that was
        // nothing but a <script>, say), or this backend has no
        // `post_login_html` column yet and every response omits it. Blanking
        // the editor would destroy the venue's work in the second case, so
        // this branch never writes -- it only warns.
        toast.warning(
          "The post-login page came back empty from the server. Nothing of it was stored — check that the markup is more than just scripts, and try again.",
        );
      } else if (stored !== postLoginHtml) {
        setPostLoginHtml(stored);
        setPreviewHtml(stored);
        if (stored !== sent) {
          toast.info(
            "Some markup was removed or rewritten for safety. The editor now shows exactly what was saved.",
          );
        }
      }
    } catch (err) {
      // The disabled Save above makes the over-limit 400 unreachable from
      // THIS tab, but an older tab (predating the limits) can still race a
      // save through -- surface the backend's own max_length/actual_length
      // envelope instead of a generic failure toast.
      toast.error(
        postLoginHtmlLimitErrorMessage(err) ??
          splashLimitErrorMessage(err) ??
          (axios.isAxiosError(err)
            ? toAppError(err).message
            : "Could not save — check the connection and try again."),
      );
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
            <p className="text-xs text-muted-foreground">
              Design what guests see the moment they connect.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Real, shareable preview of the actual guest-facing captive portal
              (background image, branding, live sign-in methods) -- for a
              real account, pulls the real, currently-*saved*
              captive_portal_configs/brandings data for this location; for a
              demo session (no real org/location to fetch), a localStorage
              snapshot of this page's own in-progress edits instead -- see
              openExternalPreview above and /preview/portal/demo's own
              docstring. Either way opens in a new tab. The "Live Preview"
              card below renders that same real component tree too, but
              inline on this page -- the two together cover both "open this
              full-page, shareable" and "keep it visible while I keep
              editing". Bug report this demo branch fixes: "demo account
              mai capitive portal pr redirect nahi hota hai" -- previously
              hidden outright in demo mode. */}
          {(demo || (orgId && locationId)) && (
            <Button variant="outline" size="sm" onClick={openExternalPreview}>
              <ExternalLink className="mr-2 h-4 w-4" /> Preview Portal
            </Button>
          )}
          <PortalDesignIllustration />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT COLUMN. Two cards, not one, and the boundary is deliberate:
            Portal Configuration is the sign-in screen (headline, logo,
            colours, auth methods, terms); "After they connect" is the screen
            AFTER the gate. Mixing them is what would let someone drag the
            email field back onto the sign-in card, which is the one thing
            the guest-side design exists to prevent. */}
        <div className="space-y-4">
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                Portal Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Headline</Label>
                  <SplashCharCounter value={headline} max={SPLASH_HEADLINE_MAX} />
                </div>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Welcome to your venue"
                />
                <p className="text-xs text-muted-foreground">
                  The large heading guests see first on the sign-in screen. Leave blank to use the
                  default "Welcome to [venue]".
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Welcome Message</Label>
                  <SplashCharCounter value={msg} max={SPLASH_WELCOME_MAX} />
                </div>
                <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Smaller subtext shown under the headline.
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Brand Color</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPrimary(c)}
                      aria-label={c}
                      className="relative h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110"
                      style={{
                        background: c,
                        ["--tw-ring-color" as string]: primary === c ? c : "transparent",
                      }}
                    >
                      {primary === c && (
                        <motion.span
                          layoutId="swatch-ring"
                          className="absolute inset-0 rounded-full ring-2 ring-foreground/70"
                          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                        />
                      )}
                    </button>
                  ))}
                  <div className="ml-1 flex items-center gap-2">
                    <Input
                      type="color"
                      value={primary}
                      onChange={(e) => setPrimary(e.target.value)}
                      className="h-9 w-10 p-1"
                    />
                    <Input
                      value={primary}
                      onChange={(e) => setPrimary(e.target.value)}
                      className="font-mono h-9 w-24"
                    />
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
                      <img
                        src={logo}
                        alt="Portal logo"
                        className="h-full w-full object-cover"
                        onError={() => setLogo(null)}
                      />
                    ) : (
                      <ImageUp className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <ImageUp className="h-3.5 w-3.5" />
                      Upload logo
                    </span>
                    <input
                      type="file"
                      accept={BRAND_ASSET_ACCEPT_ATTR}
                      className="hidden"
                      disabled={uploadingLogo}
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
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

              <div>
                <Label className="mb-2 block">Background Image</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                    {uploadingBg ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : bgImage ? (
                      <img
                        src={bgImage}
                        alt="Portal background"
                        className="h-full w-full object-cover"
                        onError={() => setBgImage(null)}
                      />
                    ) : (
                      <ImageUp className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <ImageUp className="h-3.5 w-3.5" />
                      {bgImage ? "Replace image" : "Upload image"}
                    </span>
                    <input
                      type="file"
                      accept={BRAND_ASSET_ACCEPT_ATTR}
                      className="hidden"
                      disabled={uploadingBg}
                      onChange={handleBackgroundUpload}
                    />
                  </label>
                  {bgImage && (
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={uploadingBg}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Fills the whole sign-in screen behind the card, on phones held upright — upload a
                  tall portrait photo, at least 1170×2532px, PNG/JPEG/WEBP/GIF up to 5 MB. Keep the
                  middle of the frame free of anything important: the sign-in card sits over it.
                  Like the logo, this is shared across every location in this organization. The Live
                  Preview on the right updates as soon as the upload finishes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Theme</Label>
                  <Select value={form.theme} onValueChange={(v) => setForm({ ...form, theme: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enterprise">Enterprise Blue</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Font</Label>
                  <Select value={form.font} onValueChange={(v) => setForm({ ...form, font: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="poppins">Poppins</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Languages</Label>
                  <Input
                    value={form.lang}
                    onChange={(e) => setForm({ ...form, lang: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Redirect URL</Label>
                  <Input
                    value={form.redirectUrl}
                    onChange={(e) => setForm({ ...form, redirectUrl: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Post-login page. Sits directly under Redirect URL because the
              two are the same decision -- what a guest sees the moment they
              are online -- and because a venue that sets both needs to see
              that they COMPOSE, not that one wins (the note under the
              textarea says so, and the preview under it shows it).

              Plain monospace <Textarea>, not a code editor: a code-editor
              dependency is ~200KB of the customer dashboard's bundle to
              syntax-highlight a field most venues will paste into once. */}
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="post-login-html">Post-login page (HTML)</Label>
                  {/* Bytes, not characters -- the backend column's cap is a
                  byte cap, and one Devanagari code point is 3 bytes. A
                  character count would tell a Hindi-writing venue they had
                  3x the room they actually have. */}
                  <span
                    aria-live="polite"
                    className={`text-xs tabular-nums ${
                      postLoginBlocked ? "font-medium text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {postLoginBytes.toLocaleString()} / {POST_LOGIN_HTML_MAX_BYTES.toLocaleString()}{" "}
                    bytes
                  </span>
                </div>
                <Textarea
                  id="post-login-html"
                  rows={8}
                  spellCheck={false}
                  value={postLoginHtml}
                  onChange={(e) => setPostLoginHtml(e.target.value)}
                  placeholder={
                    "<h2>Welcome!</h2>\n<p>Show your booking at the desk for a free coffee.</p>"
                  }
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Shown to guests right after they sign in. Leave it empty to keep today&apos;s
                  behaviour.{" "}
                  {form.redirectUrl.trim() ? (
                    <>
                      Because a <span className="font-medium">Redirect URL</span> is also set,
                      guests see this page with a <span className="font-medium">Continue</span>{" "}
                      button to it. They are not sent on automatically, so the page stays up until
                      they choose to leave.
                    </>
                  ) : (
                    <>
                      With no <span className="font-medium">Redirect URL</span> set, this page is
                      where guests stay.
                    </>
                  )}
                </p>
                {/* The one thing a venue WILL get wrong if we don't say it.
                This page runs on the same origin as the OTP screen, so the
                HTML is rendered in a sandboxed frame with scripts disabled
                -- an analytics or chat-widget snippet pasted here does
                nothing at all, silently. Saying so here is cheaper than the
                bug report. */}
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Scripts will not run.</span> For
                  your guests&apos; safety this page is displayed in a sandbox, so{" "}
                  <code>&lt;script&gt;</code> tags, analytics snippets, chat widgets and inline{" "}
                  <code>onclick</code> handlers are ignored. HTML, CSS, images and links all work —
                  links open in a new tab. Saving also runs the page through a safety filter, so the
                  editor may come back slightly changed from what you pasted; that version is what
                  guests get.
                </p>
                {hasPostLoginHtml(previewHtml) && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Preview</p>
                    {/* The SAME component, with the SAME sandbox, that
                    /portal/redirect renders for a real guest -- not a
                    lookalike. That is the whole point: whatever gets
                    silently dropped in this box is exactly what gets
                    dropped on the guest's phone. */}
                    <PostLoginHtmlFrame
                      html={previewHtml}
                      title="Post-login page preview"
                      className="h-64 bg-white"
                    />
                  </div>
                )}
                {postLoginBlocked && (
                  <p className="text-xs text-destructive" role="alert">
                    This page is {postLoginBytes.toLocaleString()} bytes — the limit is{" "}
                    {POST_LOGIN_HTML_MAX_BYTES.toLocaleString()}. Shorten it to save.
                  </p>
                )}
              </div>

              {/* BEFORE SIGN-IN. This picker was removed once, for a good
              reason that no longer holds: it asked a venue to make a
              decision about a pre-sign-in content step "most of them do not
              want", sitting in the middle of the branding controls they came
              here for. Only the editor went; `contentMode`/`contentHeading`/
              `contentBody`/`contentImageUrl` stayed in `loadPortal` and
              `saveConfig` throughout, which is why restoring it is a JSX
              change and not a plumbing one -- all four already have their
              read half in `toPortal` and their write half in both `create()`
              and `update()`'s whitelist.

              It comes back because a venue asked for the one thing it is
              genuinely for: showing guests a MENU inside the captive portal.
              And this is the only surface that can. A menu shown after
              connecting reaches Android and desktop guests only, because iOS
              guests are handed to captive.apple.com the moment the gate
              opens and never load `/portal/session`. This step runs BEFORE
              sign-in, on every device, on the one screen every guest sees.

              The catch, and the reason "Image" leads rather than an external
              link: pre-authentication the guest is inside the hotspot's
              walled garden, which allows exactly the portal host and the API
              host (`_portal_walled_garden_hosts`). An uploaded image is
              served from the portal's own origin and loads; a link to a menu
              on some other domain is intercepted by the NAS and goes
              nowhere. So the honest pre-login menu is a picture, and the
              copy below says so rather than letting a venue discover it by
              paste.

              Its own section, not folded back into the branding block --
              that placement was half the original objection. */}
              <div className="space-y-1.5 rounded-lg border p-3">
                <Label htmlFor="content-mode">Before sign-in</Label>
                <p className="text-xs text-muted-foreground">
                  An optional screen guests see before the sign-in form. Use it for a menu, an
                  offer, or house rules. Reaches every guest, iPhones included.
                </p>
                <Select
                  value={contentMode}
                  onValueChange={(v) => setContentMode(v as PortalContentMode)}
                >
                  <SelectTrigger id="content-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="login">Nothing — go straight to sign-in</SelectItem>
                    <SelectItem value="image">Show a picture (menu, offer, poster)</SelectItem>
                    <SelectItem value="text">Show a short message</SelectItem>
                    <SelectItem value="redirect">
                      Send guests to a page after they connect
                    </SelectItem>
                  </SelectContent>
                </Select>

                {contentMode !== "login" && (
                  <div className="space-y-1.5 border-t pt-3">
                    <Label htmlFor="content-heading" className="text-xs">
                      Heading <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="content-heading"
                      value={contentHeading}
                      onChange={(e) => setContentHeading(e.target.value)}
                      placeholder="Today's menu"
                    />
                  </div>
                )}

                {contentMode === "image" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="content-image-url" className="text-xs">
                      Picture link
                    </Label>
                    <Input
                      id="content-image-url"
                      value={contentImageUrl}
                      onChange={(e) => setContentImageUrl(e.target.value)}
                      placeholder="https://..."
                      inputMode="url"
                    />
                    {/* The constraint a venue cannot see and will otherwise
                      hit blind. There is no upload for this field -- the
                      only upload endpoints this product has are the
                      org-level logo and background (brand-asset.service.ts)
                      -- so it is a link, and where the picture is hosted
                      decides whether it loads at all before sign-in. */}
                    <p className="text-xs text-muted-foreground">
                      A photo of your menu works well. Guests have not reached the internet yet at
                      this point, so the picture must be one we host — ask support to add it. A link
                      to a menu on another website will not load here.
                    </p>
                  </div>
                )}

                {contentMode === "text" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="content-body" className="text-xs">
                      Message
                    </Label>
                    <Textarea
                      id="content-body"
                      rows={3}
                      value={contentBody}
                      onChange={(e) => setContentBody(e.target.value)}
                      placeholder="Kitchen closes at 10pm. Ask staff for today's specials."
                    />
                  </div>
                )}

                {contentMode === "redirect" && (
                  <p className="text-xs text-muted-foreground">
                    Sends guests to your <span className="font-medium">Redirect URL</span> above
                    once they are online. Set one, or guests see the sign-in form as usual.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Auth Methods</Label>
                <div className="flex flex-wrap gap-2">
                  {AUTH_OPTIONS.map(([k, v]) => (
                    <motion.div
                      key={k}
                      whileTap={{ scale: 0.96 }}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${authMethods.includes(k) ? "border-primary/50 bg-primary/5" : ""}`}
                    >
                      <Switch
                        checked={authMethods.includes(k)}
                        onCheckedChange={() => toggleAuth(k)}
                      />
                      <span className="text-xs">{v}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Terms &amp; Conditions</Label>
                <Textarea
                  rows={2}
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Button className="w-full sm:w-auto" onClick={saveConfig} disabled={saveBlocked}>
                  Save Configuration
                </Button>
                {splashBlocked && (
                  <p className="text-xs text-destructive" role="alert">
                    {headlineBlocked && msgBlocked
                      ? "The headline and welcome message are over their length limits — shorten them to save."
                      : headlineBlocked
                        ? `The headline is over the ${SPLASH_HEADLINE_MAX}-character limit — shorten it to save.`
                        : `The welcome message is over the ${SPLASH_WELCOME_MAX}-character limit — shorten it to save.`}
                  </p>
                )}
                {/* The post-login field has its own inline error next to the
                counter, but it is far enough up the form to be off screen
                from here -- repeat the reason at the disabled button rather
                than leaving it looking broken. */}
                {postLoginBlocked && (
                  <p className="text-xs text-destructive" role="alert">
                    The post-login page is over the {POST_LOGIN_HTML_MAX_BYTES.toLocaleString()}
                    -byte limit — shorten it to save.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ═══ AFTER THEY CONNECT ═══ */}
          <Card className="shadow-sm border-0" onFocusCapture={() => setPreviewTab("connected")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
                  <MessageSquareText className="h-3.5 w-3.5 text-white" />
                </div>
                After they connect
              </CardTitle>
              {/* The only truthful conversion figure for this whole card. Every
                setting below renders after the RADIUS session is authorised,
                so none of them CAN cost a connection -- which is why there is
                no "-12% conversions" chip anywhere here. See the note above
                the "No data yet" lines. */}
              <p className="text-xs text-muted-foreground">
                None of this affects whether a guest gets online.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* THE ASK BUDGET. The primary cost display, and the one that
                will actually change behaviour, because it is present at the
                moment of the decision rather than a month later. It costs
                nothing to build and it cannot be wrong: it is a count of the
                venue's own settings, not an estimate of anything. Name and
                email count as ONE -- they share a card.

                Deliberately not a hard cap. A venue that wants four asks
                gets four; the guest-side rules already limit it to one ask
                per screen, so the damage is bounded. This meter's job is to
                make the owner feel the accumulation. */}
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-sm font-medium">
                  {askCount === 0
                    ? "Your guests are asked for nothing extra after connecting."
                    : `Your guests are asked for ${askCount} thing${askCount === 1 ? "" : "s"} after connecting.`}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {Array.from({ length: MAX_POST_CONNECT_ASKS }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-full ${i < askCount ? askMeter.dot : "bg-muted-foreground/25"}`}
                      />
                    ))}
                  </span>
                  <span className={`text-xs ${askMeter.tone}`}>{askMeter.label}</span>
                </div>
                {/* WHO these asks actually reach, stated at the moment the
                  venue is deciding how many to make -- not in a help
                  article and not only in a code comment. The connected
                  screen is the only surface any of this renders on, and
                  iOS guests never load it (portal.success.tsx hands them
                  to captive.apple.com so the CNA dismisses and their
                  traffic is released -- deliberate, and the fix for a real
                  "authenticated but no internet" incident). Shown only
                  once at least one ask is on: with nothing enabled there
                  is no reach to qualify, and the line would just be
                  noise. */}
                {askCount > 0 && (
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    These reach guests on Android phones and laptops. iPhone and iPad guests are
                    sent straight to the internet the moment they connect, so they never open the
                    screen these cards are on.
                  </p>
                )}
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Guest details
              </p>

              <PostConnectRow
                title="Ask for their name"
                description="A dismissible card on the connected screen. Shown once ever, never during sign-in."
                checked={collectGuestName}
                onCheckedChange={setCollectGuestName}
              >
                <NoDataYet />
              </PostConnectRow>

              <PostConnectRow
                title="Ask for their email"
                description="The only channel you can message without DLT or WhatsApp approval. Shown on the same card as the name."
                checked={collectGuestEmail}
                onCheckedChange={setCollectGuestEmail}
              >
                {/* A venue that turns this on expecting a mailing list and
                  gets a database column should learn that here, not in a
                  support ticket. The marketing consent checkbox is
                  deliberately NOT on the guest card until the consent model
                  it would write to exists. */}
                <p className="text-xs text-muted-foreground">
                  You collect the address now; sending to it needs the marketing consent work, which
                  is not built yet.
                </p>
                <NoDataYet />
              </PostConnectRow>

              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reviews
              </p>

              <PostConnectRow
                title="Invite guests to review you on Google"
                description="One dismissible card, identical for every guest, shown before you have asked them anything else. Never next to a rating question."
                checked={reviewCardEnabled}
                onCheckedChange={setReviewCardEnabled}
              >
                {reviewCardEnabled && (
                  <div className="space-y-1.5">
                    <Label htmlFor="review-url" className="text-xs">
                      Your Google review link
                    </Label>
                    <Input
                      id="review-url"
                      value={reviewUrl}
                      onChange={(e) => setReviewUrl(e.target.value)}
                      placeholder="https://g.page/r/..."
                      inputMode="url"
                      aria-invalid={reviewUrlInvalid || undefined}
                    />
                    <p className="text-xs text-muted-foreground">
                      Business Profile → Read reviews → Get more reviews. Paste it exactly as Google
                      gives it to you.
                    </p>
                    {/* The switch and the link are two separate stored
                      values, so say what switching off does. Without this
                      line an owner has no way to know whether pausing
                      costs them the URL, and the safe assumption -- that it
                      does -- is the one that stops them pausing at all. */}
                    <p className="text-xs text-muted-foreground">
                      Switching this off pauses the card and keeps your link.
                    </p>
                    {reviewUrlInvalid && (
                      <p className="text-xs text-destructive" role="alert">
                        That does not look like an https Google link — guests will not see the card
                        until it is one.
                      </p>
                    )}
                  </div>
                )}
                <NoDataYet />
                {/* Said on the card, where a venue owner will read it, rather
                  than in a help article: this product cannot see Google's
                  side, so any number labelled "reviews" would be invented.
                  "Opened your review link" is the only true measure. */}
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  We can only count guests who opened your review link. Whether a review was
                  actually posted is not something Google tells us.
                </p>
              </PostConnectRow>

              <PostConnectRow
                title="Ask for private feedback"
                description={`A 1–5 star rating only you can see. Asked at least ${DEFAULT_FEEDBACK_DWELL_MINUTES} minutes into a visit, never in the same visit as the Google ask.`}
                checked={guestFeedbackEnabled}
                onCheckedChange={setGuestFeedbackEnabled}
              >
                <NoDataYet />
              </PostConnectRow>

              {/* Disabled, and it persists nothing. There is no `menu` campaign
                type in this product yet, so there is no dish to attach a
                rating to -- a toggle that stored a flag nothing can act on is
                the exact "ships and lies" failure the social-login switch
                already demonstrated. It is shown rather than hidden so a
                venue knows the capability is coming and what it needs first. */}
              <div className="rounded-lg border border-dashed p-3 opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Ask about individual dishes</p>
                    <p className="text-xs text-muted-foreground">
                      Needs a menu. Best for a short menu guests order from often.
                    </p>
                  </div>
                  <Switch checked={false} disabled aria-label="Ask about individual dishes" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Menus are not built yet — there is nothing for a guest to rate.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
                <Button onClick={saveConfig} disabled={saveBlocked}>
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm border-0 overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#241f52] to-[#2b2461] text-white">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2.5 text-sm text-white">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Smartphone className="h-3.5 w-3.5 text-white" />
                </div>
                Live Preview
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  </span>
                  Live
                </span>
              </CardTitle>
              <div className="flex items-center gap-1">
                {/* Same destination as the "Preview Portal" button at the top
                  of the page (openExternalPreview above) -- added directly
                  here too since that's easy to miss from inside this card.
                  Shown whenever the top button would be (demo, or a real
                  account once orgId/locationId have resolved). */}
                {(demo || (orgId && locationId)) && (
                  <button
                    type="button"
                    onClick={openExternalPreview}
                    aria-label="Open this preview in a new tab"
                    title="Open in a new tab"
                    className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
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
              </div>
            </CardHeader>
            <CardContent>
              {/* TWO TABS, and this is the fix for the blindest thing on
                  this page. The preview used to render `GuestSignInCard`
                  and only that -- the sign-in screen -- while every setting
                  on the "After they connect" card affects `/portal/session`.
                  A venue owner could flip five switches, watch the phone
                  mockup not change once, and press Save with no idea what
                  they had done to their guests. That is the difference
                  between an editor and a settings list.

                  `Sign in` is exactly the previous render, unchanged.
                  Focusing anything in the "After they connect" card switches
                  to `Connected` automatically, the same way editing the
                  headline implicitly shows the sign-in view. */}
              <div
                role="tablist"
                aria-label="Preview screen"
                className="mx-auto mb-3 flex w-full max-w-[340px] rounded-lg bg-white/10 p-1"
              >
                {(
                  [
                    ["signin", "Sign in"],
                    ["connected", "Connected"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={previewTab === id}
                    onClick={() => setPreviewTab(id)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      previewTab === id
                        ? "bg-white text-[#1e1b4b]"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Which guest, not which card. The mutual-exclusion rules are
                  NOT simulated away: the preview runs the real resolver and
                  shows ONE ask per screen, because a preview showing four
                  cards at once would teach the venue a picture of their
                  portal that no guest will ever see. To see the others, they
                  switch guest. */}
              {previewTab === "connected" && (
                <div className="mx-auto mb-3 flex w-full max-w-[340px] flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/50">Showing:</span>
                  {CONNECTED_PREVIEW_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setPreviewScenario(sc.id)}
                      aria-pressed={previewScenario === sc.id}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                        previewScenario === sc.id
                          ? "border-white/40 bg-white/15 text-white"
                          : "border-white/15 text-white/60 hover:text-white"
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              )}

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
                {/* Fixed `h-[560px]`, not `min-h-[560px]` -- PortalShell's own
                  `constrained` height class is `min-h-full`, and CSS only
                  resolves a percentage `min-height` against a parent with a
                  *definite* height. A `min-height`-only parent has no
                  definite height (it sizes to its shorter real content),
                  so PortalShell silently fell back to its natural,
                  shorter-than-560px height, leaving this frame's own
                  `bg-white` showing through as a jarring blank gap below the
                  actual card -- not what a real phone screen looks like.
                  `overflow-y-auto` (not `-hidden`) so content that's
                  genuinely taller than one screen scrolls inside the frame,
                  the same as it would on a real guest's phone, instead of
                  being invisibly clipped off. */}
                <div className="relative h-[560px] overflow-x-hidden overflow-y-auto rounded-[1.4rem] bg-white">
                  <PortalRuntimeProvider
                    organizationId={orgId ?? "preview"}
                    locationId={locationId ?? "preview"}
                    routerId="preview"
                    previewMode
                    presetConfig={livePreviewConfig}
                    presetConfigLoading={false}
                  >
                    {previewTab === "connected" ? (
                      <ConnectedPreview scenario={previewScenario} />
                    ) : (
                      <PortalShell constrained>
                        <GuestSignInCard />
                      </PortalShell>
                    )}
                  </PortalRuntimeProvider>
                </div>
              </div>
              {/* Stated where the venue is looking at the screen it applies
                  to. iOS guests are handed off to captive.apple.com on
                  success so the Captive Network Assistant closes itself,
                  which means they never load the connected screen at all --
                  so these settings reach fewer guests than the sign-in
                  screen does. We are not guessing at the share: the only
                  device-mix figures available are seeded, not real. */}
              {previewTab === "connected" && (
                <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/60">
                  Guests on iPhones and iPads are sent straight to the internet when they connect,
                  so many of them never open this screen. Anything you switch on here reaches the
                  guests who do.
                </p>
              )}
              <p className="mt-3 text-center text-[11px] text-white/50">
                {previewTab === "connected"
                  ? "This is the real connected screen, live-rendered with your unsaved settings above — one ask per screen, exactly as a guest gets it."
                  : "This is the real guest sign-in component, live-rendered with your unsaved edits above."}
                {!demo ? (
                  <>
                    {" "}
                    For the exact, currently-saved config a guest would see right now, use{" "}
                    <span className="font-medium text-white/80">Preview Portal</span> at the top of
                    this page.
                  </>
                ) : (
                  // Demo has no real "saved" config to distinguish this from
                  // (see PortalPage.tsx's saveConfig demo branch) -- Preview
                  // Portal here opens this same in-progress config full-page
                  // in a new tab, not a different snapshot, so just point at
                  // the external-link icon rather than implying otherwise.
                  <>
                    {" "}
                    Use the <ExternalLink className="mb-0.5 inline h-3 w-3" /> icon above to open
                    this in its own tab.
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
                  <QrCode className="h-3.5 w-3.5 text-white" />
                </div>
                QR Code Access
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <div
                className="grid h-32 w-32 place-items-center rounded-2xl border-2"
                style={{ borderColor: `${primary}55`, background: `${primary}0d` }}
              >
                <QrCode className="h-16 w-16" style={{ color: primary }} />
              </div>
              <p className="text-xs text-muted-foreground">auth.wyfyguest.com</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("QR code downloaded")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download QR
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
