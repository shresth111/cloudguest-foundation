/** Display helpers for the partner console. Pure functions only. */

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "–";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return n.toLocaleString("en-IN");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "5 min ago", "3 h ago", "2 d ago"; "–" for nothing. */
export function formatAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "–";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "–";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "–";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export const ROUTER_STATUS_LABEL: Record<string, string> = {
  pending_provisioning: "Awaiting setup",
  provisioning: "Setting up",
  online: "Online",
  offline: "Offline",
  suspended: "Suspended",
  decommissioned: "Decommissioned",
};

/** MTag tone for a router status. */
export function routerStatusTone(status: string): string {
  if (status === "online") return "online";
  if (status === "offline" || status === "suspended") return "offline";
  if (status === "pending_provisioning" || status === "provisioning") return "pending";
  return "normal";
}

export const CLOUD_LINK_LABEL: Record<string, string> = {
  up: "Cloud link up",
  down: "Cloud link down",
  unknown: "Cloud link unknown",
};

export const ROLE_LABEL: Record<string, string> = {
  "isp-owner": "ISP Owner",
  "isp-admin": "ISP Admin",
  "isp-noc": "NOC Operator",
  "isp-technician": "Technician",
  "isp-viewer": "Viewer",
  "isp-billing": "Billing / Accounts",
};

export function roleLabel(slug: string | null | undefined): string {
  if (!slug) return "–";
  return ROLE_LABEL[slug] ?? slug;
}

/** `YYYY-MM-DD` for a Date in the viewer's own timezone. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
