/**
 * Shared top-bar controls reused across the customer dashboard, users, and
 * feature routes so they don't drift out of sync (see customerNav.ts for
 * the same lesson applied to the sidebar).
 */
import { useState } from "react";
import { toast } from "sonner";
import { EyeOff, Clock, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { demoRequestService } from "@/services/demo-request.service";
import type { AppError } from "@/services/api";

/** Distinct default treatments for the three header controls -- previously
 * all three shared one identical pill style (border + translucent fill),
 * which reads as generic/interchangeable (bug report: "competitor ke
 * buttons bhi same hai" -- every SaaS dashboard has this exact look).
 * Now each carries its own visual role: the plan badge stays a quiet,
 * secondary info chip; Book a Demo becomes a real filled CTA since it's
 * the one thing here worth clicking; the mask toggle reads as a live
 * status control with a state dot, not just another label. */
const INFO_CHIP_CLASS =
  "hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/55 sm:inline-flex";
const DEMO_CTA_CLASS =
  "hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-indigo-950/40 transition-all hover:shadow-md hover:shadow-indigo-950/50 hover:brightness-110 sm:inline-flex";
const MASK_TOGGLE_CLASS =
  "hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex";

/** Redacts an email's local part, e.g. "john.doe@email.com" -> "jo••••••@email.com". */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  return `${email.slice(0, 2)}${"•".repeat(Math.max(3, at - 2))}${email.slice(at)}`;
}

/** Redacts a MAC address the same way the backend already does --
 * ``app/common/masking.py::mask_mac``: ``"AA:BB:CC:DD:EE:FF"`` ->
 * ``"XX:XX:XX:XX:EE:FF"`` (first four octets replaced with literal "XX",
 * last two left visible), whichever separator (``:`` or ``-``) the input
 * already used. This used to invent its own, opposite convention (mask
 * the *last* three octets, keep the vendor/OUI prefix) -- cosmetically
 * different from, and less redacted than, what several backend responses
 * (connected-devices, mac-authorization, guest session/device schemas --
 * see ``app.common.masking.MaskedMac``) already send down pre-masked in
 * this exact "XX:XX:XX:XX:EE:FF" shape. Matching it here means (1) one
 * consistent masked format everywhere in the product, not two, and (2)
 * applying this function to an already-backend-masked value is a no-op
 * (the idempotency check below) instead of visually double-masking it.
 * Falls back to returning the input unchanged for anything that isn't a
 * real 6-octet colon/dash address, exactly like the backend function. */
const MASKED_MAC_PATTERN = /^(?:[Xx]{2}[:-]){4}[0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}$/;
export function maskMac(mac: string): string {
  if (!mac) return mac;
  if (MASKED_MAC_PATTERN.test(mac)) return mac;
  const separator = mac.includes("-") ? "-" : ":";
  const octets = mac.split(separator);
  if (octets.length !== 6) return mac;
  return [...Array(4).fill("XX"), ...octets.slice(-2)].join(separator);
}

/** Read-only PII-masking status indicator -- *not* a self-service reveal
 * control. Previously this rendered an "unmask" dialog that accepted any
 * 6-digit string as an "OTP" (the correct code was printed on the dialog
 * itself, "Demo OTP: 123456") and, on "verifying", just flipped local
 * React state -- no backend call at all. That was actively misleading,
 * not just unfinished: the backend's own masking policy
 * (``app.domains.user.schemas``'s ``data_masking_enabled`` -- "True
 * (masked) is the default for every account -- administrators explicitly
 * flip this to False for privileged users, never the other way around
 * via self-service") makes self-service PII unmasking a capability that
 * cannot legitimately exist on this, the customer's own dashboard --
 * mirroring the same customer/admin boundary already drawn for
 * WireGuard internals. Faking a working OTP gate for a privilege the
 * account holder can never actually be granted here is worse than not
 * offering the control at all, so this now just states the real,
 * server-enforced policy and never flips ``masked`` to false. */
export function OtpMaskToggle({ className }: { masked?: boolean; setMasked?: (fn: (m: boolean) => boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => toast.info("Sensitive data is masked per your organization's security policy. Only an administrator can change this, for a specific account, from the admin console.")}
      className={className ?? MASK_TOGGLE_CLASS + " mr-1"}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
      <EyeOff className="h-3 w-3" /> Data masked
    </button>
  );
}

/** Formats an ISO date string (e.g. a subscription's `current_period_end`)
 * as "24-Aug-2026" to match this badge's display convention. */
export function formatPlanExpiry(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${String(d.getDate()).padStart(2, "0")}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()}`;
}

/**
 * Renders the real subscription renewal date -- callers must pass the
 * actual `current_period_end` from `GET /billing/dashboard/me` (see
 * `useMyBillingDashboard`), already formatted via `formatPlanExpiry`.
 *
 * This used to default `expiry` to a hardcoded "11-Nov-2026" and every call
 * site rendered it unconditionally, so *every* account -- demo or real --
 * showed the same fake renewal date regardless of what plan/subscription
 * was actually provisioned for it. There is no honest fallback for a real
 * account's real subscription date, so when it hasn't loaded yet (or the
 * session has no resolvable organization) this renders nothing rather than
 * a fabricated one.
 */
export function PlanExpiryBadge({ expiry, className }: { expiry?: string | null; className?: string }) {
  if (!expiry) return null;
  return (
    <span className={className ?? INFO_CHIP_CLASS} title="Current plan renewal date">
      <Clock className="h-3 w-3" /> Plan expires <span className="tabular-nums text-white/75">{expiry}</span>
    </span>
  );
}

const emptyDemoForm = { name: "", email: "", company: "", message: "" };

export function BookDemoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDemoForm);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company) {
      toast.error("Please share your name, email, and company.");
      return;
    }
    setSubmitting(true);
    try {
      await demoRequestService.submit({
        fullName: form.name,
        email: form.email,
        companyName: form.company,
        message: form.message || undefined,
      });
      toast.success("Thanks! Our team will reach out to schedule your demo.");
      setForm(emptyDemoForm);
      setOpen(false);
    } catch (err) {
      toast.error((err as AppError).message || "Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={className ?? DEMO_CTA_CLASS + " mr-1"}>
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {submitting ? "Submitting…" : "Request Demo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
