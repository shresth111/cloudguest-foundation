/**
 * "This layout ended the session on purpose" -- shared by the `/partner` route
 * guard (outside React) and `PartnerLayout`.
 *
 * When a signed-in account turns out not to be an ISP partner account (or its
 * ISP is suspended), the layout signs it out and explains why. logout() flips
 * the auth status to anonymous, and the root re-runs every `beforeLoad`; the
 * `/partner` guard would then redirect to sign-in and the explanation would
 * never be seen (measured on the test box 2026-10-23). While this flag is set
 * the guard leaves the page where it is; reaching a public page clears it.
 */
let ended = false;

export function markPartnerSessionEnded(): void {
  ended = true;
}

export function clearPartnerSessionEnded(): void {
  ended = false;
}

export function partnerSessionEnded(): boolean {
  return ended;
}
