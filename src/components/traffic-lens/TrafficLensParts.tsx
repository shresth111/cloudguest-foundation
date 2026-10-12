import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  onInk = false,
}: {
  subject: string;
  description: string;
  label: string;
  /** On the dark answer slab: light text, and a light button. */
  onInk?: boolean;
}) {
  const { existing, request } = useSupportRequest(subject);
  const pending = existing.data ?? null;
  const box = onInk
    ? "rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white"
    : "rounded-xl border border-border bg-muted/40 p-4 text-sm";
  const quiet = onInk ? "text-white/70" : "text-muted-foreground";
  if (pending)
    return (
      <div className={box}>
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="h-4 w-4 text-amber-500" aria-hidden />
          Request pending
        </p>
        <p className={`mt-1 text-xs ${quiet}`}>
          Ticket #{pending.id.slice(0, 8)} is open. We'll update it there.
        </p>
        <Link
          to="/tickets"
          className={`mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline ${onInk ? "text-white" : "text-primary"}`}
        >
          View in Support Tickets
        </Link>
      </div>
    );
  if (request.isSuccess)
    return (
      <div className={box}>
        <p className="flex items-center gap-1.5 font-medium">
          <Check className="h-4 w-4 text-emerald-500" aria-hidden />
          Request sent
        </p>
      </div>
    );
  return (
    <div className="space-y-2">
      <Button
        size={onInk ? "lg" : "default"}
        className={onInk ? "bg-white text-black hover:bg-white/90" : undefined}
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
        <p className={`text-[11px] ${quiet}`}>
          Couldn't check for an earlier request. Sending one now files a new ticket.
        </p>
      )}
    </div>
  );
}

/** A state with nothing to draw: one large plain sentence on a dashed
 * outline. Never a row of zeros. `tone="warning"` is the "no data since"
 * notice that sits above figures which are still shown. */
export function NoticeCard({
  notice,
  tone,
  action,
}: {
  notice: LensNotice;
  tone?: "warning";
  action?: ReactNode;
}) {
  if (tone === "warning")
    return (
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{notice.body}</p>
        </div>
        {notice.ask ? <SwitchOnAsk /> : action}
      </div>
    );
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 rounded-3xl border-2 border-dashed border-border px-6 py-10 sm:px-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {notice.title}
        </p>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{notice.body}</p>
      </div>
      {notice.ask ? <SwitchOnAsk /> : action}
    </div>
  );
}

function SwitchOnAsk() {
  return (
    <AskWyfy
      subject={LENS_SWITCH_ON_SUBJECT}
      description={`Please switch on ${TRAFFIC_LENS_NAME} for this venue, or check why it has stopped reporting.`}
      label="Ask Wyfy support"
    />
  );
}

/** A titled block of the page. The title is the question it answers. */
export function Panel({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="premium-card rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
          {note && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{note}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

/** A full-width share bar. The figure is always printed beside it by the
 * caller, so the number never depends on reading the bar. */
export function RankBar({ width, color }: { width: number; color?: string | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${width}%`, background: color ?? "var(--primary)" }}
      />
    </div>
  );
}

export function Footnotes({ notes }: { notes: (string | null | undefined)[] }) {
  const shown = notes.filter((n): n is string => !!n);
  if (shown.length === 0) return null;
  return (
    <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
      {shown.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}
