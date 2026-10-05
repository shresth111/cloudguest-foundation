/**
 * Presentation-only helpers for a guest row on the customer dashboard: which
 * device glyph to draw and what to put in the avatar. Both read ONLY what the
 * row already shows -- the device label (`deviceLabelFrom` in
 * customer.service, or a demo label like "MacBook Pro") and the guest label
 * as rendered -- so they can never reveal more than the row itself does.
 */

import { UNIDENTIFIED_GUEST_LABEL } from "@/lib/guest-identity";

export type DeviceKind = "phone" | "tablet" | "laptop" | "desktop" | "unknown";

/** Maps a device label to a glyph kind. Unrecognised labels (including the
 * honest "Unknown device") are `unknown`, never a guess. */
export function deviceKind(label: string | null | undefined): DeviceKind {
  const s = (label ?? "").toLowerCase();
  if (!s || s.includes("unknown")) return "unknown";
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/iphone|android|phone|pixel|galaxy/.test(s)) return "phone";
  if (/\bmac\b|macbook|laptop|chromebook/.test(s)) return "laptop";
  if (/windows|\bpc\b|linux|desktop/.test(s)) return "desktop";
  return "unknown";
}

/**
 * Up to two initials for a guest that has a real name on file ("Asha Rao" ->
 * "AR"), or null. A label carrying a digit or an "@" is a phone number or an
 * email -- masked or not -- and gets a neutral person glyph instead: an
 * avatar must never re-derive (or hint at) characters of a contact detail.
 */
export function guestAvatarInitials(label: string | null | undefined): string | null {
  const s = (label ?? "").trim();
  if (!s || /[\d@*•]/.test(s)) return null;
  // Placeholders, not names: "UG" for "Unknown guest" would read as a person.
  if (s === UNIDENTIFIED_GUEST_LABEL || /^(unknown\b|guest$)/i.test(s)) return null;
  const words = s.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return null;
  // An all-X token is a masking pattern, not a name.
  if (words.every((w) => /^x+$/i.test(w) && w.length > 2)) return null;
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
