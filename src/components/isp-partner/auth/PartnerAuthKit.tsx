/** Small shared pieces of the partner sign-in / forgot / reset pages. */
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const FIELD_CLASS =
  "h-11 transition-shadow focus-visible:ring-4 focus-visible:ring-primary/15";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn(FIELD_CLASS, "pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

const TONES = {
  error: {
    icon: AlertCircle,
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
    role: "alert",
  },
  success: {
    icon: CheckCircle2,
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    role: "status",
  },
  info: {
    icon: Info,
    cls: "border-border bg-muted/50 text-muted-foreground",
    role: "note",
  },
} as const;

export function Notice({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      role={t.role}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        t.cls,
        className,
      )}
    >
      <t.icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** "or ask your ISP Owner/Admin" -- the second way back in, on every page. */
export function AskYourAdmin({
  lead = "Or ask",
  className,
}: {
  lead?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {lead} your ISP&apos;s <strong className="font-medium text-foreground">Owner</strong> or{" "}
      <strong className="font-medium text-foreground">Admin</strong> to reset your password from{" "}
      <span className="whitespace-nowrap">Staff users</span> in the console.
    </p>
  );
}
