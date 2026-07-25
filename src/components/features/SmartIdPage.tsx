import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Fingerprint, IdCard, DoorOpen, Globe, Mail, Ticket, Key, GripVertical, Plus, Trash2 } from "lucide-react";
import { api } from "@/services/api";
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

export default function SmartIdPage({ locationId }: { locationId?: string } = {}) {
  const demo = useIsDemo();
  const [methods, setMethods] = useState<LoginMethod[]>([
    { id: "aadhar", label: "Aadhaar", icon: Fingerprint, enabled: true, required: true, order: 1, config: { otpVerify: true } },
    { id: "passport", label: "Passport", icon: IdCard, enabled: true, required: false, order: 2, config: { manualVerification: true } },
    { id: "room-no", label: "Room No.", icon: DoorOpen, enabled: true, required: false, order: 3, config: { propertyMgt: "manual" } },
    { id: "sso", label: "SSO / Email", icon: Mail, enabled: true, required: false, order: 4, config: { domain: "" } },
    { id: "email-otp", label: "Email OTP", icon: Mail, enabled: true, required: false, order: 5, config: {} },
    { id: "voucher", label: "Voucher Code", icon: Ticket, enabled: true, required: false, order: 6, config: {} },
    { id: "pin", label: "Set PIN", icon: Key, enabled: false, required: false, order: 7, config: { minLength: 4, maxLength: 8 } },
  ]);

  const [pinMode, setPinMode] = useState(false);
  const [tempPin, setTempPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // orgId + the resolved captive-portal config id for this location (if
  // one already exists) -- null configId means "none yet", created lazily
  // on the first backed toggle (see toggleMethod below).
  const [orgId, setOrgId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);

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
    const next = !methods.find((m) => m.id === id)?.enabled;
    setMethods((prev) => prev.map(m => m.id === id ? { ...m, enabled: next } : m));

    const flag = BACKED_FLAGS[id];
    if (demo || !flag) {
      // No backend field for this method (or a demo session) -- local-only,
      // same as before.
      toast.success(`Login method updated`);
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
      } else {
        const { data } = await api.post<BackendCaptivePortalConfig>(
          "/captive-portal-configs",
          {
            organization_id: orgId,
            location_id: locationId || null,
            name: "Guest WiFi Login",
            [flag]: next,
          },
          { headers },
        );
        setConfigId(data.id);
      }
      toast.success(`Login method updated`);
    } catch {
      setMethods((prev) => prev.map(m => m.id === id ? { ...m, enabled: !next } : m));
      toast.error("Could not save — check the connection and try again.");
    }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const arr = [...methods];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setMethods(arr.map((m, i) => ({ ...m, order: i + 1 })));
  };

  const savePin = () => {
    if (!tempPin || tempPin.length < 4) { toast.error("PIN must be at least 4 digits"); return; }
    if (tempPin !== confirmPin) { toast.error("PINs don't match"); return; }
    setPinMode(true);
    toast.success("PIN set successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Smart ID Configuration</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Configure login methods for the captive portal — guests can use any enabled method.</p>
        </div>
      </div>

      <Tabs defaultValue="methods">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger value="methods" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 px-4 py-2">Login Methods</TabsTrigger>
          <TabsTrigger value="pin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 px-4 py-2">Set PIN</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 px-4 py-2">Portal Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="mt-4 space-y-3">
          {methods.map((method, idx) => {
            const Icon = method.icon;
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
                      <p className="text-xs text-slate-400">Order: {method.order}{method.required ? " · Required" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {method.id === "sso" && method.enabled && (
                      <div className="hidden sm:block"><Input placeholder="Domain" className="h-8 w-36 text-xs" /></div>
                    )}
                    {method.id === "room-no" && method.enabled && (
                      <Select defaultValue="manual"><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="api">API Sync</SelectItem></SelectContent></Select>
                    )}
                    <Switch checked={method.enabled} onCheckedChange={() => toggleMethod(method.id)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="pin" className="mt-4">
          <Card className="shadow-sm border-0">
            <CardHeader><CardTitle className="text-sm">Set Portal PIN</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <p className="text-xs text-slate-400">Guests can set a PIN for quick re-login without re-entering credentials. Useful for returning guests.</p>
              <div className="space-y-2"><Label>Create PIN</Label><Input type="password" maxLength={8} placeholder="4-8 digit PIN" value={tempPin} onChange={e => setTempPin(e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
              <div className="space-y-2"><Label>Confirm PIN</Label><Input type="password" maxLength={8} placeholder="Repeat PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
              <Button onClick={savePin} disabled={!tempPin || tempPin !== confirmPin}>Save PIN</Button>
              {pinMode && <p className="text-xs text-emerald-600">✓ PIN is configured for this location</p>}
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
                {pinMode && <button className="mt-2 flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"><Key className="h-4 w-4 text-slate-500" /><span>Login with PIN</span></button>}
                <p className="text-center text-[10px] text-slate-400 mt-4">Powered by ZIP WiFi</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
