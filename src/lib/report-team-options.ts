/**
 * Which teams the Reports screen's "Team" filter may offer.
 *
 * ## The defect this exists to prevent
 *
 * `UserReports.tsx` carried a module-level
 * `const TEAMS = ["Sales Team", "Executive VIP", "Contractors",
 * "Maintenance Staff"]` and rendered it into the Team dropdown
 * unconditionally -- for demo accounts and real ones alike. A real venue
 * that has never created a single guest team was therefore shown four
 * confident-looking teams that do not exist in its database, cannot be
 * selected meaningfully, and are not seeded anywhere: they were invented
 * by the frontend.
 *
 * That is a different failure from a report faithfully rendering demo
 * fixture rows. Nothing had to be seeded for it to happen and no query
 * returned them, so no amount of cleaning up demo data would have removed
 * them -- only deleting the literal.
 *
 * Guest teams are real: `GET /guest-teams` (backend
 * `app/domains/guest_teams/router.py`) returns this organization's teams,
 * and `guestService.listTeams()` already calls it for the Guests › Teams
 * screen. The dropdown simply was never wired to it.
 *
 * ## The rule
 *
 * A real account offers exactly the teams the API returned -- and when
 * that list is empty, the UI must say so plainly instead of substituting
 * anything. Demo accounts keep a fixture list, because every other number
 * on a demo account is a fixture too and a demo with an empty dropdown
 * would misrepresent the product.
 */

/**
 * Fixture teams, for demo accounts only. Never reachable from a real
 * account -- `resolveTeamOptions` is the only thing that may read this,
 * and only on the `demo` branch.
 */
export const DEMO_TEAMS: readonly string[] = [
  "Sales Team",
  "Executive VIP",
  "Contractors",
  "Maintenance Staff",
];

export type TeamOptionsState =
  /** The team list is still in flight. The control should be inert. */
  | { kind: "loading" }
  /** Real teams (or demo fixtures) to choose from. */
  | { kind: "ready"; options: string[] }
  /** The account genuinely has no guest teams. Show an empty state. */
  | { kind: "empty" }
  /** The lookup failed. Distinct from `empty`: we do not know that there
   *  are none, so we must not claim there are none. */
  | { kind: "error" };

export interface TeamOptionsInput {
  /** Demo accounts get fixtures; real accounts never do. */
  demo: boolean;
  /** Teams from `guestService.listTeams()`; `null` while not yet loaded. */
  teams: readonly string[] | null;
  /** The lookup rejected. */
  failed?: boolean;
}

export function resolveTeamOptions({ demo, teams, failed }: TeamOptionsInput): TeamOptionsState {
  // Demo is decided first and never consults the API result: a demo
  // account is a fixture account end to end.
  if (demo) return { kind: "ready", options: [...DEMO_TEAMS] };
  if (failed) return { kind: "error" };
  if (teams === null) return { kind: "loading" };
  if (teams.length === 0) return { kind: "empty" };
  return { kind: "ready", options: [...teams] };
}

/** Copy for the `empty` state. Deliberate, and it names the screen that
 *  would fix it, so it reads as "nothing here yet" rather than "broken". */
export const NO_TEAMS_NOTICE =
  "No guest teams exist for this venue yet. Create one under Guests › Teams, then run this report.";

/** Copy for the `error` state -- we do not know the count, so we must not
 *  assert that it is zero. */
export const TEAMS_LOOKUP_FAILED_NOTICE =
  "Couldn't load this venue's guest teams. Check the connection and try again.";
