import { Info, Lock } from "lucide-react";
import type { ClientControlVerdict } from "@/lib/omada-client-controls";
import { cn } from "@/lib/utils";

/**
 * The sentence a venue owner reads beside a control that cannot do what its
 * label says at their venue.
 *
 * WHY A SMALL INLINE NOTE AND NOT `ControllerManagedFeatureNotice`
 * ---------------------------------------------------------------
 * That component replaces a WHOLE SCREEN, because the five Network screens it
 * covers are entirely RouterOS and nothing on them survives at a controller
 * venue. These screens are not like that. "Guest WiFi Limits" holds a speed
 * that cannot work here next to a session timeout, an idle timeout, a device
 * count and a daily limit that all work perfectly -- they are platform-side
 * and always were. Replacing that screen would take four working controls away
 * to be honest about one.
 *
 * So this is the same idea one level down: the control stays where it is, in
 * the order the owner already knows, greyed rather than gone, with the reason
 * attached to it rather than to the page.
 *
 * TWO TONES, AND THE DIFFERENCE MATTERS
 * -------------------------------------
 *  - `unavailable` -- a lock, and the control beside it is not submittable.
 *    This is "you cannot do this here".
 *  - `qualified`   -- an info note, and the control beside it is LIVE. This is
 *    "you can do this, and here is what it does and does not do". Rendering it
 *    as a warning would teach owners to read every note as a failure, which is
 *    how a console ends up with notes nobody reads.
 *
 * Renders NOTHING for `available`, so a call site is one unconditional
 * element rather than a conditional, and a control that works can never grow a
 * caveat by accident.
 */
export function ControllerControlNotice({
  verdict,
  className,
}: {
  verdict: ClientControlVerdict;
  className?: string;
}) {
  if (verdict.availability === "available" || !verdict.reason) return null;

  const blocked = verdict.availability === "unavailable";
  const Icon = blocked ? Lock : Info;

  return (
    <p
      // `role="note"` rather than `alert`: none of this is new information
      // arriving, it is a standing fact about the venue, and an assertive live
      // region would interrupt a screen-reader user mid-form on every render.
      role="note"
      data-testid={`controller-control-${verdict.control}`}
      data-availability={verdict.availability}
      className={cn(
        "mt-2 flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-snug",
        blocked
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{verdict.reason}</span>
    </p>
  );
}
