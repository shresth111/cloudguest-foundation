/**
 * A from/to range down to the second (NetLogs). `<input type="datetime-local"
 * step="1">` shows seconds in every evergreen browser; the values are the
 * viewer's local time and are sent as ISO instants.
 */
import { useState } from "react";

import { MButton, M_INPUT } from "@/components/master/MasterKit";
import { fromLocalInput, toLocalInput } from "@/lib/isp-partner/time-seconds";

export interface ExactWindow {
  since: string;
  until: string;
}

export function ExactRange({
  value,
  onChange,
  maxMs,
  label = "Exact range",
}: {
  value: ExactWindow | null;
  onChange: (w: ExactWindow | null) => void;
  /** Optional cap (ms) on the span. */
  maxMs?: number;
  label?: string;
}) {
  const [from, setFrom] = useState(value ? toLocalInput(new Date(value.since)) : "");
  const [to, setTo] = useState(value ? toLocalInput(new Date(value.until)) : "");
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const since = fromLocalInput(from);
    const until = fromLocalInput(to);
    if (!since || !until) return setError("Pick both times.");
    const span = new Date(until).getTime() - new Date(since).getTime();
    if (span <= 0) return setError("The end must be after the start.");
    if (maxMs && span > maxMs) return setError("That range is too long for this view.");
    setError(null);
    onChange({ since, until });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <label className="flex flex-col gap-0.5">
        <span className="text-muted-foreground">From</span>
        <input
          type="datetime-local"
          step={1}
          className={M_INPUT}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={`${label} from`}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-muted-foreground">To</span>
        <input
          type="datetime-local"
          step={1}
          className={M_INPUT}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label={`${label} to`}
        />
      </label>
      <MButton variant="outline" onClick={apply}>
        Apply
      </MButton>
      {value && (
        <MButton
          variant="outline"
          onClick={() => {
            setFrom("");
            setTo("");
            setError(null);
            onChange(null);
          }}
        >
          Clear
        </MButton>
      )}
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}
