import { createFileRoute, redirect } from "@tanstack/react-router";

// Nothing routes here any more.
//
// This page was the destination for twelve workspace nav items, and it told
// a paying customer, in as many words, that "the underlying data isn't
// scoped to your organization alone -- showing it as-is would risk exposing
// other customers' records". That is not a sentence to put in front of a
// venue owner, and the premise behind it is no longer true anyway:
// `attachOrganizationHeader` (api.ts) is applied in the shared request
// interceptor and sets X-Organization-Id on every request from a session
// without a global-scope role.
//
// The twelve nav items were removed in the same change that rebuilt
// buildOwnerWorkspaceSidebar() around pages that actually exist -- the menu
// no longer advertises features that aren't built, so there is nothing left
// to explain. Kept as a redirect so an old bookmark lands somewhere real.
//
// Note for whoever revisits per-service org scoping: only GET /users and
// GET /organizations were verified org-scoped against the backend. The rest
// still need their handlers read before those surfaces are exposed to a
// customer session.
export const Route = createFileRoute("/_authenticated/workspace/pending-scope")({
  beforeLoad: () => {
    throw redirect({ to: "/workspace" });
  },
});
