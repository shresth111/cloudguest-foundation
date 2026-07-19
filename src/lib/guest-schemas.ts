import { z } from "zod";

export const blacklistSchema = z.object({
  guestName: z.string().min(2, "Name is required"),
  mac: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, "Invalid MAC address"),
  mobile: z.string().min(6, "Mobile is required"),
  email: z.string().email("Invalid email"),
  reason: z.string().min(3, "Reason is required"),
  expiresAt: z.string().optional(),
});
export type BlacklistFormValues = z.infer<typeof blacklistSchema>;

export const whitelistSchema = z.object({
  guestName: z.string().min(2, "Name is required"),
  mac: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, "Invalid MAC address"),
  mobile: z.string().min(6, "Mobile is required"),
  email: z.string().email("Invalid email"),
  note: z.string().min(3, "Note is required"),
});
export type WhitelistFormValues = z.infer<typeof whitelistSchema>;

export const policySchema = z.object({
  internetTimeLimitMin: z.coerce.number().min(0),
  dailyLimitMb: z.coerce.number().min(0),
  speedLimitKbps: z.coerce.number().min(0),
  downloadLimitMb: z.coerce.number().min(0),
  uploadLimitMb: z.coerce.number().min(0),
  deviceLimit: z.coerce.number().min(1),
  sessionTimeoutMin: z.coerce.number().min(1),
  idleTimeoutMin: z.coerce.number().min(1),
});
export type PolicyFormValues = z.infer<typeof policySchema>;

export const messageSchema = z.object({
  channel: z.enum(["sms", "email"]),
  body: z.string().min(3, "Message is required").max(500, "Too long"),
});
export type MessageFormValues = z.infer<typeof messageSchema>;
