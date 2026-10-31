/**
 * Console primitives for the customer workspace. They read the `--wy-*`
 * tokens (docs/design/console-tokens.md) and must render inside a
 * `.wy-console` ancestor (or carry the class, for portaled content).
 */
export { StatusDot, type ConsoleStatus, type StatusDotProps } from "./StatusDot";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
export { StatTile, type StatTileProps } from "./StatTile";
export { Panel, PANEL_SURFACE, type PanelProps } from "./Panel";
export { PageHeader, type PageHeaderProps, type PageScope } from "./PageHeader";
export {
  DataTable,
  TablePager,
  MONO_CELL,
  ROW_REVEAL,
  type DataTableColumn,
  type DataTableProps,
  type TablePagerProps,
} from "./DataTable";
export { Toolbar, ToolbarSearch, type ToolbarProps, type ToolbarSearchProps } from "./Toolbar";
export { SubTabs, type SubTabsProps, type SubTabOption } from "./SubTabs";
export { Callout, type CalloutProps, type CalloutTone } from "./Callout";
export {
  FormSection,
  FormField,
  FormSwitchRow,
  type FormSectionProps,
  type FormFieldProps,
  type FormSwitchRowProps,
} from "./FormSection";
export { FilterChip } from "./FilterChip";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./SegmentedControl";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { livenessToStatus, CONSOLE_STATUS_WORD } from "./status";
