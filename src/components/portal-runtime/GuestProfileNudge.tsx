import { useEffect, useRef, useState } from "react";
import { Check, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner, PG_INPUT, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { PG_FIELD_LABEL } from "@/components/portal-runtime/AuthFields";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { AppError } from "@/services/api";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import {
  PORTAL_SLOW_NOTICE_DELAY_MS,
  PROFILE_SAVE_MAX_RETRIES,
  PROFILE_SAVE_RETRY_DELAY_MS,
  isValidGuestEmail,
} from "@/lib/portal-post-connect";
import type { RuntimeSession } from "@/types/portal-runtime";

/** `guestPortalApi`'s response interceptor already rejects with a real
 * `AppError`, so a rejection from the service layer arrives shaped. This
 * only guards the other case -- a thrown `TypeError` from the network
 * layer itself, which has a `message` that is a debugging string, not a
 * sentence for a guest. Either way `friendlyGuestAuthError`'s localized
 * fallback is what a guest ends up reading unless the backend sent a real
 * reason. */
function asAppError(e: unknown): AppError {
  if (e && typeof e === "object" && "code" in e && "message" in e) return e as AppError;
  return { status: null, code: "network_error", message: "" };
}

/**
 * The optional "name and email" ask, on `/portal/session`, AFTER the guest
 * is online.
 *
 * ⚠ THE LOAD-BEARING DECISION, WHICH NOBODY SHOULD UNDO: this card used to
 * sit *inside* the login funnel, between OTP verification and the hotspot
 * handoff, and was deliberately moved out. Every extra field before the
 * gate costs connections, and a network only 23% of public-WiFi users
 * believe is safe asking for an email *before* it lets them on reads as
 * phishing, not as CRM. By the time this renders, the RADIUS session is
 * authorised and the NAS gate is open -- which is precisely why this card
 * is allowed to be chatty in a way the sign-in card is not. Do not move it
 * back.
 *
 * WHAT CHANGED HERE, and why each one is a defect rather than a polish
 * item:
 *
 * 1. **A failed save was swallowed.** The whole error path was
 *    `catch {}` followed by `finish()`, so a save that never happened
 *    dismissed the card with the identical animation as one that did. The
 *    guest spent twenty seconds typing and was told, wordlessly, that it
 *    worked. Silence is fine for a request the guest did not make; it is
 *    not fine for one they filled in. The card now stays, keeps their
 *    text, and says so -- through the same `AlertBanner` and the same
 *    `friendlyGuestAuthError` as every other guest-facing form, so this
 *    surface cannot drift into its own private error vocabulary.
 * 2. **There was no venue toggle**, so the card showed at every venue,
 *    always, and "what happens when the venue has it switched off" was an
 *    unreachable state. It now reads `collectGuestName`/`collectGuestEmail`
 *    and renders exactly the fields the venue asked for -- or nothing.
 * 3. **No DPDP purpose notice.** An email is a contact channel, and under
 *    DPDP the purpose has to be stated. `Only {venue} sees this.` is
 *    directly under the field, names the venue rather than Wyfy, and is
 *    true: the marketing checkbox is deliberately NOT here, because the
 *    consent model it would write to does not exist yet, and a checkbox
 *    that ticks into /dev/null is a worse compliance position than no
 *    checkbox.
 * 4. **`"Jane Doe"` and `"you@example.com"`** were hardcoded outside `t()`
 *    in a component that renders in ten languages. Deleted rather than
 *    translated -- the labels already carry the meaning.
 * 5. **No email validation**, so the field's entire purpose (a reachable
 *    contact) was unenforced.
 * 6. **The don't-ask-twice flag was `localStorage`**, which THROWS inside
 *    Apple's Captive Network Assistant. Its only job was to stop the card
 *    reappearing after the guest had answered, and inside the CNA it never
 *    did that job: an iPhone guest typed their name, tapped Save, was
 *    bounced back here by the NAS as a brand-new document, and was asked
 *    again. Replaced by `session.hasProfile`, the server bit -- see
 *    `RuntimeSession.hasProfile`. `src/lib/portal-profile-prompt.ts` is
 *    deleted; there is one less Web Storage touch on this surface.
 *
 * Eligibility is NOT decided here. `portal.session.tsx` asks
 * `resolvePostConnectAsk` (src/lib/portal-post-connect.ts) which single
 * card may render, so the one-ask-per-screen rule lives in one readable,
 * testable place instead of being spread across three components.
 */
export function GuestProfileNudge({
  session,
  onResolved,
}: {
  session: RuntimeSession;
  /** Called once the guest has answered or declined and the card is done
   * with its slot. The parent closes the arrival slot for the rest of the
   * page -- it does NOT promote the runner-up ask. */
  onResolved: () => void;
}) {
  const { t, config, setSession, previewMode, demoMode } = usePortalRuntime();
  /** The operator's own Portal Preview and the guest walkthrough both run
   * this real component against a SYNTHETIC session whose ids are the
   * literal strings "preview"/"demo-guest". Two things must not happen on
   * either surface: a write to `POST /guest/profile` (it would 404, or
   * worse land a real row), and a `setSession` (whose persistence would
   * drop a fake guest session into the operator's own browser storage,
   * under the same origin a real portal reads). Same guard, same
   * reasoning, as `CampaignOverlay`'s. */
  const isSimulated = previewMode || demoMode;
  const venueName = config?.name?.trim() || "";

  const collectName = !!config?.collectGuestName;
  const collectEmail = !!config?.collectGuestEmail;

  // An email-OTP guest already typed their email to get online; asking for
  // it again is asking a question we know the answer to. Pre-fill it and
  // let them correct it. (This is also why the old auth-method gate could
  // go: it excluded voucher guests entirely, who are exactly the guests a
  // venue knows least about.)
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() =>
    session.authMethod === "otp_email" && session.identifier.includes("@")
      ? session.identifier
      : "",
  );

  const [emailInvalid, setEmailInvalid] = useState(false);
  /** A partial save landed: the name is stored, the email was rejected by
   * the client-side check and the guest is being given another go at it. */
  const [nameStored, setNameStored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Non-null once the save succeeded: the card is replaced in place by a
   * single confirmation line for 3s, then the stack closes up. */
  const [successLine, setSuccessLine] = useState<string | null>(null);

  const resolvedRef = useRef(false);
  const resolve = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (isSimulated) {
      onResolved();
      return;
    }
    // Mark it on the session we already hold so a same-document
    // re-render/navigation does not ask again before the next login
    // response carries the real server bit. This rides the runtime
    // context's existing, CNA-safe session persistence -- it deliberately
    // does NOT introduce a new storage key of its own.
    setSession({ ...session, hasProfile: true });
    onResolved();
  };

  useEffect(() => {
    if (!successLine) return;
    const id = setTimeout(resolve, 3_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successLine]);

  useEffect(() => {
    if (!saving) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), PORTAL_SLOW_NOTICE_DELAY_MS);
    return () => clearTimeout(id);
  }, [saving]);

  /** `Not now`, the `✕`, and Save-with-both-fields-empty are the same
   * thing: the guest has said no. Record it, collapse, no confirmation, no
   * "are you sure", no replacement content -- the stack simply closes, and
   * the page becomes identical to one at a venue that never turned this
   * on.
   *
   * The write is fire-and-forget on purpose. A decline that fails to
   * record costs one more ask on a later visit; blocking the guest's
   * dismissal on a network round trip costs their patience now. */
  const decline = () => {
    if (isSimulated) {
      resolve();
      return;
    }
    portalRuntimeService
      .updateGuestProfile({
        guestId: session.guestId,
        sessionId: session.sessionId,
        declined: true,
      })
      .catch(() => undefined);
    resolve();
  };

  const postProfile = async (payload: { displayName?: string; email?: string }) => {
    if (isSimulated) return;
    let lastError: unknown;
    for (let attempt = 0; attempt <= PROFILE_SAVE_MAX_RETRIES; attempt++) {
      try {
        await portalRuntimeService.updateGuestProfile({
          guestId: session.guestId,
          sessionId: session.sessionId,
          ...payload,
        });
        return;
      } catch (e) {
        lastError = e;
        const delay = PROFILE_SAVE_RETRY_DELAY_MS[attempt];
        // Two retries with backoff, then stop and tell the guest. NOT
        // forever: the venue would rather have no record than one written
        // four minutes later against a session the guest has left, and a
        // background retry that never surfaces is the silent-failure shape
        // this whole change is removing.
        if (attempt < PROFILE_SAVE_MAX_RETRIES && delay !== undefined) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  };

  const onSave = async () => {
    const trimmedName = collectName && !nameStored ? name.trim() : "";
    const trimmedEmail = collectEmail ? email.trim() : "";

    // Saving with everything empty is a decline, not an error. A guest who
    // taps Save on a blank form has communicated "no", and arguing with
    // them costs more than the record is worth.
    if (!trimmedName && !trimmedEmail && !nameStored) {
      decline();
      return;
    }

    const emailOk = !trimmedEmail || isValidGuestEmail(trimmedEmail);
    setEmailInvalid(!emailOk);
    // Nothing valid left to write -- show the field error and stop. Never
    // a banner for this: the guest can see which field is wrong.
    if (!emailOk && !trimmedName) return;

    setError(null);
    setSaving(true);
    try {
      await postProfile({
        displayName: trimmedName || undefined,
        email: emailOk ? trimmedEmail || undefined : undefined,
      });
      if (!emailOk) {
        // PARTIAL SAVE. The name was good and is now stored; the email was
        // not. Keep the card open on the email field rather than
        // discarding the good value to punish the bad one -- that is the
        // difference between the venue getting 60% of a record and 0%.
        setNameStored(true);
        setSaving(false);
        return;
      }
      const saved = trimmedName || name.trim();
      setSuccessLine(
        saved ? t("profileSavedTemplate").replace("{name}", saved) : t("profileSaved"),
      );
    } catch (e) {
      // THE POINT OF THIS COMPONENT'S REWRITE. The card stays, the fields
      // keep their content -- never make someone retype their own name --
      // and the guest is told, in their own language, that this failed and
      // that their internet is fine.
      setError(friendlyGuestAuthError(asAppError(e), "profile", t("profileSaveFailed")));
    } finally {
      setSaving(false);
    }
  };

  // The venue collects nothing: no card, no gap, no placeholder. The stack
  // closes up. (The parent's `resolvePostConnectAsk` already enforces this;
  // repeated here so the component is safe to mount from anywhere -- e.g.
  // the dashboard's Connected preview.)
  if (!collectName && !collectEmail) return null;

  if (successLine) {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 pg-meta text-[var(--pg-ink-muted)]"
      >
        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        {successLine}
      </p>
    );
  }

  const title = collectName ? t("profileNudgeTitle") : t("profileNudgeTitleEmail");
  const saveLabel = nameStored ? t("profileSaveEmailCta") : t("profileSaveCta");

  return (
    <PortalCard className="relative space-y-3">
      {/* 44x44, not the previous ~24px `p-1` target in the hardest corner
          to reach with a thumb. The glyph stays 16px. */}
      <button
        type="button"
        onClick={decline}
        aria-label={t("dismissCardLabel")}
        className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full text-[var(--pg-ink-faint)] hover:bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_6%,var(--pg-surface,#fff))] hover:text-[var(--pg-ink-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 pr-11">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="pg-body font-semibold text-[var(--pg-ink)]">{title}</p>
          <p className="pg-meta font-normal text-[var(--pg-ink-muted)]">
            {t("profileNudgeSubtitle")}
          </p>
        </div>
      </div>

      {collectName && (
        <div>
          <label className={PG_FIELD_LABEL} htmlFor="pg-profile-name">
            {t("nameLabel")}
          </label>
          {/* No placeholder. See this component's docstring, item 4. */}
          <Input
            id="pg-profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving || nameStored}
            autoComplete="name"
            className={PG_INPUT}
          />
        </div>
      )}

      {collectEmail && (
        <div>
          <label className={PG_FIELD_LABEL} htmlFor="pg-profile-email">
            {t("emailAddress")}
          </label>
          <Input
            id="pg-profile-email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailInvalid) setEmailInvalid(false);
            }}
            // On blur AND on submit -- the blur check is what stops a guest
            // discovering the typo only after tapping the button.
            onBlur={() => setEmailInvalid(!!email.trim() && !isValidGuestEmail(email))}
            disabled={saving}
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={emailInvalid || undefined}
            aria-describedby={emailInvalid ? "pg-profile-email-error" : "pg-profile-email-purpose"}
            className={PG_INPUT}
            style={emailInvalid ? { borderColor: "var(--pg-danger-border, #FECACA)" } : undefined}
          />
          {emailInvalid ? (
            <p
              id="pg-profile-email-error"
              className="mt-1 pg-meta"
              style={{ color: "var(--pg-danger, #DC2626)" }}
            >
              {t("profileEmailInvalid")}
            </p>
          ) : (
            // The DPDP purpose notice. Names the VENUE, not Wyfy -- the
            // venue is the Data Fiduciary here. Rendered only when the
            // venue has a name to put in it rather than showing the raw
            // "{venue}" placeholder to a guest.
            venueName && (
              <p id="pg-profile-email-purpose" className="mt-1 pg-micro text-[var(--pg-ink-faint)]">
                {t("profileEmailPurpose").replace("{venue}", venueName)}
              </p>
            )
          )}
        </div>
      )}

      <AlertBanner message={error} />

      <button type="button" onClick={onSave} disabled={saving} className={PG_PRIMARY_BTN}>
        {saving ? t("savingLabel") : error ? t("profileRetryCta") : saveLabel}
      </button>

      {/* "Still saving -- your internet is working." The second clause is
          the important one: a guest watching a spinner on a captive portal
          assumes the WiFi failed, and it did not. */}
      {slow && (
        <p className="text-center pg-meta text-[var(--pg-ink-muted)]">{t("profileSlowSaving")}</p>
      )}

      {/* The primary decline: full width, under the thumb, labelled, and at
          least 44px tall. The one a hurried guest will actually hit. Never
          blocked by validation, and live even while a save is in flight. */}
      <button
        type="button"
        onClick={decline}
        className="min-h-[44px] w-full rounded-xl pg-meta font-medium text-[var(--pg-ink-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_5%,var(--pg-surface,#fff))] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15"
      >
        {t("profileSkipCta")}
      </button>
    </PortalCard>
  );
}
