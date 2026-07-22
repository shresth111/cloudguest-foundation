import { z } from "zod";

export const nasRegisterSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  nasIdentifier: z.string().trim().min(1, "NAS identifier is required").max(255),
  sharedSecret: z
    .string()
    .trim()
    .min(8, "Shared secret must be at least 8 characters")
    .max(255)
    .optional()
    .or(z.literal("")),
  name: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  ipAddress: z.string().trim().max(45).optional().or(z.literal("")),
});

export type NasRegisterValues = z.infer<typeof nasRegisterSchema>;
