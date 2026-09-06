import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { PortalCard, PG_FONT_STACK } from "@/components/portal-runtime/PortalShell";
import { PortalDefaultBrandBadge } from "@/components/portal-runtime/PortalDefaultBrandBadge";
import { readLanguageFromUrl, translate } from "@/lib/portal-i18n";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * The error boundary for every `/portal/*` route.
 *
 * ## Why this exists
 *
 * TanStack Router does NOT inherit `errorComponent` down the route tree. A
 * child route that defines none falls through to the router's
 * `defaultErrorComponent` (src/router.tsx), NOT to its parent's -- verified
 * live: with a deliberate throw in `/portal/session`'s render and a marker
 * string in `/portal`'s own `errorComponent`, the marker never appeared and
 * the app-wide screen did. So `/portal`'s existing `errorComponent` was
 * covering exactly one route: `/portal` itself.
 *
 * Every other portal route therefore rendered `__root.tsx`'s `ErrorComponent`
 * -- the customer dashboard's error screen -- to a guest standing in a cafe:
 *
 *   - "Something went wrong on our end", English-only, on a surface that
 *     ships in ten languages;
 *   - in `bg-background`/`text-foreground` (the dashboard's tokens) rather
 *     than the venue's `--pg-*` palette and font, so it does not look like
 *     the venue's WiFi at all;
 *   - with a "Go home" that is `<a href="/">` -- a full navigation to the
 *     app root. Behind a captive portal the only reachable host is this one,
 *     and `/` is the operator's dashboard login. It is a dead end for a
 *     guest and it throws away the `organizationId`/`locationId`/`routerId`
 *     that their whole sign-in depends on;
 *   - and, most importantly, it says nothing about the only question a guest
 *     on a captive portal actually has: **is my internet working?**
 *
 * That last point is the reason the copy here leads with it. The NAS gate is
 * opened by `portal.success.tsx`'s full-page form POST, which has already
 * completed by the time `/portal/session` renders -- so a crash on the
 * connected side of the flow leaves a guest who genuinely IS online looking
 * at an error and concluding the WiFi failed. Telling them to try a website
 * is the difference between a guest who just browses and a guest who queues
 * at reception.
 *
 * ## Constraints this screen has to respect
 *
 * It renders when something else has already broken, so it assumes nothing:
 *
 *   - **No `usePortalRuntime()`.** The provider is a plausible source of the
 *     very error being caught, and on `/portal` itself the boundary sits
 *     ABOVE the provider, so the context would be null. Language comes from
 *     `readLanguageFromUrl()` (pure, SSR-safe, try/catch'd, reads only
 *     `window.location.search`) and strings from `translate()` (a pure
 *     `DICTS[lang]?.[key] ?? DICTS.en[key] ?? key` lookup that cannot throw).
 *   - **No Web Storage, at all.** Inside Apple's Captive Network Assistant
 *     Web Storage *throws* rather than returning null (see
 *     `PortalRuntimeContext`'s safeGet/safeSet and
 *     docs/captive-portal-v7-design-spec.md §0.2). A storage read in an error
 *     boundary would turn a caught, recoverable error into an uncaught one --
 *     the boundary itself throwing is the one failure that really is a blank
 *     page.
 *   - **No `<Link>`.** The router's `Link` validates against the typed route
 *     tree and re-parses search params -- and an invalid search param is one
 *     of the things that can land a guest here in the first place. A plain
 *     anchor carrying `window.location.search` through verbatim cannot fail
 *     that way, and a full document load is the better recovery anyway: it
 *     re-asks the NAS rather than repainting from memory (same reasoning as
 *     `portal.success.tsx`'s `window.location.assign` over `navigate()`).
 *   - **Provider-free styling.** `portal-runtime pg-shell` on the root brings
 *     styles.css's `--pg-*` token block into scope as plain CSS with zero JS,
 *     exactly as `portal.tsx`'s own `IncompletePortalLinkError` does.
 */
export function PortalErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const lang = readLanguageFromUrl() ?? "en";
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    // Same reporting the app-wide boundary does, under its own boundary name
    // so a guest-portal crash is distinguishable from a dashboard one in the
    // error feed. A guest cannot report this themselves -- they close the
    // sheet and ask staff -- so this is the only signal we get.
    console.error(error);
    reportLovableError(error, { boundary: "portal_error_screen" });
  }, [error]);

  // Preserves organizationId/locationId/routerId (and `lang`, `mac`, `ip`,
  // `link-login-only`) verbatim -- see the docstring on why this is a raw
  // string rather than a typed `<Link>`.
  const search = typeof window === "undefined" ? "" : window.location.search;

  return (
    <div
      className="portal-runtime pg-shell flex min-h-dvh w-full items-center justify-center px-4"
      style={{ fontFamily: PG_FONT_STACK, background: "var(--pg-canvas, #F8F8FC)" }}
    >
      <PortalCard className="pg-enter w-full max-w-[400px] text-center">
        <PortalDefaultBrandBadge size={64} className="mx-auto h-14 w-14" />
        <h1 className="mt-4 pg-subtitle text-[var(--pg-ink)]">{t("portalErrorTitle")}</h1>
        <p className="mt-2 pg-meta font-normal text-[var(--pg-ink-muted)]">
          {t("portalErrorBody")}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="flex min-h-6 items-center rounded-full bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] px-4 py-2 pg-meta font-medium text-[var(--pr-primary,#6366f1)] hover:bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_14%,var(--pg-surface,#fff))]"
          >
            {t("retry")}
          </button>
          <a
            href={`/portal/welcome${search}`}
            className="pg-meta font-medium text-[var(--pg-ink-muted)] underline-offset-2 hover:text-[var(--pr-primary,#6366f1)] hover:underline"
          >
            {t("signInAgainLink")}
          </a>
        </div>
      </PortalCard>
    </div>
  );
}
