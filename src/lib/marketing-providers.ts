/**
 * Bring-your-own provider forms (wyfy-specs/guest-marketing-campaigns.md
 * §12.2, §12.4): which fields each provider type takes, which are secret,
 * and how a form's state becomes a PUT body.
 *
 * THE SECRET RULE. A secret is never prefilled, never echoed and never held
 * after submit. The server shows only `{set, hint}`; a secret input starts
 * empty, and an empty secret input means "keep the stored one", which is an
 * OMITTED key in the PUT body (the server returns 422 for "" or null --
 * removing a secret means removing the provider). `buildProviderPut` is the
 * one place that rule is implemented, and scripts/test-marketing-ui.mjs
 * executes it.
 *
 * Dependency-free so the test can run it directly.
 */

export type Channel = "sms" | "whatsapp" | "email";

export interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  kind?: "text" | "number" | "select" | "boolean" | "email";
  options?: { value: string; label: string }[];
  help?: string;
}

export interface ProviderTypeDef {
  type: string;
  label: string;
  channel: Channel;
  /** false = listed in the contract but its backend adapter ships later. */
  available: boolean;
  fields: ProviderField[];
}

export const PROVIDER_TYPES: ProviderTypeDef[] = [
  {
    type: "ping4sms",
    label: "Ping4SMS",
    channel: "sms",
    available: true,
    fields: [
      { key: "api_key", label: "API key", secret: true, required: true },
      { key: "route", label: "Promotional route", required: true, help: "Your Ping4SMS promotional route number." },
      { key: "sender_id", label: "Sender ID (DLT header)", required: true },
      { key: "dlt_entity_id", label: "DLT entity ID", required: true },
    ],
  },
  {
    type: "exotel",
    label: "Exotel",
    channel: "sms",
    available: true,
    fields: [
      { key: "api_key", label: "API key", secret: true, required: true },
      { key: "api_token", label: "API token", secret: true, required: true },
      { key: "account_sid", label: "Account SID", required: true },
      {
        key: "subdomain",
        label: "Region",
        kind: "select",
        required: true,
        options: [
          { value: "api.exotel.com", label: "Singapore (api.exotel.com)" },
          { value: "api.in.exotel.com", label: "Mumbai (api.in.exotel.com)" },
        ],
      },
      { key: "sender_id", label: "Sender ID (DLT header)", required: true },
      { key: "dlt_entity_id", label: "DLT entity ID", required: true },
    ],
  },
  {
    type: "smtp",
    label: "SMTP server",
    channel: "email",
    available: true,
    fields: [
      { key: "host", label: "Host", required: true, help: "Must be reachable on the internet." },
      {
        key: "port",
        label: "Port",
        kind: "select",
        required: true,
        options: ["587", "465", "25", "2525"].map((p) => ({ value: p, label: p })),
      },
      { key: "use_tls", label: "Use TLS", kind: "boolean" },
      { key: "username", label: "Username", required: true },
      { key: "password", label: "Password", secret: true, required: true },
      { key: "from_address", label: "From address", kind: "email", required: true },
      { key: "from_name", label: "From name", required: true },
      { key: "reply_to", label: "Reply-to (optional)", kind: "email" },
    ],
  },
  {
    type: "ses",
    label: "Amazon SES",
    channel: "email",
    available: true,
    fields: [
      { key: "access_key_id", label: "Access key ID", secret: true, required: true },
      { key: "secret_access_key", label: "Secret access key", secret: true, required: true },
      { key: "region", label: "Region", required: true, help: "For example ap-south-1." },
      {
        key: "from_address",
        label: "From address",
        kind: "email",
        required: true,
        help: "Must be a verified identity in your SES account.",
      },
      { key: "from_name", label: "From name", required: true },
      { key: "configuration_set", label: "Configuration set (optional)" },
    ],
  },
  {
    type: "meta_cloud",
    label: "WhatsApp Cloud API (Meta)",
    channel: "whatsapp",
    // BE-11b: the WhatsApp adapter, verify and template sync ship in a
    // follow-up. The server answers 422 provider_type_not_supported until then.
    available: false,
    fields: [
      { key: "phone_number_id", label: "Phone number ID", required: true },
      { key: "waba_id", label: "WhatsApp Business Account ID", required: true },
      { key: "access_token", label: "System-user access token", secret: true, required: true },
    ],
  },
];

export function providerTypesFor(channel: Channel): ProviderTypeDef[] {
  return PROVIDER_TYPES.filter((t) => t.channel === channel);
}

export function providerTypeDef(type: string | null | undefined): ProviderTypeDef | undefined {
  return PROVIDER_TYPES.find((t) => t.type === type);
}

export function providerLabel(type: string | null | undefined): string {
  return providerTypeDef(type)?.label ?? type ?? "provider";
}

export interface SecretHintLike {
  set: boolean;
  hint: string | null;
}

export function isSecretHint(v: unknown): v is SecretHintLike {
  return !!v && typeof v === "object" && "set" in (v as object);
}

/** The placeholder a secret input shows: never the value, only the hint. */
export function secretPlaceholder(hint: SecretHintLike | undefined): string {
  if (!hint?.set) return "";
  return `Saved (${hint.hint ?? "…"}). Leave blank to keep.`;
}

/**
 * The initial form values: non-secret fields from `display`, secrets ALWAYS
 * empty (a secret is never prefilled).
 */
export function initialProviderValues(
  def: ProviderTypeDef,
  display: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.secret) {
      out[f.key] = "";
      continue;
    }
    const v = display?.[f.key];
    out[f.key] =
      v === null || v === undefined || isSecretHint(v)
        ? f.kind === "boolean"
          ? "true"
          : f.kind === "select" && f.options?.length
            ? f.options[0].value
            : ""
        : String(v);
  }
  return out;
}

export interface BuildResult {
  body: {
    provider_type: string;
    config: Record<string, string | number | boolean>;
    enabled?: boolean | null;
  } | null;
  /** field key -> problem, for fields the client can already see are wrong. */
  errors: Record<string, string>;
}

/**
 * Form state -> PUT body.
 *
 *  - A blank secret is OMITTED (keep the stored one). On a create, or when
 *    the provider type changes (a full replace on the server), every
 *    required secret must be typed, because there is nothing stored to keep.
 *  - On an update, only fields that changed are sent; unchanged non-secret
 *    fields are left out too, so an untouched Save is a no-op body.
 *  - `port` is sent as a number, `use_tls` as a boolean.
 */
export function buildProviderPut(
  def: ProviderTypeDef,
  values: Record<string, string>,
  stored: { provider_type: string; display: Record<string, unknown> } | null,
): BuildResult {
  const replace = !stored || stored.provider_type !== def.type;
  const errors: Record<string, string> = {};
  const config: Record<string, string | number | boolean> = {};
  for (const f of def.fields) {
    const raw = (values[f.key] ?? "").trim();
    if (f.secret) {
      if (raw) config[f.key] = raw;
      else if (replace && f.required) errors[f.key] = "Required.";
      continue;
    }
    if (!raw) {
      if (f.required) errors[f.key] = "Required.";
      continue;
    }
    const value: string | number | boolean =
      f.key === "port" ? Number(raw) : f.kind === "boolean" ? raw === "true" : raw;
    if (f.kind === "email" && !/^\S+@\S+\.\S+$/.test(raw)) errors[f.key] = "Not an email address.";
    const before = stored?.display?.[f.key];
    if (replace || before === undefined || String(before) !== String(value)) config[f.key] = value;
  }
  if (Object.keys(errors).length > 0) return { body: null, errors };
  return { body: { provider_type: def.type, config }, errors };
}

/**
 * §12.1: the channel has an own provider row that is NOT what sends right
 * now (enabled but unverified, failed, or disabled) -- so a new campaign
 * falls back to Wyfy, and (founder decision Q11, option A) only after an
 * explicit acknowledgement.
 */
export function needsFallbackAcknowledgement(status: {
  provider_source?: string;
  own_provider_status?: string | null;
}): boolean {
  return (status.provider_source ?? "wyfy") === "wyfy" && !!status.own_provider_status;
}

/** Why the own provider is not the one sending, in the composer's words. */
export function fallbackReason(
  channelLabel: string,
  status: { own_provider_status?: string | null; byo_entitled?: boolean },
): string {
  const own = `Your own ${channelLabel} provider`;
  const tail = `This campaign will be sent through Wyfy's default ${channelLabel} account.`;
  if (status.byo_entitled === false)
    return `${own} can't be used: the bring-your-own add-on isn't active. ${tail}`;
  switch (status.own_provider_status) {
    case "failed":
      return `${own} failed verification. ${tail}`;
    case "unverified":
      return `${own} hasn't been verified yet. ${tail}`;
    default:
      return `${own} is turned off. ${tail}`;
  }
}
