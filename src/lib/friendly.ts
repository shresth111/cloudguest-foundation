import type { RouterStatus } from "@/types/router";

/**
 * "3 days ago" rather than "14:32".
 *
 * A router's last check-in was rendered as a bare time, so a router that
 * last reported three days ago read as if it had reported this afternoon --
 * on the one tile a venue owner looks at to answer "is my WiFi box alive?".
 * A relative time cannot be misread that way, and it sidesteps the fact that
 * every date on this surface renders in the *viewer's* timezone rather than
 * the venue's.
 */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "Unknown";
  if (diffMs < 0) return "just now";

  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;

  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/**
 * Plain English for a router's state.
 *
 * The raw values leaked to venue owners as "pending provisioning" and
 * "provisioning" -- internal lifecycle vocabulary that answers none of the
 * only question an owner has about a router, which is whether it is working.
 */
export function routerStatusLabel(status: RouterStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "provisioning":
    case "pending_provisioning":
      return "Being set up";
    case "suspended":
      return "Paused";
    case "decommissioned":
      return "Retired";
  }
}
