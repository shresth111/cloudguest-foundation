/**
 * How a network-diagnostics run is described to a human.
 *
 * Shared by the Master console's router Diagnostics tab
 * (`components/routers/RouterDetailTabs.tsx`) and the customer dashboard's
 * Connection Tools page (`DebuggingView` in
 * `components/features/OperationsFeatures.tsx`). Both used to carry their
 * own copy of this, and they had already drifted -- the master console
 * rounded RTT to one decimal and printed `* (no reply)` for a silent hop,
 * the customer page printed the raw float and a bare `*`. Keep the
 * derivations here; keep the JSX in the components.
 *
 * ── THE OUTCOME AXIS ────────────────────────────────────────────────────
 * `DiagnosticRun.status` answers "did the command run", NOT "did the
 * target answer". The backend is explicit about this
 * (`app/domains/network_diagnostics/constants.py`'s `DiagnosticStatus`:
 * FAILED "covers both a genuine device-connection failure and a
 * completed-but-unreachable-target result"), and a ping to a dead address
 * comes back `status: "success"` carrying `received: 0,
 * packet_loss_percentage: 100` -- `device_adapters.py` returns exactly
 * that when RouterOS reports no replies.
 *
 * The customer page coloured on `status` alone, so a venue owner whose
 * internet was down got a green tick, a green "Last result: Success" tile
 * and a green "completed" toast over the line
 * `8.8.8.8 — 0/4 received (100% loss)`. The single most useful thing this
 * page can say, said backwards.
 *
 * So `diagnosticVerdict` reads `result`, not `status`, and returns both
 * axes separately: `executed` (did the router run it) and `outcome` (what
 * it found). Colour follows `outcome`.
 */
import type { AppError } from "@/services/api";
import { humanizeApiError } from "@/lib/errorMessages";
import type {
  DiagnosticRun,
  PingRunResult,
  TracerouteHop,
  TracerouteRunResult,
} from "@/types/network-diagnostics";

/** What the check found. Independent of whether the command executed. */
export type DiagnosticOutcome =
  /** The target answered every probe. */
  | "reached"
  /** The target answered, but not every probe came back. */
  | "degraded"
  /** The command ran and the target never answered. */
  | "unreachable"
  /** The command did not run -- device unreachable, credentials, etc. */
  | "failed"
  /** It ran, but returned nothing we can read. */
  | "unknown";

export type DiagnosticTone = "success" | "warning" | "danger";

export interface DiagnosticVerdict {
  outcome: DiagnosticOutcome;
  tone: DiagnosticTone;
  /** True when the router actually executed the command. */
  executed: boolean;
  /** One plain sentence, target-first. */
  headline: string;
  /** The measurement behind it, or null when there is none. */
  detail: string | null;
}

const TONE_BY_OUTCOME: Record<DiagnosticOutcome, DiagnosticTone> = {
  reached: "success",
  degraded: "warning",
  unreachable: "danger",
  failed: "danger",
  unknown: "warning",
};

/** `"success"` is what this backend writes. `"completed"` is accepted only
 * because the master console has always accepted it; nothing in
 * `DiagnosticStatus` emits it, so treat it as legacy tolerance, not a
 * second real state. */
export function didDiagnosticExecute(run: Pick<DiagnosticRun, "status">): boolean {
  return run.status === "success" || run.status === "completed";
}

export function pingResultOf(run: Pick<DiagnosticRun, "result">): PingRunResult | null {
  const r = run.result as unknown as PingRunResult | undefined;
  if (!r || typeof r.sent !== "number") return null;
  return r;
}

export function tracerouteHopsOf(run: Pick<DiagnosticRun, "result">): TracerouteHop[] {
  const r = run.result as unknown as TracerouteRunResult | undefined;
  return Array.isArray(r?.hops) ? r.hops : [];
}

const label = (kind: string) => (kind === "traceroute" ? "traceroute" : "ping");

function rtt(ms: number | null | undefined): string | null {
  return typeof ms === "number" && Number.isFinite(ms) ? `${ms.toFixed(1)} ms` : null;
}

/** Percentage that actually came back, preferring the counters over the
 * device's own float -- `received`/`sent` are integers RouterOS reports
 * directly, `packet-loss` is derived and can disagree by a rounding step. */
function lossPercent(r: PingRunResult): number {
  if (r.sent > 0) return Math.round((1 - r.received / r.sent) * 1000) / 10;
  return typeof r.packet_loss_percentage === "number" ? r.packet_loss_percentage : 100;
}

function pingVerdict(run: DiagnosticRun): DiagnosticVerdict {
  const r = pingResultOf(run);
  if (!r || r.sent <= 0) {
    return {
      outcome: "unknown",
      tone: TONE_BY_OUTCOME.unknown,
      executed: true,
      headline: `The router ran the ping but recorded no measurement for ${run.target}.`,
      detail: null,
    };
  }
  const loss = lossPercent(r);
  const avg = rtt(r.avg_rtt_ms);
  const counts = `${r.received} of ${r.sent} replies`;

  if (r.received <= 0) {
    return {
      outcome: "unreachable",
      tone: TONE_BY_OUTCOME.unreachable,
      executed: true,
      headline: `${run.target} did not answer.`,
      detail: `${counts} — 100% packet loss.`,
    };
  }
  if (r.received < r.sent || loss > 0) {
    return {
      outcome: "degraded",
      tone: TONE_BY_OUTCOME.degraded,
      executed: true,
      headline: `${run.target} answered, but packets are being lost.`,
      detail: [counts, `${loss}% packet loss`, avg && `${avg} average round trip`]
        .filter(Boolean)
        .join(" — "),
    };
  }
  return {
    outcome: "reached",
    tone: TONE_BY_OUTCOME.reached,
    executed: true,
    headline: `${run.target} answered every time.`,
    detail: [counts, avg && `${avg} average round trip`].filter(Boolean).join(" — "),
  };
}

function tracerouteVerdict(run: DiagnosticRun): DiagnosticVerdict {
  const hops = tracerouteHopsOf(run);
  if (hops.length === 0) {
    return {
      outcome: "unreachable",
      tone: TONE_BY_OUTCOME.unreachable,
      executed: true,
      headline: `No route to ${run.target} could be traced.`,
      detail: "The router did not get a reply from a single hop.",
    };
  }
  const replied = hops.filter((h) => !!h.address).length;
  const silent = hops.length - replied;
  // A hop that does not reply is ordinary -- plenty of routers on the
  // public internet drop the probe by policy -- so this is stated as a
  // fact and explicitly not as a fault. Only the FINAL hop decides whether
  // the destination was reached.
  const silentNote =
    silent > 0
      ? `${silent} of ${hops.length} hops did not reply, which is normal on the public internet.`
      : null;
  const last = hops[hops.length - 1];
  const reachedTarget = !!last.address && (last.packet_loss_percentage ?? 0) < 100;

  if (!reachedTarget) {
    const lastAnswering = [...hops].reverse().find((h) => !!h.address);
    return {
      outcome: "unreachable",
      tone: TONE_BY_OUTCOME.unreachable,
      executed: true,
      headline: `The route to ${run.target} stopped after ${hops.length} hops.`,
      detail: lastAnswering
        ? `The last device to answer was ${lastAnswering.address}.`
        : "No hop along the way answered.",
    };
  }
  const finalRtt = rtt(last.avg_rtt_ms);
  if ((last.packet_loss_percentage ?? 0) > 0) {
    return {
      outcome: "degraded",
      tone: TONE_BY_OUTCOME.degraded,
      executed: true,
      headline: `${run.target} was reached in ${hops.length} hops, but it is losing packets.`,
      detail: [
        `${last.packet_loss_percentage}% loss at the final hop`,
        finalRtt && `${finalRtt} to reach it`,
        silentNote,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  return {
    outcome: "reached",
    tone: TONE_BY_OUTCOME.reached,
    executed: true,
    headline: `${run.target} was reached in ${hops.length} hops.`,
    detail: [finalRtt && `${finalRtt} to reach it.`, silentNote].filter(Boolean).join(" "),
  };
}

/**
 * The two axes of one run: did it execute, and what did it find.
 *
 * Never colour on `run.status`. Use `verdict.tone`.
 */
export function diagnosticVerdict(run: DiagnosticRun): DiagnosticVerdict {
  if (!didDiagnosticExecute(run)) {
    return {
      outcome: "failed",
      tone: TONE_BY_OUTCOME.failed,
      executed: false,
      headline: `The ${label(run.diagnosticType)} could not be run.`,
      detail: describeRecordedFailure(run),
    };
  }
  return run.diagnosticType === "traceroute" ? tracerouteVerdict(run) : pingVerdict(run);
}

/** Compact one-line summary for a history row. Shared with the master
 * console, whose Diagnostics tab has rendered exactly this since it
 * shipped. Returns null when there is nothing measured to summarize. */
export function summarizeDiagnosticResult(run: DiagnosticRun): string | null {
  if (!didDiagnosticExecute(run)) return null;
  if (run.diagnosticType === "ping") {
    const r = pingResultOf(run);
    if (!r) return null;
    const avg = rtt(r.avg_rtt_ms);
    return `${r.received}/${r.sent} received · ${lossPercent(r)}% loss · ${avg ? `${avg} avg` : "no response"}`;
  }
  if (run.diagnosticType === "traceroute") {
    const hops = tracerouteHopsOf(run);
    if (!(run.result as unknown as TracerouteRunResult)?.hops) return null;
    return `${hops.length} hop${hops.length === 1 ? "" : "s"}`;
  }
  return null;
}

/* ── Keeping the router's address off the customer's screen ─────────── */

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const QUOTED_AFTER_AT = /\bat\s+'([^']*)'/gi;

/**
 * Strips device addresses and entity ids out of a message before it is
 * shown to a venue owner.
 *
 * The backend's diagnostics exceptions are written for an engineer reading
 * a log line and interpolate the router's own management IP:
 * `Could not connect to router at '10.20.0.1': <library exception>`, and
 * `Router '<uuid>' is missing device connection credentials`. Both were
 * being printed verbatim into a toast and a result panel on the customer
 * dashboard. A cafe owner has no use for a tunnel address and should not
 * be handed one.
 *
 * `keep` is the target the user themselves typed -- their own `8.8.8.8`
 * must survive, since redacting it would make the message nonsense. It is
 * the only address a customer is entitled to see here, because it is the
 * one they entered.
 */
export function redactDeviceAddresses(text: string, keep?: string | null): string {
  if (!text) return "";
  const preserved = (keep ?? "").trim().toLowerCase();
  const isPreserved = (value: string) => !!preserved && value.trim().toLowerCase() === preserved;

  let out = text.replace(QUOTED_AFTER_AT, (match, host: string) =>
    isPreserved(host) ? match : "",
  );
  out = out.replace(IPV4, (match) => (isPreserved(match) ? match : "the router"));
  out = out.replace(UUID, "this router");
  out = out.replace(/'(the router|this router)'/g, "$1");
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([:,.])/g, "$1")
    .replace(/:\s*$/, "")
    .trim();
}

/**
 * A recorded FAILED run's `errorMessage`, rewritten for a customer.
 *
 * These four shapes are every exception
 * `app/domains/network_diagnostics/exceptions.py` can put on a run, read
 * off that module rather than guessed. Anything unrecognised falls through
 * to the redactor, so a message added later is still stripped of addresses
 * even before anyone writes copy for it.
 */
export function describeRecordedFailure(run: Pick<DiagnosticRun, "errorMessage" | "target">) {
  const raw = run.errorMessage ?? "";
  if (/could not connect to router/i.test(raw)) {
    return "We could not reach this location's router. It may be powered off, or its connection back to us may be down.";
  }
  if (/missing device connection credentials/i.test(raw)) {
    return "This router has no saved connection details, so checks cannot be sent to it yet.";
  }
  if (/no diagnostics adapter registered/i.test(raw)) {
    return "This router's model does not support on-device checks.";
  }
  const operation = /operation '(\w+)' failed/i.exec(raw)?.[1];
  if (operation) {
    return `The router answered, but the ${label(operation)} command did not complete on the device.`;
  }
  const redacted = redactDeviceAddresses(raw, run.target);
  return redacted || "The check did not complete.";
}

/* ── Thrown API errors ──────────────────────────────────────────────── */

export interface DiagnosticProblem {
  title: string;
  description: string;
  /** False when trying again cannot possibly help (permissions, setup). */
  retryable: boolean;
}

/**
 * Turns a thrown `AppError` into something a venue owner can act on.
 *
 * Every non-2xx used to collapse into one sentence -- "Could not reach the
 * router to run this diagnostic." -- which was wrong for most of them. A
 * 403 (role lacks `network_diagnostics.execute`), a 422 (the router has no
 * stored credentials), a 404 (the router was deleted) and a client timeout
 * are four different problems with four different next steps, and the
 * router is perfectly reachable in three of them.
 *
 * THE TIMEOUT CASE IS THE DELICATE ONE. `services/api.ts` aborts at 20s,
 * and the backend's own traceroute budget (15 hops × 15s) can exceed that.
 * When the client gives up, the backend carries on and *records the run* --
 * so "we could not reach the router" was contradicted seconds later by a
 * completed row appearing in Recent runs. `toAppError` collapses an abort
 * and a dropped connection into the same `status: null`, so this reads the
 * elapsed time to tell them apart, and either way says only what stays
 * true: it may still be finishing, look in Recent runs.
 */
export function describeDiagnosticApiError(
  err: AppError,
  opts: { kind: "ping" | "traceroute"; target: string; elapsedMs: number; timeoutMs: number },
): DiagnosticProblem {
  const what = label(opts.kind);

  if (err.status === null) {
    const gaveUpWaiting = opts.elapsedMs >= opts.timeoutMs - 1000;
    return {
      title: gaveUpWaiting ? "We stopped waiting for the result" : "The request did not complete",
      description: gaveUpWaiting
        ? `We gave up after ${Math.round(opts.timeoutMs / 1000)} seconds. The ${what} may still be finishing on the router — check Recent runs in a moment.`
        : `The connection dropped before we got an answer. If the ${what} did reach the router, it will appear in Recent runs.`,
      retryable: true,
    };
  }
  if (err.status === 401) {
    return {
      title: "Your session has expired",
      description: "Sign in again to run checks on this router.",
      retryable: false,
    };
  }
  if (err.status === 403) {
    return {
      title: "You do not have permission to run this check",
      description:
        "Running a ping or traceroute needs the network diagnostics permission. Ask the account owner to grant it.",
      retryable: false,
    };
  }
  if (err.status === 404) {
    return {
      title: "That router is no longer registered here",
      description: "Reload the router list and try again.",
      retryable: true,
    };
  }
  if (err.status === 422) {
    if (/missing device connection credentials/i.test(err.message)) {
      return {
        title: "This router is not finished being set up",
        description:
          "It has no saved connection details, so checks cannot be sent to it. Contact support to complete its setup.",
        retryable: false,
      };
    }
    return {
      title: `${opts.target} was not accepted`,
      description: "Check the hostname or IP address and try again.",
      retryable: true,
    };
  }
  if (err.status >= 500) {
    return {
      title: "The check could not be started",
      description: "Something failed on our side, not on your router. Try again in a moment.",
      retryable: true,
    };
  }
  return {
    title: `The ${what} could not be run`,
    description: redactDeviceAddresses(
      humanizeApiError(err, "Please try again in a moment."),
      opts.target,
    ),
    retryable: true,
  };
}
