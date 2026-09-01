import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { POST_LOGIN_HTML_SANDBOX, buildPostLoginSrcDoc } from "@/lib/post-login-html";

/**
 * The ONE renderer for venue-authored post-login HTML
 * (`RuntimePortalConfig.postLoginHtml`).
 *
 * Every surface that shows this content -- the real guest page
 * (`/portal/redirect`) and the authoring preview in Portal -> Design -- goes
 * through this component, so the guest can never be shown something the
 * editor's preview rendered differently, and so there is exactly one place
 * the `sandbox` attribute is written.
 *
 * WHY AN IFRAME AND NOT `dangerouslySetInnerHTML`
 * ----------------------------------------------
 * `/portal/redirect` is the same origin as the phone-number entry and OTP
 * verification screens and is reached with a live guest session. Injecting
 * stored, venue-authored markup into THIS document -- however well sanitized
 * on write -- puts an attacker one sanitizer bug away from reading the
 * identifier a guest just typed. `srcdoc` into an opaque-origin, script-less
 * frame makes that structurally impossible rather than merely unlikely: the
 * server-side sanitizer is the second line, not the first. See
 * `POST_LOGIN_HTML_SANDBOX` for what each token in the attribute buys.
 *
 * WHY THE FIXED HEIGHT AND THE WRAPPER
 * ------------------------------------
 * Auto-sizing an iframe to its content needs a `postMessage` from inside the
 * frame, which needs `allow-scripts`, which is the one thing this component
 * exists to refuse. So the frame gets a viewport-relative height and the
 * content scrolls inside it -- and it takes BOTH elements below to make that
 * scroll work on a phone:
 *
 *   - On desktop and Android the `<iframe>` itself scrolls, and the wrapper
 *     is inert.
 *   - iOS Safari (and therefore the Captive Network Assistant websheet, and
 *     therefore roughly half of real guests) has long refused to give an
 *     iframe its own scroller, expanding it to its content height instead.
 *     The wrapper is the scroller in that case: the frame grows past the
 *     wrapper's fixed height and the wrapper -- a normal, ordinary
 *     overflow-y element -- scrolls it. This is why the height lives on the
 *     `<div>` and `h-full` on the `<iframe>`, and not the other way round.
 *
 * NO STORAGE, NO SCRIPT, NO NETWORK OF OUR OWN. iOS's CNA websheet throws on
 * Web Storage access (docs/captive-portal-v7-design-spec.md §0.2), so nothing
 * on this path may depend on it -- this component is pure render and holds no
 * state at all.
 */
export function PostLoginHtmlFrame({
  html,
  title,
  className,
}: {
  /** The venue's raw HTML. Callers gate on `hasPostLoginHtml` first -- this
   * component does not decide whether there is anything to show. */
  html: string;
  /** The frame's accessible name. Required, not defaulted: an `<iframe>` with
   * no `title` is an unlabelled landmark to a screen reader, and the guest
   * surface must pass a TRANSLATED string here (`t("postLoginPageLabel")`)
   * while the dashboard preview passes its own dashboard-language one. */
  title: string;
  /** Height/spacing for the scroll wrapper. Callers set the height because
   * the right one differs per surface -- see `/portal/redirect`, which gives
   * the frame more room when there is no countdown block under it. */
  className?: string;
}) {
  const srcDoc = useMemo(() => buildPostLoginSrcDoc(html), [html]);
  return (
    <div
      className={cn(
        // `overscroll-contain` so reaching the end of the venue's content
        // does not chain the scroll into the portal page behind it -- on a
        // phone that reads as the whole screen lurching.
        "w-full overflow-y-auto overscroll-contain rounded-2xl bg-white ring-1 ring-[var(--pg-border,#e2e8f0)]",
        className,
      )}
    >
      <iframe
        title={title}
        srcDoc={srcDoc}
        sandbox={POST_LOGIN_HTML_SANDBOX}
        // The venue's markup may reference remote images; do not leak the
        // portal URL (which carries router/NAS query state) as their referrer.
        referrerPolicy="no-referrer"
        className="block h-full w-full border-0 bg-transparent"
      />
    </div>
  );
}
