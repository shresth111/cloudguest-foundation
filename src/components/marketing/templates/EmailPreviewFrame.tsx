/**
 * Renders an email body for preview inside a fully sandboxed iframe.
 *
 * `sandbox=""` (no allow-* tokens) means no script runs, no form submits,
 * no top-level navigation and no same-origin access -- so preview HTML,
 * including an unsaved draft the server has not sanitised yet, can never
 * touch the dashboard or its session. Links render but cannot navigate.
 */
export function EmailPreviewFrame({ html, className }: { html: string; className?: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={doc}
      className={className ?? "h-64 w-full rounded-md border border-border bg-white"}
    />
  );
}
