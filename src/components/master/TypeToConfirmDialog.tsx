import { useEffect, useId, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { M_INPUT } from "@/components/master/MasterKit";

/** Whether what the operator typed matches the name they were asked for.
 * Surrounding whitespace is forgiven (a stray paste space should not block
 * a deliberate confirmation); case and everything in between is not. */
function typedNameMatches(typed: string, name: string): boolean {
  return typed.trim() === name.trim() && name.trim().length > 0;
}

/**
 * Confirmation for an irreversible-from-the-console action: the confirm
 * button stays disabled until the operator types `confirmName` exactly.
 *
 * Same AlertDialog idiom as every other destructive Master-console action
 * (Revoke Partner, Delete Quotation); the typed name is the extra step for
 * actions that remove a whole tenant or partner, where one stray click on
 * the wrong drawer would be expensive.
 */
export function TypeToConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmName,
  confirmLabel,
  busyLabel,
  busy,
}: {
  open: boolean;
  /** Called when the operator dismisses the dialog. Ignored while `busy`. */
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description: ReactNode;
  /** The exact text the operator must type -- normally the record's name. */
  confirmName: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  // A fresh dialog never starts pre-confirmed from a previous record.
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const matches = typedNameMatches(typed, confirmName);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      {/* Portal + Content assembled here rather than ui/alert-dialog's
          AlertDialogContent: the Master drawers are inline `z-[60]` layers and
          the shared overlay/content are `z-50`, so the dialog would open
          behind the drawer's backdrop (see CustomerAddonsPanel). */}
      <AlertDialogPortal>
        <AlertDialogOverlay className="z-[70]" />
        <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[70] grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-1">
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Type <span className="font-semibold text-foreground">{confirmName}</span> to confirm
            </label>
            <input
              id={inputId}
              className={M_INPUT}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={busy || !matches}
              onClick={(e) => {
                e.preventDefault();
                if (matches && !busy) onConfirm();
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}
                </>
              ) : (
                confirmLabel
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
