/**
 * Small shared pieces for the partner console, built on the Master kit
 * (`components/master/MasterKit.tsx`) so the two consoles share one look.
 * Every async screen renders exactly one of: loading, error (403 called out
 * as a permission problem), empty, or data. None of them invent data.
 */
import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { MButton, MEmptyState, M_INPUT } from "@/components/master/MasterKit";
import { copyToClipboard, cn } from "@/lib/utils";
import { describeIspError, ispErrorDetails, missingPermission } from "@/lib/isp-partner/errors";
import { translate } from "@/lib/isp-partner/error-copy";
import { customerLabels, type CustomerLabelInput } from "@/lib/isp-partner/customer-label";

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

/** The small "Reference: abc · Copy details" line for support (5xx and
 * anything unexplained). Copies plain text, never JSON. */
export function ErrorReference({ error, className }: { error: unknown; className?: string }) {
  const [copied, setCopied] = useState(false);
  const info = describeIspError(error);
  if (!info.showReference) return null;
  return (
    <p
      className={cn(
        "mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {info.requestId && (
        <span className="font-mono">{translate("ui.reference", { id: info.requestId })}</span>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
        onClick={async () => {
          await copyToClipboard(ispErrorDetails(error));
          setCopied(true);
          toast.success(translate("ui.copied"));
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {translate("ui.copy_details")}
      </button>
    </p>
  );
}

/** A request failed. 403 names the missing permission; network errors,
 * timeouts and 5xx offer a retry; 409 offers a refresh; 5xx shows the
 * request id with "Copy details". */
export function ErrorBlock({
  error,
  onRetry,
  what = "this",
}: {
  error: unknown;
  onRetry?: () => void;
  what?: string;
}) {
  const info = describeIspError(error);
  if (info.kind === "forbidden") {
    return (
      <MEmptyState
        icon={Lock}
        title={translate("ui.no_access_title")}
        description={
          info.code || missingPermission(error) ? info.message : translate("ui.no_access", { what })
        }
      />
    );
  }
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-semibold text-foreground">
        {translate("ui.couldnt_load", { what })}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{info.message}</p>
      {onRetry && (
        <MButton variant="outline" className="mt-3" onClick={onRetry}>
          {info.refresh ? <RefreshCw className="mr-1 h-3.5 w-3.5" /> : null}
          {translate(info.refresh ? "ui.refresh" : "ui.retry")}
        </MButton>
      )}
      <ErrorReference error={error} />
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
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
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

/** A form-level error. Pass `message` (already worded), or `error` (the
 * request failure: worded here, with the support reference when it is a
 * server error). */
export function FormError({ message, error }: { message?: string | null; error?: unknown }) {
  const text = message ?? (error ? describeIspError(error).message : null);
  if (!text) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
    >
      <p>{text}</p>
      {error ? <ErrorReference error={error} className="justify-start" /> : null}
    </div>
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
  customers: CustomerLabelInput[] | undefined;
  allLabel?: string | null;
  disabled?: boolean;
}) {
  const labels = customerLabels(customers ?? []);
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
          {labels.get(c.id) ?? c.name}
        </option>
      ))}
    </select>
  );
}
