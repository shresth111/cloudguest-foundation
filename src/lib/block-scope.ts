/**
 * Where a block on Blocked Guests will actually land, and the sentence the
 * venue admin reads about it.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The screen had a control labelled "Applies to" listing every location in
 * the account, and it set nothing. `handleBlock` sends the `locationId`
 * PROP to `createAccessRule`; the select's state (`bu`) reached neither the
 * request nor -- outside demo -- the table filter beside it, which keys off
 * the same prop. An owner could pick "Delhi Office", press Block, and write
 * a rule for whichever venue the dashboard happened to be on.
 *
 * That is the visible half. The half that does damage is what happens when
 * there is no `locationId` at all:
 *
 *   * `createAccessRule` builds a plain object and axios JSON.stringifies
 *     it, so an undefined `locationId` is DROPPED FROM THE BODY -- not sent
 *     as null;
 *   * the backend's `GuestAccessRuleCreate.location_id` then defaults to
 *     None and the column stores NULL;
 *   * and NULL does not mean "unknown" at enforcement time. The matching
 *     query ORs `location_id IS NULL` into every lookup
 *     (`guest_access/repository.py`, `list_matching_guest_rules`), so the
 *     rule fires at EVERY location in the organization.
 *
 * One mount path did exactly that: the agent/staff-preview dashboard
 * rendered Access Rules with no `locationId` while the active location sat
 * in scope, so an agent blocking one guest at one venue banned them
 * account-wide, under a control naming a single venue.
 *
 * Organization-wide blocking is a real and deliberate backend capability --
 * the schema's own field description says "Omit for org-wide". Nothing here
 * removes it. What this module does is make the screen STATE which of the
 * two it is about to do, so the broad one is chosen rather than fallen
 * into.
 *
 * WHY IT IS PURE AND LIVES HERE
 * -----------------------------
 * Same reason as `block-outcome.ts` next door: `scripts/test-block-scope.mjs`
 * bundles this module alone and executes the ladder for real, including the
 * states a browser would make you sign in as a staff agent to reach. A copy
 * of it inside the screen would drift from the copy that ships, which is
 * the bug `block-outcome.ts` exists to avoid and the one the "Applies to"
 * control was.
 */

/** What the screen knows about the venue it is about to write a rule for. */
export interface BlockScopeFacts {
  /** The demo account, whose location roster is fictional and whose blocks
   * are never sent anywhere. */
  demo: boolean;
  /** The `locationId` prop -- the ONLY value that decides the rule's
   * `location_id`. Undefined on a mount path that did not pass one. */
  locationId?: string | null;
  /** Resolves a location id to its name, or "" when the locations list has
   * not arrived or holds no such id. */
  nameForLocation: (id: string | null | undefined) => string;
  /** The demo screen's own picker value. Ignored outside demo, deliberately
   * and by the whole point of this module. */
  demoUnit?: string;
}

export type BlockScopeKind =
  /** The rule carries a location id and applies at that venue. */
  | "location"
  /** The rule will carry no location id, so it applies at every location in
   * the organization. */
  | "organization"
  /** The demo account. Nothing is written; the label is the picker's. */
  | "demo";

export interface BlockScope {
  kind: BlockScopeKind;
  /** What to print after "Applies to". Never empty, never a raw UUID. */
  label: string;
  /** True only for `organization`. The one state an owner is most likely
   * not to have meant, so callers style and confirm it differently. */
  orgWide: boolean;
}

/**
 * Which of the three states this screen is in.
 *
 * Reads `locationId` and never `demoUnit` outside demo: that substitution
 * is the defect, and making it structurally impossible here is worth more
 * than the two lines it costs.
 */
export function blockScope(facts: BlockScopeFacts): BlockScope {
  if (facts.demo) {
    return { kind: "demo", label: facts.demoUnit ?? "", orgWide: false };
  }
  if (!facts.locationId) {
    return {
      kind: "organization",
      label: "Every location in this account",
      orgWide: true,
    };
  }
  // The locations list may not have arrived yet, and a venue whose name we
  // cannot resolve is still a venue. "this location" is vague but true;
  // printing a raw UUID, or the empty string `nameForLocation` returns,
  // would be worse in different ways.
  return {
    kind: "location",
    label: facts.nameForLocation(facts.locationId) || "this location",
    orgWide: false,
  };
}

/**
 * The sentence in the confirm dialog, at the last moment before the write.
 *
 * Says nothing about what a block does to a guest who is connected right
 * now -- that is `block-outcome.ts`'s job, from what the server actually
 * did, and it is the only honest place for it.
 */
export function blockScopeConfirmation(scope: BlockScope): string {
  return scope.orgWide
    ? "This applies at every location in this account, not just the one you are viewing."
    : `This applies at ${scope.label}.`;
}
