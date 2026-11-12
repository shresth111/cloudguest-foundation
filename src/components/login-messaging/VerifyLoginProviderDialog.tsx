import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmLoginVerify, useStartLoginVerify } from "@/hooks/useLoginMessaging";
import type {
  LoginChannel,
  LoginMessagingTarget,
  VerifyStartResult,
} from "@/types/login-messaging";
import { LayerDialog } from "./LayerDialog";
import { CHANNEL_LABEL, loginMessagingError } from "./login-messaging-copy";

/**
 * Verify, the same for every provider: we send a code through the account to
 * a number you type, and the account counts as verified only when you type
 * that code back. A provider "accepting" a message is not proof it arrives.
 * From Master, the number is the one the Wyfy team member enters.
 */
export function VerifyLoginProviderDialog({
  target,
  channel,
  open,
  onOpenChange,
}: {
  target: LoginMessagingTarget;
  channel: LoginChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const start = useStartLoginVerify(target);
  const confirm = useConfirmLoginVerify(target);
  const [to, setTo] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<VerifyStartResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = start.isPending || confirm.isPending;

  useEffect(() => {
    if (!open) {
      setCode("");
      setSent(null);
      setError(null);
    }
  }, [open]);

  const send = async () => {
    setError(null);
    try {
      setSent(await start.mutateAsync({ channel, to: to.trim() }));
    } catch (err) {
      setError(loginMessagingError(err, "Couldn't send the code."));
    }
  };

  const check = async () => {
    setError(null);
    try {
      await confirm.mutateAsync({ channel, code: code.trim() });
      toast.success(
        `Verified. Guests now get their ${CHANNEL_LABEL[channel]} login codes from this account.`,
      );
      onOpenChange(false);
    } catch (err) {
      setError(loginMessagingError(err, "Couldn't verify the code."));
    }
  };

  return (
    <LayerDialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={`Verify your ${CHANNEL_LABEL[channel]} provider`}
      description={
        target.kind === "platform"
          ? "Enter a number you can read messages on. A code is sent through the customer's account."
          : "Enter your own mobile number. We send a code through your account; type it back to finish."
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          {!sent ? (
            <Button onClick={() => void send()} disabled={busy || to.trim().length < 8}>
              {start.isPending ? "Sending…" : "Send code"}
            </Button>
          ) : (
            <Button onClick={() => void check()} disabled={busy || !/^\d{4,8}$/.test(code.trim())}>
              {confirm.isPending ? "Checking…" : "Verify"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-1">
        <Label htmlFor="lm-verify-to">Mobile number</Label>
        <Input
          id="lm-verify-to"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={to}
          disabled={!!sent}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {sent && (
        <div className="space-y-2">
          <ul className="space-y-1 text-xs">
            {sent.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-1.5">
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                  aria-hidden
                />
                <span>{c.detail}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Sent to {sent.sent_to}. The code is valid for {Math.round(sent.expires_in_seconds / 60)}{" "}
            minutes.{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setSent(null);
                setCode("");
              }}
            >
              Use another number
            </button>
          </p>
          <div className="space-y-1">
            <Label htmlFor="lm-verify-code">Code you received</Label>
            <Input
              id="lm-verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </LayerDialog>
  );
}
