/**
 * How an SLA uptime percentage is written on a customer-facing screen.
 *
 * Both places that render `kpis.slaUptime` used to do it as
 * `${value.toFixed(1)}%`. That rounds to nearest, so every figure from
 * 99.95 upward prints as a flat "100.0%" -- the dashboard claimed a
 * perfect month to a customer who had just had an outage, and the demo
 * fixture (99.97) is squarely in that band, which is why the product video
 * shows "SLA UPTIME 100.0%".
 *
 * Two rules, both deliberate:
 *
 * 1. **Never round up to 100.** Anything short of a genuine 100 is floored
 *    at the last displayed digit, so a real dip always shows. Overstating
 *    uptime is the one direction that costs trust, and an SLA number is
 *    exactly where a customer will check us against their own experience.
 * 2. **Enough precision to see a dip.** The interesting range for uptime
 *    is the top of the scale, where one decimal is not enough -- 99.97 and
 *    99.99 are materially different promises and both print as "100.0".
 *    Two decimals above 99.9 keeps them apart; one decimal below that is
 *    plenty, since a figure like 97.4% already reads as a bad week.
 *
 * A true 100 still prints as "100%", not "100.00%" -- the padding would
 * imply a precision the buckets do not have, and there is no rounding
 * hazard in the one case where the number is exact.
 */
export function formatUptimePercent(value: number): string {
  if (!Number.isFinite(value)) return "--";
  // Clamp rather than trust: a weighted average of backend bucket
  // percentages should already sit in 0..100, but a single malformed
  // bucket should not render "100.3%" or a negative.
  const pct = Math.min(100, Math.max(0, value));
  if (pct >= 100) return "100%";

  // Floor at the precision we are about to print, so the displayed digits
  // are never rounded up past what actually happened.
  const decimals = pct > 99.9 ? 2 : 1;
  const factor = 10 ** decimals;
  const floored = Math.floor(pct * factor) / factor;

  // Flooring can only ever move the number down, so it cannot reach 100
  // here -- but a value of exactly 99.999... would floor to 100.00 at two
  // decimals, which would print the very string this function exists to
  // prevent. Step back one unit in the last place in that case.
  const safe = floored >= 100 ? (100 * factor - 1) / factor : floored;
  return `${safe.toFixed(decimals)}%`;
}
