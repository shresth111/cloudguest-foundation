import type {
  AdapterField,
  AdapterSchema,
  HeaderView,
  LoginProviderPut,
  LoginProviderView,
  SecretStub,
} from "@/types/login-messaging";

/**
 * Form state for one login-messaging adapter, built only from the adapter's
 * declared fields (`GET .../guest-messaging/providers` -> `adapters`).
 *
 * Secrets are write-only: a secret input always starts EMPTY, the stored
 * `{set, hint}` becomes its placeholder, and a blank secret is left out of
 * the PUT so the server keeps the stored value. Secret header values follow
 * the same rule.
 */

export type HeaderRow = { name: string; value: string; secret: boolean; stored?: SecretStub };
export type FieldValue = string | boolean | HeaderRow[];
export type FormValues = Record<string, FieldValue>;

export function isSecretStub(v: unknown): v is SecretStub {
  return !!v && typeof v === "object" && "set" in v && "hint" in v;
}

export function secretPlaceholder(stub: unknown): string | undefined {
  return isSecretStub(stub) && stub.set ? `Saved (${stub.hint}). Leave blank to keep.` : undefined;
}

export function initialValues(schema: AdapterSchema, own: LoginProviderView | null): FormValues {
  const display = own && own.provider_type === schema.key ? own.display : null;
  const out: FormValues = {};
  for (const f of schema.fields) {
    const stored = display?.[f.name];
    if (f.kind === "secret") out[f.name] = "";
    else if (f.kind === "headers") {
      out[f.name] = Array.isArray(stored)
        ? (stored as HeaderView[]).map((h) =>
            h.secret
              ? { name: h.name, value: "", secret: true, stored: { set: h.set, hint: h.hint } }
              : { name: h.name, value: h.value, secret: false },
          )
        : [];
    } else if (f.kind === "boolean") {
      out[f.name] = typeof stored === "boolean" ? stored : f.default === true;
    } else {
      out[f.name] =
        stored !== undefined && stored !== null
          ? String(stored)
          : f.default !== undefined && f.default !== null
            ? String(f.default)
            : "";
    }
  }
  return out;
}

function sameType(schema: AdapterSchema, own: LoginProviderView | null): boolean {
  return !!own && own.provider_type === schema.key;
}

export function buildPut(
  schema: AdapterSchema,
  values: FormValues,
  own: LoginProviderView | null,
): { body: LoginProviderPut | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const config: Record<string, unknown> = {};
  const keep = sameType(schema, own);
  for (const f of schema.fields) {
    const v = values[f.name];
    if (f.kind === "headers") {
      const rows = (Array.isArray(v) ? v : []).filter((h) => h.name.trim() || h.value);
      for (const h of rows) {
        if (!h.name.trim()) errors[f.name] = "Every header needs a name";
        if (!h.value && !(h.secret && h.stored?.set)) errors[f.name] = `'${h.name}' needs a value`;
      }
      config[f.name] = rows.map((h) =>
        h.secret && !h.value
          ? { name: h.name.trim(), secret: true }
          : { name: h.name.trim(), value: h.value, secret: h.secret },
      );
      continue;
    }
    if (f.kind === "boolean") {
      config[f.name] = v === true;
      continue;
    }
    const text = typeof v === "string" ? v.trim() : "";
    if (f.kind === "secret") {
      const stored = keep ? own?.display?.[f.name] : undefined;
      if (text) config[f.name] = text;
      else if (f.required && !(isSecretStub(stored) && stored.set)) errors[f.name] = "Required";
      continue;
    }
    if (!text) {
      if (f.required && (f.default === null || f.default === undefined || f.default === "")) {
        errors[f.name] = "Required";
      }
      if (keep) config[f.name] = null; // cleared: the server drops it or uses the default
      continue;
    }
    if (f.pattern && !new RegExp(`^(?:${f.pattern})$`).test(text)) {
      errors[f.name] = "Has the wrong format";
      continue;
    }
    config[f.name] = text;
  }
  if (Object.keys(errors).length > 0) return { body: null, errors };
  return { body: { provider_type: schema.key, config }, errors };
}

export function fieldValueText(field: AdapterField, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (field.kind === "secret")
    return isSecretStub(value) && value.set ? `Saved (${value.hint})` : null;
  if (field.kind === "headers") {
    const rows = Array.isArray(value) ? (value as HeaderView[]) : [];
    return rows.length
      ? rows
          .map((h) => (h.secret ? `${h.name}: Saved (${h.hint})` : `${h.name}: ${h.value}`))
          .join(", ")
      : null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
