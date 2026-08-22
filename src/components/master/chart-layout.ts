/**
 * Shared chart geometry for the Master Console.
 *
 * This exists as its own zero-dependency module for one specific bundling
 * reason. `PlatformOverviewCharts.tsx` is loaded via `lazy()` precisely so
 * `recharts` (the `vendor-2-charts` chunk, 408KB raw / 104KB gzip) stays off
 * `/master`'s critical path -- but a module that is BOTH statically and
 * dynamically imported gets hoisted straight back into the static graph by
 * Rollup. Importing this constant from the chart module itself, even as a
 * type-free number, silently re-added `vendor-2-charts` as a static import of
 * the route chunk and undid the whole split (verified against a real
 * `.output/` build, not assumed).
 *
 * So: the constant lives here, both the chart and its reserved placeholder
 * import it from here, and neither has to hardcode the other's height.
 */

/** Plot-area height in px for the Platform Overview's bar charts. The loading
 * placeholder MUST use this same value -- a placeholder of a different height
 * turns a blank wait into a layout jump. */
export const CHART_BODY_H = 220;
