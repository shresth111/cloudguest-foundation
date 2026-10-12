import { useState } from "react";
import { MButton, MField, MSeg, M_INPUT } from "@/components/master/MasterKit";
import {
  FLOW_RETENTION_DAYS,
  customRangeFromInputs,
  rangeLabel,
  toLocalInput,
} from "@/lib/traffic-flow-destinations";
import type { FlowScope, FlowWindow } from "@/types/traffic-flow";

const PRESETS: { value: FlowWindow; label: string }[] = [
  { value: "1h", label: "1 h" },
  { value: "6h", label: "6 h" },
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 d" },
];
const OPTIONS: { value: FlowWindow | "custom"; label: string }[] = [
  ...PRESETS,
  { value: "custom", label: "Custom" },
];
const HOUR_MS = 3_600_000;

/**
 * The page's time-range control: the four presets, plus a custom range with
 * minute precision. One control for every tab, so the venue view, the
 * Destinations search and the service drill-down read the same range.
 *
 * A custom range is checked before it is used (start before end, at most
 * 7 days, inside the 7 days that are kept) and refused in words; the server
 * makes the same three checks and never shortens a range silently. Times
 * are entered and shown in the browser's local time.
 */
export function TrafficFlowRangeControl({
  scope,
  onChange,
}: {
  scope: FlowScope;
  onChange: (patch: Partial<FlowScope>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pick = (value: FlowWindow | "custom") => {
    setError(null);
    if (value !== "custom") {
      setEditing(false);
      onChange({ window: value, custom: null });
      return;
    }
    // Opens on the range already in use, or the last hour.
    const now = Date.now();
    setSince(toLocalInput(scope.custom ? Date.parse(scope.custom.since) : now - HOUR_MS));
    setUntil(toLocalInput(scope.custom ? Date.parse(scope.custom.until) : now));
    setEditing(true);
  };

  const apply = () => {
    const result = customRangeFromInputs(since, until, Date.now());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setEditing(false);
    onChange({ custom: result.range });
  };

  const now = Date.now();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <MSeg
        options={OPTIONS}
        value={editing || scope.custom ? "custom" : scope.window}
        onChange={pick}
      />
      {scope.custom && !editing && (
        <button
          type="button"
          className="rounded-md px-2 py-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => pick("custom")}
        >
          {rangeLabel(scope.custom)}
        </button>
      )}
      {editing && (
        <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
          <div className="w-52">
            <MField label="From">
              <input
                type="datetime-local"
                className={M_INPUT}
                value={since}
                min={toLocalInput(now - FLOW_RETENTION_DAYS * 24 * HOUR_MS)}
                max={toLocalInput(now)}
                onChange={(e) => setSince(e.target.value)}
              />
            </MField>
          </div>
          <div className="w-52">
            <MField label="To">
              <input
                type="datetime-local"
                className={M_INPUT}
                value={until}
                min={toLocalInput(now - FLOW_RETENTION_DAYS * 24 * HOUR_MS)}
                onChange={(e) => setUntil(e.target.value)}
              />
            </MField>
          </div>
          <MButton onClick={apply}>Use this range</MButton>
          <MButton
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </MButton>
          <p className="w-full text-[11px] text-muted-foreground">
            Your local time, to the minute. Traffic data is kept for {FLOW_RETENTION_DAYS} days, and
            a range may be at most {FLOW_RETENTION_DAYS} days long. Figures are per five-minute
            window, so a range covers the windows that start inside it.
          </p>
          {error && (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
