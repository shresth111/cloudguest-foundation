/**
 * DEMO ONLY -- bring-your-own provider state for the demo workspace
 * (spec §12). Imported only by ./demo-backend.ts, which itself is loaded
 * only for a demo session (see `useMarketingApi`).
 *
 * The demo org starts with a story worth clicking through:
 *   - Email: its own Amazon SES account, verified and on -- campaigns send
 *     through it and cost no Wyfy credits.
 *   - SMS: its own Ping4SMS account, switched on but FAILED verification --
 *     so the composer shows the "falls back to Wyfy" warning and requires the
 *     acknowledgement (founder decision Q11, option A).
 *   - WhatsApp: Wyfy's default number.
 *
 * Secrets are never stored here in any recoverable form: only the 4-char
 * hint the real API returns.
 */
import type {
  ChannelProviders,
  MarketingChannel,
  ProviderDeleteResult,
  ProviderPutPayload,
  ProviderStatus,
  ProviderVerifyPayload,
  ProviderVerifyResult,
  ProviderView,
} from "@/types/marketing";
import { providerLabel, providerTypeDef } from "@/lib/marketing-providers";

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const DEMO_USER = { id: "u-demo", name: "Demo Admin" };

function hint(secret: string): { set: true; hint: string } {
  return { set: true, hint: secret.length < 12 ? "…" : `…${secret.slice(-4)}` };
}

const rows = new Map<MarketingChannel, ProviderView>([
  [
    "email",
    {
      channel: "email",
      provider_type: "ses",
      enabled: true,
      status: "verified",
      last_verified_at: iso(now - 9 * 86_400_000),
      last_error: null,
      effective: true,
      display: {
        region: "ap-south-1",
        from_address: "offers@acmecafe.in",
        from_name: "Acme Cafe",
        configuration_set: null,
        access_key_id: { set: true, hint: "…Q7XA" },
        secret_access_key: { set: true, hint: "…9f2k" },
      },
      updated_at: iso(now - 9 * 86_400_000),
      updated_by: DEMO_USER,
    },
  ],
  [
    "sms",
    {
      channel: "sms",
      provider_type: "ping4sms",
      enabled: true,
      status: "failed",
      last_verified_at: iso(now - 2 * 86_400_000),
      last_error: "Ping4SMS: the DLT template ID isn't registered to header ACMECF.",
      effective: false,
      display: {
        route: "4",
        sender_id: "ACMECF",
        dlt_entity_id: "1101690000012345",
        api_key: { set: true, hint: "…c81d" },
      },
      updated_at: iso(now - 2 * 86_400_000),
      updated_by: DEMO_USER,
    },
  ],
]);

let byoEntitled = true;

export function demoByoEntitled(): boolean {
  return byoEntitled;
}
export function setDemoByoEntitled(v: boolean) {
  byoEntitled = v;
}

function effective(v: ProviderView): boolean {
  return byoEntitled && v.enabled && v.status === "verified";
}

function withEffective(v: ProviderView): ProviderView {
  return { ...v, effective: effective(v) };
}

export function demoOwnRow(channel: MarketingChannel): ProviderView | null {
  const r = rows.get(channel);
  return r ? withEffective(r) : null;
}

function senderLabel(v: ProviderView): string {
  const d = v.display;
  const s = (d.sender_id ?? d.from_address ?? "") as string;
  return s ? `${providerLabel(v.provider_type)} (${s})` : providerLabel(v.provider_type);
}

/** The §12.4 additive ChannelStatus fields for one channel. */
export function demoChannelProviderStatus(channel: MarketingChannel) {
  const own = demoOwnRow(channel);
  const source = own?.effective ? ("own" as const) : ("wyfy" as const);
  return {
    provider_source: source,
    provider_display_name: source === "own" && own ? `Your ${senderLabel(own)}` : "Wyfy default",
    own_provider_status: (own?.status ?? null) as ProviderStatus | null,
    byo_entitled: byoEntitled,
  };
}

export function demoCampaignProvider(channel: MarketingChannel) {
  const s = demoChannelProviderStatus(channel);
  const own = demoOwnRow(channel);
  return {
    source: s.provider_source,
    type: s.provider_source === "own" ? (own?.provider_type ?? null) : null,
    display_name: s.provider_display_name,
  };
}

function locked(): never {
  const err = {
    status: 402,
    code: "feature_not_entitled",
    message: "The bring-your-own providers add-on isn't enabled.",
    data: { error_code: "feature_not_entitled", feature_key: "guest_marketing_byo" },
  };
  throw err;
}

function fail(status: number, code: string, message: string, data: Record<string, unknown> = {}): never {
  throw { status, code, message, data: { error_code: code, ...data } };
}

export function demoListProviders(): { channels: ChannelProviders[] } {
  if (!byoEntitled) locked();
  return {
    channels: (["sms", "whatsapp", "email"] as MarketingChannel[]).map((channel) => {
      const own = demoOwnRow(channel);
      return { channel, effective_source: own?.effective ? "own" : "wyfy", own };
    }),
  };
}

export function demoGetProvider(channel: MarketingChannel): ProviderView {
  if (!byoEntitled) locked();
  const own = demoOwnRow(channel);
  if (!own) fail(404, "not_found", "No provider for this channel.");
  return own;
}

export function demoPutProvider(channel: MarketingChannel, body: ProviderPutPayload): ProviderView {
  if (!byoEntitled) locked();
  const def = providerTypeDef(body.provider_type);
  if (!def || def.channel !== channel || !def.available) {
    fail(422, "provider_type_not_supported", "That provider isn't supported for this channel yet.");
  }
  const cur = rows.get(channel);
  const replace = !cur || cur.provider_type !== body.provider_type;
  const display: ProviderView["display"] = replace ? {} : { ...cur!.display };
  const missing: Record<string, string> = {};
  for (const f of def.fields) {
    const v = body.config[f.key];
    if (v === undefined) {
      if (replace && f.required) missing[f.key] = "Required.";
      continue;
    }
    if (f.secret) {
      if (v === "" || v === null) missing[f.key] = "A secret can't be blank.";
      else display[f.key] = hint(String(v));
    } else display[f.key] = v;
  }
  if (Object.keys(missing).length) fail(422, "provider_config_invalid", "Some fields are invalid.", { fields: missing });
  if (body.enabled && (replace || cur!.status !== "verified" || Object.keys(body.config).length > 0)) {
    fail(409, "provider_not_verified", "Verify the provider before turning it on.");
  }
  const changed = Object.keys(body.config).length > 0 || replace;
  const next: ProviderView = {
    channel,
    provider_type: body.provider_type,
    enabled: body.enabled ?? cur?.enabled ?? false,
    status: changed ? "unverified" : (cur?.status ?? "unverified"),
    last_verified_at: changed ? null : (cur?.last_verified_at ?? null),
    last_error: changed ? null : (cur?.last_error ?? null),
    effective: false,
    display,
    updated_at: iso(Date.now()),
    updated_by: DEMO_USER,
  };
  rows.set(channel, next);
  return withEffective(next);
}

export function demoDeleteProvider(channel: MarketingChannel, affected: number): ProviderDeleteResult {
  if (!byoEntitled) locked();
  if (!rows.has(channel)) fail(404, "not_found", "No provider for this channel.");
  rows.delete(channel);
  return { channel, effective_source: "wyfy", affected_campaign_count: affected };
}

export function demoVerifyProvider(
  channel: MarketingChannel,
  body: ProviderVerifyPayload,
): ProviderVerifyResult {
  if (!byoEntitled) locked();
  const cur = rows.get(channel);
  if (!cur) fail(404, "not_found", "No provider for this channel.");
  if ((channel === "sms" || channel === "email") && !body.test_to) {
    fail(422, "validation_error", "A test address is required.");
  }
  if (channel === "sms" && !body.template_id) {
    fail(422, "validation_error", "Pick one of your own templates with a DLT template ID.");
  }
  const next: ProviderView = {
    ...cur,
    status: "verified",
    last_error: null,
    last_verified_at: iso(Date.now()),
    updated_at: iso(Date.now()),
  };
  rows.set(channel, next);
  return {
    provider: withEffective(next),
    checks: [
      { name: "credentials", ok: true, detail: "Account reachable (demo)" },
      {
        name: "test_send",
        ok: true,
        detail: "Accepted by provider (demo). In the demo nothing was actually sent.",
      },
    ],
  };
}
