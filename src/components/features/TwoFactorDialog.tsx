import { useState } from "react";
import { ShieldCheck, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const BACKUP_CODES = ["7F3K-9QXZ", "2M8T-KL04", "R5VN-88DC", "QW1E-77YU", "ZX92-P0LK", "B4NM-3VCX"];

export function TwoFactorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<"idle" | "verify">("idle");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startEnable = () => setStep("verify");

  const verify = () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit code from your authenticator app."); return; }
    setSubmitting(true);
    setTimeout(() => {
      setEnabled(true);
      setStep("idle");
      setCode("");
      setSubmitting(false);
      toast.success("Two-factor authentication enabled");
    }, 600);
  };

  const disable = () => {
    setEnabled(false);
    toast.success("Two-factor authentication disabled");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setStep("idle"); setCode(""); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />2FA Settings</DialogTitle>
          <DialogDescription>Add an extra layer of security to your account.</DialogDescription>
        </DialogHeader>

        {step === "idle" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Authenticator app</p>
                <p className="text-xs text-muted-foreground">{enabled ? "Enabled — codes required at sign-in." : "Not enabled."}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => (v ? startEnable() : disable())} />
            </div>
            {enabled && (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Backup codes — save these somewhere safe.</p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                  {BACKUP_CODES.map((c) => <span key={c} className="rounded-md bg-background px-2 py-1 text-center">{c}</span>)}
                </div>
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(BACKUP_CODES.join(" ")); toast.success("Backup codes copied"); }}><Copy className="mr-1.5 h-3 w-3" />Copy codes</Button>
              </div>
            )}
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-4">
              <div className="grid h-32 w-32 place-items-center rounded-lg border-2 border-dashed text-muted-foreground"><ShieldCheck className="h-10 w-10 opacity-40" /></div>
              <p className="text-center text-xs text-muted-foreground">Scan this QR with Google Authenticator, Authy, or any TOTP app.</p>
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
      </DialogContent>
    </Dialog>
  );
}
