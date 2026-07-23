import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, Download } from "lucide-react";
import { toast } from "sonner";

export function PortalPage() {
  const [primary, setPrimary] = useState("#6366f1");
  const [msg, setMsg] = useState("Welcome! Connect to enjoy free WiFi");
  const [authMethods, setAuthMethods] = useState(["otp","sms","voucher"]);
  const [form, setForm] = useState({ theme: "enterprise", font: "inter", lang: "en, hi, ar", redirectUrl: "https://bhaifi.com/welcome", terms: "By connecting you agree to fair-use terms." });

  const toggleAuth = (m: string) => {
    setAuthMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-sm border-0">
        <CardHeader><CardTitle className="text-sm">Portal Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Welcome Message</Label><Textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Primary Color</Label><div className="flex items-center gap-2"><Input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="h-9 w-14 p-1" /><Input value={primary} className="font-mono h-9" /></div></div>
            <div className="space-y-1.5"><Label>Theme</Label><Select value={form.theme} onValueChange={v => setForm({...form, theme: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="enterprise">Enterprise Blue</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Font</Label><Select value={form.font} onValueChange={v => setForm({...form, font: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inter">Inter</SelectItem><SelectItem value="poppins">Poppins</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Languages</Label><Input value={form.lang} onChange={e => setForm({...form, lang: e.target.value})} className="h-9" /></div>
          </div>
          <div className="space-y-1.5"><Label>Auth Methods</Label><div className="flex flex-wrap gap-2">{[["otp","OTP"],["sms","SMS"],["voucher","Voucher"],["social","Social Login"]].map(([k,v]) => (
            <div key={k} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
              <Switch checked={authMethods.includes(k)} onCheckedChange={() => toggleAuth(k)} />
              <span className="text-xs">{v}</span>
            </div>
          ))}</div></div>
          <div className="space-y-1.5"><Label>Redirect URL</Label><Input value={form.redirectUrl} onChange={e => setForm({...form, redirectUrl: e.target.value})} className="h-9" /></div>
          <div className="space-y-1.5"><Label>Terms & Conditions</Label><Textarea rows={2} value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} /></div>
          <Button onClick={() => toast.success("Portal configuration saved")}>Save Configuration</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle className="text-sm">Live Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden" style={{background: `linear-gradient(160deg, ${primary}22, ${primary}11)`}}>
              <div className="p-6 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full" style={{background: primary, color: "white"}}><Wifi className="h-5 w-5" /></div>
                <p className="font-semibold">{msg}</p>
                <p className="text-xs text-muted-foreground">Connect to enjoy free WiFi</p>
                <div className="space-y-2 max-w-xs mx-auto"><Input placeholder="Mobile number" className="h-9" /><Button className="h-9 w-full" style={{background: primary}}>Continue</Button></div>
                <p className="text-[10px] text-muted-foreground">Powered by ZIP WiFi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0">
          <CardHeader><CardTitle className="text-sm">QR Code Access</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="grid h-32 w-32 place-items-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
              <Wifi className="h-16 w-16 text-primary/40" />
            </div>
            <p className="text-xs text-muted-foreground">portal.bhaifi.com</p>
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Download QR</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
