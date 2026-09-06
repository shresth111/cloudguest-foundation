/**
 * Shared top-bar controls reused across the customer dashboard, users, and
 * feature routes so they don't drift out of sync (see customerNav.ts for
 * the same lesson applied to the sidebar).
 */
import { useState } from "react";
import { Shield, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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
export function OtpMaskToggle({
  masked = true,
  onClick,
  loading,
  className,
}: {
  masked?: boolean;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      title={
        masked
          ? "Sensitive guest data is masked. Click to verify and show it unmasked."
          : "Guest data is shown unmasked for this account. Click to mask it again."
      }
      className={
        className ??
        `${MASK_TAG_BASE} mr-1 transition-colors hover:bg-slate-500/20 disabled:opacity-60 ${masked ? "text-slate-300" : "text-sky-300"}`
      }
      style={{ clipPath: MASK_TAG_CLIP }}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : masked ? (
        <Shield className="h-3 w-3" />
      ) : (
        <Eye className="h-3 w-3" />
      )}
      Guest Privacy
    </button>
  );
}

/** The OTP-entry dialog `OtpMaskToggle` opens. Purely a controlled
 * presentational shell -- all the actual send/verify logic (and the demo-
 * vs-real branching) lives in `useDataMasking`; this just renders whatever
 * state that hook is in. */
export function DataMaskingOtpDialog({
  open,
  maskingOn,
  sentTo,
  verifying,
  onVerify,
  onCancel,
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setCode("");
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Verify it's you</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code sent {sentTo ?? "to your registered mobile/email"} to{" "}
            {maskingOn ? "mask" : "unmask"} guest data on this dashboard.
          </DialogDescription>
        </DialogHeader>
        <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
          <InputOTPGroup className="mx-auto">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => {
              setCode("");
              onCancel();
            }}
            disabled={verifying}
          >
            Cancel
          </Button>
          <Button
            disabled={code.length !== 6 || verifying}
            onClick={async () => {
              const ok = await onVerify(code);
              if (!ok) setCode("");
            }}
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

/**
 * Real renewal state for the dashboard header: either a quiet date (far
 * off) or a live countdown with a runway gauge (inside the 30-day decision
 * window) -- see `planTier`/`runwayFilled`. This used to be a two-stub
 * boarding-pass whose right stub opened the demo-request dialog ("Book a
 * Demo" / "Talk to us"); the customer asked for that CTA out of the
 * dashboard header, so the ticket is now just the renewal countdown pill.
 *
 * `expiryIso` must be the real `current_period_end`/`renewalDate` from
 * `GET /billing/dashboard/me`; when it hasn't loaded (or there's no
 * resolvable organization) nothing renders rather than showing a
 * fabricated date, same honesty contract as before.
 */
export function PlanRenewalTicket({
  expiryIso,
  className,
}: {
  expiryIso?: string | null;
  className?: string;
}) {
  const daysLeft = daysUntil(expiryIso);
  const tier = planTier(daysLeft);
  const filled = runwayFilled(daysLeft);
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

  // The demo-request CTA stub used to ride along on this ticket (a single
  // boarding-pass object: renewal stub | "Book a Demo" stub). The customer
  // asked for the demo CTA gone from the dashboard header; the renewal
  // countdown itself is real account state and stays.
  if (!statusLabel) return null;

  return (
    <div
      className={className ?? "mr-1 hidden h-9 shrink-0 items-stretch sm:flex"}
      title={expiryLabel ? `Plan renewal: ${expiryLabel}` : undefined}
    >
      {/* items-center, not items-stretch: this row lays the gauge out beside
        the label, so both must centre on the pill's vertical axis. The outer
        wrapper above keeps items-stretch -- that is what makes this pill fill
        the h-9 (36px) header row. When the two-stub boarding pass was
        flattened into a single pill, the inner stub that carried
        `items-center` went with it and this row inherited the outer
        `items-stretch`, which stretched both children to the full 36px: the
        gauge is `items-end`, so its bars sank to the pill's bottom edge, while
        the label's line box stayed at the top -- leaving the date sitting
        ~22px above its own gauge inside a 36px pill. */}
      <div className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-3">
        <RunwayGauge tier={tier} filled={filled} />
        <span className={`ml-2 text-[11px] font-medium tabular-nums ${TIER_STYLE[tier].text}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
