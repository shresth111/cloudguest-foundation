/**
 * Shared top-bar controls reused across the customer dashboard, users, and
 * feature routes so they don't drift out of sync (see customerNav.ts for
 * the same lesson applied to the sidebar).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, Clock, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const PILL_CLASS = "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent sm:inline-flex";

/** Data-masking toggle gated behind an OTP step -- revealing (or re-hiding)
 * guest data requires verifying a 6-digit code first, same as a real
 * sensitive-action confirmation would. */
export function OtpMaskToggle({ masked, setMasked, className }: { masked: boolean; setMasked: (fn: (m: boolean) => boolean) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) { toast.error("Enter the 6-digit code sent to your registered mobile."); return; }
    setMasked((m) => !m);
    toast.success(masked ? "Data unmasked" : "Data masked");
    setOtp("");
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => { setOtp(""); setOpen(true); }} className={className ?? PILL_CLASS + " mr-1"}>
        {masked ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {masked ? "Data masked" : "Data visible"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Verify to {masked ? "unmask" : "mask"} data</DialogTitle>
            <DialogDescription>Enter the 6-digit OTP sent to your registered mobile to {masked ? "reveal" : "hide"} sensitive user data.</DialogDescription>
          </DialogHeader>
          <form onSubmit={verify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mask-otp">One-time code</Label>
              <Input id="mask-otp" autoFocus inputMode="numeric" maxLength={6} placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-[0.5em]" />
            </div>
            <p className="text-center text-xs text-muted-foreground">Demo OTP: <span className="font-mono font-semibold text-foreground">123456</span></p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Verify &amp; {masked ? "Unmask" : "Mask"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PlanExpiryBadge({ expiry = "11-Nov-2026", className }: { expiry?: string; className?: string }) {
  return (
    <span className={className ?? PILL_CLASS} title="Current plan renewal date">
      <Clock className="h-3 w-3" /> Plan expires {expiry}
    </span>
  );
}

const emptyDemoForm = { name: "", email: "", company: "", message: "" };

export function BookDemoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDemoForm);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast.error("Please share your name and email."); return; }
    toast.success("Thanks! Our team will reach out to schedule your demo.");
    setForm(emptyDemoForm);
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={className ?? PILL_CLASS + " mr-1"}>
        <CalendarClock className="h-3 w-3" /> Book a Demo
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book a Demo</DialogTitle>
            <DialogDescription>Tell us a bit about your business and our team will reach out to schedule a walkthrough.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="hdr-demo-name">Full name</Label><Input id="hdr-demo-name" placeholder="Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="hdr-demo-email">Work email</Label><Input id="hdr-demo-email" type="email" placeholder="jane@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="hdr-demo-company">Company</Label><Input id="hdr-demo-company" placeholder="Acme Hotels" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-2">
              <Label htmlFor="hdr-demo-message">What are you looking for? (optional)</Label>
              <textarea
                id="hdr-demo-message"
                placeholder="Tell us about your locations, network size, or specific needs…"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Request Demo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
