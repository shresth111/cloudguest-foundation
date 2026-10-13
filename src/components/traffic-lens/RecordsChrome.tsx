import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What sits around a records table on both consoles: the "Filters" button
 * with its count, the filters in force as removable chips, and the "About
 * these records" disclosure. Markup only: no request, no wording about what
 * a record is or where it comes from.
 *
 * The per-field filters are closed by default. Records load by themselves;
 * a person who never opens this still sees them.
 */
export function FiltersButton({
  open,
  active,
  onToggle,
  controls,
}: {
  open: boolean;
  /** How many filters are in force. */
  active: number;
  onToggle: () => void;
  /** The id of the panel this opens. */
  controls: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <SlidersHorizontal className="h-4 w-4" /> Filters
      {active > 0 && (
        <span
          className="rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
          aria-label={`${active} in force`}
        >
          {active}
        </span>
      )}
    </Button>
  );
}

/** The filters in force. Removing one asks for the records again without it. */
export function FilterChips<Field extends string>({
  chips,
  onRemove,
}: {
  chips: readonly { field: Field; label: string }[];
  onRemove: (field: Field) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filters in force" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.field}>
          <button
            type="button"
            onClick={() => onRemove(chip.field)}
            aria-label={`Remove filter: ${chip.label}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-2 text-xs font-medium text-foreground hover:bg-primary/20"
          >
            {chip.label}
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The longer explanation, one click away, so the table is what opens. */
export function AboutRecords({ children }: { children: ReactNode }) {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-foreground/80 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="h-3.5 w-3.5 group-open:hidden" />
        <ChevronDown aria-hidden className="hidden h-3.5 w-3.5 group-open:block" />
        About these records
      </summary>
      <div className="mt-2 max-w-3xl space-y-1.5 leading-relaxed">{children}</div>
    </details>
  );
}
