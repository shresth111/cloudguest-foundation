/**
 * `GET /guest/session/active` can answer with an opaque `hotspot_username`.
 * The portal posts it to the router in place of the guest's phone or email,
 * so it may sit in `guestIdentifier`, but it is not a person's identity and
 * must never pre-fill a sign-in form or be sent as one.
 */
const RESUME_USERNAME = /^wr1-[0-9a-f]{32}-[0-9a-f]{16}$/;

export function isResumeUsername(value: string | null | undefined): boolean {
  return RESUME_USERNAME.test(value?.trim() ?? "");
}

/** The identifier, or `undefined` when all we hold is a resume alias. */
export function realGuestIdentifier(value: string | null | undefined): string | undefined {
  return value && !isResumeUsername(value) ? value : undefined;
}
