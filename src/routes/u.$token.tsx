import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MailX, AlertTriangle } from "lucide-react";
import { guestPortalApi } from "@/services/guest-portal-api";
import { requestErrorOf } from "@/services/api";

/**
 * Public unsubscribe page -- `{marketing_unsubscribe_base_url}/u/{token}`,
 * the link carried by every marketing SMS, WhatsApp message and email
 * (wyfy-specs/guest-marketing-campaigns.md §5.7).
 *
 * No auth, no customer shell, no portal runtime: the person here is a guest
 * who tapped a link in a message, on whatever network they happen to be on.
 * Uses `guestPortalApi` -- the unauthenticated client with no token, no
 * organization header and no 401 -> "session expired" redirect -- because
 * none of those mean anything for a guest holding a one-time token.
 *
 * HONEST STATES ONLY. The page says "unsubscribed" after the POST returned
 * 2xx, or when the GET itself reports the address is already unsubscribed
 * -- never on the click. The endpoint is not entitlement-gated on the
 * backend: honouring an opt-out is a legal duty whatever the venue's
 * billing state.
 */
export const Route = createFileRoute("/u/$token")({
  ssr: false,
  component: UnsubscribePage,
});

interface UnsubscribeInfo {
  venue_name: string;
  channel: "sms" | "whatsapp" | "email";
  masked_address: string;
  status: "subscribed" | "unsubscribed";
}

const CHANNEL_LABEL: Record<UnsubscribeInfo["channel"], string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "email",
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; info: UnsubscribeInfo }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

function describeError(err: unknown): string {
  const e = requestErrorOf(err);
  if (e?.status === 429) {
    const retry = e.data?.retry_after_seconds;
    return typeof retry === "number"
      ? `Too many attempts from this network. Please try again in ${Math.ceil(retry / 60)} minute(s).`
      : "Too many attempts from this network. Please try again in a minute.";
  }
  if (e?.code === "network_error")
    return "We couldn't reach the server. Check your connection and try again.";
  return "Something went wrong on our side. Please try again in a moment.";
}

function isInvalidToken(err: unknown): boolean {
  const e = requestErrorOf(err);
  return e?.status === 404 || e?.data?.error_code === "invalid_token";
}

function UnsubscribePage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    guestPortalApi
      .get<UnsubscribeInfo>(`/public/marketing/unsubscribe/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        if (!cancelled) setState({ kind: "ready", info: data });
      })
      .catch((err) => {
        if (cancelled) return;
        setState(
          isInvalidToken(err)
            ? { kind: "invalid" }
            : { kind: "error", message: describeError(err) },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  const unsubscribe = async () => {
    if (state.kind !== "ready") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data } = await guestPortalApi.post<{ status: "unsubscribed" }>(
        `/public/marketing/unsubscribe/${encodeURIComponent(token)}`,
        {},
      );
      // Only the server's own answer flips the page.
      if (data?.status === "unsubscribed") {
        setState({ kind: "ready", info: { ...state.info, status: "unsubscribed" } });
      } else {
        setSubmitError("We couldn't confirm the unsubscribe. Please try again.");
      }
    } catch (err) {
      if (isInvalidToken(err)) setState({ kind: "invalid" });
      else setSubmitError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-[#f5f4ff] px-4 py-10 text-[#1e1b4b] sm:items-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src="/brand/mark-primary-blue.svg" alt="" className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight">Wyfy Guest</span>
        </div>
        <section className="rounded-2xl border border-[#e4e1fb] bg-white p-6 shadow-sm">
          {state.kind === "loading" && (
            <div
              className="flex items-center justify-center gap-2 py-8 text-sm text-[#5b5886]"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking your link…
            </div>
          )}

          {state.kind === "invalid" && (
            <div className="space-y-2 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
              <h1 className="text-lg font-semibold">This link isn't valid</h1>
              <p className="text-sm text-[#5b5886]">
                It may have been copied incompletely. Open the unsubscribe link from the message you
                received again, or reply to the venue and ask them to stop messaging you.
              </p>
            </div>
          )}

          {state.kind === "error" && (
            <div className="space-y-3 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" aria-hidden />
              <h1 className="text-lg font-semibold">We couldn't load this page</h1>
              <p className="text-sm text-[#5b5886]">{state.message}</p>
              <button
                type="button"
                onClick={() => setReload((n) => n + 1)}
                className="min-h-[44px] rounded-xl border border-[#d9d5f7] px-4 text-sm font-medium hover:bg-[#f5f4ff]"
              >
                Try again
              </button>
            </div>
          )}

          {state.kind === "ready" && state.info.status === "unsubscribed" && (
            <div className="space-y-2 text-center" role="status">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" aria-hidden />
              <h1 className="text-lg font-semibold">You're unsubscribed</h1>
              <p className="text-sm text-[#5b5886]">
                {state.info.venue_name} won't send offers by {CHANNEL_LABEL[state.info.channel]} to{" "}
                <span className="font-medium text-[#1e1b4b]">{state.info.masked_address}</span> any
                more.
              </p>
            </div>
          )}

          {state.kind === "ready" && state.info.status === "subscribed" && (
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <MailX className="mx-auto h-9 w-9 text-[#6c4eff]" aria-hidden />
                <h1 className="text-lg font-semibold">Stop offers from {state.info.venue_name}?</h1>
                <p className="text-sm text-[#5b5886]">
                  You'll stop receiving {CHANNEL_LABEL[state.info.channel]} offers at{" "}
                  <span className="font-medium text-[#1e1b4b]">{state.info.masked_address}</span>.
                  This does not affect your WiFi access.
                </p>
              </div>
              {submitError && (
                <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {submitError}
                </p>
              )}
              <button
                type="button"
                onClick={() => void unsubscribe()}
                disabled={submitting}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#6c4eff] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting ? "Unsubscribing…" : "Unsubscribe"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
