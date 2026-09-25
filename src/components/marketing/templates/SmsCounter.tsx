import { cn } from "@/lib/utils";
import {
  SMS_MAX_RAW_LENGTH,
  SMS_MAX_WORST_CASE_SEGMENTS,
  measureSms,
  worstCaseSms,
} from "@/lib/marketing-template";

/**
 * Live SMS length, encoding and segments as the owner types (spec §6.1).
 * A client-side mirror of the §5.4 rules for feedback only -- the server
 * recomputes on save and its answer is what gets stored.
 *
 * Two numbers, because they answer different questions: "as typed" is the
 * template text itself; "longest case" fills every variable at its maximum
 * length, which is what the server's `sms_too_long` check measures.
 */
export function SmsCounter({ body }: { body: string }) {
  const raw = measureSms(body);
  const worst = worstCaseSms(body);
  const tooLong = worst.segments > SMS_MAX_WORST_CASE_SEGMENTS;
  const rawTooLong = body.length > SMS_MAX_RAW_LENGTH;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
      aria-live="polite"
    >
      <span className={cn(rawTooLong && "font-medium text-red-600")}>
        {raw.length.toLocaleString()} / {SMS_MAX_RAW_LENGTH.toLocaleString()} characters
      </span>
      <span>
        {raw.encoding === "gsm7" ? "GSM-7" : "Unicode (UCS-2)"} · {raw.segments} part
        {raw.segments === 1 ? "" : "s"}
        {raw.segments > 0 && ` · ${raw.remainingInSegment} left in this part`}
      </span>
      <span className={cn(tooLong && "font-medium text-red-600")}>
        Longest case: {worst.segments} part{worst.segments === 1 ? "" : "s"} (max{" "}
        {SMS_MAX_WORST_CASE_SEGMENTS})
      </span>
      {raw.encoding === "ucs2" && (
        <span className="w-full text-amber-700 dark:text-amber-400">
          A character outside the basic SMS alphabet (₹, emoji, Hindi…) switches the whole message
          to 70 characters per part.
        </span>
      )}
    </div>
  );
}
