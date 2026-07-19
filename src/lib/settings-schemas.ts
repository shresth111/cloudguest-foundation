import { z } from "zod";

export const generalSchema = z.object({
  platformName: z.string().min(2, "Required"),
  companyName: z.string().min(2, "Required"),
  supportEmail: z.string().email(),
  supportPhone: z.string().min(6),
  website: z.string().url(),
  defaultLanguage: z.string(),
  timezone: z.string(),
  currency: z.string(),
  dateFormat: z.string(),
  timeFormat: z.enum(["12h", "24h"]),
});

export const emailSchema = z.object({
  provider: z.enum(["aws_ses", "smtp", "sendgrid", "mailgun"]),
  host: z.string().min(2),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(4),
  fromAddress: z.string().email(),
  connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
  lastTestedAt: z.string().optional(),
});

export const smsSchema = z.object({
  provider: z.enum(["msg91", "twilio", "aws_sns"]),
  apiKey: z.string().min(4),
  senderId: z.string().min(1),
  templateId: z.string().min(1),
  connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
  lastTestedAt: z.string().optional(),
});

export const storageSchema = z.object({
  provider: z.enum(["aws_s3", "local"]),
  bucket: z.string().min(1),
  region: z.string().min(1),
  accessKey: z.string().min(4),
  secretKey: z.string().min(4),
  usageGb: z.coerce.number(),
  quotaGb: z.coerce.number(),
  connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
});

export const paymentSchema = z.object({
  provider: z.enum(["stripe", "razorpay", "paypal"]),
  publishableKey: z.string().min(4),
  secretKey: z.string().min(4),
  webhookSecret: z.string().min(4),
  currency: z.string().min(3).max(3),
  taxPercent: z.coerce.number().min(0).max(100),
  autoInvoice: z.boolean(),
});
