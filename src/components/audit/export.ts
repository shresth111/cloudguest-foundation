import type { AuditLog } from "@/types/audit";

export type ExportFormat = "csv" | "json" | "excel" | "pdf";

const HEADERS = ["ID","Timestamp","User","Email","Role","Organization","Location","Module","Action","Category","Resource","Status","Severity","IP","Device","Browser","OS","Message"];

function toRow(r: AuditLog) {
  return [
    r.id, r.timestamp, r.actor.name, r.actor.email, r.actor.role, r.organizationName, r.locationName ?? "",
    r.module, r.action, r.category, r.resource, r.status, r.severity,
    r.context.ipAddress, r.context.device, r.context.browser, r.context.os, r.message,
  ];
}

function download(name: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRows(rows: AuditLog[], format: ExportFormat) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "json") {
    download(`audit-logs-${stamp}.json`, "application/json", JSON.stringify(rows, null, 2));
    return;
  }
  if (format === "csv") {
    const csv = [HEADERS, ...rows.map(toRow)].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`audit-logs-${stamp}.csv`, "text/csv;charset=utf-8", csv);
    return;
  }
  if (format === "excel") {
    // simple SpreadsheetML/HTML that Excel opens
    const html = `<table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => `<tr>${toRow(r).map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
    download(`audit-logs-${stamp}.xls`, "application/vnd.ms-excel", html);
    return;
  }
  if (format === "pdf") {
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Audit logs</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;font-size:11px;color:#111}h1{font-size:16px;margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:6px;text-align:left}th{background:#f8fafc}</style>
      </head><body><h1>CloudGuest — Audit logs (${rows.length})</h1>
      <table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${toRow(r).map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>{window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
