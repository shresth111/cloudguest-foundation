/**
 * PII redaction helpers, extracted verbatim out of
 * `src/components/features/HeaderControls.tsx` (which still re-exports them,
 * so every existing call site is unchanged).
 *
 * They are pure string functions with no dependencies at all, but they used
 * to live in a module whose top level does `import { motion } from
 * "framer-motion"`. `src/hooks/useCustomerDashboard.ts` imports `maskPhone`
 * from there; `src/lib/customerLocationGuard.ts` imports `customerKeys` from
 * `useCustomerDashboard`; and roughly a dozen route files call that guard
 * from their `beforeLoad`. A route's `beforeLoad` has to run *before* its
 * lazy component chunk is fetched, so TanStack Router's code-splitter leaves
 * it (and everything it statically imports) in the route's registration
 * module -- which `routeTree.gen.ts` pulls into the entry chunk that every
 * route downloads, guest captive portal included.
 *
 * Net effect: a four-hop chain from `beforeLoad` to one 8-line string
 * function was putting the whole of framer-motion (~121KB raw / ~39KB gzip
 * of `motion-dom` + `framer-motion` + `motion-utils`) into the bytes every
 * guest downloads on a pre-authentication captive-portal path. Living here,
 * in a module with no imports whatsoever, that chain terminates immediately.
 */

/** Redacts an email's local part, e.g. "john.doe@email.com" -> "jo••••••@email.com". */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  return `${email.slice(0, 2)}${"•".repeat(Math.max(3, at - 2))}${email.slice(at)}`;
}

/** Redacts a phone number's digits, keeping the leading country code/first
 * two digits and the trailing three visible (e.g. "+91 98765 43210" ->
 * "+91 9•••• ••210"), same "some structure survives, PII doesn't" shape as
 * `maskEmail` above. Operates on digit *positions* only so any existing
 * formatting (spaces, dashes, the leading "+") passes through untouched
 * rather than being collapsed into the mask. Numbers too short to usefully
 * redact (<=5 digits) are returned as-is. */
export function maskPhone(phone: string): string {
  const digitIndexes: number[] = [];
  for (let i = 0; i < phone.length; i++) {
    if (phone[i] >= "0" && phone[i] <= "9") digitIndexes.push(i);
  }
  if (digitIndexes.length <= 5) return phone;
  const toMask = new Set(digitIndexes.slice(2, digitIndexes.length - 3));
  return phone
    .split("")
    .map((ch, i) => (toMask.has(i) ? "•" : ch))
    .join("");
}

/** No-op by explicit product decision -- MAC addresses are shown
 * unmasked everywhere (customers need the real address to identify a
 * device for support). Mirrors the backend's own ``mask_mac`` (see
 * ``app/common/masking.py``), which is the actual source of truth for
 * this: several endpoints (connected-devices, mac-authorization, guest
 * session/device schemas) already send the real, unmasked value, so this
 * function stays a real passthrough rather than being deleted, in case
 * any call site still relies on it existing. */
export function maskMac(mac: string): string {
  return mac;
}
