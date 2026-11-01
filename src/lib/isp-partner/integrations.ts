/** APPS-2 #5 integrations page: pure helpers (tested by
 * `scripts/test-isp-partner-integrations.mjs`). Every label is derived from a
 * recorded field; nothing is assumed healthy because it is configured. */
import type { IntegrationState } from "@/services/isp-partner/integrations";

export const INTEGRATION_KEYS = [
  "whatsapp",
  "email",
  "telegram",
  "acs",
  "payment_gateway",
  "ipdr_archive",
] as const;
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];

export const INTEGRATION_TITLES: Record<IntegrationKey, string> = {
  whatsapp: "WhatsApp sender",
  email: "Email sender",
  telegram: "Telegram alerts",
  acs: "ACS / TR-069",
  payment_gateway: "Payment gateway",
  ipdr_archive: "Off-site backup (IPDR / NAT)",
};

/** Where each card's existing configuration screen is, and the permission
 * that screen needs (the link is hidden without it). */
export const INTEGRATION_LINKS: Partial<
  Record<IntegrationKey, { to: string; search?: Record<string, string>; perm: string }>
> = {
  whatsapp: { to: "/partner/messaging", perm: "isp_engage.read" },
  email: { to: "/partner/messaging", perm: "isp_engage.read" },
  telegram: { to: "/partner/finance", search: { tab: "automation" }, perm: "isp_billing.read" },
  acs: { to: "/partner/settings", perm: "tr069.manage" },
  ipdr_archive: { to: "/partner/compliance", perm: "isp_partner.read" },
};

export function stateLabel(state: IntegrationState): { label: string; tone: string } {
  switch (state) {
    case "configured":
      return { label: "Configured", tone: "active" };
    case "coming_soon":
      return { label: "Coming soon", tone: "info" };
    case "not_set_up":
      return { label: "Not set up", tone: "muted" };
    default:
      return { label: "Not configured", tone: "muted" };
  }
}

/** The newer of a last success and a last failure, labelled; null when
 * neither is recorded (the card then says "No sends recorded"). */
export function lastOutcome(
  sentAt: string | null,
  failedAt: string | null,
): { kind: "sent" | "failed"; at: string } | null {
  if (!sentAt && !failedAt) return null;
  if (!failedAt) return { kind: "sent", at: sentAt as string };
  if (!sentAt) return { kind: "failed", at: failedAt };
  return new Date(failedAt).getTime() > new Date(sentAt).getTime()
    ? { kind: "failed", at: failedAt }
    : { kind: "sent", at: sentAt };
}

export function yesNo(v: boolean): string {
  return v ? "Yes" : "No";
}
