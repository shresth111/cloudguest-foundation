/**
 * Shared top-bar controls reused across the customer dashboard, users, and
 * feature routes so they don't drift out of sync (see customerNav.ts for
 * the same lesson applied to the sidebar).
 */
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shield, Eye, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { demoRequestService } from "@/services/demo-request.service";
import type { AppError } from "@/services/api";

/**
 * Second design pass on the header controls (see git history for the first
 * -- three identical rounded pills, then three pills with distinct colors).
 * Founder feedback on the second pass: still reads as "generic SaaS chips,"
 * just recolored. This pass changes the shape language and the information
 * architecture, not just the palette:
 *
 * - "Plan expires" and "Book a Demo" were two disconnected chips telling
 *   two unrelated half-stories. They're now one object, `PlanRenewalTicket`:
 *   a boarding-pass-style card (angled cut ends, a perforated tear line
 *   down the middle) whose left stub is a real countdown -- a 5-bar runway
 *   gauge plus day count that only appears once the renewal is close enough
 *   to matter -- and whose right stub is the actual CTA. One shape, one
 *   sentence: "N days left on your plan -- talk to us." The gauge's fill
 *   and color tier (calm indigo / warn amber / urgent rose) are computed
 *   from the real renewal date, and only the urgent tier gets a slow pulse
 *   on the CTA -- motion tied to real account state, not decoration.
 * - The masking indicator was never a "button" in spirit (it's a read-only
 *   policy statement, see `OtpMaskToggle` below), so it no longer looks
 *   like one. It's a small notched security tag in a cool slate register
 *   that appears nowhere else in this indigo/violet UI, signalling "this
 *   is a compliance fact, not something to press" purely through material.
 */

/** Tailwind class applied to the read-only masking tag; kept as a constant
 * because its notched-corner clip-path is the one piece of shared shape
 * between its two states (masked / unmasked). */
const MASK_TAG_BASE =
  "hidden items-center gap-1.5 border border-slate-400/25 bg-slate-500/10 py-1.5 pl-2.5 pr-3 text-[11px] font-medium sm:inline-flex";
const MASK_TAG_CLIP = "polygon(7px 0, 100% 0, 100% 100%, 0 100%, 0 7px)";

/** Redacts an email's local part, e.g. "john.doe@email.com" -> "jo••••••@email.com". */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  return `${email.slice(0, 2)}${"•".repeat(Math.max(3, at - 2))}${email.slice(at)}`;
}

/** Redacts a phone number's digits, keeping the leading country code/first
 * two digits and the trailing three visible (e.g. "+91 98765 43210" ->
 * "+91 9•••• ••210"), same "some structure survives, PII doesn't" shape as
 * `maskEmail` above. Operates on digit *positions* only so any existing
 * formatting (spaces, dashes, the leading "+") passes through untouched
 * rather than being collapsed into the mask. Numbers too short to usefully
 * redact (<=5 digits) are returned as-is. */
export function maskPhone(phone: string): string {
  const digitIndexes: number[] = [];
  for (let i = 0; i < phone.length; i++) {
    if (phone[i] >= "0" && phone[i] <= "9") digitIndexes.push(i);
  }
  if (digitIndexes.length <= 5) return phone;
  const toMask = new Set(digitIndexes.slice(2, digitIndexes.length - 3));
  return phone
    .split("")
    .map((ch, i) => (toMask.has(i) ? "•" : ch))
    .join("");
}

/** No-op by explicit product decision -- MAC addresses are shown
 * unmasked everywhere (customers need the real address to identify a
 * device for support). Mirrors the backend's own ``mask_mac`` (see
 * ``app/common/masking.py``), which is the actual source of truth for
 * this: several endpoints (connected-devices, mac-authorization, guest
 * session/device schemas) already send the real, unmasked value, so this
 * function stays a real passthrough rather than being deleted, in case
 * any call site still relies on it existing. */
export function maskMac(mac: string): string {
  return mac;
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
export function OtpMaskToggle({ masked = true, className }: { masked?: boolean; setMasked?: (fn: (m: boolean) => boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      title={masked
        ? "Sensitive data is masked per your organization's security policy. Only an administrator can change this from the admin console."
        : "This account has been granted unmasked access by an administrator. This is a privileged, admin-controlled setting -- not something you can toggle here."}
      onClick={() => toast.info(masked
        ? "Sensitive data is masked per your organization's security policy. Only an administrator can change this, for a specific account, from the admin console."
        : "This account currently sees unmasked data, set by an administrator. Contact them to change it.")}
      className={className ?? `${MASK_TAG_BASE} mr-1 ${masked ? "text-slate-300" : "text-sky-300"}`}
      style={{ clipPath: MASK_TAG_CLIP }}
    >
      {masked ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {masked ? "Data masked" : "Data visible"}
    </button>
  );
}

/** Demo-mode plan renewal date -- the header used to hardcode the display
 * string "11-Nov-2026" directly; kept as the same calendar date but as a
 * real ISO instant, since `PlanRenewalTicket`'s countdown/urgency math
 * needs an actual `Date` to compute against, not a pre-formatted label. */
export const DEMO_PLAN_RENEWAL_ISO = new Date(Date.UTC(2026, 10, 11)).toISOString();

/** Formats an ISO date string (e.g. a subscription's `current_period_end`)
 * as "24-Aug-2026" to match this badge's display convention. */
export function formatPlanExpiry(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${String(d.getDate()).padStart(2, "0")}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()}`;
}

/** Whole days between now and an ISO date, rounded up (so "expires in the
 * next few hours" still reads as "0d", never a misleading negative-turned-
 * positive rounding artifact). Returns `null` for a missing/unparseable
 * date so callers can fall back to a quiet, non-urgent state instead of
 * guessing. */
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

type PlanTier = "calm" | "warn" | "urgent";

/** Three real states, not a cosmetic gradient pick: `calm` when renewal is
 * far off (>30d or unknown), `warn` inside the last month, `urgent` inside
 * the last week or already past. This is the actual decision window a plan
 * owner cares about, so the badge's whole visual language -- gauge fill,
 * color, whether the CTA pulses -- is driven by it. */
function planTier(daysLeft: number | null): PlanTier {
  if (daysLeft === null) return "calm";
  if (daysLeft <= 7) return "urgent";
  if (daysLeft <= 30) return "warn";
  return "calm";
}

const TIER_STYLE: Record<PlanTier, { text: string; bar: string; ring: string }> = {
  calm: { text: "text-indigo-300", bar: "bg-indigo-400", ring: "99,102,241" },
  warn: { text: "text-amber-300", bar: "bg-amber-400", ring: "245,158,11" },
  urgent: { text: "text-rose-300", bar: "bg-rose-400", ring: "244,63,94" },
};

/** How many of the 5 runway bars are lit. The gauge only tracks the final
 * 30-day window before renewal -- that's the stretch where "how much is
 * left" is actually actionable -- so anything further out reads as a full,
 * calm tank rather than a meaningless sliver. */
function runwayFilled(daysLeft: number | null): number {
  if (daysLeft === null) return 5;
  if (daysLeft <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil((Math.min(daysLeft, 30) / 30) * 5)));
}

/** A 5-bar "fuel gauge" for plan runway -- ascending bar heights like a
 * signal-strength meter, filled/dimmed per `runwayFilled`. Reused nowhere
 * else in the product on purpose: it's a one-off metaphor for "how much
 * plan is left," not a generic progress bar. */
function RunwayGauge({ tier, filled }: { tier: PlanTier; filled: number }) {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {[5, 7, 9, 11, 13].map((h, i) => (
        <span
          key={h}
          className={`w-[3px] rounded-[1px] transition-colors duration-500 ${i < filled ? TIER_STYLE[tier].bar : "bg-white/15"}`}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}

const emptyDemoForm = { name: "", email: "", company: "", message: "" };

/**
 * Combines what used to be two disconnected chips -- `PlanExpiryBadge` and
 * `BookDemoButton` -- into one object, because they were never two separate
 * facts: "your plan renews on X" and "want to talk to us" are one sentence
 * ("N days left -- talk to us"), not two unrelated pieces of chrome sharing
 * a toolbar. Shaped like a boarding-pass stub (angled ends via `clip-path`,
 * a perforated tear line down the middle) instead of a rounded pill, so it
 * reads as a distinct object rather than "another button."
 *
 * Left stub: real renewal data, either a quiet date (far off) or a live
 * countdown with a runway gauge (inside the 30-day decision window) --
 * see `planTier`/`runwayFilled`. Right stub: the real, working demo-request
 * flow (same `demoRequestService.submit` call as before), just relabeled to
 * "Talk to us" once the plan is actually at risk, and the one visual flourish
 * in this whole redesign -- a slow pulse -- only fires in the `urgent` tier,
 * because that's the one moment this chrome should actually grab attention.
 *
 * `expiryIso` must be the real `current_period_end`/`renewalDate` from
 * `GET /billing/dashboard/me`; when it hasn't loaded (or there's no
 * resolvable organization) the left stub is simply omitted rather than
 * showing a fabricated date, same honesty contract as before.
 */
export function PlanRenewalTicket({ expiryIso, className }: { expiryIso?: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDemoForm);
  const [submitting, setSubmitting] = useState(false);

  const daysLeft = daysUntil(expiryIso);
  const tier = planTier(daysLeft);
  const filled = runwayFilled(daysLeft);
  const urgent = tier === "urgent";
  const expiryLabel = expiryIso ? formatPlanExpiry(expiryIso) : null;

  const statusLabel = !expiryLabel
    ? null
    : daysLeft === null
    ? `Renews ${expiryLabel}`
    : daysLeft < 0
    ? "Plan expired"
    : daysLeft === 0
    ? "Expires today"
    : daysLeft <= 30
    ? `${daysLeft}d left`
    : `Renews ${expiryLabel}`;

  const ctaLabel = tier === "calm" ? "Book a Demo" : "Talk to us";

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
      <div className={className ?? "mr-1 hidden h-9 shrink-0 items-stretch sm:flex"} title={expiryLabel ? `Plan renewal: ${expiryLabel}` : undefined}>
        <div className="flex items-stretch overflow-hidden" style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
          {statusLabel && (
            <>
              <div className="flex items-center gap-2 border-y border-l border-white/10 bg-white/[0.04] pl-4 pr-3">
                <RunwayGauge tier={tier} filled={filled} />
                <span className={`text-[11px] font-medium tabular-nums ${TIER_STYLE[tier].text}`}>{statusLabel}</span>
              </div>
              {/* Tear line: a dashed seam with two punched notches, so the
                  two stubs read as one perforated ticket, not two chips
                  glued together. */}
              <div className="relative w-px shrink-0 self-stretch">
                <span className="absolute inset-y-0 left-0 border-l border-dashed border-white/25" />
                <span className="absolute -top-[5px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-[#221f4c]" />
                <span className="absolute -bottom-[5px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-[#221f4c]" />
              </div>
            </>
          )}
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            animate={urgent ? { boxShadow: [`0 0 0 0 rgba(${TIER_STYLE.urgent.ring},0.55)`, `0 0 0 6px rgba(${TIER_STYLE.urgent.ring},0)`] } : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
            transition={urgent ? { duration: 1.8, repeat: Infinity, ease: "easeOut" } : undefined}
            className={`flex items-center gap-1.5 border-y border-r ${statusLabel ? "" : "border-l"} border-white/10 bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] pl-3 pr-4 text-[11px] font-semibold text-white`}
          >
            <CalendarClock className="h-3 w-3" /> {ctaLabel}
          </motion.button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tier === "calm" ? "Book a Demo" : "Talk to Us"}</DialogTitle>
            <DialogDescription>
              {tier === "calm"
                ? "Tell us a bit about your business and our team will reach out to schedule a walkthrough."
                : "Tell us a bit about your business and our team will reach out about your plan and renewal options."}
            </DialogDescription>
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
