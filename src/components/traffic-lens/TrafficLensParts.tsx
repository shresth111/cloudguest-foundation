import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Callout, PANEL_SURFACE } from "@/components/customer/console";
import { useSupportRequest } from "@/hooks/useMarketing";
import { requestErrorMessage } from "@/services/api";
import {
  LENS_SWITCH_ON_SUBJECT,
  TRAFFIC_LENS_NAME,
  type LensNotice,
} from "@/lib/traffic-lens-customer";

/**
 * Small pieces the Traffic Lens customer page is built from. Presentation
 * only: none of them fetches traffic figures or decides what a number means.
 */

/** Files one real support ticket, through the same call Support Tickets
 * uses. "Request sent" shows only after the ticket came back; an open
 * request shows as pending and is never filed twice. */
export function AskWyfy({
  subject,
  description,
  label,
}: {
  subject: string;
  description: string;
  label: string;
}) {
  const { existing, request } = useSupportRequest(subject);
  const pending = existing.data ?? null;
  const box =
    "rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-3 text-[13px] text-[var(--wy-text)]";
  if (pending)
    return (
      <div className={box}>
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="h-4 w-4 text-[var(--wy-warn)]" aria-hidden />
          Request pending
        </p>
        <p className="mt-1 text-xs text-[var(--wy-text-muted)]">
          Ticket #{pending.id.slice(0, 8)} is open. We'll update it there.
        </p>
        <Link
          to="/tickets"
          className="mt-2 inline-block rounded-sm text-xs font-medium text-[var(--wy-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
        >
          View in Support Tickets
        </Link>
      </div>
    );
  if (request.isSuccess)
    return (
      <div className={box}>
        <p className="flex items-center gap-1.5 font-medium">
          <Check className="h-4 w-4 text-[var(--wy-ok)]" aria-hidden />
          Request sent
        </p>
      </div>
    );
  return (
    <div className="space-y-2">
      <Button
        disabled={request.isPending || existing.isLoading}
        onClick={() =>
          request.mutate(description, {
            onSuccess: (ticket) => toast.success(`Request sent: ticket #${ticket.id.slice(0, 8)}`),
            onError: (err) =>
              toast.error(requestErrorMessage(err, "Couldn't send the request. Try again.")),
          })
        }
      >
        {request.isPending ? "Sending request…" : label}
      </Button>
      {existing.isError && (
        <p className="text-[11px] text-[var(--wy-text-muted)]">
          Couldn't check for an earlier request. Sending one now files a new ticket.
        </p>
      )}
    </div>
  );
}

/** A state with nothing to draw: one plain sentence in a console panel.
 * Never a row of zeros. `tone="warning"` is the "no data since" notice that
 * sits above figures which are still shown: a warn Callout. */
export function NoticeCard({
  notice,
  tone,
  action,
}: {
  notice: LensNotice;
  tone?: "warning";
  action?: ReactNode;
}) {
  const resolve = notice.ask ? <AskAboutVenue /> : action;
  if (tone === "warning")
    return (
      <Callout tone="warn" title={notice.title} action={resolve}>
        <p className="text-[var(--wy-text-muted)]">{notice.body}</p>
      </Callout>
    );
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-5 border-dashed px-5 py-8 sm:px-8 sm:py-10 ${PANEL_SURFACE}`}
    >
      <div className="max-w-2xl">
        <p className="text-base font-semibold leading-snug text-[var(--wy-text)]">{notice.title}</p>
        <p className="mt-1.5 text-[13px] text-[var(--wy-text-muted)]">{notice.body}</p>
      </div>
      {resolve}
    </div>
  );
}

function AskAboutVenue() {
  return (
    <AskWyfy
      subject={LENS_SWITCH_ON_SUBJECT}
      description={`Please switch on ${TRAFFIC_LENS_NAME} for this venue, or check why it has stopped reporting.`}
      label="Ask Wyfy support"
    />
  );
}
