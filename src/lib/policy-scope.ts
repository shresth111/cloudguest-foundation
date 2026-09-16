/**
 * Which BANDWIDTH policy belongs to which screen.
 *
 * The backend has exactly one policy type for both of these screens --
 * `PolicyType.BANDWIDTH` -- and both write the identical, untargeted
 * assignment shape `(scope_type=location, target_type=none, priority=0)`.
 * Nothing in the row itself says "this is a location's default speed" or
 * "this is an access tier"; the only thing that distinguishes them is the
 * policy's `name`, which each screen sets to the thing it was created for:
 *
 *   * Guest WiFi Limits (LocationPolicies.tsx) names it after the location
 *     the operator picked -- its field is literally called "Location" and
 *     its value becomes the policy name.
 *   * Access Tiers (CreateGroup.tsx) names it after the tier.
 *
 * Because that is the only signal, both screens have to agree on it, and
 * this is the one place that decides. Before this module each screen listed
 * *every* active BANDWIDTH policy, so creating a tier added a row that read
 * as a location in Guest WiFi Limits (bug report: "when creating access
 * tier sometimes it is creating new in guest wifi limit"), and a saved
 * location limit read as a tier one tab over. A setting cannot be shown as
 * two different things on two screens.
 *
 * This is a display rule, not a data one: it changes nothing about what is
 * stored or which assignment wins at guest login -- that precedence is the
 * backend's `resolve_effective_policy`, and it is unaffected here.
 */
export function isLocationNamedPolicy(name: string, locationNames: ReadonlySet<string>): boolean {
  return locationNames.has(name.trim());
}
