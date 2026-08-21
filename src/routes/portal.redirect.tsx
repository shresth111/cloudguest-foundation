import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { GlyphRedirect } from "@/components/portal-runtime/PortalGlyphs";
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

  // The guest-decision-relevant part of the destination is its host; the
  // full URL (often a wall of %2F-encoded router state) moves to the
  // anchor's `title`. `url` already passed isSafeRedirectTarget, so this
  // parse cannot throw for a reachable value -- the fallback is belt and
  // braces. Same {host} substitution convention as resendAvailableInTemplate.
  let host = url;
  try {
    host = new URL(url, window.location.origin).hostname;
  } catch {
    /* keep the raw value */
  }
  const [noticePre, noticePost] = t("redirectNoticeTemplate").split("{host}");
  const [countPre, countPost] = t("redirectCountdownTemplate").split("{n}");

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            {/* Flat venue-primary tile (contrast-safe foreground via
             * accessibleForeground()'s `--pr-primary-foreground`), not the
             * retired indigo gradient + glow. GlyphRedirect is the brand
             * set's "arrow leaving an open frame". */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--pr-primary,#6366f1)] text-[color:var(--pr-primary-foreground,#ffffff)] shadow-[0_2px_8px_-2px_rgba(30,27,75,0.18)]">
              <GlyphRedirect className="h-7 w-7" />
            </div>
            <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("redirecting")}</h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1.5 pg-meta text-[var(--pg-ink-muted)]">
              {noticePre}
              <span className="font-semibold text-[var(--pg-ink)]">{host}</span>
              {noticePost}
            </p>
            {/* One honest countdown line folded into the plate -- replaces
             * the dedicated card whose content was a bare number over a
             * 2.56:1 slate-400 "SECONDS" caption. The number keeps
             * emphasis + tabular-nums so it does not jitter as it ticks. */}
            <p className="mt-3 pg-meta text-[var(--pg-ink-faint)]" aria-live="off">
              {countPre}
              <span className="font-semibold tabular-nums text-[var(--pg-ink)]">{remaining}</span>
              {countPost}
            </p>
          </PortalTextPlate>
        </div>
        <a
          href={url}
          title={url}
          target="_blank"
          rel="noreferrer"
          className={`${PG_PRIMARY_BTN} flex items-center justify-center`}
        >
          {t("continueNowLabel")}
        </a>
      </div>
    </PortalShell>
  );
}
