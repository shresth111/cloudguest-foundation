/**
 * Small shared pieces for the partner console, built on the Master kit
 * (`components/master/MasterKit.tsx`) so the two consoles share one look.
 * Every async screen renders exactly one of: loading, error (403 called out
 * as a permission problem), empty, or data. None of them invent data.
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { MButton, MEmptyState, M_INPUT } from "@/components/master/MasterKit";
import { copyToClipboard, cn } from "@/lib/utils";
import { isForbidden, ispErrorMessage } from "@/lib/isp-partner/errors";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-xl premium-card p-10 text-sm text-muted-foreground"
    >
      <Spinner /> {label}
    </div>
  );
}

/** A request failed. 403 says so plainly; everything else shows the
 * backend's message and a retry. */
export function ErrorBlock({
  error,
  onRetry,
  what = "this",
}: {
  error: unknown;
  onRetry?: () => void;
  what?: string;
}) {
  if (isForbidden(error)) {
    return (
      <MEmptyState
        icon={Lock}
        title="You do not have access"
        description={`Your role does not include ${what}. Ask your ISP Owner or Admin if you need it.`}
      />
    );
  }
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-semibold text-foreground">Couldn&apos;t load {what}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        {ispErrorMessage(error)}
      </p>
      {onRetry && (
        <MButton variant="outline" className="mt-3" onClick={onRetry}>
          Try again
        </MButton>
      )}
    </div>
  );
}

export function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return <p className="text-xs text-muted-foreground">{total} total</p>;
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-1">
        <MButton variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft /> Previous
        </MButton>
        <MButton variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight />
        </MButton>
      </div>
    </div>
  );
}

/** A read-only value with a copy button; `secret` hides it until asked. */
export function CopyField({
  label,
  value,
  secret,
  mono = true,
}: {
  label: string;
  value: string | null | undefined;
  secret?: boolean;
  mono?: boolean;
}) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const text = value ?? "";
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <code
          className={cn(
            "min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs",
            !mono && "font-sans",
          )}
        >
          {text ? (shown ? text : "•".repeat(Math.min(text.length, 16))) : "–"}
        </code>
        {secret && text && (
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? `Hide ${label}` : `Show ${label}`}
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          disabled={!text}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            const ok = await copyToClipboard(text);
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } else {
              toast.error("Copy failed. Select the text and copy it by hand.");
            }
          }}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <input
        className={cn(M_INPUT, error && "border-destructive")}
        value={value}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {hint && !error && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      {error && <span className="block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
    >
      {message}
    </p>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl premium-card p-4 sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Blob -> browser download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The labels on a `<select>` of customers, shared by every filter bar. */
export function CustomerSelect({
  value,
  onChange,
  customers,
  allLabel = "All customers",
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  customers: { id: string; name: string }[] | undefined;
  allLabel?: string | null;
  disabled?: boolean;
}) {
  return (
    <select
      className={M_INPUT}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Customer"
    >
      {allLabel !== null && <option value="">{allLabel}</option>}
      {allLabel === null && <option value="">Pick a customer…</option>}
      {(customers ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
