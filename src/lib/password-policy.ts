import { z } from "zod";

/**
 * Mirrors `app.domains.auth.password.PasswordManager.validate_strength` on the
 * backend -- the exact hasher/policy the API enforces (Argon2id, 12-128 chars,
 * upper + lower + digit + special).
 *
 * This exists in one place because it has already drifted once: the reset
 * password page checked only the length, so a 12-character password with no
 * digit or symbol passed the form and came back from the server as a bare 400
 * the page could not explain field-by-field. The server is still the real
 * source of truth -- a password that somehow slips past this just surfaces the
 * server's own message -- but a form should not knowingly submit something the
 * API is guaranteed to reject.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Human-readable form of the same rules, for showing next to a password field. */
export const PASSWORD_RULES = [
  `Between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
  "At least one uppercase letter",
  "At least one lowercase letter",
  "At least one digit",
  "At least one special character (!@#$%^&*-_=+)",
] as const;

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `At most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/\d/, "At least one digit")
  .regex(/[!@#$%^&*\-_=+]/, "At least one special character (!@#$%^&*-_=+)");
