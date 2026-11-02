/**
 * Which guest a typed phone number or email refers to, in Fix a Problem.
 *
 * The guest search is a substring match, so its rows need narrowing. Comparing
 * digits alone is wrong for an email: two addresses with no digits both reduce
 * to "", so the first row would answer for someone else entirely.
 */
import { maskEmail, maskPhone } from "@/lib/masking";

export interface LookupGuest {
  identifier: string;
  email?: string | null;
}

const digitsOf = (value: string) => value.replace(/\D/g, "");

export const looksLikeEmail = (value: string) => value.includes("@");

export function findGuestByIdentifier<T extends LookupGuest>(rows: T[], input: string): T | null {
  const typed = input.trim();
  let exact: T | undefined;
  if (looksLikeEmail(typed)) {
    const wanted = typed.toLowerCase();
    exact = rows.find(
      (g) =>
        g.identifier.trim().toLowerCase() === wanted || g.email?.trim().toLowerCase() === wanted,
    );
  } else {
    const wanted = digitsOf(typed);
    exact = wanted ? rows.find((g) => digitsOf(g.identifier) === wanted) : undefined;
  }
  return exact ?? (rows.length === 1 ? rows[0] : null);
}

/** An email identifier must not fall through `maskPhone`, which only hides digits. */
export function maskGuestIdentifier(identifier: string): string {
  return looksLikeEmail(identifier) ? maskEmail(identifier) : maskPhone(identifier);
}
