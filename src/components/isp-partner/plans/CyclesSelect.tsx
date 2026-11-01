/**
 * BILL-2: "Renew for N cycles" (1-12) in one invoice. Sent only when > 1,
 * so a single renewal is exactly the old request. The backend refuses N > 1
 * (ISP_RENEW_CYCLES_OFF) unless ISP_BILL2_ENABLED is on; that message is
 * shown as the dialog error.
 */
import { M_INPUT } from "@/components/master/MasterKit";

export const MAX_CYCLES = 12;

export function CyclesSelect({
  value,
  onChange,
  validityDays,
}: {
  value: number;
  onChange: (n: number) => void;
  validityDays?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">Renew for</span>
      <select className={M_INPUT} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: MAX_CYCLES }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n === 1 ? "1 cycle" : `${n} cycles`}
            {validityDays ? ` (${n * validityDays} days)` : ""}
          </option>
        ))}
      </select>
      {value > 1 && (
        <span className="block text-[11px] text-muted-foreground">
          One invoice for {value} cycles; validity and the next bill date move {value} cycles.
        </span>
      )}
    </label>
  );
}
