/** COMMS-2b: the manual invoice email's sender choice (BE
 * `GET /isp/finance/email-senders`, `comms2b_router.py`). The choice is shown
 * only when the backend reports more than one sender (the ISP has its own
 * verified SMTP/SES sender besides the platform default). */

export type EmailSenderKey = "platform" | "own";

export interface EmailSenders {
  senders: { key: EmailSenderKey; label: string; provider_type?: string }[];
  choice_available: boolean;
}

export interface EmailInvoiceResult {
  queued: string[];
  sent?: string[];
  failed?: string[];
  sender?: EmailSenderKey;
}

/** Show the picker only with a real choice; anything else stays hidden. */
export function showSenderChoice(data: EmailSenders | undefined | null): boolean {
  return Boolean(data?.choice_available && (data?.senders?.length ?? 0) > 1);
}

/** The sender to send with: the picked one if it is still offered, else the
 * platform default (never "own" when the backend did not list it). */
export function effectiveSender(
  picked: EmailSenderKey,
  data: EmailSenders | undefined | null,
): EmailSenderKey {
  if (!showSenderChoice(data)) return "platform";
  return data!.senders.some((s) => s.key === picked) ? picked : "platform";
}

export function emailResultMessage(r: EmailInvoiceResult): { ok: boolean; text: string } {
  if (r.sender === "own") {
    const sent = r.sent ?? [];
    const failed = r.failed ?? [];
    if (!failed.length) return { ok: true, text: `Invoice sent to ${sent.join(", ")}.` };
    if (!sent.length)
      return { ok: false, text: `Your sender could not deliver to ${failed.join(", ")}.` };
    return {
      ok: false,
      text: `Sent to ${sent.join(", ")}; failed for ${failed.join(", ")}.`,
    };
  }
  return { ok: true, text: `Invoice emailed to ${r.queued.join(", ")}.` };
}
