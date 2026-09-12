/**
 * The guard in front of changing a fleet row's vendor, and the `<select>`
 * that can no longer change one without it.
 *
 * See `@/lib/router-vendor-change` for the incident this exists because of
 * and for every rule it enforces -- the rules live there, as pure functions,
 * so `scripts/test-vendor-change-guard.mjs` can assert against the real ones.
 * This file is only their presentation.
 *
 * Built on the same `AlertDialog` primitives as `ConfirmDialog`, and in the
 * same register as `RegenerateGuard` and `DESELECT_PHRASE`: name the thing,
 * state the outcome, and make the operator type something the row itself
 * carries before the irreversible half happens. Deliberately not a new modal
 * system -- one more dialog shape is one more thing to keep consistent.
 */
import { useEffect, useState } from "react";
import { AlertOctagon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import type { RouterDevice } from "@/types/router";
import {
  routerAgentEvidence,
  typedNameMatches,
  vendorChangeConsequences,
  vendorChangeNeedsTypedName,
  vendorChangeSummary,
} from "@/lib/router-vendor-change";

/** A vendor change that has been asked for but not yet written. */
export interface PendingVendorChange {
  router: RouterDevice;
  /** The vendor the operator picked. */
  next: string;
  /** `saving` once the PUT is in flight, so the dialog closes but the
   * `<select>` keeps showing what is being written rather than snapping back
   * to the old value and then forward again. */
  phase: "confirming" | "saving";
}

/**
 * The vendor `<select>`.
 *
 * It does NOT write. `onRequestChange` asks the page for a change; what the
 * control displays is whatever the page says it displays, which is the whole
 * point:
 *
 *   - nothing pending -> the server's value;
 *   - a change being confirmed or saved -> that change;
 *   - confirm cancelled, or the PUT failed -> `pending` goes back to null and
 *     the control returns to the server's value *by re-render*.
 *
 * That last case is why `pending` is a prop rather than local state. A plain
 * controlled `<select>` whose `value` prop does not change does not get its
 * DOM value rewritten by React, so a cancelled change would leave the
 * dropdown reading `TP-Link Omada` over a row that is still MikroTik -- the
 * drift this whole change is about, reintroduced in the control itself.
 */
export function VendorSelect({
  value,
  pending,
  vendors,
  className,
  disabled,
  onRequestChange,
}: {
  value: string;
  pending: string | null;
  vendors: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
  onRequestChange: (vendor: string) => void;
}) {
  const shown = pending ?? value;
  return (
    <select
      aria-label="Vendor"
      className={className}
      value={shown}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        if (next === value) return;
        onRequestChange(next);
      }}
    >
      {vendors.map((v) => (
        <option key={v.value} value={v.value}>
          {v.label}
        </option>
      ))}
    </select>
  );
}

/**
 * The confirmation itself.
 *
 * `onConfirm` fires only once the change is actually allowed: a click for a
 * row that has never reported in, the router's own name typed out for one
 * that has. Closing by any other route (Cancel, Escape, the overlay) is a
 * `onCancel`, and `onCancel` MUST leave the row alone -- a dialog dismissed
 * by a stray keystroke must not be able to produce the exact write this
 * exists to prevent.
 */
export function VendorChangeDialog({
  change,
  onConfirm,
  onCancel,
}: {
  change: PendingVendorChange | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");

  // A fresh row is a fresh decision: never carry a satisfied acknowledgement
  // from the previous router into the next one.
  const routerId = change?.router.id ?? null;
  const next = change?.next ?? null;
  useEffect(() => {
    setTyped("");
  }, [routerId, next]);

  if (!change) return null;

  const { router } = change;
  const from = router.vendor || "mikrotik";
  const needsName = vendorChangeNeedsTypedName(router);
  const evidence = routerAgentEvidence(router);
  const allowed = !needsName || typedNameMatches(router, typed);

  return (
    <AlertDialog
      open={change.phase === "confirming"}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 shrink-0 text-destructive" />
            Change the vendor on “{router.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className="text-sm font-medium text-foreground">
                <span className="font-mono">{vendorChangeSummary(from, change.next)}</span>
              </p>
              <p>This changes what this platform does with the row, starting immediately:</p>
              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
                {vendorChangeConsequences(from, change.next).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {evidence.length > 0 && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  This row is a device that has actually reported in:{" "}
                  {evidence.map((e) => `${e.label} ${e.value}`).join(", ")}. It is not an empty
                  placeholder.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {needsName && (
          <div className="rounded-lg border border-border bg-background p-2.5">
            <p className="text-xs font-medium text-foreground">
              Type this router’s name to confirm:{" "}
              <span className="font-mono text-destructive">{router.name}</span>
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={router.name}
              aria-label="Type the router name to confirm"
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 text-xs"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep it as it is</AlertDialogCancel>
          {/* Deliberately a plain button rather than `AlertDialogAction`:
              `AlertDialogAction` closes the dialog on every click, including
              the clicks this gate is supposed to refuse. */}
          <button
            type="button"
            disabled={!allowed}
            onClick={onConfirm}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Change vendor
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
