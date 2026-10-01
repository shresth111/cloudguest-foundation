import type { SecurityActivityProtection } from "@/types/security";

/** Translated sentence for a known protection; the backend's own sentence
 * (English) for one this build does not know yet. */
export function activitySentence(
  t: (key: string, opts: Record<string, unknown>) => string,
  p: SecurityActivityProtection,
): string | null {
  if (!p.available || p.count == null) return null;
  const key =
    p.count === 0 ? `securityActivity.zero.${p.key}` : `securityActivity.sentence.${p.key}`;
  return t(key, { n: p.count.toLocaleString(), defaultValue: p.sentence ?? "" }) || p.sentence;
}
