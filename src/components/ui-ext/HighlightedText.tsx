import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface HighlightedTextProps {
  /** Full text to render. */
  text: string;
  /** Search term to highlight (case-insensitive). Empty term renders plain text. */
  query: string;
  /** Extra classes for the highlighted <mark> segments. */
  markClassName?: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders `text` with every case-insensitive occurrence of `query` wrapped in a
 * <mark>, so users can see exactly why a row matched their search.
 */
export function HighlightedText({ text, query, markClassName }: HighlightedTextProps) {
  const parts = useMemo(() => {
    const term = query.trim();
    if (!term) return [text];
    return text.split(new RegExp(`(${escapeRegExp(term)})`, "ig"));
  }, [text, query]);

  const term = query.trim().toLowerCase();

  return (
    <>
      {parts.map((part, i) =>
        term && part.toLowerCase() === term ? (
          <mark
            key={i}
            className={cn(
              "rounded-[3px] bg-amber-300/30 px-0.5 text-inherit ring-1 ring-inset ring-amber-300/40",
              markClassName,
            )}
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
