import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Check,
  Lock,
  Mail,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ticketService } from "@/services/ticket.service";
import { requestErrorMessage } from "@/services/api";
import type { SupportTicket } from "@/types/support-ticket";

/** The subject the request ticket is filed under (spec §8.2). Also how an
 * existing request is recognised, so it is one constant, not two strings. */
export const MARKETING_REQUEST_SUBJECT = "Enable Marketing add-on";

const requestKey = ["marketing", "addon-request-ticket"] as const;

function openRequest(tickets: SupportTicket[]): SupportTicket | null {
  return (
    tickets.find(
      (t) =>
        t.subject.trim().toLowerCase() === MARKETING_REQUEST_SUBJECT.toLowerCase() &&
        (t.status === "open" || t.status === "in_progress"),
    ) ?? null
  );
}

/**
 * The locked state (spec §8.2, D5): the add-on exists, this organisation
 * does not have it, and every marketing route answers 402.
 *
 * It says what Marketing does and how to get it -- and nothing else. No
 * preview data, no sample campaign, no "try it" that unlocks nothing. The
 * one action is a real support ticket through the same create call the
 * Support Tickets screen uses; "Request sent" appears only after the
 * backend returned the ticket, and an already-open request is shown as
 * pending rather than filed twice.
 */
export function MarketingLockedUpsell({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("marketing", { i18n });
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: requestKey,
    queryFn: async () =>
      openRequest(await ticketService.list({ search: MARKETING_REQUEST_SUBJECT })),
    staleTime: 60_000,
    retry: false,
  });

  const request = useMutation({
    mutationFn: () =>
      ticketService.create({
        locationId,
        subject: MARKETING_REQUEST_SUBJECT,
        description:
          "Please enable the Marketing add-on (WhatsApp, SMS and email campaigns to opted-in WiFi guests) for our organisation.",
        category: "billing",
        priority: "medium",
      }),
    onSuccess: (ticket) => {
      qc.setQueryData(requestKey, ticket);
      toast.success(`Request sent: ticket #${ticket.id.slice(0, 8)}`);
    },
    onError: (err) => {
      toast.error(requestErrorMessage(err, "Couldn't send the request. Try again."));
    },
  });

  const pending = existing.data ?? null;

  const points = [
    { icon: MessageCircle, text: "WhatsApp offers and invitations" },
    { icon: MessageSquareText, text: "SMS campaigns on a registered sender" },
    { icon: Mail, text: "Email newsletters with your venue's name" },
    {
      icon: ShieldCheck,
      text: "Only guests who opt in on your WiFi page can be messaged, and every message carries an unsubscribe link",
    },
  ];

  return (
    <Card className="premium-card overflow-hidden">
      <CardContent className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
            <Lock className="h-3 w-3" aria-hidden />
            {t("locked.badge", "Add-on")}
          </span>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("locked.title", "Marketing is an add-on")}
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {t(
              "locked.body",
              "Reach guests who opted in on your WiFi login page with WhatsApp, SMS and email offers. It is not part of your current plan.",
            )}
          </p>
          <ul className="space-y-2">
            {points.map((p) => (
              <li key={p.text} className="flex items-start gap-2.5 text-sm">
                <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t(
              "locked.request",
              "Ask your Wyfy Guest account manager to turn it on for your organisation.",
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 md:w-60">
          {pending ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <Clock className="h-4 w-4 text-amber-600" aria-hidden />
                Request pending
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ticket #{pending.id.slice(0, 8)} is open. We'll update it when the add-on is
                enabled.
              </p>
              <Link
                to="/tickets"
                className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                View in Support Tickets
              </Link>
            </div>
          ) : request.isSuccess ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                Request sent
              </p>
            </div>
          ) : (
            <Button
              onClick={() => request.mutate()}
              disabled={request.isPending || existing.isLoading}
            >
              {request.isPending ? "Sending request…" : "Request Marketing add-on"}
            </Button>
          )}
          {existing.isError && !pending && (
            <p className="text-[11px] text-muted-foreground">
              Couldn't check for an earlier request. Sending one now files a new ticket.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** 402 `license_not_active`: the whole licence lapsed, not just this add-on.
 * No tabs -- every marketing call would answer the same 402. The customer
 * dashboard has no licence screen of its own, so the way forward it offers
 * is Support Tickets. */
export function MarketingLicenceLapsed() {
  const { t } = useTranslation("marketing", { i18n });
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t(
          "locked.lapsed",
          "Your Wyfy Guest licence is not active, so Marketing is unavailable until it is renewed.",
        )}
      </span>
      <Link to="/tickets" className="shrink-0 font-medium underline-offset-4 hover:underline">
        Contact support
      </Link>
    </div>
  );
}
