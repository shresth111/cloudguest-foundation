import { useId, type CSSProperties, type ClipboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { normalizeNationalPhone, nationalNumberMaxLength } from "@/lib/portal-locale";
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
 *
 * captive-portal-v7-design-spec.md Part 8 then changed the *shape* of two
 * of these fields, not just their labelling: the OTP field is now one
 * `<input>` rather than `input-otp`'s six slots (§8.1, see
 * `OtpCodeInput`), and the phone row is one input behind a fixed,
 * non-editable dialling-code prefix rather than two editable boxes (§8.1,
 * see `PhoneNumberFields`). Both changes are downstream of §0.2: this
 * portal runs inside a browser that cannot be inspected, so every piece of
 * focus choreography and every extra field is a bug that can only ever be
 * reported second-hand, from a hotel lobby, by a guest with no internet.
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
  dialCode,
  phone,
  onPhoneChange,
  phoneName,
  label,
  hint,
  autoFocus,
}: {
  /** The venue's own dialling code, already derived from real config by
   * `defaultCountryCode(config.defaultLanguage, config.locationCountry)`.
   * Rendered as a fixed, non-editable prefix -- never an editable box and
   * never a dropdown. */
  dialCode: string;
  phone: string;
  onPhoneChange: (v: string) => void;
  /** Passed through as `name` when a caller drives this field inside a
   * real `<form>`. */
  phoneName?: string;
  /** The visible name for the phone-number field, already translated by
   * the caller (it varies by OTP channel: "Mobile number" vs "WhatsApp
   * number"). Required -- a caller cannot render this control without
   * naming it, which is the point. */
  label: string;
  /** v7 §8.3-2: one plain sentence, next to the field, saying why the
   * number is being asked for. On a network the guest already suspects
   * (only 23% believe public WiFi is safe, while 51% use it more than five
   * times a month), an unexplained data request is read as evidence of a
   * scam, so the stated reason is a trust control, not a nicety. */
  hint?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const phoneId = `${id}-phone`;
  const prefixId = `${id}-prefix`;
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={phoneId} className={PG_FIELD_LABEL}>
        {label}
      </Label>
      {/* v7 §8.1: one input behind a fixed prefix, replacing the old
       * `grid-cols-[84px_1fr]` row of two editable boxes.
       *
       * The country-code box was a freeform text input a guest could
       * (and, per the incident reports behind §6.3, did) edit into
       * something that could not receive an SMS, sitting immediately left
       * of the field it was most likely to be confused with. Deleting it
       * removes a whole input from the critical path, removes the
       * `tel-country-code`/`tel-national` autofill split, and removes the
       * only field on this screen with no plausible correct value other
       * than the one already known from config.
       *
       * The prefix is a `<span>`, not a `disabled`/`readOnly` input: a
       * disabled input is skipped by the tab order and is not submitted,
       * a readonly one is still focusable and still reads as "a thing you
       * might be able to change". This is neither -- it is a label for the
       * box beside it, and it is wired as one via `aria-describedby`, so
       * a screen-reader guest hears "Mobile number, edit text, plus 91"
       * rather than reaching an unexplained ten-digit field. */}
      <div className="flex items-stretch gap-2">
        <span
          id={prefixId}
          className="inline-flex min-h-[3rem] shrink-0 select-none items-center rounded-2xl border border-[var(--pg-border,#E2E8F0)] bg-[color-mix(in_srgb,var(--pg-ink,#0F172A)_4%,var(--pg-surface,#fff))] px-3 text-[length:calc(1rem*var(--pg-type-scale,1))] font-semibold tabular-nums text-[var(--pg-ink,#0F172A)]"
        >
          {dialCode}
        </span>
        <Input
          id={phoneId}
          name={phoneName}
          value={phone}
          // Normalised on every change, not only on submit, so a pasted
          // "+91 98765 43210" visibly becomes the ten digits this field
          // actually wants instead of silently failing validation later.
          onChange={(e) => onPhoneChange(normalizeNationalPhone(e.target.value, dialCode))}
          // Identical `maxLength`-eats-the-paste problem as the OTP field
          // (see `pasteText`), and worse here: a guest pasting "+91 98765
          // 43210" into a 10-bounded box has 16 characters cut to 10 before
          // anything can strip the prefix, leaving five digits of a real
          // number and an OTP sent nowhere.
          onPaste={(e) =>
            pasteText(e, (raw) =>
              onPhoneChange(
                normalizeNationalPhone(raw, dialCode).slice(0, nationalNumberMaxLength(dialCode)),
              ),
            )
          }
          type="tel"
          // v7 §8.1: `inputmode="numeric"`, not `tel`. The `tel` keypad on
          // Android carries `+ * #` keys that have no meaning in a field
          // whose country code is already fixed and whose contents are
          // stripped to digits anyway.
          inputMode="numeric"
          pattern="[0-9]*"
          // Still `tel-national` -- the HTML standard's own token for "the
          // number without the country code", which is exactly what this
          // box now holds. `tel` would mean the whole number and would
          // autofill a value including a country code the prefix already
          // supplies.
          autoComplete="tel-national"
          maxLength={nationalNumberMaxLength(dialCode)}
          dir="ltr"
          autoFocus={autoFocus}
          aria-describedby={hint ? `${prefixId} ${hintId}` : prefixId}
          // An example, alongside a real label -- never the naming itself
          // (v7 §7.4-4: "a placeholder is not a label").
          placeholder={dialCode === "+91" ? "98765 43210" : "555 010 2200"}
          className={PG_INPUT}
        />
      </div>
      {hint && (
        <p id={hintId} className="pg-meta text-[var(--pg-ink-muted,#475569)]">
          {hint}
        </p>
      )}
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

/** The metrics that give one plain `<input>` the six-box *look* with zero
 * JS (v7 §8.1: "render a single `<input>` with `letter-spacing` and a
 * repeating dash background. One input, six-box aesthetic, zero JS").
 *
 * One "cell" is a digit's own advance (`1ch` -- by definition the advance
 * of the `0` glyph in the used font) plus the `letter-spacing` that
 * follows it, so six cells is exactly the width of a rendered six-digit
 * code. The dashes come from a `repeating-linear-gradient` on the same
 * cell pitch, which is why they land under the digits rather than near
 * them. `box-sizing: content-box` is load-bearing: it is what makes
 * `width` mean *six cells of text* rather than six cells minus the
 * padding and border.
 *
 * Verified in a real browser at 1x and at `--pg-type-scale: 1.25`, with
 * the real `PG_FONT_STACK` resolved (`-apple-system`), empty / partial /
 * full values. If a future font ships genuinely proportional digits the
 * dashes drift; `font-variant-numeric: tabular-nums` is set to keep the
 * digits themselves on the cell pitch, and the failure mode is cosmetic
 * drift on a decorative background, never a broken input.
 */
/**
 * **A correction to v7 §8.1.** That section's own example markup carries
 * `maxlength="6"`, and taken literally it breaks the single thing the
 * whole single-box change exists to deliver.
 *
 * `maxlength` is applied by the user agent to the *raw* pasted string
 * before any script sees it. So on a field whose value is later stripped
 * to digits, a guest pasting the code exactly as it arrives:
 *
 *     "123 456"                 -> truncated to "123 45" -> 12345
 *     "Your Wyfy code is 123456" -> truncated to "Your W" -> (empty)
 *
 * Confirmed in a real Chromium, not reasoned about --
 * `scripts/test-portal-signin-fields.mjs` asserts both cases and both failed
 * before this handler existed. And "copy the whole line out of the SMS"
 * is not an edge case; it is what a guest holding a phone in one hand
 * actually does.
 *
 * `maxlength` is kept, because it is a real typing bound and a real hint
 * to the user agent about the shape of the field, and the paste path is
 * handled explicitly instead: read `clipboardData` directly, pull the
 * digits out, and set the value ourselves. This is the *only* piece of JS
 * in the new control, and it replaces `input-otp`'s entire per-slot focus
 * choreography (§8.1) -- one handler with no focus management in it at
 * all, which is the distinction that matters in a browser that cannot be
 * debugged (§0.2).
 *
 * Falls through to the browser's own default when there is no
 * `clipboardData` to read (older WebViews, some automation), so the worst
 * case is the pre-existing truncating behaviour, never a dead paste.
 */
function pasteText(
  e: ClipboardEvent<HTMLInputElement>,
  /** Receives the *raw* clipboard text, punctuation and all. Deliberately
   * not pre-stripped to digits here: the phone field's own normaliser has
   * to be able to tell an explicitly-written `+91` (strippable) from a
   * bare leading `91` (a real Indian number's first two digits), and that
   * distinction is destroyed the moment the `+` is discarded. */
  apply: (raw: string) => void,
) {
  const text = e.clipboardData?.getData("text");
  if (!text) return;
  e.preventDefault();
  apply(text);
}

const OTP_GAP = "0.5em";
const OTP_CELL = `calc(1ch + ${OTP_GAP})`;
const OTP_PAD_X = "0.875rem";
const OTP_PAD_Y = "0.75rem";

const OTP_INPUT_STYLE: CSSProperties = {
  boxSizing: "content-box",
  // v7 §8.2: every input >= 16px or iOS auto-zooms on focus and destroys
  // the layout. 20px here (the same size the six decorative slots used to
  // render their digits at, so this is not a visual change), and folded
  // through `--pg-type-scale` per §7.3 so the portal's text-size control
  // reaches it -- an absolute px size does not.
  fontSize: "calc(1.25rem * var(--pg-type-scale, 1))",
  fontWeight: 600,
  // Form controls do not inherit `font-family` from the page. Without
  // this the field silently renders in the UA's own default (Arial in
  // Chromium -- confirmed), which is both off-brand and a different `1ch`
  // than everything else on the card was measured against.
  fontFamily: "inherit",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: OTP_GAP,
  textAlign: "left",
  width: `calc(6 * ${OTP_CELL})`,
  paddingLeft: OTP_PAD_X,
  paddingRight: OTP_PAD_X,
  // The box height is padding + line-height, both relative, rather than a
  // `min-height`: the dashes are positioned from the bottom edge, so any
  // height the text does not account for (a `min-height` taller than the
  // content, which is what a fixed `3.5rem` was) opens a gap between the
  // digits and the dashes that grows with `--pg-type-scale`. Expressed
  // this way the whole control scales as one piece, which is also what
  // v7 §7.3 asks for on Android WebView's text zoom. 0.75rem + 1.5em is
  // 54px at the default scale -- above the 44px touch floor on its own.
  paddingTop: OTP_PAD_Y,
  paddingBottom: OTP_PAD_Y,
  lineHeight: 1.5,
  backgroundImage: `repeating-linear-gradient(to right, var(--pg-border, #E2E8F0) 0, var(--pg-border, #E2E8F0) 1ch, transparent 1ch, transparent ${OTP_CELL})`,
  // One gap narrower than the text box, so the run of dashes ends under
  // the sixth digit instead of trailing an orphaned seventh gap.
  backgroundSize: `calc(6 * ${OTP_CELL} - ${OTP_GAP}) 2px`,
  // Sits just under the digits, not at the bottom of the box: with
  // `line-height: 1.5` the half-leading puts the digits' own baseline
  // 0.25em above the content box's lower edge, so the dashes ride
  // `padding + 0.02em` up from the border box and stay there at any type
  // scale, because both terms are relative.
  backgroundPosition: `left ${OTP_PAD_X} bottom calc(${OTP_PAD_Y} + 0.02em)`,
  backgroundRepeat: "no-repeat",
};

const OTP_INPUT_CLASS =
  "h-auto rounded-2xl border border-[var(--pg-border,#E2E8F0)] bg-[var(--pg-surface,#fff)] text-[var(--pg-ink,#0F172A)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--pg-ink-faint,#505E73)] focus-visible:border-[var(--pr-primary,#6366f1)] focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15";

/** The 6-digit OTP field -- **one** `<input>`, not six.
 *
 * captive-portal-v7-design-spec.md §8.1. This used to render `input-otp`'s
 * `InputOTP`/`InputOTPGroup`/`InputOTPSlot`: one visually-transparent real
 * `<input>` sitting behind six decorative `<div>` slots. GOV.UK's Design
 * System is explicit that a code the user has not memorised belongs in a
 * single box, and in *this* browser the segmented version is specifically
 * a liability -- it breaks paste, it breaks `autocomplete="one-time-code"`
 * autofill in restricted webviews, it fragments the accessible name, and
 * every slot is another focus-management bug in a runtime that cannot be
 * inspected in Web Inspector at all (§0.2). The six-box *aesthetic*
 * survives via `OTP_INPUT_STYLE` above; the six-box *markup* does not.
 *
 * Three obligations this component owns, all of which survived the
 * rewrite and none of which may be dropped:
 *
 * 1. **Accessible name (SC 1.3.1/3.3.2/4.1.2).** A real `<Label htmlFor>`
 *    plus `aria-describedby` pointing at a short "6-digit code" hint. A
 *    placeholder is not a label.
 *
 * 2. **SC 3.3.8 Accessible Authentication (Minimum), Level AA.** W3C is
 *    explicit that requiring a user to manually transcribe a verification
 *    code is non-conforming; the user agent must at minimum be able to
 *    autofill it, and the user must be able to paste. Before v7 this
 *    passed only because the `input-otp` dependency happened to default
 *    `autoComplete` to `"one-time-code"` -- a fragile place for an AA
 *    obligation on the critical path to live. `autoComplete` is therefore
 *    a **required prop typed to the literal `"one-time-code"`**: deleting
 *    it, or hand-rolling a replacement that forgets it, is a `tsc` error
 *    at every call site, not a silent conformance regression. Now that
 *    the dependency is gone from this path that type is the *only* thing
 *    holding the attribute in place, so it matters more than it did.
 *    `scripts/check-a11y-invariants.mjs` covers the case the type system
 *    cannot see (this component itself being replaced), and
 *    `scripts/test-portal-signin-fields.mjs` proves the attribute and a real
 *    six-digit paste both reach a real DOM.
 *
 * 3. **>= 16px font-size (v7 §8.2).** Under that, iOS zooms the page on
 *    focus and the layout is destroyed -- on the one screen where the
 *    guest is copying digits between two apps.
 *
 * Note `autoComplete="one-time-code"` only fires when the SMS contains the
 * word "code", and there is a known reproducible iOS WebView bug where the
 * first autofill succeeds and later attempts offer "Passwords" instead
 * (§8.1). This is designed for autofill never firing: typing and pasting
 * are both first-class, autofill is a bonus.
 */
export function OtpCodeInput({
  value,
  onChange,
  autoFocus,
  className,
  autoComplete,
  label,
  name,
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
  name?: string;
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
      {/* A plain `<input>`, not the shared `<Input>`: that component's base
       * class carries `h-9`, `text-base` *and* `md:text-sm`, and the last
       * of those would drop this field to 14px at >= 768px -- straight back
       * under §8.2's 16px floor at exactly the width the admin Portal
       * Preview renders it. There is nothing here for `<Input>` to
       * contribute anyway; every visual is OTP-specific. */}
      <input
        id={inputId}
        name={name}
        type="text"
        // `inputMode`, not `type="number"`: a number input brings spinners,
        // silently drops a leading zero, and lets a guest scroll-wheel the
        // value. `pattern` is what makes older iOS show the numeric keypad.
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        maxLength={6}
        // A code is always LTR even when the portal is in Arabic -- and the
        // dash background is positioned from the left edge, so an RTL
        // reflow here would put the digits and the dashes on opposite
        // sides of the box.
        dir="ltr"
        value={value}
        // The whole point of one box: a paste of "123456", "123 456" or
        // "Your code is 123456" all land as six digits, with no per-slot
        // focus choreography to get wrong. `slice` bounds it independently
        // of `maxLength`, which browsers apply inconsistently to pastes.
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        // See `pasteText` -- without this, `maxLength` silently eats the
        // paste this whole control exists to support (SC 3.3.8, AA).
        onPaste={(e) => pasteText(e, (raw) => onChange(raw.replace(/\D/g, "").slice(0, 6)))}
        autoFocus={autoFocus}
        aria-describedby={hintId}
        className={OTP_INPUT_CLASS}
        style={OTP_INPUT_STYLE}
      />
    </div>
  );
}
