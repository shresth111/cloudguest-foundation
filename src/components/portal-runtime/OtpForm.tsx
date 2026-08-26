import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { AlertBanner, PG_PRIMARY_BTN, SecurityTip } from "./PortalGuestUi";
import { PhoneNumberFields, EmailField, OtpCodeInput } from "./AuthFields";
import type { UseGuestSignInReturn } from "./useGuestSignIn";

/**
 * The OTP tab's two real screens (phone/email entry -> 6-digit code) --
 * presentational only, all state/mutations come from `useGuestSignIn()`.
 * Split out of `GuestSignInCard.tsx` per v4 §6 (Component structure).
 *
 * v4 UX §6.2: the terms checkbox now lives on *this* first screen (same
 * as the password tab always had it), not the code-entry screen -- a
 * guest never discovers a blocking requirement only after already
 * waiting for and typing a code.
 *
 * captive-portal-v7-design-spec.md §8.2 asks for "two screens, not one --
 * phone -> 'Get code', then OTP -> connected. Each a real page with a real
 * POST." **The two screens ship; the two documents deliberately do not**,
 * and the reasoning is §0.2's, not a style preference:
 *
 * - What §8.2 is actually protecting is the *authorization* step: "full
 *   navigation is how the CNA learns it can close." That step is
 *   `portal.success.tsx`, which builds a real `<form>` and calls
 *   `form.submit()` -- a genuine top-level document POST to the NAS's
 *   `link-login-only` URL. It is untouched by this pass and must stay that
 *   way. Neither "send me a code" nor "here is my code" authorizes
 *   anything, so neither one is a moment the CNA can learn anything from.
 *
 * - Carrying the guest's number across a real document load needs it to
 *   live *somewhere*. Web Storage throws in the CNA (§0.2), so the only
 *   remaining place is the URL -- putting a guest's phone number into a
 *   URL that a NAS, a proxy and a router log all see. That is a privacy
 *   regression, and per §8.4 a DPDP-relevant one, in exchange for nothing.
 *
 * - This is not hypothetical: `/portal/verify`, the older deep-linkable
 *   "real page" version of exactly this step, reads `otpTarget` from
 *   `PortalRuntimeContext`, which is a plain `useState` with no
 *   persistence at all. Reached by a real document navigation it would
 *   find `otpTarget` undefined and bounce the guest straight back to
 *   `/portal/auth`. The spec's own preferred shape is the one that is
 *   already broken under its own §0.2 constraint.
 *
 * What the guest gets is what §8.2 is describing: one thing on screen at a
 * time, a real `<form>` per step so the phone keyboard's "Go" key submits
 * it, and an honest "Step 1 of 2" / "Step 2 of 2". What they do not get is
 * a second full SPA boot inside a websheet with a folklore ~128 KB initial
 * HTML budget, to move between two steps that neither open nor close the
 * NAS gate.
 */
export function OtpForm(sign: UseGuestSignInReturn) {
  const { t } = usePortalRuntime();
  const dataConsentId = useId();

  // Consent is now implied by continuing -- no checkbox to tick, matching
  // the reference design's "By clicking Continue, you agree to..." pattern.
  // Same legal text/link as before (reused verbatim, not retranslated), now
  // a plain non-interactive statement below the submit button rather than
  // an opt-in row above it.
  const TermsNotice = (
    <p className="text-center text-[13px] leading-snug text-[var(--pg-ink-muted)]">
      {t("agreeToThe")}{" "}
      {sign.requiresTermsLink ? (
        <Link
          to="/portal/terms"
          search={sign.portalSearch}
          className="font-medium text-[var(--pr-primary,#6366f1)] underline underline-offset-2 hover:opacity-80"
        >
          {t("termsAcceptableUsePolicy")}
        </Link>
      ) : (
        <span className="font-medium text-[var(--pg-ink)]">{t("termsAcceptableUsePolicy")}</span>
      )}
    </p>
  );

  // DPDP Act 2023 §6: a real, unticked-by-default, actively-tapped
  // checkbox -- distinct from `TermsNotice` above, which stays implied
  // consent (that one is contract acceptance, not personal-data consent;
  // see `dataConsentAccepted`'s own doc comment in PortalRuntimeContext
  // for why the two are legally different questions that only look
  // similar). Only ever shown here, on the phone/email entry screen: this
  // is the one moment this identifier is actually collected and
  // transmitted, and the DPDP standard for consent -- "free, specific,
  // informed, unconditional, unambiguous, given through clear affirmative
  // action" -- explicitly rejects inferring it from a bundled "continue"
  // tap. `PasswordSignInForm` never repeats this: reaching that tab at all
  // already requires this exact consent to have been given once, back
  // when this device first went through OTP (see `useGuestSignIn`'s
  // `showTabs`), and DPDP asks for consent per purpose, not per login.
  // Shortened from a single long descriptive sentence to a tight label
  // plus a link out to this same page's own Privacy policy card, which
  // already carries the full "what/why/who/how long" detail -- direct
  // feedback that the original wording was the longest line on an
  // already text-dense screen. The `Link` is a SIBLING of the `<label>`,
  // not nested inside it: a native `<label>` forwards any click inside
  // it to its associated control, and a nested `<a>` has no spec-level
  // exemption from that the way a nested checkbox/radio does -- putting
  // the link inside the label risks a tap meant only to open the detail
  // page also toggling the checkbox. Kept as a real `htmlFor`/`id` pair
  // rather than wrapping, so tapping the descriptive text still toggles
  // the box exactly as before.
  // Direct follow-up feedback, two fixes together:
  //  - Alignment: this row was `items-start` with no `justify-center`,
  //    so the checkbox sat flush at the container's LEFT edge while
  //    `TermsNotice` right below/above it is `text-center` -- two
  //    disclosures in the same tight cluster with different horizontal
  //    anchors read as misaligned even though each was internally
  //    correct. `justify-center` centers the checkbox+text as one
  //    block, matching the Terms line's own centering, while the text
  //    inside that block stays left-set (centering multi-line text next
  //    to a checkbox, rather than the block itself, is what actually
  //    looks broken once it wraps).
  //  - Size: `text-[12px]`, one step below `TermsNotice`'s `text-[13px]`
  //    -- the longer, more detailed DPDP disclosure reads as secondary
  //    to the shorter contract-acceptance line, not competing with it at
  //    equal weight. The checkbox itself keeps its own fixed size
  //    (Checkbox's default, ~16px) -- a tap target shouldn't shrink with
  //    the text next to it.
  const DataConsentCheckbox = (
    <div className="flex items-start justify-center gap-2 text-[12px] leading-snug text-[var(--pg-ink-muted)]">
      <Checkbox
        id={dataConsentId}
        checked={sign.dataConsentAccepted}
        onCheckedChange={(v) => sign.setDataConsentAccepted(!!v)}
        className="mt-0.5 shrink-0 border-[var(--pg-ink-faint)] data-[state=checked]:border-[var(--pr-primary,#6366f1)] data-[state=checked]:bg-[var(--pr-primary,#6366f1)]"
      />
      <span>
        <label htmlFor={dataConsentId} className="cursor-pointer">
          {t("dataConsentLabel")}
        </label>{" "}
        <Link
          to="/portal/terms"
          search={sign.portalSearch}
          className="font-medium text-[var(--pr-primary,#6366f1)] underline underline-offset-2 hover:opacity-80"
        >
          {t("dataConsentLearnMore")}
        </Link>
      </span>
    </div>
  );

  const StepProgress = ({ n }: { n: 1 | 2 }) => (
    // v7 §8.2: "show progress honestly". Two steps, named as two steps --
    // not a progress bar, which would have to invent a completion
    // percentage for a flow whose second step is bounded by how fast an
    // SMS arrives. A small pill, not a bare line of gray text sitting
    // directly above the field's own label -- direct feedback that two
    // stacked plain-text lines (this, then "Email address"/"Mobile
    // number") read as unfinished. Direct follow-up feedback: the first
    // pass's full-saturation brand-accent fill/text and `font-semibold`
    // pulled more visual weight than a step indicator should have next
    // to plain gray surrounding text -- toned down to a neutral hairline
    // pill (same family as the "Guest network" pill's own border-only
    // treatment) with muted text at regular weight, still legible as a
    // status chip without out-competing the content around it.
    <span className="inline-flex w-fit items-center rounded-full border border-[var(--pg-border)] bg-[var(--pg-surface)] px-2.5 py-1 pg-meta font-medium text-[var(--pg-ink-muted)]">
      {t("stepProgressTemplate").replace("{n}", String(n)).replace("{total}", "2")}
    </span>
  );

  if (sign.phase === "phone") {
    return (
      // A real <form>, not a bare <div> with an onClick button: on a phone
      // keyboard the "Go"/"Done" key only submits a form, and until now it
      // did nothing at all here -- a guest who typed their number and
      // pressed Go got silence, on the first interaction of the flow.
      // `onSubmit`/`preventDefault` keeps this an in-page mutation, which
      // is correct for a step that authorizes nothing (see this file's own
      // docstring on why only the final NAS POST is a real navigation).
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          sign.onSendOtp();
        }}
        className="space-y-3"
      >
        <StepProgress n={1} />
        {/* v7 §7.2: this used to be a floating `<label>` with no `htmlFor`
         * sitting above a two-input row -- an element that named nothing,
         * for either a screen reader or a sighted guest trying to work out
         * which of the two boxes it belonged to. The name is now passed
         * into the field component, which owns the `htmlFor`/`id` pairing
         * so the two cannot drift apart again. */}
        {sign.otpChannel !== "email" ? (
          <PhoneNumberFields
            label={sign.otpChannel === "whatsapp" ? t("whatsappNumberLabel") : t("mobileNumber")}
            // v7 §8.3-2: say why, in one plain sentence, next to the
            // field. Deliberately a statement of what happens to the
            // number ("we send your code here") rather than a promise
            // about what it is not used for -- the identifier is also this
            // guest's RADIUS username and their stored identity on this
            // platform, so "we only use this to..." would be a claim this
            // codebase cannot honour.
            hint={sign.otpChannel === "whatsapp" ? t("whyWeAskWhatsapp") : t("whyWeAskMobile")}
            dialCode={sign.dialCode}
            phone={sign.phone}
            onPhoneChange={sign.setPhone}
          />
        ) : (
          <EmailField label={t("emailAddress")} email={sign.email} onEmailChange={sign.setEmail} />
        )}
        {/* Both disclosures as one tightly-grouped fine-print cluster,
         * `space-y-2` (tighter than this form's own `space-y-3`) rather
         * than sitting on opposite sides of the button: direct feedback
         * that the checkbox above the button and this sentence below it
         * read as the button being sandwiched between two separate legal
         * asides, adding to an already text-heavy screen. Grouping them
         * -- both read before the tap, matching how informed consent is
         * supposed to work -- leaves the button as the last, cleanest
         * thing before it. */}
        <div className="space-y-2">
          {DataConsentCheckbox}
          {TermsNotice}
        </div>
        <AlertBanner message={sign.otpError} />
        <button type="submit" disabled={sign.sendOtpPending} className={PG_PRIMARY_BTN}>
          {sign.sendOtpPending ? t("sendingLabel") : t("sendOtp")}
        </button>
        <SecurityTip />
      </form>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        sign.onVerifyOtp();
      }}
      className="space-y-3"
    >
      <StepProgress n={2} />
      <p className="text-center text-sm text-[var(--pg-ink-muted)]">
        {t("sentCodeToPrefix")}{" "}
        <span className="font-semibold text-[var(--pg-ink)]">{sign.target}</span>
      </p>
      {/* v7 §7.2: `autoComplete` is a required, literal-typed prop -- SC
       * 3.3.8 (AA) is not left resting on the `input-otp` dependency's
       * internal default. */}
      <OtpCodeInput
        value={sign.code}
        onChange={sign.setCode}
        autoFocus
        autoComplete="one-time-code"
      />
      <AlertBanner message={sign.otpError} />
      <button
        type="submit"
        disabled={sign.code.length !== 6 || sign.verifyOtpPending}
        className={PG_PRIMARY_BTN}
      >
        {sign.verifyOtpPending ? t("verifyingLabel") : t("verifyOtpConnect")}
      </button>
      <div className="flex items-center justify-center gap-3 pt-0.5 text-xs">
        {sign.resendCooldown > 0 ? (
          <span className="text-[var(--pg-ink-faint)]">
            {t("resendAvailableInTemplate").replace("{n}", String(sign.resendCooldown))}
          </span>
        ) : (
          <button
            type="button"
            onClick={sign.onResendOtp}
            disabled={sign.sendOtpPending}
            className="font-medium text-[var(--pr-primary,#6366f1)] hover:underline"
          >
            {t("resend")}
          </button>
        )}
        <span aria-hidden="true" className="text-[var(--pg-border)]">
          |
        </span>
        <button
          type="button"
          onClick={sign.onChangeNumber}
          className="font-medium text-[var(--pg-ink-muted)] hover:text-[var(--pg-ink)] hover:underline"
        >
          {t("changeNumberLabel")}
        </button>
      </div>
      <SecurityTip />
    </form>
  );
}
