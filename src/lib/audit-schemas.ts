import { z } from "zod";

export const retentionSchema = z.object({
  retentionDays: z.coerce.number().int().min(7, "Minimum 7 days").max(3650, "Maximum 10 years"),
  autoCleanup: z.boolean(),
  archiveEnabled: z.boolean(),
  archiveAfterDays: z.coerce.number().int().min(1).max(3650),
  storageUsedMb: z.coerce.number().min(0),
  storageQuotaMb: z.coerce.number().min(64),
});

export type RetentionFormValues = z.infer<typeof retentionSchema>;
