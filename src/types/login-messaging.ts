/**
 * Login messaging: which account sends guests' login codes (WhatsApp, SMS).
 * Shapes of `GET /guest-messaging/providers` and its Master twin
 * `GET /platform/organizations/{id}/guest-messaging/providers`
 * (cloud-guest `app/domains/guest_messaging`).
 */

export type LoginChannel = "whatsapp" | "sms";
export const LOGIN_CHANNELS: LoginChannel[] = ["whatsapp", "sms"];

export type AdapterFieldKind = "text" | "secret" | "select" | "textarea" | "boolean" | "headers";

/** One form field, declared by the backend adapter. The form renders from
 * these; there is no per-vendor form in the frontend. */
export interface AdapterField {
  name: string;
  label: string;
  kind: AdapterFieldKind;
  required: boolean;
  help: string;
  placeholder: string;
  options: string[];
  pattern: string | null;
  default: unknown;
  max_length: number;
}

export interface AdapterSchema {
  key: string;
  channel: LoginChannel;
  display_name: string;
  docs_url: string;
  notes: string;
  sender_field: string | null;
  fields: AdapterField[];
}

/** A secret as the API shows it: never the value. */
export interface SecretStub {
  set: boolean;
  hint: string;
}

export type HeaderView =
  | { name: string; secret: true; set: boolean; hint: string }
  | { name: string; secret: false; value: string };

export interface LoginProviderView {
  channel: LoginChannel;
  provider_type: string;
  display_name: string;
  sender_label: string | null;
  enabled: boolean;
  status: "verified" | "unverified" | "failed" | string;
  effective: boolean;
  last_verified_at: string | null;
  last_error: string | null;
  display: Record<string, unknown>;
  configured_by_platform: boolean;
  set_up_by: "wyfy_team" | "venue";
  fallback: { count: number; last_at: string | null; last_error: string | null };
  updated_at: string | null;
  updated_by: { id: string | null; name: string | null } | null;
}

export interface LoginChannelState {
  channel: LoginChannel;
  effective_source: "own" | "wyfy";
  own: LoginProviderView | null;
  platform_default: { configured: boolean; provider?: string };
}

export interface LoginMessagingOverview {
  organization_id: string;
  byo_allowed: boolean;
  channels: LoginChannelState[];
  adapters: Record<LoginChannel, AdapterSchema[]>;
}

export interface LoginProviderPut {
  provider_type?: string | null;
  config: Record<string, unknown>;
  enabled?: boolean | null;
}

export interface VerifyStartResult {
  sent_to: string;
  expires_in_seconds: number;
  checks: { name: string; ok: boolean; detail: string }[];
}

/** Customer dashboard (org from the session) or Master acting for an org. */
export type LoginMessagingTarget = { kind: "own" } | { kind: "platform"; organizationId: string };
