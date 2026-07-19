import { useState } from "react";
import { toast } from "sonner";
import { Mail, Smartphone, KeyRound, RefreshCw, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRbacMfa } from "@/hooks/useRbac";
import { rbacService } from "@/services/rbac.service";

const CODES = ["A3F9-K2LM", "9XR2-PQ4T", "M7BN-4KJ8", "V2LP-9WX3", "H8CY-P1RD", "T5NM-B4XA"];

export function MfaPanel() {
  const { data, isLoading, refetch } = useRbacMfa();
  const [showCodes, setShowCodes] = useState(false);

  const toggle = async (method: "email" | "sms" | "authenticator") => {
    if (!data) return;
    const has = data.methods.includes(method);
    const next = has ? data.methods.filter((m) => m !== method) : [...data.methods, method];
    await rbacService.setMfa({ methods: next, enabled: next.length > 0 });
    toast.success(has ? "Method removed" : "Method enabled");
    refetch();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Multi-factor authentication</h3>
          <p className="text-xs text-muted-foreground">Add a second layer of security to every sign-in.</p>
        </div>
        {isLoading || !data ? <Skeleton className="h-32" /> : (
          <>
            <div className="space-y-2">
              <MethodRow icon={Mail} label="Email OTP" desc="Send a code to the user's email." checked={data.methods.includes("email")} onChange={() => toggle("email")} />
              <MethodRow icon={Smartphone} label="SMS OTP" desc="Send a code via SMS." checked={data.methods.includes("sms")} onChange={() => toggle("sms")} />
              <MethodRow icon={KeyRound} label="Authenticator app" desc="TOTP compatible with Authy, Google Authenticator, 1Password." checked={data.methods.includes("authenticator")} onChange={() => toggle("authenticator")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Status" value={data.enabled ? "Enabled" : "Disabled"} tone={data.enabled ? "text-emerald-500" : "text-muted-foreground"} />
              <Stat label="Last verification" value={data.lastVerifiedAt ? new Date(data.lastVerifiedAt).toLocaleString() : "—"} />
              <Stat label="Backup codes left" value={String(data.backupCodesRemaining)} />
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Recovery codes</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowCodes((v) => !v)}>{showCodes ? "Hide" : "Show"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(CODES.join("\n")); toast.success("Codes copied"); }}><Copy className="me-1 h-3.5 w-3.5" /> Copy</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success("New backup codes generated")}><RefreshCw className="me-1 h-3.5 w-3.5" /> Regenerate</Button>
                </div>
              </div>
              {showCodes && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono sm:grid-cols-3">
                  {CODES.map((c) => <Badge key={c} variant="outline" className="justify-center py-1.5">{c}</Badge>)}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MethodRow({ icon: Icon, label, desc, checked, onChange }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
