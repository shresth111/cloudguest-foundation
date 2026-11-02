/**
 * ERROR-COPY: a failed action as a toast -- the worded message, the support
 * reference for a server error, and a "Try again" (when `onRetry` is given
 * and a retry can help) or "Copy details" action. No raw text, no JSON.
 */
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { describeIspError, ispErrorDetails } from "./errors";
import { translate } from "./error-copy";

export function ispToastError(error: unknown, fallback?: string, onRetry?: () => void): void {
  const info = describeIspError(error);
  const lead = fallback && ["network", "timeout", "server", "other"].includes(info.kind);
  const message = lead ? `${fallback} ${info.message}` : info.message;
  const description =
    info.showReference && info.requestId
      ? translate("ui.reference", { id: info.requestId })
      : undefined;
  const action =
    onRetry && info.retryable
      ? { label: translate("ui.retry"), onClick: onRetry }
      : info.showReference
        ? {
            label: translate("ui.copy_details"),
            onClick: () => void copyToClipboard(ispErrorDetails(error)),
          }
        : undefined;
  toast.error(message, { description, action });
}
