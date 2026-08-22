import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MStat } from "@/components/master/MasterKit";
import { copyToClipboard } from "@/lib/utils";
import type { RouterDevice } from "@/types/router";
import type { FleetBootstrapScriptPreview } from "@/types/router-fleet-wizard";

export function FleetWizardBootstrapStep({
  router,
  preview,
  loading,
  skipped,
  confirmed,
  onGenerate,
  onConfirmedChange,
}: {
  router: RouterDevice;
  preview: FleetBootstrapScriptPreview | null;
  loading: boolean;
  skipped: boolean;
  confirmed: boolean;
  onGenerate: () => void;
  onConfirmedChange: (value: boolean) => void;
}) {
  if (skipped) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Bootstrap</h3>
          <p className="text-sm text-muted-foreground">
            This router is already past initial enrollment — skip to discovery unless you are
            reprovisioning from factory defaults.
          </p>
        </div>
        <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Status: <span className="font-medium text-foreground">{router.status}</span> — no
          bootstrap script required for the normal wizard path.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Bootstrap on the device</h3>
        <p className="text-sm text-muted-foreground">
          Paste this server-rendered script once in WinBox or SSH before discovery. Copy it with the
          button — it is joined onto one line on purpose, because RouterOS gives each pasted line
          its own scope and a line-by-line paste makes every field check fail. It enrolls the
          router, brings up WireGuard, and pulls the first config — the embedded token is shown only
          this once.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MStat label="Location code" value={router.locationName} />
        <MStat label="Router status" value={router.status} />
        <MStat label="WireGuard" value={router.status === "online" ? "Reachable" : "Not yet"} />
      </div>
      {preview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {preview.lineCount} lines · location{" "}
              <span className="font-mono">{preview.locationCode}</span> · token expires{" "}
              {new Date(preview.tokenExpiresAt).toLocaleString()}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const ok = await copyToClipboard(preview.scriptSingleLine);
                if (ok) toast.success("Copied as one line — paste it in a single go");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy script (1 line)
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {preview.script}
          </pre>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Generate the bootstrap script when you are at the device console.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {preview ? "Regenerate script" : "Generate bootstrap script"}
        </Button>
        {preview ? (
          <div className="flex items-center gap-2">
            <Switch
              id="bootstrap-confirmed"
              checked={confirmed}
              onCheckedChange={onConfirmedChange}
            />
            <Label htmlFor="bootstrap-confirmed" className="text-sm">
              I pasted this on the device
            </Label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
