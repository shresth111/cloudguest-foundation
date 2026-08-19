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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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

// `maskEmail`/`maskPhone`/`maskMac` now live in `@/lib/masking` -- pure
// string helpers with zero imports, moved out because importing one of them
// used to drag this module's `framer-motion` import into the app's entry
// chunk (see that file's own note for the full chain). Re-exported here so
// every existing `from "@/components/features/HeaderControls"` call site
// keeps working unchanged; anything reachable from a route `beforeLoad`
// should import them from `@/lib/masking` directly instead.
export { maskEmail, maskPhone, maskMac } from "@/lib/masking";

/** Self-service PII-masking toggle. Click sends a real OTP (see
 * `useDataMasking` in `useCustomerDashboard.ts`) and opens
 * `DataMaskingOtpDialog` to collect it -- the actual state flip only
 * happens once that code verifies. Two earlier revisions got this wrong in
 * opposite directions: one faked the OTP entirely (accepted any 6-digit
 * string, the correct code printed on the dialog itself); the next
 * over-corrected into a read-only tag with no self-service path at all,
 * on the theory that the backend's ``data_masking_enabled`` field is
 * "administrator-only." That theory didn't survive contact with the
 * actual endpoint though (see ``app.domains.user.router``'s ``/me/data-
 * masking`` docstring) -- there's no reason this can't be a real,
 * OTP-verified self-service control, so now it is one. */
export function OtpMaskToggle({ masked = true, onClick, loading, className }: { masked?: boolean; onClick?: () => void; loading?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      title={masked
        ? "Sensitive guest data is masked. Click to verify and show it unmasked."
        : "Guest data is shown unmasked for this account. Click to mask it again."}
      className={className ?? `${MASK_TAG_BASE} mr-1 transition-colors hover:bg-slate-500/20 disabled:opacity-60 ${masked ? "text-slate-300" : "text-sky-300"}`}
      style={{ clipPath: MASK_TAG_CLIP }}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : masked ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      Guest Privacy
    </button>
  );
}

/** The OTP-entry dialog `OtpMaskToggle` opens. Purely a controlled
 * presentational shell -- all the actual send/verify logic (and the demo-
 * vs-real branching) lives in `useDataMasking`; this just renders whatever
 * state that hook is in. */
export function DataMaskingOtpDialog({
  open, maskingOn, sentTo, verifying, onVerify, onCancel,
}: {
  open: boolean;
  /** The masking state being switched TO, for copy purposes only. */
  maskingOn: boolean | null;
  /** e.g. "via sms to +91••••••210" or "via email to ad••••@example.com" --
   * the backend's own message (or, in demo mode, an equivalent client-built
   * string), so this dialog never has to guess which channel was used. */
  sentTo?: string | null;
  verifying: boolean;
  onVerify: (code: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setCode(""); onCancel(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Verify it's you</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code sent {sentTo ?? "to your registered mobile/email"} to {maskingOn ? "mask" : "unmask"} guest data on this dashboard.
          </DialogDescription>
        </DialogHeader>
        <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
          <InputOTPGroup className="mx-auto">
            {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
          </InputOTPGroup>
        </InputOTP>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => { setCode(""); onCancel(); }} disabled={verifying}>Cancel</Button>
          <Button
            disabled={code.length !== 6 || verifying}
            onClick={async () => { const ok = await onVerify(code); if (!ok) setCode(""); }}
          >
            {verifying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
