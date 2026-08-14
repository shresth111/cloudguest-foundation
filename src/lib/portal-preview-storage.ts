/**
 * localStorage key the demo-mode "Preview Portal" flow uses to hand a
 * snapshot of PortalPage.tsx's in-progress `livePreviewConfig` to
 * `/preview/portal/demo` (opened in a new tab) -- see that route's own
 * docstring for the full write-up on why this exists instead of a real
 * backend fetch. A standalone module (rather than exporting the constant
 * from the route file itself) so the writer (PortalPage.tsx, a plain
 * component) and the reader (the route file, which TanStack Router's
 * file-based codegen processes) never need to import across into each
 * other.
 *
 * localStorage, not sessionStorage: `window.open(url, "_blank",
 * "noopener,noreferrer")` deliberately severs the new tab's `opener`
 * relationship (no reverse-tabnabbing risk here since the target is
 * same-origin, but harmless to keep) -- and per the HTML spec, a new
 * browsing context only inherits a *copy* of the opener's sessionStorage
 * when that opener relationship exists. `noopener` breaks that
 * inheritance, so the new tab's sessionStorage came up empty regardless
 * of what was just written (confirmed live: "abhi bhi live preview mai
 * external link nahi aaya" -- the button/redirect worked, but the new
 * tab always showed "No preview open"). localStorage has no such
 * opener-dependent behavior -- it's shared unconditionally across every
 * tab of the same origin.
 */
export const DEMO_PORTAL_PREVIEW_STORAGE_KEY = "wyfy-demo-portal-preview";
