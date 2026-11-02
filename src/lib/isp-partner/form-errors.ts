/**
 * ERROR-COPY: a failed save, split into "under this field" messages and one
 * form-level message, for the big partner forms (onboarding, package rules,
 * renew/recharge, billing settings, CAF, fiber, zones).
 *
 * Sources, in order:
 *  - a Pydantic 422 (`data.errors[]`, each with `loc`/`type`/`msg`/`ctx`):
 *    `loc` minus its "body"/"query" prefix is matched against `fields`
 *    (full dotted path first, then the last name);
 *  - an ISP error with `data.field` (e.g. `ISP_BAD_REQUEST`, field "gstin").
 *
 * A field error the form has no input for still reaches the user, named, in
 * `form` ("PIN code: Enter at least 6 characters."). Nothing is ever shown
 * as JSON or as a raw code.
 */
import { requestErrorOf } from "@/services/api";
import { translate } from "./error-copy";
import { describeIspError, fieldNameFromLoc, humanizeField, pydanticMessage } from "./errors";

export interface IspFormErrors {
  /** form field key -> message to show under that field */
  fields: Record<string, string>;
  /** one message for the top / bottom of the form, or null */
  form: string | null;
  /** the first form field key with an error (scroll/focus target) */
  first: string | null;
}

export interface IspFormErrorOptions {
  /** backend name (dotted `loc` path or last segment) -> form field key.
   * Names not listed map to themselves when `known` includes them. */
  fields?: Record<string, string>;
  /** form field keys the form can show an error under. When omitted, every
   * mapped or raw name counts as showable. */
  known?: readonly string[];
  /** form field key -> label used when the error cannot sit under it */
  labels?: Record<string, string>;
  /** match on the first path segment instead of the last (forms whose body
   * is grouped by section, e.g. onboarding's `kyc.pin_code` -> "kyc") */
  segment?: "first" | "last";
}

const FIX_FIELDS = "Fix the highlighted fields and try again.";

export function ispFormErrors(err: unknown, opts: IspFormErrorOptions = {}): IspFormErrors {
  const e = requestErrorOf(err);
  const out: IspFormErrors = { fields: {}, form: null, first: null };
  if (!e) {
    out.form = describeIspError(err).message;
    return out;
  }
  const map = opts.fields ?? {};
  const known = opts.known ? new Set(opts.known) : null;
  const stray: string[] = [];

  const place = (name: string, message: string) => {
    const parts = name.split(".").filter((p) => !/^\d+$/.test(p));
    const last = parts[parts.length - 1] ?? name;
    const pick = opts.segment === "first" ? (parts[0] ?? name) : last;
    const key = map[name] ?? map[parts.join(".")] ?? map[pick] ?? pick;
    if (known && !known.has(key)) {
      const label = opts.labels?.[key] ?? opts.labels?.[last] ?? humanizeField(name);
      stray.push(`${label}: ${message}`);
      return;
    }
    if (!out.fields[key]) out.fields[key] = message;
    out.first ??= key;
  };

  const errors = (e.data as { errors?: unknown } | undefined)?.errors;
  if (e.status === 422 && Array.isArray(errors)) {
    for (const raw of errors) {
      const one = raw as {
        loc?: unknown[];
        type?: string;
        msg?: string;
        ctx?: Record<string, unknown>;
      };
      const name = fieldNameFromLoc(one.loc);
      const message = pydanticMessage(one);
      if (name) place(name, message);
      else stray.push(message);
    }
  } else {
    const info = describeIspError(e);
    if (info.field) place(info.field, info.message);
    else out.form = info.message;
  }

  if (stray.length) out.form = stray.join(" ");
  else if (!out.form && out.first) out.form = FIX_FIELDS;
  return out;
}

/** For a form that shows one message: every field error, named by its
 * label ("Price: Must be 1 or more."), else the worded failure. */
export function ispFormMessage(
  err: unknown,
  labels: Record<string, string> = {},
  fallback?: string,
): string {
  const r = ispFormErrors(err, { known: [], labels });
  const text = r.form ?? describeIspError(err).message;
  const info = describeIspError(err);
  if (fallback && ["network", "timeout", "server", "other"].includes(info.kind)) {
    return `${fallback} ${text}`;
  }
  return info.showReference && info.requestId
    ? `${text} (${translate("ui.reference", { id: info.requestId })})`
    : text;
}
