/** COMMS-2 endpoints (ADDENDUM_06). All 404 while ISP_COMMS_HUB_ENABLED is off. */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export type CommsStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped";

export interface CommsLogQuery {
  channel?: "email" | "whatsapp" | "telegram";
  status?: CommsStatus;
  event?: string;
  phone?: string;
  email?: string;
  /** Plain YYYY-MM-DD. */
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface CommsLogRow {
  id: string;
  at_ist: string;
  channel: string;
  event: string;
  recipient: string;
  content: string;
  status: CommsStatus;
  status_at_ist: string | null;
  error: string | null;
  provider_message_id: string | null;
  receipts: {
    status: string;
    at_ist: string;
    error_code: string | null;
    error_title: string | null;
  }[];
  isp_customer_id: string | null;
  subscriber_id: string | null;
  invoice_id: string | null;
}

export interface CommsLogPage {
  items: CommsLogRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  status_note: string;
}

export interface CommsTemplate {
  event: string;
  label: string;
  channel: "email" | "whatsapp";
  variables: string[];
  wired: boolean;
  automation_trigger: string | null;
  enabled: boolean;
  email_subject: string | null;
  email_body: string | null;
  wa_template_name: string | null;
  wa_language: string | null;
  wa_approval_status: string | null;
  wa_checked_ist: string | null;
}

export interface CommsWebhook {
  configured: boolean;
  callback_path?: string;
  verify_token?: string;
  app_secret_set?: boolean;
  last_received_ist?: string | null;
  rejected_count?: number;
}

export type CommsPreview =
  | { channel: "email"; subject: string; body: string; unknown_variables: string[] }
  | {
      channel: "whatsapp";
      template_name: string | null;
      language: string | null;
      parameters: { position: number; variable: string; sample: string }[];
      note: string;
    };

const clean = (q: object) =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== "" && v !== null),
  ) as Record<string, string>;

export const commsService = {
  async logs(q: CommsLogQuery): Promise<CommsLogPage> {
    const { data } = await api.get<CommsLogPage>("/isp/comms/logs", { params: clean(q) });
    return data;
  },
  exportCsv(q: CommsLogQuery): Promise<FileDownload> {
    const { page: _p, page_size: _s, ...rest } = q;
    return downloadFile("/isp/comms/logs/export.csv", clean(rest), "messages.csv");
  },
  async templates(): Promise<{ items: CommsTemplate[]; rules: string }> {
    const { data } = await api.get<{ items: CommsTemplate[]; rules: string }>(
      "/isp/comms/templates",
    );
    return data;
  },
  async saveTemplate(
    event: string,
    channel: string,
    body: Partial<
      Pick<
        CommsTemplate,
        "enabled" | "email_subject" | "email_body" | "wa_template_name" | "wa_language"
      >
    >,
  ): Promise<CommsTemplate> {
    const { data } = await api.put<CommsTemplate>(`/isp/comms/templates/${event}/${channel}`, body);
    return data;
  },
  async preview(
    event: string,
    channel: string,
    body: { email_subject?: string; email_body?: string } = {},
  ): Promise<CommsPreview> {
    const { data } = await api.post<CommsPreview>(
      `/isp/comms/templates/${event}/${channel}/preview`,
      body,
    );
    return data;
  },
  async webhook(): Promise<CommsWebhook> {
    const { data } = await api.get<CommsWebhook>("/isp/comms/webhook");
    return data;
  },
  async saveWebhook(app_secret: string | null): Promise<CommsWebhook> {
    const { data } = await api.put<CommsWebhook>("/isp/comms/webhook", { app_secret });
    return data;
  },
  async rotateWebhook(): Promise<CommsWebhook> {
    const { data } = await api.post<CommsWebhook>("/isp/comms/webhook/rotate");
    return data;
  },
};
