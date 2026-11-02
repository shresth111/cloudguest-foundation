/**
 * QA-013: router-level refusals are correct but were shown raw -- a router
 * UUID and internal credential wording. Say it in ISP terms instead.
 *
 * These read the SERVER's own sentence. `ispErrorMessage` replaces a 5xx or an
 * uncoded refusal with generic copy (ERROR-COPY), so matching on its output
 * turned "categories are not set up" into "something went wrong".
 */
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { requestErrorOf } from "@/services/api";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CREDENTIALS_RE = /connection credentials|management or public IP|API username|API secret/i;
const CATEGORIES_RE = /category filtering is not configured|Cloudflare/i;

export function friendlyB4Message(error: unknown): string {
  const server = requestErrorOf(error)?.message ?? "";
  if (CREDENTIALS_RE.test(server)) {
    return "This router is not ready for remote changes yet: it has not finished its setup (run its setup script and wait for it to check in), then try again.";
  }
  if (CATEGORIES_RE.test(server)) {
    return "Website categories are not available on this platform yet. Blocking single websites and addresses above still works.";
  }
  return ispErrorMessage(error).replace(UUID_RE, "this router");
}
