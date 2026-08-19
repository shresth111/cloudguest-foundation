import { createFileRoute, redirect } from "@tanstack/react-router";

// /c itself is now just a compat redirect to the bare "/" root -- see
// index.tsx's own doc comment: the dashboard now renders in place at "/"
// (the same route that already shows the sign-in form to an anonymous
// visitor, in-place, no separate /login redirect), one fewer path segment
// for the app's single most-visited page. Kept as a real route (not
// deleted) purely so a link/bookmark to /c from the brief window it was
// the real dashboard URL still lands somewhere real.
//
// Deliberately just this -- the real dashboard component used to live
// in this same file (`CustomerDashboardPage`, imported cross-file by
// index.tsx). It's been moved to
// src/components/customer/CustomerDashboardPage.tsx: this file is a real
// route file, which means routeTree.gen.ts statically imports it (to
// register the "/c/" redirect) into the app's root/entry chunk -- the one
// every route loads, guest captive portal included. Anything defined
// here, including an unused-by-this-route export, rides along with that
// static import whether or not TanStack Router's automatic code-splitting
// can see a reason to split it away (it only ever looks at `component`/
// `loader`/etc. on this file's own `Route`, never at other exports). Keep
// this file limited to the route registration itself -- no chart-bearing
// or otherwise heavy component belongs here again.
export const Route = createFileRoute("/c/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});

