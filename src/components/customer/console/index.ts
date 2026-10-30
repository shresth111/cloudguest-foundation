/**
 * Console primitives for the customer workspace. They read the `--wy-*`
 * tokens (docs/design/console-tokens.md) and must render inside a
 * `.wy-console` ancestor.
 */
export { StatusDot, type ConsoleStatus, type StatusDotProps } from "./StatusDot";
export { StatTile, type StatTileProps } from "./StatTile";
export { Panel, type PanelProps } from "./Panel";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./SegmentedControl";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { livenessToStatus } from "./status";
