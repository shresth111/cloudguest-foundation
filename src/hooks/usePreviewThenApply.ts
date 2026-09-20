import { useCallback, useEffect, useReducer, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  PREVIEW_APPLY_INITIAL,
  previewApplyReducer,
  refusalGapsFromError,
  type PreviewApplyOutcome,
  type PreviewApplyState,
  type ReadBackPlan,
  type WriteConfirmation,
} from "@/lib/preview-then-apply";

/**
 * The wiring half of preview-then-apply. The decisions live in
 * `@/lib/preview-then-apply`; this owns the mutation and the state.
 *
 * WHY A HOOK AND A COMPONENT RATHER THAN ONE COMPONENT
 * ----------------------------------------------------
 * The state is not private to the panel. `master.integrations.tsx` folds the
 * run's pending flag into a drawer-wide `busy` so no other control on the same
 * controller is live mid-write, and its take-over dialog invalidates a held
 * preview from outside the panel entirely. A component that owned the state
 * internally could do neither without callbacks that exist only to leak it
 * back out. So the seam is: hook owns state, component renders it, the route
 * holds both and can read either.
 *
 * READ-BACK IS NOT OPTIONAL, ONLY DECLARABLE
 * ------------------------------------------
 * `readBack` is required, and it has no arm meaning "the response said 200".
 * Either you pass a `verify` that reads the configuration back off the device,
 * or you pass a sentence saying why this surface does not. See the lib's
 * docstring for the three measured writes that returned `errorCode 0` and
 * changed nothing.
 */
export interface UsePreviewThenApplyOptions<TResult> {
  /** One call, parameterised by dry run. The same request shape both times is
   * what makes the preview worth anything. */
  run: (dryRun: boolean) => Promise<TResult>;
  /** Reduce the provider's response to what the panel renders. Label tables
   * stay at the call site; each surface has its own vocabulary. */
  toOutcome: (result: TResult) => PreviewApplyOutcome;
  /** How this surface knows the write landed. Required — see above. */
  readBack: ReadBackPlan<TResult>;
  /** A dry run finished. Toasts belong here, not in the panel. */
  onPreviewed?: (outcome: PreviewApplyOutcome) => void;
  /** A real apply finished AND has been read back (or declared unreadable).
   * The confirmation is handed over so success copy cannot be written without
   * it in scope. */
  onApplied?: (outcome: PreviewApplyOutcome, confirmation: WriteConfirmation) => void;
  /** A typed 409 refusal, with its gap list already normalised. */
  onRefused?: (gaps: string[]) => void;
  /** Everything else. The panel is left exactly as it was. */
  onFailed?: (error: unknown) => void;
  /**
   * When this value changes, a held preview stops describing what Apply would
   * do and is dropped.
   *
   * Opt-in by omission: a surface that does not pass it keeps its preview until
   * something explicitly calls `invalidate()`. `master.integrations.tsx`
   * deliberately omits it — see the note at its call site.
   */
  inputs?: unknown;
}

export interface PreviewThenApplyController {
  state: PreviewApplyState;
  /** A run — either direction — is in flight. Fold this into a screen-wide
   * busy flag so nothing else writes to the same device underneath it. */
  isRunning: boolean;
  isPreviewing: boolean;
  isApplying: boolean;
  /** The read-back is in flight. The write has returned; nothing yet knows
   * whether it took. */
  isVerifying: boolean;
  preview: () => void;
  apply: () => void;
  /** Drop a held preview. Call this from anything outside the panel that
   * changes what Apply would do. */
  invalidate: () => void;
  reset: () => void;
}

export function usePreviewThenApply<TResult>(
  options: UsePreviewThenApplyOptions<TResult>,
): PreviewThenApplyController {
  const [state, dispatch] = useReducer(previewApplyReducer, PREVIEW_APPLY_INITIAL);
  const [verifying, bumpVerifying] = useReducer((n: number, d: 1 | -1) => Math.max(0, n + d), 0);

  // Read through a ref so the mutation's identity does not depend on inline
  // callbacks a caller re-creates every render.
  const opts = useRef(options);
  opts.current = options;

  const run = useMutation<TResult, unknown, boolean>({
    mutationFn: (dryRun: boolean) => opts.current.run(dryRun),
    onSuccess: async (result, dryRun) => {
      const o = opts.current;
      const outcome = o.toOutcome(result);
      dispatch({ type: "run-succeeded", dryRun, outcome });

      if (dryRun) {
        o.onPreviewed?.(outcome);
        return;
      }

      // A surface that has declared it cannot read back resolves
      // synchronously: there is nothing to wait for, and interposing a
      // microtask would reorder a caller's toast against its own refetch.
      if (o.readBack.kind === "not-read-back") {
        const confirmation: WriteConfirmation = {
          state: "not-read-back",
          why: o.readBack.why,
        };
        dispatch({ type: "confirmed", confirmation });
        o.onApplied?.(outcome, confirmation);
        return;
      }

      bumpVerifying(1);
      let confirmation: WriteConfirmation;
      try {
        confirmation = await o.readBack.verify(result);
      } catch (err) {
        // The read-back failed, which says nothing about the write. Reporting
        // it as a failed write would be the same invention in the other
        // direction.
        confirmation = {
          state: "unreadable",
          detail:
            err instanceof Error && err.message
              ? `Could not read the configuration back — ${err.message}`
              : "Could not read the configuration back, so nothing here has confirmed the change took.",
        };
      } finally {
        bumpVerifying(-1);
      }
      dispatch({ type: "confirmed", confirmation });
      o.onApplied?.(outcome, confirmation);
    },
    onError: (err) => {
      const gaps = refusalGapsFromError(err);
      if (gaps) {
        dispatch({ type: "run-refused", gaps });
        opts.current.onRefused?.(gaps);
        return;
      }
      dispatch({ type: "run-failed" });
      opts.current.onFailed?.(err);
    },
  });

  const { mutate } = run;
  const preview = useCallback(() => mutate(true), [mutate]);
  const apply = useCallback(() => mutate(false), [mutate]);
  const invalidate = useCallback(() => dispatch({ type: "invalidate" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  // Stale-preview invalidation. Skipped on the first render, because mounting
  // is not an edit.
  const inputs = options.inputs;
  const seenFirstInputs = useRef(false);
  useEffect(() => {
    if (!seenFirstInputs.current) {
      seenFirstInputs.current = true;
      return;
    }
    dispatch({ type: "invalidate" });
  }, [inputs]);

  return {
    state,
    isRunning: run.isPending || verifying > 0,
    isPreviewing: run.isPending && run.variables === true,
    isApplying: run.isPending && run.variables === false,
    isVerifying: verifying > 0,
    preview,
    apply,
    invalidate,
    reset,
  };
}
