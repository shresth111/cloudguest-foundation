import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PG_INPUT } from "./PortalGuestUi";

/**
 * v4 §6.8: the real fields a guest fills in (phone/country-code, email,
 * a 6-digit code) used to be hand-authored twice -- once inline in
 * `GuestSignInCard.tsx` (the real primary path almost every guest takes)
 * and once in `AuthMethodForms.tsx` (the legacy per-method deep-link
 * pages, kept for bookmarks). §3.2/§3.8 of the UX audit are direct
 * symptoms of that split (the two disagreed on resend-cooldown
 * behavior because they were two separate implementations of "the same
 * form"). These are the shared, single-implementation pieces both now
 * render -- not a new visual, the exact same markup/classes each side
 * already used, just written once.
 *
 * captive-portal-v7-design-spec.md §7.2 -- the labelling failure. Until
 * this pass, every input in this file shipped with no `<label>`, no
 * `aria-label` and no `autocomplete`: a placeholder was the only visible
 * naming, and the OTP field (a visually transparent `<input>` behind six
 * decorative `<div>` slots) had no accessible name at all. That is SC
 * 1.3.1, 1.3.5, 3.3.2 and 4.1.2, and in practice it means a guest using a
 * screen reader reaches an unnamed text field and cannot complete sign-in
 * at all -- total task failure, not degraded comfort.
 *
 * The fix is deliberately shaped so the label cannot drift away from the
 * control again: the visible label is rendered *by these components*, from
 * a `label` prop, wired to a `useId()`-generated `htmlFor`/`id` pair.
 * Callers used to hand-author a floating `<label>`/`<Label>` above the
 * field with no `htmlFor` -- which is exactly how three separate call
 * sites ended up with a label element that named nothing, and how the
 * two-input phone row ended up ambiguous even for a sighted guest.
 */

/** Shared visual treatment for the field labels, reproducing exactly the
 * `text-xs font-semibold text-slate-500` (12px/600) the call sites
 * previously hand-authored -- moved here so the label and the control it
 * names are one unit. Two deliberate differences:
 *
 * - The colour is a token (`--pg-ink-muted`, now 7.58:1 on --pg-surface)
 *   rather than `text-slate-500` (#64748B, 4.76:1 -- which per v7 Part 9-4
 *   passes only at >=16px, and these labels are 12px).
 * - The size is `text-[length:...]` folding in `--pg-type-scale` (v7 §7.3)
 *   rather than a `pg-*` utility. `<Label>`'s own cva base carries
 *   `text-sm`, and tailwind-merge can only displace that with something it
 *   recognises as a font-size -- a custom utility class silently loses,
 *   which is exactly the bug the first cut of this branch shipped (labels
 *   rendering at 14px and ignoring the text-size control entirely). */
export const PG_FIELD_LABEL =
  "block text-[length:calc(0.75rem*var(--pg-type-scale,1))] font-semibold text-[var(--pg-ink-muted)]";

export function PhoneNumberFields({
  countryCode,
  onCountryCodeChange,
  phone,
  onPhoneChange,
  countryCodeName,
  phoneName,
  label,
  autoFocus,
}: {
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  /** Passed through as `name`/registered via `react-hook-form` when a
   * caller (AuthMethodForms.tsx) drives this field with `register(...)`
   * instead of controlled `value`/`onChange` -- both callers still render
   * the identical DOM/classes either way. */
  countryCodeName?: string;
  phoneName?: string;
  /** The visible name for the phone-number field, already translated by
   * the caller (it varies by OTP channel: "Mobile number" vs "WhatsApp
   * number"). Required -- a caller cannot render this control without
   * naming it, which is the point. */
  label: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const { t } = usePortalRuntime();
  const countryCodeId = `${id}-cc`;
  const phoneId = `${id}-phone`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={phoneId} className={PG_FIELD_LABEL}>
        {label}
      </Label>
      <div className="grid grid-cols-[84px_1fr] gap-2">
        {/* Visually hidden rather than visible: the country-code box sits
         * directly left of the number box in a two-column row that has one
         * shared visible label, and stacking a second visible label above
         * only that 84px column would be a redesign of this row. `sr-only`
         * (a real, focusable-order-preserving <label>) is the correct tool
         * here -- never a bare `aria-label`, which would silently replace
         * the accessible name for voice-control users who say what they
         * see, and which cannot be found by an automated label/placeholder
         * mismatch check. */}
        <Label htmlFor={countryCodeId} className="sr-only">
          {t("countryCodeLabel")}
        </Label>
        <Input
          id={countryCodeId}
          name={countryCodeName}
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          type="tel"
          inputMode="tel"
          // `tel-country-code`/`tel-national`, not a single `tel` on each
          // box: `tel` means "the whole number", and putting it on two
          // adjacent fields tells the user agent to autofill the same full
          // number into both. The split tokens are what the HTML standard
          // defines for exactly this two-box arrangement.
          autoComplete="tel-country-code"
          className={PG_INPUT}
        />
        <Input
          id={phoneId}
          name={phoneName}
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          // Still a placeholder -- but now an *example*, sitting alongside
          // a real label, rather than the only naming the field has (v7
          // §7.4-4: "a placeholder is not a label").
          placeholder="555 010 2200"
          className={PG_INPUT}
        />
      </div>
    </div>
  );
}

export function EmailField({
  email,
  onEmailChange,
  name,
  label,
  autoFocus,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  name?: string;
  /** See `PhoneNumberFields.label`. */
  label: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const emailId = `${id}-email`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={emailId} className={PG_FIELD_LABEL}>
        {label}
      </Label>
      <Input
        id={emailId}
        name={name}
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus={autoFocus}
        placeholder="you@example.com"
        className={PG_INPUT}
      />
    </div>
  );
}

/** The shared 6-digit OTP slot styling -- `GuestSignInCard`'s inline
 * verify step and `/portal/verify`'s deep-linkable one now render the
 * identical slot markup instead of two independently hand-tuned copies
 * (the deep-link page's used to also carry a stray `font-display`
 * class the inline one never had).
 *
 * v7 §7.2, two separate obligations, both previously met by accident or
 * not at all:
 *
 * 1. **Accessible name.** `input-otp` renders one real `<input>`, made
 *    visually transparent, behind six decorative `<div>` slots. It had no
 *    name of any kind, so the entire verify step was an unlabelled text
 *    box. It now carries a `<Label htmlFor>` plus `aria-describedby`
 *    pointing at a short "6-digit code" hint, and the six slots are marked
 *    `aria-hidden` because they are a picture of the value, not the value.
 *
 * 2. **SC 3.3.8 Accessible Authentication (Minimum), Level AA.** W3C is
 *    explicit that requiring a user to manually transcribe a verification
 *    code is non-conforming; the user agent must at minimum be able to
 *    autofill it. Today that works only because the `input-otp` dependency
 *    happens to default `autoComplete` to `"one-time-code"`
 *    (`autoComplete: a.autoComplete || "one-time-code"` in its dist
 *    bundle). An AA obligation on the critical path should not be living
 *    inside a third-party default, so `autoComplete` is a **required prop
 *    typed to the literal `"one-time-code"`** -- deleting it, or swapping
 *    in a hand-rolled OTP control that forgets it, is now a type error at
 *    every call site rather than a silent conformance regression.
 *    `scripts/check-a11y-invariants.mjs` asserts the same thing against
 *    the emitted markup path for the case where the component itself is
 *    replaced.
 */
export function OtpCodeInput({
  value,
  onChange,
  autoFocus,
  className,
  autoComplete,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  className?: string;
  /** Required, and required to be exactly this value -- see (2) above. */
  autoComplete: "one-time-code";
  /** Visible name for the code field. Optional only so that a caller
   * already rendering its own heading immediately above the field can pass
   * `label={false}`-style visually-hidden naming; the accessible name is
   * never optional. */
  label?: string;
}) {
  const id = useId();
  const { t } = usePortalRuntime();
  const inputId = `${id}-otp`;
  const hintId = `${id}-otp-hint`;
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <Label htmlFor={inputId} className="sr-only">
        {label ?? t("otpCodeLabel")}
      </Label>
      <span id={hintId} className="sr-only">
        {t("otpCodeHint")}
      </span>
      <InputOTP
        id={inputId}
        maxLength={6}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        aria-describedby={hintId}
        containerClassName="justify-center"
      >
        <InputOTPGroup className="gap-2 sm:gap-2.5" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot
              key={i}
              index={i}
              // v7 §7.3: `h-14 w-11` -> min-height/min-width + padding, so
              // a scaled-up digit expands the slot instead of clipping
              // inside it on Android WebView. Same 56x44 at a 16px root.
              className="h-auto min-h-14 w-auto min-w-11 rounded-2xl border-slate-200 bg-white px-1.5 py-2 text-xl font-semibold tabular-nums text-slate-900 shadow-none transition-[border-color,box-shadow] duration-150 first:rounded-2xl last:rounded-2xl"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
