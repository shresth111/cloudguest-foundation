/** APPS-2 #5: `GET /isp/integrations/status` (BE
 * `isp_partner/integrations_router.py`). Read-only: every field is a row the
 * backend already records; `null` means nothing is recorded. No secret,
 * token hint, chat id or bucket name is ever returned. */
import api from "@/services/api";

export type IntegrationState = "configured" | "not_configured" | "not_set_up" | "coming_soon";

interface BaseCard {
  state: IntegrationState;
  configured: boolean;
  link: string | null;
}

export interface ProviderCard extends BaseCard {
  enabled: boolean;
  provider_type: string | null;
  status: string | null;
  last_verified_at: string | null;
  last_error: string | null;
}

export interface WhatsappCard extends ProviderCard {
  last_sent_at: string | null;
  last_failed_at: string | null;
  automation_enabled: boolean;
  automation_feature_enabled: boolean;
}

export interface TelegramCard extends BaseCard {
  enabled: boolean;
  feature_enabled: boolean;
  bot_token_set: boolean;
  chat_id_set: boolean;
  last_sent_at: string | null;
  last_failed_at: string | null;
}

export interface AcsCard extends BaseCard {
  feature_enabled: boolean;
  credentials: number;
  enabled_credentials: number;
  devices: number;
  last_inform_at: string | null;
}

export interface IpdrArchiveCard extends BaseCard {
  store: "s3" | "local";
  last_built_at: string | null;
  last_offsite_built_at: string | null;
  exports_offsite: "not_set_up";
}

export interface IntegrationsStatus {
  cards: {
    whatsapp: WhatsappCard;
    email: ProviderCard;
    telegram: TelegramCard;
    acs: AcsCard;
    payment_gateway: BaseCard;
    ipdr_archive: IpdrArchiveCard;
  };
}

export const integrationsService = {
  async getStatus(): Promise<IntegrationsStatus> {
    const { data } = await api.get<IntegrationsStatus>("/isp/integrations/status");
    return data;
  },
};
