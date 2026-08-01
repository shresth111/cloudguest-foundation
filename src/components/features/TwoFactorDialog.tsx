import { useState } from "react";
import { ShieldCheck, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { authService } from "@/services/auth.service";
import type { AppError } from "@/services/api";

// Was: a hardcoded QR placeholder + a static BACKUP_CODES array that
// accepted ANY 6-digit code as "verified" and never called the backend --
// clicking through this dialog convinced a customer 2FA was protecting
// their account when nothing was ever enrolled server-side. Wired to the
// real self-service MFA endpoints (auth.service.ts's enrollMfa/verifyMfa/
// disableMfa, backed by /auth/mfa/*), matching the pattern already used in
// the operator-facing _authenticated/account.tsx TwoFactorSection.
export function TwoFactorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<"idle" | "verify" | "enabled" | "disable">("idle");
  const [enrollment, setEnrollment] = useState<{ secret: string; provisioningUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetTransient = () => {
    setStep((s) => (s === "enabled" ? "enabled" : "idle"));
    setEnrollment(null);
    setCode("");
    setDisablePassword("");
    setDisableCode("");
  };

  const startEnable = async () => {
    setSubmitting(true);
    try {
      const res = await authService.enrollMfa();
      setEnrollment(res);
      setStep("verify");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to start enrollment");
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit code from your authenticator app."); return; }
    setSubmitting(true);
    try {
      const codes = await authService.verifyMfa(code);
      setRecoveryCodes(codes);
      setEnrollment(null);
      setCode("");
      setStep("enabled");
      toast.success("Two-factor authentication enabled");
    } catch (err) {
      toast.error((err as AppError).message || "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  const disable = async () => {
    if (!disablePassword || disableCode.length < 6) { toast.error("Enter your password and a current code or recovery code."); return; }
    setSubmitting(true);
    try {
      await authService.disableMfa(disablePassword, disableCode);
      toast.success("Two-factor authentication disabled");
      setStep("idle");
      setRecoveryCodes(null);
      setDisablePassword("");
      setDisableCode("");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to disable");
    } finally {
      setSubmitting(false);
    }
  };

  const enabled = step === "enabled" || step === "disable";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetTransient(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />2FA Settings</DialogTitle>
          <DialogDescription>Add an extra layer of security to your account.</DialogDescription>
        </DialogHeader>

        {(step === "idle" || step === "enabled") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Authenticator app</p>
                <p className="text-xs text-muted-foreground">{enabled ? "Enabled — codes required at sign-in." : "Not enabled."}</p>
              </div>
              <Switch checked={enabled} disabled={submitting} onCheckedChange={(v) => (v ? startEnable() : setStep("disable"))} />
            </div>
            {step === "enabled" && recoveryCodes && (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Recovery codes — shown once, save these somewhere safe.</p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                  {recoveryCodes.map((c) => <span key={c} className="rounded-md bg-background px-2 py-1 text-center">{c}</span>)}
                </div>
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(recoveryCodes.join(" ")); toast.success("Recovery codes copied"); }}><Copy className="mr-1.5 h-3 w-3" />Copy codes</Button>
              </div>
            )}
          </div>
        )}

        {step === "verify" && enrollment && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-4">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={enrollment.provisioningUri} size={140} />
              </div>
              <p className="text-center text-xs text-muted-foreground">Scan this QR with Google Authenticator, Authy, or any TOTP app, or enter the secret manually:</p>
              <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{enrollment.secret}</code>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tfa-code">6-digit code</Label>
              <Input id="tfa-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="text-center font-mono tracking-widest" autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("idle")}>Cancel</Button>
              <Button onClick={verify} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Verify &amp; Enable</Button>
            </DialogFooter>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Confirm your password and a current authenticator (or recovery) code to disable two-factor authentication.</p>
            <div className="space-y-1.5">
              <Label htmlFor="tfa-disable-password">Password</Label>
              <Input id="tfa-disable-password" type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tfa-disable-code">Code</Label>
              <Input id="tfa-disable-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value.slice(0, 10))} placeholder="123456" className="font-mono tracking-widest" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("enabled")}>Cancel</Button>
              <Button variant="destructive" onClick={disable} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Disable 2FA</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
