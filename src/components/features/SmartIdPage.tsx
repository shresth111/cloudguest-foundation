import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Fingerprint, IdCard, DoorOpen, Mail, Ticket, Key, GripVertical } from "lucide-react";
import { api, type AppError } from "@/services/api";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { resolveOrgId } from "@/services/customer.service";

interface LoginMethod {
  id: string;
  label: string;
  icon: typeof Fingerprint | typeof IdCard;
  enabled: boolean;
  required: boolean;
  order: number;
  config: Record<string, any>;
}

// Only these two SmartIdPage methods have a real, persisted counterpart in
// the backend's captive_portal_configs table (otp_email_enabled /
// voucher_enabled -- see backend/app/domains/captive_portal/models.py).
// Aadhaar/Passport/Room No./SSO/PIN have no backing column anywhere in the
// backend (no identity-verification or PIN-login module exists), so
// toggling those stays local-only -- the same honest "real field written
// for real, no field faked as persisted" boundary portal.service.ts's own
// LOGIN_METHOD_FLAGS already documents for this exact backend table.
const BACKED_FLAGS: Partial<Record<string, "otp_email_enabled" | "voucher_enabled">> = {
  "email-otp": "otp_email_enabled",
  voucher: "voucher_enabled",
};

interface BackendCaptivePortalConfig {
  id: string;
  organization_id: string;
  location_id: string | null;
  otp_email_enabled: boolean;
  voucher_enabled: boolean;
  is_active: boolean;
  is_default: boolean;
}

// Aadhaar/Passport/Room No./SSO/PIN have no real guest-facing
// implementation anywhere in this product -- no verification flow, no
// backend field, nothing a guest would ever actually see on the real
// captive portal regardless of this toggle. Shown disabled with
// "Coming soon" rather than silently accepting a toggle that does
// nothing (see BACKED_FLAGS below for the two that are real).
const UNAVAILABLE_METHOD_IDS = new Set(["aadhar", "passport", "room-no", "sso", "pin"]);

export default function SmartIdPage({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  const [methods, setMethods] = useState<LoginMethod[]>([
    { id: "aadhar", label: "Aadhaar", icon: Fingerprint, enabled: false, required: false, order: 1, config: { otpVerify: true } },
    { id: "passport", label: "Passport", icon: IdCard, enabled: false, required: false, order: 2, config: { manualVerification: true } },
    { id: "room-no", label: "Room No.", icon: DoorOpen, enabled: false, required: false, order: 3, config: { propertyMgt: "manual" } },
    { id: "sso", label: "SSO / Email", icon: Mail, enabled: false, required: false, order: 4, config: { domain: "" } },
    { id: "email-otp", label: "Email OTP", icon: Mail, enabled: true, required: false, order: 5, config: {} },
    { id: "voucher", label: "Voucher Code", icon: Ticket, enabled: true, required: false, order: 6, config: {} },
    { id: "pin", label: "Set PIN", icon: Key, enabled: false, required: false, order: 7, config: { minLength: 4, maxLength: 8 } },
  ]);

  // orgId + the resolved captive-portal config id for this location (if
  // one already exists) -- null configId means "none yet", created lazily
  // on the first backed toggle (see toggleMethod below).
  const [orgId, setOrgId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
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
      } catch {
        // Leave the local defaults in place -- backed toggles will lazily
        // create a config on first use (see toggleMethod).
      }
    })();
  }, [demo, locationId]);

  const toggleMethod = async (id: string) => {
    const method = methods.find((m) => m.id === id);
    const next = !method?.enabled;
    const label = method?.label ?? "Login method";
    setMethods((prev) => prev.map(m => m.id === id ? { ...m, enabled: next } : m));

    const flag = BACKED_FLAGS[id];
    if (demo || !flag) {
      // No backend field for this method (or a demo session) -- local-only,
      // same as before.
      toast.success(next ? `${label} is now on — guests can use it to sign in.` : `${label} is now off.`);
      return;
    }
    if (!orgId) {
      setMethods((prev) => prev.map(m => m.id === id ? { ...m, enabled: !next } : m));
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
      toast.success(next ? `${label} is now on — guests can use it to sign in.` : `${label} is now off.`);
    } catch (err) {
      setMethods((prev) => prev.map(m => m.id === id ? { ...m, enabled: !next } : m));
      toast.error((err as AppError).message || "Could not save — check the connection and try again.");
    }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const arr = [...methods];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setMethods(arr.map((m, i) => ({ ...m, order: i + 1 })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sign-in Methods</h1>
          <p className="text-sm text-muted-foreground">Configure login methods for the captive portal — guests can use any enabled method.</p>
        </div>
      </div>

      <Tabs defaultValue="methods">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger value="methods" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 px-4 py-2">Login Methods</TabsTrigger>
          <TabsTrigger value="pin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 px-4 py-2">Set PIN</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 px-4 py-2">Portal Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="mt-4 space-y-3">
          {methods.map((method, idx) => {
            const Icon = method.icon;
            const unavailable = UNAVAILABLE_METHOD_IDS.has(method.id);
            return (
              <Card key={method.id} className={`border-0 shadow-sm transition-all ${method.enabled ? "ring-1 ring-slate-200" : "opacity-60"}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => moveUp(idx)} className="text-slate-300 hover:text-slate-500 cursor-grab"><GripVertical className="h-4 w-4" /></button>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{method.label}</p>
                      <p className="text-xs text-slate-400">
                        {unavailable ? (
                          <span className="text-amber-600">Coming soon — not yet available to guests</span>
                        ) : (
                          <>Order: {method.order}{method.required ? " · Required" : ""}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {unavailable ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not available yet
                      </Badge>
                    ) : (
                      <Switch checked={method.enabled} onCheckedChange={() => toggleMethod(method.id)} />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="pin" className="mt-4">
          <Card className="shadow-sm border-0">
            <CardHeader><CardTitle className="text-sm">Set Portal PIN</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-md">
              <p className="text-xs text-slate-400">
                Guests will be able to set a PIN for quick re-login without re-entering
                credentials. This isn't available to guests yet — coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="shadow-sm border-0">
            <CardHeader><CardTitle className="text-sm">Portal Login Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-6 max-w-sm mx-auto">
                <div className="text-center mb-4"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary p-2"><img src="/brand/mark-compact-white.svg" alt="" className="h-full w-full" /></div><p className="text-sm font-semibold mt-2 text-slate-800">Connect to WiFi</p></div>
                <div className="space-y-2">
                  {methods.filter(m => m.enabled).map(m => (
                    <button key={m.id} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"><m.icon className="h-4 w-4 text-slate-500" /><span>{m.label}</span><span className="ml-auto text-xs text-slate-400">→</span></button>
                  ))}
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-4">Powered by ZIP WiFi</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
