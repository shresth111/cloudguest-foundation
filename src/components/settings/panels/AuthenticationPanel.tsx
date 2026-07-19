import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionCard, ToggleRow, FieldGrid } from "../SectionCard";
import type { AuthSettings } from "@/types/settings";
import { useUpdateSection } from "@/hooks/useSettings";
import { useState } from "react";

const METHODS: { key: keyof AuthSettings; label: string; description: string }[] = [
  { key: "emailLogin", label: "Email login", description: "Guests sign in with email and password." },
  { key: "mobileOtp", label: "Mobile OTP", description: "One-time passcode delivered via SMS." },
  { key: "emailOtp", label: "Email OTP", description: "One-time passcode delivered via email." },
  { key: "voucherLogin", label: "Voucher login", description: "Prepaid code-based access." },
  { key: "pmsLogin", label: "PMS login", description: "Validate guests against a property PMS." },
  { key: "socialLogin", label: "Social login", description: "Google, Facebook and Apple sign-in." },
  { key: "qrLogin", label: "QR login", description: "Scan-to-connect using room QR codes." },
];

export function AuthenticationPanel({ data }: { data: AuthSettings }) {
  const mut = useUpdateSection<"auth">();
  const [local, setLocal] = useState<AuthSettings>(data);

  const patch = (p: Partial<AuthSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () =>
    mut.mutate({ section: "auth", value: local }, { onSuccess: () => toast.success("Authentication updated") });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Login methods"
        description="Enable the sign-in options offered on captive portals and admin apps."
        actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {METHODS.map((m) => (
            <ToggleRow key={m.key} label={m.label} description={m.description}>
              <Switch
                checked={local[m.key] as boolean}
                onCheckedChange={(v) => patch({ [m.key]: v } as Partial<AuthSettings>)}
              />
            </ToggleRow>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Session & password" description="Tune authentication behaviour across the platform.">
        <FieldGrid>
          <Field label="Session timeout (minutes)">
            <Input type="number" min={1} value={local.sessionTimeoutMinutes}
              onChange={(e) => patch({ sessionTimeoutMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Password expiry (days)">
            <Input type="number" min={0} value={local.passwordExpiryDays}
              onChange={(e) => patch({ passwordExpiryDays: Number(e.target.value) })} />
          </Field>
          <Field label="Max login attempts">
            <Input type="number" min={1} value={local.maxLoginAttempts}
              onChange={(e) => patch({ maxLoginAttempts: Number(e.target.value) })} />
          </Field>
          <ToggleRow label="Remember me" description="Extended session cookies for trusted devices.">
            <Switch checked={local.rememberLogin} onCheckedChange={(v) => patch({ rememberLogin: v })} />
          </ToggleRow>
        </FieldGrid>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
