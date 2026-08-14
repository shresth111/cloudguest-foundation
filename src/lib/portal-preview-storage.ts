/**
 * sessionStorage key the demo-mode "Preview Portal" flow uses to hand a
 * snapshot of PortalPage.tsx's in-progress `livePreviewConfig` to
 * `/preview/portal/demo` (opened in a new tab) -- see that route's own
 * docstring for the full write-up on why this exists instead of a real
 * backend fetch. A standalone module (rather than exporting the constant
 * from the route file itself) so the writer (PortalPage.tsx, a plain
 * component) and the reader (the route file, which TanStack Router's
 * file-based codegen processes) never need to import across into each
 * other.
 */
export const DEMO_PORTAL_PREVIEW_STORAGE_KEY = "wyfy-demo-portal-preview";
