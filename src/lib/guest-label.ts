/**
 * How a guest is named anywhere in the customer workspace.
 *
 * The backend's guest-session payload (`GuestSessionResponse`) carries
 * `guest_id` but no identifier, so `guestIdentifier` is null on every
 * session row today. Rendering it directly left the "Guest" column -- the
 * first and most important one on both guest tables -- blank on every row.
 *
 * Falling back to a short slice of the guest id gives the owner something
 * stable to recognise and quote to support, and it starts showing the real
 * phone or email automatically if that field is ever joined in.
 */
export function guestLabel(session: { guestIdentifier: string | null; guestId: string }): string {
  return session.guestIdentifier?.trim() || `Guest ${session.guestId.slice(0, 8)}`;
}
