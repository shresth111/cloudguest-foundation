import { z } from "zod";

// ============================================================================
// Alert Rules -- condition_config shape depends on triggerType; the exact
// snake_case keys below are confirmed against the real evaluator methods in
// the backend's monitoring/service.py (_evaluate_threshold_rule,
// _evaluate_event_occurred_rule, condition_config.get("expected_status")),
// not guessed -- condition_config is stored/echoed as an opaque dict, so the
// keys produced here are sent through verbatim by monitoring.service.ts.
// ============================================================================

const HEALTH_STATUS_OPTIONS = ["healthy", "degraded", "unhealthy", "unknown"] as const;
const THRESHOLD_METRIC_OPTIONS = [
  "cpu_usage_percent",
  "memory_usage_percent",
  "uptime_seconds",
  "connected_clients_count",
] as const;
const THRESHOLD_OPERATOR_OPTIONS = ["gt", "gte", "lt", "lte", "eq"] as const;

export const alertRuleSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(200),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    organizationId: z.string().optional().or(z.literal("")),
    triggerType: z.enum(["health_status_change", "threshold", "event_occurred"]),
    targetComponent: z.string().optional().or(z.literal("")),
    severity: z.enum(["info", "warning", "critical"]),
    isActive: z.boolean(),
    notificationChannelIds: z.array(z.string()),
    expectedStatus: z.enum(HEALTH_STATUS_OPTIONS).optional(),
    metric: z.enum(THRESHOLD_METRIC_OPTIONS).optional(),
    operator: z.enum(THRESHOLD_OPERATOR_OPTIONS).optional(),
    value: z.coerce.number().optional(),
    eventType: z.string().trim().optional().or(z.literal("")),
  })
  .refine((v) => (v.triggerType !== "health_status_change" || !!v.expectedStatus), {
    message: "Required",
    path: ["expectedStatus"],
  })
  .refine(
    (v) =>
      v.triggerType !== "threshold" ||
      (!!v.metric && !!v.operator && v.value !== undefined && !Number.isNaN(v.value)),
    { message: "Required", path: ["metric"] },
  )
  .refine((v) => v.triggerType !== "event_occurred" || !!v.eventType, {
    message: "Required",
    path: ["eventType"],
  });
export type AlertRuleFormValues = z.infer<typeof alertRuleSchema>;

export function conditionConfigFromAlertRuleForm(v: AlertRuleFormValues): Record<string, unknown> {
  if (v.triggerType === "health_status_change") return { expected_status: v.expectedStatus };
  if (v.triggerType === "threshold")
    return { metric: v.metric, operator: v.operator, value: v.value };
  return { event_type: v.eventType };
}

// ============================================================================
// Notification Channels -- config shape depends on channelType, confirmed
// against the real Notifier classes (EmailNotifier/SmsNotifier/
// WhatsAppNotifier read config["email"]/config["phone_number"];
// SlackNotifier/TeamsNotifier/DiscordNotifier read config["webhook_url"];
// WebhookNotifier reads config["url"] + optional config["auth_header_name"]/
// config["auth_header_value"]).
// ============================================================================

export const notificationChannelSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(200),
    organizationId: z.string().optional().or(z.literal("")),
    channelType: z.enum(["email", "sms", "whatsapp", "slack", "teams", "discord", "webhook"]),
    isActive: z.boolean(),
    email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
    phoneNumber: z.string().trim().optional().or(z.literal("")),
    webhookUrl: z.string().trim().url("Invalid URL").optional().or(z.literal("")),
    url: z.string().trim().url("Invalid URL").optional().or(z.literal("")),
    authHeaderName: z.string().trim().optional().or(z.literal("")),
    authHeaderValue: z.string().trim().optional().or(z.literal("")),
  })
  .refine((v) => v.channelType !== "email" || !!v.email, {
    message: "Required",
    path: ["email"],
  })
  .refine((v) => !["sms", "whatsapp"].includes(v.channelType) || !!v.phoneNumber, {
    message: "Required",
    path: ["phoneNumber"],
  })
  .refine((v) => !["slack", "teams", "discord"].includes(v.channelType) || !!v.webhookUrl, {
    message: "Required",
    path: ["webhookUrl"],
  })
  .refine((v) => v.channelType !== "webhook" || !!v.url, { message: "Required", path: ["url"] });
export type NotificationChannelFormValues = z.infer<typeof notificationChannelSchema>;

export function configFromNotificationChannelForm(
  v: NotificationChannelFormValues,
): Record<string, unknown> {
  switch (v.channelType) {
    case "email":
      return { email: v.email };
    case "sms":
    case "whatsapp":
      return { phone_number: v.phoneNumber };
    case "slack":
    case "teams":
    case "discord":
      return { webhook_url: v.webhookUrl };
    case "webhook":
      return {
        url: v.url,
        ...(v.authHeaderName && v.authHeaderValue
          ? { auth_header_name: v.authHeaderName, auth_header_value: v.authHeaderValue }
          : {}),
      };
    default:
      return {};
  }
}

// ============================================================================
// Incidents
// ============================================================================

export const incidentSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  severity: z.enum(["info", "warning", "critical"]),
  organizationId: z.string().optional().or(z.literal("")),
  assignedToUserId: z.string().trim().optional().or(z.literal("")),
});
export type IncidentFormValues = z.infer<typeof incidentSchema>;

export const incidentUpdateSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
  assignedToUserId: z.string().trim().optional().or(z.literal("")),
  resolutionNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type IncidentUpdateFormValues = z.infer<typeof incidentUpdateSchema>;

export const attachAlertSchema = z.object({
  alertId: z.string().min(1, "Select an alert"),
});
export type AttachAlertFormValues = z.infer<typeof attachAlertSchema>;

// ============================================================================
// SLA Targets
// ============================================================================

export const slaTargetSchema = z.object({
  organizationId: z.string().optional().or(z.literal("")),
  component: z.string().optional().or(z.literal("")),
  targetPercentage: z.coerce.number().gt(0, "Must be greater than 0").max(100, "Max 100"),
  measurementWindowDays: z.coerce.number().int().gt(0, "Must be at least 1 day"),
});
export type SlaTargetFormValues = z.infer<typeof slaTargetSchema>;
