import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/** The customer dashboard's production hostname. */
const CUSTOMER_APP_HOSTNAME = "app.wyfyguest.com";
/** The Master Console's own production hostname -- see `routes/index.tsx`. */
const MASTER_CONSOLE_HOSTNAME = "master.wyfyguest.com";

/**
 * Super Admin "Master" console layout. A separate route tree from the
 * customer (/customer/*) and agent (/agent/*) surfaces so the three are
 * cleanly identifiable. Client-only (auth lives in localStorage); every
 * child renders its own MasterShell.
 *
 * This guard used to only check `status !== "anonymous"` -- i.e. "is
 * *someone* logged in", not "is this a platform operator". Any real
 * customer/org-owner account (org-scoped role only, never "global") is
 * "authenticated" too, so a customer who simply navigated their browser to
 * /master -- with no need to even go through /master-login's own form --
 * got the full operator console shell. Master-login's own submit handler
 * has a matching check for the same reason (better UX: an immediate,
 * explained rejection instead of a silent bounce back here), but this is
 * the actual security boundary -- it has to hold even for sessions that
 * never went through that form at all (e.g. a customer already logged in
 * via /login who just types /master into the address bar).
 */
export const Route = createFileRoute("/master")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    // The Master Console is served from its own hostname. Asked for on the
    // CUSTOMER hostname, it is not a permission question at all -- it is
    // the wrong surface, and it must not render there even for a real
    // operator whose role check below would happily pass.
    //
    // foundation#288 fixed the post-login redirect that SENT operators here
    // (authGuards.ts), which was one of two ways in and the only one that
    // fix could see. It did nothing for the other: typing
    // `app.wyfyguest.com/master` straight into the address bar never touches
    // `requireCustomerSession` -- it lands on this route, whose guard has
    // only ever asked "is this an operator", never "on which host". So the
    // console kept rendering under the customer's address after that deploy,
    // exactly as reported: "https://app.wyfyguest.com/master - abhi bhi same
    // hai". Checked here, the boundary holds for every route into /master/*.
    //
    // Only the literal customer production host bounces, so localhost and
    // previews -- one origin for both consoles -- are untouched.
    if (typeof window !== "undefined" && window.location.hostname === CUSTOMER_APP_HOSTNAME) {
      window.location.href = `https://${MASTER_CONSOLE_HOSTNAME}${location.href}`;
      // Do not let this navigation resolve against a page being left.
      throw redirect({ to: "/master-login" });
    }
    // Never carry a redirect target that's already /master-login itself
    // forward as the ?redirect= value (see authGuards.ts's
    // requireCustomerSession's identical guard for the live symptom this
    // was written for -- ?redirect=/login there, ?redirect=/master-login's
    // equivalent risk here).
    const isAlreadyOnLoginTarget =
      location.href === "/master-login" ||
      location.href.startsWith("/master-login?") ||
      location.href.startsWith("/master-login#");
    const redirectSearch = isAlreadyOnLoginTarget ? undefined : { redirect: location.href };
    if (context.auth?.status === "anonymous") {
      throw redirect({ to: "/master-login", search: redirectSearch });
    }
    const isOperator = context.auth?.roles?.some((r) => r.scopeType === "global") ?? false;
    if (context.auth?.status === "authenticated" && !isOperator) {
      throw redirect({ to: "/master-login", search: redirectSearch });
    }
  },
  component: () => <Outlet />,
});
