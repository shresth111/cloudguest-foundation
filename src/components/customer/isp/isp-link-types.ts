/** Non-component exports split out of `IspDialogs.tsx` so that file
 * only exports components (react-refresh/only-export-components). */

// i18n-ignore-start: English fallbacks; rendered through `linkTypeLabel` (dialog.linkType.*)
export const LINK_TYPES: { value: string; label: string }[] = [
  { value: "fiber", label: "Fiber" },
  { value: "dsl", label: "DSL" },
  { value: "cable", label: "Cable" },
  { value: "wireless_4g", label: "4G Wireless" },
  { value: "wireless_5g", label: "5G Wireless" },
  { value: "satellite", label: "Satellite" },
  { value: "leased_line", label: "Leased Line" },
  { value: "other", label: "Other" },
];
// i18n-ignore-end

/** A link type's name in the active language (`dialog.linkType.<value>`). */
export function linkTypeLabel(t: (k: string, d: string) => string, value: string): string {
  const known = LINK_TYPES.find((x) => x.value === value);
  return known ? t(`dialog.linkType.${value}`, known.label) : value.replace(/_/g, " ");
}
