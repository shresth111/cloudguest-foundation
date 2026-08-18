import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/redirect")({
  component: RedirectPage,
});

/** `destinationUrl` is `dst` straight off this route's own URL (RouterOS's
 * `$(link-orig)`, see src/routes/portal.tsx's `searchSchema.dst` doc
 * comment) -- an unauthenticated visitor can put anything there, no login
 * or real router redirect required to reach this page (this route has no
 * session gate of its own, by design -- see the file's own history). Below,
 * `url` gets assigned straight to `window.location.href` and to an anchor's
 * `href`, both real navigation sinks: a `javascript:`-scheme value there
 * runs script in this page's own origin on click, and `window.location.href
 * = "javascript:..."` runs it with NO click at all, straight off this page's
 * own 5-second auto-redirect timer. `config?.redirectUrl` (an org's own
 * configured post-login destination) is admin-entered free text with no
 * scheme validation of its own either, so the same check applies to it too.
 * Restricting to http/https before either sink ever sees it is the fix --
 * not a broader sanitizer, since a real `link-orig`/`redirectUrl` is always
 * meant to be an ordinary web destination anyway. */
function isSafeRedirectTarget(candidate: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(candidate, window.location.origin).protocol);
  } catch {
    return false;
  }
}

/**
 * Reached right after a real login when the guest had an actual
 * pre-hotspot destination (RouterOS's `$(link-orig)`, or the location's
 * own configured `redirectUrl`) -- a real, live post-login path, not a
 * hypothetical one. Previously still the old dark shell (see
 * portal.terms.tsx's own comment on the same class of leftover page) --
 * same light shell/card/button language as the rest of the redesigned
 * flow now, so a guest going success -> redirect never sees the visual
 * seam this used to have.
 */
function RedirectPage() {
  const { config, t, destinationUrl } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/redirect" });
  const [remaining, setRemaining] = useState(5);
  const rawUrl = destinationUrl || config?.redirectUrl;
  const url = rawUrl && isSafeRedirectTarget(rawUrl) ? rawUrl : undefined;

  useEffect(() => {
    if (!url) {
      navigate({ to: "/portal/success", replace: true, search: (prev) => prev });
    }
  }, [url, navigate]);

  useEffect(() => {
    if (!url || remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [url, remaining]);

  useEffect(() => {
    if (url && remaining <= 0) {
      window.location.href = url;
    }
  }, [url, remaining]);

  if (!url) return null;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/25"
            style={{
              background:
                "linear-gradient(135deg, var(--pr-primary, #6366f1), var(--pr-accent, #4f46e5))",
            }}
          >
            <ExternalLink className="h-7 w-7" />
          </div>
          <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("redirecting")}</h1>
          <p className="mt-1.5 break-all text-sm text-slate-500">
            You'll be sent to <span className="font-medium text-slate-700">{url}</span> shortly.
          </p>
        </div>
        <PortalCard className="text-center">
          <p className="text-4xl font-bold tabular-nums text-[var(--pg-ink)]">{remaining}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">seconds</p>
        </PortalCard>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--pr-primary,#6366f1)] to-[var(--pr-accent,#4f46e5)] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)] transition-all duration-200 hover:brightness-105 active:translate-y-px"
        >
          Continue now
        </a>
      </div>
    </PortalShell>
  );
}
