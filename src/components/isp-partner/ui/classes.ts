/**
 * UX-PASS: shared class strings for the partner console.
 *
 * `M_INPUT` carries `w-full`, and appending `w-auto` in a template string does
 * not override it (no class merge; `w-full` wins in the generated CSS), so
 * every "compact" filter select rendered full width. `M_FILTER` is the same
 * input with the width swapped, capped to its container on a phone.
 */
import { M_INPUT } from "@/components/master/MasterKit";

export const M_FILTER = `${M_INPUT.replace("w-full", "w-auto")} max-w-full`;

/**
 * Page-level tab bars (`MSeg` with many tabs): one line that scrolls sideways
 * on a phone instead of wrapping labels and being clipped by `<main>`.
 */
export const PAGE_TABS =
  "max-w-full overflow-x-auto [scrollbar-width:none] [&>button]:shrink-0 [&>button]:whitespace-nowrap";
