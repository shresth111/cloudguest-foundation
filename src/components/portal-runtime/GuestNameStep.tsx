import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PG_INPUT, PG_PRIMARY_BTN } from "./PortalGuestUi";
import { PG_FIELD_LABEL } from "./AuthFields";
import {
  cleanGuestName,
  guestDetailsErrorKey,
  guestNameErrorKey,
  isPlausibleGuestEmail,
} from "@/lib/portal-guest-name";

/**
 * NAME REQUIRED AT SIGN-IN -- the one "Your name" screen.
 *
 * Shown by `/portal/success` when the OTP login response said
 * `name_required` (the venue requires a name, this was an OTP sign-in, and
 * the guest has none on file). One field, one button, no skip: the backend
 * refuses to open the network for this session until a name is stored, so a
 * skip would only strand the guest.
 *
 * ORDER IS THE WHOLE POINT. `submit` (the caller's
 * `POST /guest/sign-in-name`) is AWAITED, and only after it resolves does
 * `onDone` run -- which is what lets the success page start the hotspot
 * login / controller authorize. The name is therefore on file before
 * anything asks the backend to open the gate: sequential, never racing the
 * login POST (see the backend's `GuestService.update_guest_profile`
 * docstring for the race this avoids, and why the optional post-connect ask
 * stays post-connect).
 *
 * The owner chose this screen knowing a step between a verified guest and
 * their internet is where some guests give up; it is per-venue and can be
 * switched off. Keep it to this one field.
 *
 * The field is a plain `<input>` rather than the shared `<Input>`: that
 * component's `md:text-sm` would drop it under 16px at tablet width and iOS
 * would zoom on focus -- the same reason `OtpCodeInput` is plain. The inline
 * `fontSize` floor holds even if the stylesheet does not load.
 *
 * EMAIL TWIN (migration 0148). With `askEmail` the same screen also asks
 * for the email the venue requires (`require_guest_email`); with
 * `askName={false}` it asks for the email alone. Exactly the fields the
 * SERVER said are missing are shown -- a returning guest whose name is on
 * file is never asked for it again.
 */
export function GuestNameStep({
  initialName,
  askName = true,
  askEmail = false,
  submit,
  onDone,
}: {
  /** A name already known on this device, if any -- prefill only; the field
   * is still required to be non-empty. */
  initialName?: string;
  /** Show the name field (default true -- the original screen). */
  askName?: boolean;
  /** Show the email field. */
  askEmail?: boolean;
  /** Stores the cleaned details. Rejects with the backend's `AppError`. */
  submit: (displayName: string, email?: string) => Promise<void>;
  /** Runs only after `submit` resolved. */
  onDone: (displayName: string) => void;
}) {
  const { t } = usePortalRuntime();
  const id = useId();
  const inputId = `${id}-name`;
  const hintId = `${id}-name-hint`;
  const errorId = `${id}-name-error`;
  const emailId = `${id}-email`;
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cleaned = cleanGuestName(name);
  const cleanedEmail = email.trim();
  const canSubmit =
    (!askName || cleaned.length > 0) && (!askEmail || cleanedEmail.length > 0) && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // The disabled button does not stop an Enter-key submission, so the
    // empty check lives here too -- never a POST with a blank field.
    if (saving) return;
    if (askName && !cleaned) {
      setError(t("errNameRequired"));
      return;
    }
    if (askEmail && !isPlausibleGuestEmail(cleanedEmail)) {
      setError(t("errEmailRequired"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await submit(cleaned, askEmail ? cleanedEmail : undefined);
    } catch (err) {
      setSaving(false);
      setError(t(askEmail ? guestDetailsErrorKey(err) : guestNameErrorKey(err)));
      return;
    }
    onDone(cleaned);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3" data-testid="guest-name-step">
      <div className="text-center">
        <h1 className="pg-subtitle text-[var(--pg-ink)]">{t("nameStepTitle")}</h1>
        <p id={hintId} className="mt-1 pg-meta text-[var(--pg-ink-muted)]">
          {t(askEmail ? "detailsStepHint" : "nameStepHint")}
        </p>
      </div>
      {askName && (
        <div className="space-y-1.5">
          <Label htmlFor={inputId} className={PG_FIELD_LABEL}>
            {t("yourNameLabel")}
          </Label>
          <input
            id={inputId}
            name="name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="go"
            required
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            maxLength={200}
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            className={`flex w-full border px-3 ${PG_INPUT}`}
            style={{ fontSize: "max(16px, calc(1rem * var(--pg-type-scale, 1)))" }}
          />
        </div>
      )}
      {askEmail && (
        <div className="space-y-1.5">
          <Label htmlFor={emailId} className={PG_FIELD_LABEL}>
            {t("emailAddress")}
          </Label>
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            enterKeyHint="go"
            required
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            maxLength={255}
            autoFocus={!askName}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className={`flex w-full border px-3 ${PG_INPUT}`}
            style={{ fontSize: "max(16px, calc(1rem * var(--pg-type-scale, 1)))" }}
          />
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {error}
        </p>
      )}
      <button type="submit" disabled={!canSubmit} className={PG_PRIMARY_BTN}>
        {saving ? t("savingLabel") : t("nameStepContinue")}
      </button>
    </form>
  );
}
