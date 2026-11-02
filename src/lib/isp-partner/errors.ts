/**
 * The ISP API's machine error codes (API_CONTRACT §9) and what the partner
 * UI says for each. All words live in `error-copy.ts` (one module, ready for
 * Hindi); this file only decides which words apply.
 *
 * The code travels in the error envelope's `data.code`; a few broad codes
 * (`ISP_BAD_REQUEST`, `ISP_APPS_INVALID`, ...) add a stable sub-code in
 * `data.reason` (ERROR-COPY). `toAppError` keeps `data` intact but sets its
 * own `code` (`forbidden`, `validation_error`, a slug of the message), so
 * `data.code` has to be read explicitly.
 *
 * Never shown to a partner user: raw codes, JSON, stack text, axios's
 * "Request failed with status 422", or the platform's tunnel wording.
 */
import { requestErrorOf, type AppError } from "@/services/api";
import { abilityLabel, hasCopy, translate } from "./error-copy";

export function ispErrorCode(err: unknown): string | null {
  const e = requestErrorOf(err);
  const code = e?.data?.code;
  return typeof code === "string" ? code : null;
}

export function ispErrorReason(err: unknown): string | null {
  const reason = requestErrorOf(err)?.data?.reason;
  return typeof reason === "string" ? reason : null;
}

export function ispErrorStatus(err: unknown): number | null {
  return requestErrorOf(err)?.status ?? null;
}

export function ispRequestId(err: unknown): string | null {
  return requestErrorOf(err)?.requestId || null;
}

/** Codes that cover many situations: the backend's own sentence is more
 * specific than ours, so it is shown when it reads as plain English. */
const BROAD_CODES = new Set([
  "ISP_ERROR",
  "ISP_BAD_REQUEST",
  "ISP_APPS_INVALID",
  "ISP_APPS_CONFLICT",
  "ISP_APPS_NOT_FOUND",
  "ISP_FINANCE_INVALID",
  "ISP_FINANCE_NOT_FOUND",
  "ISP_FIBER_INVALID",
  "ISP_FIBER_CONFLICT",
  "ISP_DISCOUNT_INVALID",
  "ISP_REFERRAL_INVALID",
  "ISP_PROFILE_INVALID",
  "ISP_INCIDENT_STATE",
  "ISP_QUEUED_RENEWAL_STATE",
  "ISP_AUTOMATION_ERROR",
  "ISP_PPPOE_SCRIPT_PARAM",
  "ISP_ONBOARD_STEP_FAILED",
  "ISP_NAME_TAKEN",
]);

const INTERNAL_WORDS = /\b(tunnel|wireguard|vpn|wg0)\b/i;

/** True when a backend sentence can go on screen as is: plain words, no
 * identifiers, no JSON, no stack text, no platform internals. */
export function isPresentable(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const t = text.trim();
  if (t.length < 3 || t.length > 220) return false;
  if (!/^[A-Z0-9"'(]/.test(t)) return false; // engineer-English starts lowercase
  if (/[{}<>[\]=`\\]/.test(t)) return false;
  if (/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/.test(t)) return false; // snake_case
  if (/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(t)) return false; // CODES
  if (/traceback|exception|error:|\bnull\b|undefined|NaN|request failed with status/i.test(t))
    return false;
  if (
    /^(not found|forbidden|internal server error|invalid request|bad request|http error)$/i.test(t)
  )
    return false;
  if (INTERNAL_WORDS.test(t)) return false;
  return true;
}

export type IspErrorKind =
  | "network"
  | "timeout"
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "server"
  | "other";

export interface IspErrorInfo {
  kind: IspErrorKind;
  /** One or two sentences: what happened and what to do next. */
  message: string;
  status: number | null;
  code: string | null;
  reason: string | null;
  /** Backend field name for a single-field error (`data.field`). */
  field: string | null;
  requestId: string | null;
  /** A retry may succeed (network, timeout, 429, 5xx). */
  retryable: boolean;
  /** The data changed under the user: offer Refresh. */
  refresh: boolean;
  /** Show the request id + "Copy details" (5xx and anything unexplained). */
  showReference: boolean;
}

function vars(e: AppError | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e?.data ?? {})) {
    if (typeof v === "number" || typeof v === "string") out[k] = v;
  }
  return out;
}

/** `Permission denied: 'isp_billing.manage' is required` -> the key. */
export function missingPermission(err: unknown): string | null {
  const m = /'([a-z0-9_]+\.[a-z0-9_]+)'/i.exec(requestErrorOf(err)?.message ?? "");
  return m ? m[1] : null;
}

function kindOf(e: AppError): IspErrorKind {
  const s = e.status;
  if (s === null) {
    return e.transportCode === "ECONNABORTED" || e.transportCode === "ETIMEDOUT"
      ? "timeout"
      : "network";
  }
  if (s === 401) return "auth";
  if (s === 403) return "forbidden";
  if (s === 404) return "not_found";
  if (s === 409) return "conflict";
  if (s === 422 || s === 400) return "validation";
  if (s === 429) return "rate_limited";
  if (s === 408 || s === 504) return "timeout";
  if (s >= 500) return "server";
  return "other";
}

function statusCopy(e: AppError, kind: IspErrorKind): string {
  switch (kind) {
    case "network":
      return translate("status.network");
    case "timeout":
      return translate("status.timeout");
    case "auth":
      return translate("status.401");
    case "forbidden": {
      const key = missingPermission(e);
      return key
        ? translate("status.403_ability", { ability: abilityLabel(key) })
        : translate("status.403");
    }
    case "not_found":
      return translate("status.404");
    case "conflict":
      return translate("status.409");
    case "validation":
      return translate("status.422");
    case "rate_limited":
      return translate("status.429");
    case "server":
      return translate("status.5xx");
    default:
      return translate(e.status && e.status < 500 ? "status.4xx" : "status.unknown");
  }
}

/** Everything the UI needs to show one failure. */
export function describeIspError(err: unknown): IspErrorInfo {
  const e = requestErrorOf(err);
  if (!e) {
    return {
      kind: "other",
      message: translate("status.unknown"),
      status: null,
      code: null,
      reason: null,
      field: null,
      requestId: null,
      retryable: true,
      refresh: false,
      showReference: false,
    };
  }
  const kind = kindOf(e);
  const code = ispErrorCode(e);
  const reason = ispErrorReason(e);
  const field = typeof e.data?.field === "string" ? e.data.field : null;
  const v = vars(e);

  let message: string | null = null;
  if (reason && hasCopy(`code.${reason}`)) message = translate(`code.${reason}`, v);
  if (!message && code && BROAD_CODES.has(code) && isPresentable(e.message)) message = e.message;
  if (!message && code && hasCopy(`code.${code}`)) message = translate(`code.${code}`, v);
  if (!message && kind === "validation") message = validationSummary(e);
  if (!message) message = statusCopy(e, kind);

  const known = Boolean(code && hasCopy(`code.${code}`));
  return {
    kind,
    message,
    status: e.status,
    code,
    reason,
    field,
    requestId: e.requestId || null,
    retryable: ["network", "timeout", "rate_limited", "server"].includes(kind),
    refresh:
      kind === "conflict" || reason === "ISP_STATUS_CHANGED" || reason === "ISP_QUERY_INVALID",
    showReference: kind === "server" || (!known && kind === "other"),
  };
}

/** The first Pydantic field error as "Field: message", when the 422 has them. */
function validationSummary(e: AppError): string | null {
  const errors = (e.data as { errors?: unknown } | undefined)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0] as {
    loc?: unknown[];
    type?: string;
    msg?: string;
    ctx?: Record<string, unknown>;
  };
  const name = fieldNameFromLoc(first.loc);
  const text = pydanticMessage(first);
  return name ? translate("field.named", { field: humanizeField(name), message: text }) : text;
}

/** `["body", "kyc", "pin_code"]` -> `kyc.pin_code` (location prefix dropped). */
export function fieldNameFromLoc(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null;
  const parts = loc.filter(
    (p, i) => !(i === 0 && ["body", "query", "path", "header"].includes(String(p))),
  );
  const named = parts.filter((p) => typeof p === "string");
  return named.length ? parts.map(String).join(".") : null;
}

/** `credit_limit_paise` -> "Credit limit"; `isp_customer_id` -> "Customer". */
export function humanizeField(name: string): string {
  const last =
    name
      .split(".")
      .filter((p) => !/^\d+$/.test(p))
      .pop() ?? name;
  const words = last
    .replace(/_(id|ids|paise)$/i, "")
    .replace(/^isp_/i, "")
    .replace(/_/g, " ")
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "This field";
}

/** One Pydantic error object -> plain words. */
export function pydanticMessage(err: {
  type?: string;
  msg?: string;
  ctx?: Record<string, unknown>;
}): string {
  const type = err.type ?? "";
  const ctx = err.ctx ?? {};
  if (type === "string_too_short" && ctx.min_length !== undefined)
    return translate("field.string_too_short_n", ctx);
  if (type === "string_too_long" && ctx.max_length !== undefined)
    return translate("field.string_too_long_n", ctx);
  if (type === "value_error") {
    const msg = String(err.msg ?? "").replace(/^Value error,\s*/i, "");
    if (/email/i.test(msg)) return translate("field.value_error.email");
    if (isPresentable(msg)) return msg.endsWith(".") ? msg : `${msg}.`;
    return translate("field.invalid");
  }
  if (hasCopy(`field.${type}`)) return translate(`field.${type}`, ctx);
  if (type.startsWith("enum") || type.startsWith("literal")) return translate("field.enum");
  return translate("field.invalid");
}

/** One sentence for any request failure. Known codes get our wording;
 * broad codes may use the backend's own plain sentence; everything else
 * gets the status-class copy. For a 5xx (or anything unexplained) the
 * support reference is appended, since string-only callers have no other
 * place to show it. `fallback` is used for non-request failures and as a
 * lead-in for network/server failures ("Could not save the package."). */
export function ispErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (!requestErrorOf(err)) return fallback;
  const info = describeIspError(err);
  let text = info.message;
  const custom = fallback !== "Something went wrong.";
  if (custom && ["network", "timeout", "server", "other"].includes(info.kind)) {
    text = `${fallback} ${text}`;
  }
  if (info.showReference && info.requestId) {
    text = `${text} (${translate("ui.reference", { id: info.requestId })})`;
  }
  return text;
}

/** Plain-text block for "Copy details": what support needs, no JSON. */
export function ispErrorDetails(err: unknown, now: Date = new Date()): string {
  const info = describeIspError(err);
  const lines = [
    info.message,
    `Status: ${info.status ?? "no answer"}`,
    info.code ? `Code: ${info.code}${info.reason ? ` / ${info.reason}` : ""}` : null,
    info.requestId ? `Reference: ${info.requestId}` : null,
    `Time: ${now.toISOString()}`,
    typeof window !== "undefined" ? `Page: ${window.location.pathname}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** 422 field errors keyed by backend field name (last `loc` segment, or
 * `data.field`), worded for the operator. Use `ispFormErrors` (form-errors.ts)
 * to map them onto a form's own field keys. */
export function ispFieldErrors(err: unknown): Record<string, string> {
  const e = requestErrorOf(err);
  if (!e) return {};
  const out: Record<string, string> = {};
  const errors = (e.data as { errors?: unknown } | undefined)?.errors;
  if (Array.isArray(errors)) {
    for (const raw of errors) {
      const one = raw as {
        loc?: unknown[];
        type?: string;
        msg?: string;
        ctx?: Record<string, unknown>;
      };
      const name = fieldNameFromLoc(one.loc);
      if (!name) continue;
      const key =
        name
          .split(".")
          .filter((p) => !/^\d+$/.test(p))
          .pop() ?? name;
      out[key] ??= pydanticMessage(one);
    }
  }
  const info = describeIspError(e);
  if (info.field && !out[info.field]) out[info.field] = info.message;
  return out;
}

export function isForbidden(err: unknown): boolean {
  return ispErrorStatus(err) === 403;
}

export function isNotFound(err: unknown): boolean {
  return ispErrorStatus(err) === 404;
}

/** For sign-in / password screens, whose backend sentences are written for
 * people ("Invalid email or password"): show that sentence when it reads as
 * plain English, else the worded status copy, else `fallback`. */
export function ispPlainMessage(err: unknown, fallback: string): string {
  const e = requestErrorOf(err);
  if (!e) return fallback;
  if (e.status !== null && e.status < 500 && isPresentable(e.message)) return e.message;
  return ispErrorMessage(err, fallback);
}
