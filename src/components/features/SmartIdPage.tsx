import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  DoorOpen,
  Mail,
  Ticket,
  Key,
  LogIn,
  AlertTriangle,
  ListOrdered,
  Hourglass,
  MessageCircle,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { api, type AppError } from "@/services/api";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { resolveOrgId } from "@/services/customer.service";

interface LoginMethod {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  required: boolean;
  order: number;
  config: Record<string, unknown>;
}

// Only these five SmartIdPage methods have a real, persisted counterpart
// in the backend's captive_portal_configs table (otp_sms_enabled /
// otp_email_enabled / otp_whatsapp_enabled / voucher_enabled /
// pin_login_enabled -- see backend/app/domains/captive_portal/models.py).
// Room No./SSO have no backing column anywhere in the backend (no
// property-management or SSO module exists), so toggling those stays
// local-only -- the same honest "real field written for real, no field
// faked as persisted" boundary portal.service.ts's own LOGIN_METHOD_FLAGS
// already documents for this exact backend table.
const BACKED_FLAGS: Partial<
  Record<
    string,
    | "otp_sms_enabled"
    | "otp_email_enabled"
    | "otp_whatsapp_enabled"
    | "voucher_enabled"
    | "pin_login_enabled"
  >
> = {
  "sms-otp": "otp_sms_enabled",
  "email-otp": "otp_email_enabled",
  "whatsapp-otp": "otp_whatsapp_enabled",
  voucher: "voucher_enabled",
  pin: "pin_login_enabled",
};

interface BackendCaptivePortalConfig {
  id: string;
  organization_id: string;
  location_id: string | null;
  otp_sms_enabled: boolean;
  otp_email_enabled: boolean;
  otp_whatsapp_enabled: boolean;
  voucher_enabled: boolean;
  pin_login_enabled: boolean;
  is_active: boolean;
  is_default: boolean;
}

// Room No./SSO have no real guest-facing implementation anywhere in this
// product -- no verification flow, no backend field, nothing a guest would
// ever actually see on the real captive portal regardless of this toggle.
// Shown disabled with "Coming soon" rather than silently accepting a
// toggle that does nothing (see BACKED_FLAGS above for the ones that are
// real). Aadhaar/Passport were removed outright (not just hidden) rather
// than kept as permanent "Coming soon" placeholders -- confirmed there was
// no near-term plan to build ID-document verification, so the entries were
// pure clutter, not a real roadmap item.
const UNAVAILABLE_METHOD_IDS = new Set(["room-no", "sso"]);

export default function SmartIdPage({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  const [methods, setMethods] = useState<LoginMethod[]>([
    // The real, primary guest-facing method -- the actual captive portal's
    // own sign-in card (GuestSignInCard.tsx) shows Mobile OTP as its
    // default tab, backed by a real otp_sms_enabled column that already
    // defaults to true on every config. It had never been surfaced here
    // at all, so an admin had no way to see or turn off the method most
    // guests actually use to sign in.
    {
      id: "sms-otp",
      label: "Mobile OTP",
      icon: Smartphone,
      enabled: true,
      required: false,
      order: 1,
      config: {},
    },
    {
      id: "room-no",
      label: "Room No.",
      icon: DoorOpen,
      enabled: false,
      required: false,
      order: 2,
      config: { propertyMgt: "manual" },
    },
    // Own icon (LogIn) rather than reusing Email OTP's Mail icon -- the two
    // previously shared an icon despite being unrelated sign-in concepts
    // (federated SSO vs. a one-time code emailed to the guest).
    {
      id: "sso",
      label: "SSO / Email",
      icon: LogIn,
      enabled: false,
      required: false,
      order: 3,
      config: { domain: "" },
    },
    {
      id: "email-otp",
      label: "Email OTP",
      icon: Mail,
      enabled: true,
      required: false,
      order: 4,
      config: {},
    },
    // Defaults off (unlike Email OTP) -- a real send needs a Meta-approved
    // WhatsApp Business template configured on the backend
    // (Settings.whatsapp_twilio_content_sid), which most orgs won't have
    // set up yet. See backend/app/domains/captive_portal/models.py's
    // otp_whatsapp_enabled docstring.
    {
      id: "whatsapp-otp",
      label: "WhatsApp OTP",
      icon: MessageCircle,
      enabled: false,
      required: false,
      order: 5,
      config: {},
    },
    {
      id: "voucher",
      label: "Voucher Code",
      icon: Ticket,
      enabled: true,
      required: false,
      order: 6,
      config: {},
    },
    // Real, functional login method (GuestService.login_via_pin / POST
    // /guest/login/pin), gated by pin_login_enabled -- defaults off,
    // mirroring the backend column's own default (a PIN is a materially
    // weaker secret than a password, so an operator opts in per location
    // deliberately). PIN_LENGTH is fixed at 6 digits backend-side
    // (app/domains/guest/constants.py), not an operator-configurable
    // setting, so there's no local config to carry here.
    {
      id: "pin",
      label: "Portal PIN",
      icon: Key,
      enabled: false,
      required: false,
      order: 7,
      config: {},
    },
  ]);

  // orgId + the resolved captive-portal config id for this location (if
  // one already exists) -- null configId means "none yet", created lazily
  // on the first backed toggle (see toggleMethod below).
  const [orgId, setOrgId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  // The seven rows below are a hardcoded array with baked-in `enabled`
  // flags (Mobile OTP / Email OTP / Voucher start `true`). If the GET
  // fails, those defaults are all that is left on screen -- and the page
  // used to render them as fact, telling an owner three sign-in methods
  // were on without ever having asked the server. For the screen that
  // decides how guests get online, "we don't know" has to look different
  // from "it's on".
  const [loadFailed, setLoadFailed] = useState(false);
  // Guards the lazy-create-on-first-toggle path below: if two different
  // methods are toggled before the first POST resolves, `configId` is still
  // null for both calls, which would otherwise fire two
  // `POST /captive-portal-configs` for the same (organization_id,
  // location_id) -- the backend allows several configs per location by
  // design (drafts, see CaptivePortalConfig's own docstring), so it will
  // not reject the second one as a duplicate, and the second toggle's flag
  // would silently end up on a row this component never learns the id of.
  // Any toggle that finds this set (a create is already in flight) awaits
  // the same promise instead of starting its own.
  const pendingConfigCreation = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        const org = await resolveOrgId();
        setOrgId(org);
        // No single-column "give me this location's config, else the org
        // default" filter exists server-side -- fetch every config for
        // this org and resolve most-specific-wins client-side, mirroring
        // backend's own CaptivePortalService.resolve_portal_config order
        // (location override, else org default, else none).
        const { data } = await api.get<{ items: BackendCaptivePortalConfig[] }>(
          "/captive-portal-configs",
          { params: { page_size: 100 }, headers: { "X-Organization-Id": org } },
        );
        const items = data.items ?? [];
        const match =
          items.find((c) => c.location_id === locationId) ??
          items.find((c) => c.location_id === null && c.is_default) ??
          null;
        if (match) {
          setConfigId(match.id);
          setMethods((prev) =>
            prev.map((m) => {
              const flag = BACKED_FLAGS[m.id];
              return flag ? { ...m, enabled: match[flag] } : m;
            }),
          );
        }
        setLoadFailed(false);
      } catch {
        // Do NOT leave the local defaults standing as if they were the
        // answer -- say the settings could not be read (see loadFailed).
        setLoadFailed(true);
      }
    })();
  }, [demo, locationId]);

  const toggleMethod = async (id: string) => {
    const method = methods.find((m) => m.id === id);
    const next = !method?.enabled;
    const label = method?.label ?? "Login method";
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: next } : m)));

    const flag = BACKED_FLAGS[id];
    if (demo || !flag) {
      // No backend field for this method (or a demo session) -- local-only,
      // same as before.
      toast.success(
        next ? `${label} is now on — guests can use it to sign in.` : `${label} is now off.`,
      );
      return;
    }
    if (!orgId) {
      setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !next } : m)));
      toast.error("No organization found for this session.");
      return;
    }
    try {
      const headers = { "X-Organization-Id": orgId };
      if (configId) {
        await api.put(`/captive-portal-configs/${configId}`, { [flag]: next }, { headers });
      } else if (pendingConfigCreation.current) {
        // Another toggle already kicked off the lazy-create -- reuse its
        // result instead of creating a second row, then apply this
        // toggle's own flag on top of it.
        const createdId = await pendingConfigCreation.current;
        await api.put(`/captive-portal-configs/${createdId}`, { [flag]: next }, { headers });
      } else {
        const creation = api
          .post<BackendCaptivePortalConfig>(
            "/captive-portal-configs",
            {
              organization_id: orgId,
              location_id: locationId || null,
              name: "Guest WiFi Login",
              [flag]: next,
            },
            { headers },
          )
          .then(({ data }) => {
            setConfigId(data.id);
            return data.id;
          })
          .finally(() => {
            pendingConfigCreation.current = null;
          });
        pendingConfigCreation.current = creation;
        await creation;
      }
      toast.success(
        next ? `${label} is now on — guests can use it to sign in.` : `${label} is now off.`,
      );
    } catch (err) {
      setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !next } : m)));
      toast.error(
        (err as AppError).message || "Could not save — check the connection and try again.",
      );
    }
  };

  // Split for rendering only -- live/orderable methods vs. still-planned
  // ones, so an owner sees "what guests can use today" separately from
  // "what's coming" instead of one flat list of 8 identical-looking rows.
  // `idx` keeps each method's real position in the underlying `methods`
  // array so moveUp(idx) still operates on the exact same state it always
  // has -- this is purely a rendering split, not a reordering change.
  const indexedMethods = methods.map((m, idx) => ({ method: m, idx }));
  const liveMethods = indexedMethods.filter(({ method }) => !UNAVAILABLE_METHOD_IDS.has(method.id));
  const comingSoonMethods = indexedMethods.filter(({ method }) =>
    UNAVAILABLE_METHOD_IDS.has(method.id),
  );
  const pinMethod = methods.find((m) => m.id === "pin");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sign-in Methods</h1>
          <p className="text-sm text-muted-foreground">
            Choose which ways guests can sign in to your WiFi.
          </p>
        </div>
      </div>

      <Tabs defaultValue="methods">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger
            value="methods"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 px-4 py-2"
          >
            Login Methods
          </TabsTrigger>
          <TabsTrigger
            value="pin"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 px-4 py-2"
          >
            Portal PIN
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 px-4 py-2"
          >
            Portal Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="mt-4">
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-sm">Login Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {/* Live for Guests -- the methods guests can actually use
                    today, visually separated from Coming Soon below so an
                    owner sees "what's real" at a glance instead of a flat
                    list of 8 same-looking rows. */}
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-1 flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Live for Guests
                    </h3>
                  </div>
                  {/* No ordering claim any more. The arrows here reordered
                      local state and nothing else: there is no `order`
                      field on captive_portal_configs, nothing is sent, and
                      the real portal does not read one -- so every arrow
                      click was lost on reload while the copy promised it
                      set the guest-facing tab order. Removed rather than
                      disabled, because unlike the limit fields elsewhere in
                      Access Rules there is no value being stored at all. */}
                  <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                    Guests can sign in with any of these today.
                  </p>
                  {loadFailed && (
                    <div
                      role="alert"
                      className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        We couldn&rsquo;t load your sign-in settings, so the switches below may not
                        match what guests actually see. Nothing has changed — reload to try again.
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {/* enabledCount/enabledRank are the "to guests" numbers --
                        distinct from `rank`, which is this row's position in
                        the reorderable list regardless of its own toggle
                        state. Previously every row's caption read "Shown N
                        of {liveMethods.length} to guests" off `rank` alone,
                        so a method with its own toggle switched OFF (e.g.
                        Mobile OTP) still said "Shown 1 of 4 to guests" --
                        contradicting the Portal Preview tab, which correctly
                        excludes disabled methods from what guests actually
                        see. */}
                    {(() => {
                      return liveMethods.map(({ method }) => {
                        const Icon = method.icon;
                        return (
                          <div
                            key={method.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                                <Icon className="h-4 w-4 text-indigo-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                  {method.label}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs",
                                    method.enabled
                                      ? "text-slate-400 dark:text-slate-500"
                                      : "text-amber-600 dark:text-amber-500",
                                  )}
                                >
                                  {method.enabled
                                    ? `Shown to guests${method.required ? " · Required" : ""}`
                                    : "Hidden from guests"}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={method.enabled}
                              disabled={loadFailed}
                              onCheckedChange={() => toggleMethod(method.id)}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Coming Soon -- methods with no real guest-facing
                    implementation yet (see UNAVAILABLE_METHOD_IDS above).
                    Dashed border + muted styling and no switch/reorder
                    control, so these read as "not real yet" rather than
                    looking like just-another live row. */}
                <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-600">
                  <div className="mb-1 flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Coming Soon
                    </h3>
                  </div>
                  <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
                    Planned sign-in methods — not yet available to guests, nothing to configure here
                    yet.
                  </p>
                  <div className="space-y-2">
                    {comingSoonMethods.map(({ method }) => {
                      const Icon = method.icon;
                      return (
                        <div
                          key={method.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 p-3 opacity-70 dark:border-slate-700"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                              <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                {method.label}
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-500">
                                Coming soon — not yet available to guests
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Not available yet
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pin" className="mt-4">
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-sm">Portal PIN</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                    <Key className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Portal PIN
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Guests can set a 6-digit PIN after verifying via OTP, for faster sign-in on
                      return visits.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pinMethod?.enabled ?? false}
                  onCheckedChange={() => toggleMethod("pin")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-sm">Portal Login Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-6 max-w-sm mx-auto">
                <div className="text-center mb-4">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary p-2">
                    <img src="/brand/mark-compact-white.svg" alt="" className="h-full w-full" />
                  </div>
                  <p className="text-sm font-semibold mt-2 text-slate-800">Connect to WiFi</p>
                </div>
                <div className="space-y-2">
                  {methods
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <button
                        key={m.id}
                        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                      >
                        <m.icon className="h-4 w-4 text-slate-500" />
                        <span>{m.label}</span>
                        <span className="ml-auto text-xs text-slate-400">→</span>
                      </button>
                    ))}
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-4">Powered by Wyfy Guest</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
