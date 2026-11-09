/**
 * Runs one job at a time and drops any call made while one is in flight.
 *
 * For a button whose job writes a row: `disabled` alone only takes effect
 * after React re-renders, so two quick clicks can both get through. This
 * flag is set synchronously, inside the first click.
 *
 * Pure and dependency-free so `scripts/test-block-single-submit.mjs` can
 * execute it.
 */
export interface SingleFlight {
  /** Resolves true if `job` ran, false if the call was dropped. */
  run(job: () => Promise<void>): Promise<boolean>;
}

export function createSingleFlight(): SingleFlight {
  let inFlight = false;
  return {
    async run(job) {
      if (inFlight) return false;
      inFlight = true;
      try {
        await job();
        return true;
      } finally {
        inFlight = false;
      }
    },
  };
}
