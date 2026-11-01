/**
 * Shared top-bar controls reused across the customer dashboard, users, and
 * feature routes so they don't drift out of sync (see customerNav.ts for
 * the same lesson applied to the sidebar).
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * What is left here: the renewal pill (`PlanRenewalTicket`) the top bar
 * shows inside the last week before renewal, the OTP dialog behind the
 * sidebar's Guest Privacy control, and re-exported masking helpers. The
 * pill's three tiers (calm / warn / urgent) are computed from the real
 * renewal date and coloured from the console tokens (batch 3D). The old
 * notched `OtpMaskToggle` tag had no importer left and was removed then.
 */

// `maskEmail`/`maskPhone`/`maskMac` now live in `@/lib/masking` -- pure
// string helpers with zero imports, moved out because importing one of them
// used to drag this module's `framer-motion` import into the app's entry
// chunk (see that file's own note for the full chain). Re-exported here so
// every existing `from "@/components/features/HeaderControls"` call site
// keeps working unchanged; anything reachable from a route `beforeLoad`
// should import them from `@/lib/masking` directly instead.
export { maskEmail, maskPhone, maskMac } from "@/lib/masking";

/** The OTP-entry dialog the sidebar's Guest Privacy control opens. Purely a controlled
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
  if (daysLeft <= 3) return "urgent";
  if (daysLeft <= RENEWAL_VISIBLE_DAYS) return "warn";
  return "calm";
}

/** The renewal pill is hidden until renewal is this close. */
const RENEWAL_VISIBLE_DAYS = 7;

/** Pill colours per tier, from the console tokens. The pill sits in the
 * indigo top bar, where `.wy-topbar` re-points the text tokens at the chrome
 * palette; the two alarming tiers use the status pair (`-soft` fill, token
 * text), which passes AA on its own fill in both themes, rather than
 * status-coloured text straight on indigo. The gauge bars take
 * `currentColor`, so they always match the label. */
const TIER_STYLE: Record<PlanTier, string> = {
  calm: "border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text-muted)]",
  warn: "border-transparent bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
  urgent: "border-transparent bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]",
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
function RunwayGauge({ filled }: { filled: number }) {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {[5, 7, 9, 11, 13].map((h, i) => (
        <span
          key={h}
          className={`w-[3px] rounded-[1px] transition-colors duration-500 motion-reduce:transition-none ${i < filled ? "bg-current" : "bg-[color-mix(in_srgb,currentColor_25%,transparent)]"}`}
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

  // Only shown once renewal is actually close (or past). A calm "30d left" /
  // "Renews <date>" pill on every page read as filler to venue owners, so
  // outside the last week the header stays quiet.
  if (!statusLabel || daysLeft === null || daysLeft > RENEWAL_VISIBLE_DAYS) return null;

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
      <div
        className={`flex items-center overflow-hidden rounded-full border pl-3 pr-3 ${TIER_STYLE[tier]}`}
      >
        <RunwayGauge filled={filled} />
        <span className="ml-2 text-[11px] font-medium tabular-nums">{statusLabel}</span>
      </div>
    </div>
  );
}
