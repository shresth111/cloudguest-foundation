import { Mail, MessageCircle, MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import {
  marketingError,
  marketingErrorCode,
  marketingErrorData,
} from "@/services/marketing.service";
import type {
  AudienceFilter,
  ChannelStatus,
  MarketingChannel,
  MarketingTemplate,
} from "@/types/marketing";
import { MARKETING_CHANNELS } from "@/types/marketing";

/**
 * Non-component helpers for the Marketing screens (labels, the error-code →
 * sentence table, permission checks, formatters). Kept out of the .tsx
 * component modules so React Fast Refresh keeps working on those.
 */

export const CHANNEL_ICON: Record<MarketingChannel, typeof Mail> = {
  sms: MessageSquareText,
  whatsapp: MessageCircle,
  email: Mail,
};

const CHANNEL_FALLBACK: Record<MarketingChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

export function useChannelLabel() {
  const { t } = useTranslation("marketing", { i18n });
  return (c: MarketingChannel) => t(`channel.${c}`, CHANNEL_FALLBACK[c]);
}

/** Why a recipient was left out -- `skip_reason` (§4.7). */
export const SKIP_REASON_LABEL: Record<string, string> = {
  opted_out: "Opted out",
  suppressed: "On the do-not-contact list",
  no_consent: "No consent",
  invalid_address: "Invalid address",
  blocked: "Blocked guest",
  addon_locked: "Add-on was locked",
  cancelled: "Campaign cancelled",
};

/** The audience-preview / dispatch exclusion buckets (§5.3). */
export const EXCLUSION_LABEL: Record<string, string> = {
  no_consent: "Never opted in",
  opted_out: "Opted out",
  suppressed: "On the do-not-contact list",
  no_address: "No address for this channel",
  invalid_address: "Address not usable",
  blocked: "Blocked guests",
};

/** `sendable.reason` (§5.4, plus `review_link_missing` from the 2026-09-25
 * contract change). */
export const SENDABLE_REASON_LABEL: Record<string, string> = {
  channel_not_configured: "This channel isn't live for your account yet.",
  channel_missing_in_template: "This template has no text for this channel.",
  dlt_template_id_missing: "Needs a DLT template ID before it can be sent by SMS.",
  whatsapp_not_approved: "Waiting for WhatsApp (Meta) approval.",
  unsubscribe_link_missing: "Must include {{unsubscribe_link}}.",
  review_link_missing: "Uses {{review_link}}, but your portal has no review link set.",
};

export function channelNotLiveCopy(channelLabel: string): string {
  return `${channelLabel} isn't live for your account yet. Wyfy support has to finish setup.`;
}

/**
 * The contract's error codes (§5.11) as sentences. The FE switches on
 * `data.error_code`, never on `message` (§5.0); anything not listed here
 * falls back to the server's own message.
 */
const ERROR_COPY: Record<string, string> = {
  organization_required: "Your session has no organisation selected. Sign in again.",
  feature_not_entitled: "Marketing isn't enabled for your organisation.",
  license_not_active: "Your Wyfy Guest licence isn't active.",
  permission_denied: "Your role doesn't allow this.",
  forbidden: "Your role doesn't allow this.",
  cross_location: "That belongs to a different venue.",
  not_found: "It no longer exists, or it belongs to another venue.",
  location_not_found: "That venue wasn't found.",
  template_not_found: "That template no longer exists.",
  template_empty: "Add text for at least one channel.",
  unknown_variable: "The text uses a variable that doesn't exist. Use the variable buttons.",
  unsubscribe_link_missing: "SMS and email text must include {{unsubscribe_link}}.",
  sms_too_long: "With long names and codes filled in, this SMS would exceed 3 parts. Shorten it.",
  whatsapp_custom_not_supported: "Custom WhatsApp templates aren't available yet.",
  template_name_taken: "You already have a template with this name.",
  system_template_read_only: "Wyfy templates can't be edited. Duplicate it instead.",
  template_in_use: "A scheduled or sending campaign uses this template. Duplicate it instead.",
  version_conflict: "Someone else changed this since you opened it. Reload and try again.",
  channel_mismatch: "The audience channel doesn't match the campaign channel.",
  channel_missing_in_template: "This template has no text for the chosen channel.",
  invalid_status_transition: "This campaign's status changed. Reload to see where it is now.",
  channel_not_configured:
    "This channel isn't live for your account yet. Wyfy support has to finish setup.",
  template_not_sendable: "This template can't be sent on this channel yet.",
  audience_empty: "Nobody in this audience has opted in, so there is no one to send to.",
  audience_too_large: "This audience is larger than the per-campaign limit.",
  quiet_hours: "SMS and WhatsApp can't be sent during quiet hours.",
  schedule_out_of_range: "Pick a time at least 5 minutes from now and within 60 days.",
  invalid_address: "One of those addresses isn't valid for this channel.",
  test_send_limit: "You've used today's test sends.",
  portal_config_missing: "This venue has no WiFi login page set up yet.",
  network_error: "Couldn't reach the server. Check your connection and try again.",
  rate_limited: "Too many requests. Wait a minute and try again.",
};

/** A sentence for any marketing request failure. */
export function marketingErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  const code = marketingErrorCode(err);
  const data = marketingErrorData(err);
  const e = marketingError(err);
  if (code === "quiet_hours" && typeof data?.next_allowed_at === "string") {
    return `${ERROR_COPY.quiet_hours} The next allowed time is ${formatDateTime(data.next_allowed_at)}.`;
  }
  if (code === "test_send_limit" && typeof data?.retry_after_seconds === "number") {
    const hrs = Math.ceil(data.retry_after_seconds / 3600);
    return `${ERROR_COPY.test_send_limit} Try again in about ${hrs} hour${hrs === 1 ? "" : "s"}.`;
  }
  if (code === "template_not_sendable" && typeof data?.reason === "string") {
    return SENDABLE_REASON_LABEL[data.reason] ?? ERROR_COPY.template_not_sendable;
  }
  if (code === "audience_too_large" && typeof data?.limit === "number") {
    return `${ERROR_COPY.audience_too_large} (${Number(data.reachable ?? 0).toLocaleString()} reachable, limit ${data.limit.toLocaleString()}.)`;
  }
  if (code === "unknown_variable" && Array.isArray(data?.variables) && data.variables.length) {
    return `${ERROR_COPY.unknown_variable} Unknown: ${(data.variables as string[]).join(", ")}.`;
  }
  if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  return e?.message || fallback;
}

// ── Permissions ────────────────────────────────────────────────────────

export type MarketingAction = "read" | "create" | "update" | "delete" | "execute" | "manage";

/**
 * Whether to OFFER an action (spec §8.2 "Permission-limited"). Reads the
 * caller's real grants; fails open while they are unknown, exactly like the
 * sidebar (customerNavPermissions.ts), because the backend enforces every
 * request regardless and a hidden button is a feature the owner paid for
 * and cannot find.
 */
export function useMarketingCan(): (action: MarketingAction) => boolean {
  const { data } = useMyPermissions();
  return (action) => {
    if (!data || data.length === 0) return true;
    return data.includes(`marketing.${action}`);
  };
}

// ── Formatting ─────────────────────────────────────────────────────────

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCount(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString() : "—";
}

// ── Channel readiness ──────────────────────────────────────────────────

export function channelStatusFor(
  channels: ChannelStatus[] | undefined,
  channel: MarketingChannel,
): ChannelStatus | undefined {
  return channels?.find((c) => c.channel === channel);
}

// ── Pager ──────────────────────────────────────────────────────────────

/** A fresh idempotency key for one schedule attempt (§5.5). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 from getRandomValues, for the rare browser without randomUUID.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── Audience filter ────────────────────────────────────────────────────

/** True when the filter has a client-visible contradiction the server
 * would 422 on; the preview is not asked for such a filter. */
export function audienceFilterInvalid(f: AudienceFilter): boolean {
  if (f.visited_from && f.visited_to && f.visited_from > f.visited_to) return true;
  if (f.min_visits != null && f.max_visits != null && f.min_visits > f.max_visits) return true;
  return false;
}

/** The filter as sent: empty values dropped so the request says only what
 * the owner actually chose. */
export function cleanAudienceFilter(f: AudienceFilter): AudienceFilter {
  const out: AudienceFilter = { channel: f.channel };
  // Omitted (not null) means "all venues" for an org-scoped caller and
  // "my venue" for a location-scoped one (§5.3); the server resolves it.
  if (f.location_ids && f.location_ids.length > 0) out.location_ids = [...f.location_ids];
  if (f.visited_from) out.visited_from = f.visited_from;
  if (f.visited_to) out.visited_to = f.visited_to;
  if (f.min_visits != null) out.min_visits = f.min_visits;
  if (f.max_visits != null) out.max_visits = f.max_visits;
  if (f.not_seen_for_days != null) out.not_seen_for_days = f.not_seen_for_days;
  if (f.require_name) out.require_name = true;
  return out;
}

// ── Templates ──────────────────────────────────────────────────────────

export function categoryLabel(c: string): string {
  if (c === "winback") return "Win-back";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function templateChannels(t: MarketingTemplate): MarketingChannel[] {
  return MARKETING_CHANNELS.filter((c) => t[c] !== null);
}
