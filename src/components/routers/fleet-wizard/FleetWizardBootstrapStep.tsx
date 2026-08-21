import { CheckCircle2, Copy, Download, Loader2, RotateCcw, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { MStat } from "@/components/master/MasterKit";
import { cn, copyToClipboard } from "@/lib/utils";
import type { RouterDevice } from "@/types/router";
import type {
  FleetBootstrapMode,
  FleetBootstrapScriptPreview,
  FleetRemoteCutoverPhase,
} from "@/types/router-fleet-wizard";

/** Mirrors the backend's REMOTE_BOOTSTRAP_CUTOVER_DELAY_SECONDS -- the
 * staged cutover's scheduler interval. Not part of the preview response
 * (only `revert_window_minutes` is), so this is display copy, not a
 * contract value. */
const REMOTE_CUTOVER_DELAY_SECONDS = 30;

function downloadScript(preview: FleetBootstrapScriptPreview) {
  const blob = new Blob([preview.script], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bootstrap-${preview.mode}-${preview.locationCode}.rsc`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ModeCard({
  value,
  title,
  desc,
  disabled,
  disabledReason,
}: {
  value: FleetBootstrapMode;
  title: string;
  desc: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <label
      htmlFor={`bootstrap-mode-${value}`}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5",
      )}
    >
      <RadioGroupItem
        id={`bootstrap-mode-${value}`}
        value={value}
        disabled={disabled}
        className="mt-1"
      />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
        {disabled && disabledReason ? (
          <div className="mt-1 text-xs text-muted-foreground italic">{disabledReason}</div>
        ) : null}
      </div>
    </label>
  );
}

/** What the operator is agreeing to before pasting the remote script --
 * written for the moment their session drops mid-cutover. */
function RemoteBriefing({ revertWindowMinutes }: { revertWindowMinutes: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <p className="font-medium">Before you paste — how the remote cutover works</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          The script validates everything first. Your live tunnel is not touched until every
          replacement value checks out — a stale token or unreachable platform aborts with the
          current tunnel intact.
        </li>
        <li>
          The cutover is staged on the router&apos;s own scheduler and fires about{" "}
          {REMOTE_CUTOVER_DELAY_SECONDS} seconds after the paste.{" "}
          <span className="font-medium text-foreground">
            Your session dropping at that point is expected
          </span>{" "}
          — the tunnel you are connected through is being replaced. Do not re-paste; watch the
          status below.
        </li>
        <li>
          An automatic revert is armed for {revertWindowMinutes} minutes. If the new tunnel cannot
          reach the hub, the router restores its previous configuration by itself — no console
          visit needed.
        </li>
      </ul>
    </div>
  );
}

function RemoteCutoverStatus({
  phase,
  revertWindowMinutes,
  lastHandshakeAt,
}: {
  phase: FleetRemoteCutoverPhase;
  revertWindowMinutes: number;
  lastHandshakeAt: string | null;
}) {
  if (phase === "confirmed") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-600/40 bg-emerald-500/10 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium">Cutover confirmed</p>
          <p className="text-muted-foreground">
            The replacement tunnel completed a handshake with the hub
            {lastHandshakeAt ? ` at ${new Date(lastHandshakeAt).toLocaleTimeString()}` : ""}. The
            automatic revert has been disarmed on the device — continue to discovery.
          </p>
        </div>
      </div>
    );
  }
  if (phase === "presumed_reverted") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm">
        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">No handshake inside the revert window — presumed reverted</p>
          <p className="text-muted-foreground">
            The new tunnel never reached the hub within {revertWindowMinutes} minutes, so the
            router should have restored its previous configuration automatically. The platform has
            no direct signal for the revert itself — verify the router from the fleet list before
            retrying, and regenerate the script for another attempt.
          </p>
        </div>
      </div>
    );
  }
  if (phase === "cutover_staged") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
        <div>
          <p className="font-medium">Cutover staged — waiting for the new tunnel to confirm</p>
          <p className="text-muted-foreground">
            The router checked in and its keys were rotated. If your session to the router just
            dropped, that is the cutover running — not a failure. The moment the new tunnel
            handshakes the hub this turns green; if it cannot, the previous tunnel is restored
            automatically within {revertWindowMinutes} minutes.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <TimerReset className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="font-medium">Waiting for the router to check in</p>
        <p className="text-muted-foreground">
          Run the script on the device (WinBox terminal or SSH). Nothing changes on the router
          until it validates and stages the cutover — this panel updates as soon as the check-in
          lands.
        </p>
      </div>
    </div>
  );
}

export function FleetWizardBootstrapStep({
  router,
  mode,
  onModeChange,
  preview,
  loading,
  skipped,
  confirmed,
  remotePhase,
  remoteLastHandshakeAt,
  onGenerate,
  onConfirmedChange,
}: {
  router: RouterDevice;
  /** `null` only for an already-enrolled router that has not opted into a
   * re-provision -- the step then stays informational, as before. */
  mode: FleetBootstrapMode | null;
  onModeChange: (mode: FleetBootstrapMode) => void;
  preview: FleetBootstrapScriptPreview | null;
  loading: boolean;
  skipped: boolean;
  confirmed: boolean;
  /** Non-null only while a remote-mode script is outstanding. */
  remotePhase: FleetRemoteCutoverPhase | null;
  /** The rotated peer's reported handshake time -- the proof behind a
   * `confirmed` phase. */
  remoteLastHandshakeAt: string | null;
  onGenerate: () => void;
  onConfirmedChange: (value: boolean) => void;
}) {
  const neverEnrolled = router.lastSeenAt == null;
  const remote = mode === "remote";
  // Belt-and-braces: the parent already clears stale previews on mode
  // change, but a script must never render under a mode it was not
  // generated for.
  const activePreview = preview && preview.mode === mode ? preview : null;
  const revertWindowMinutes = activePreview?.revertWindowMinutes ?? 10;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          {skipped ? "Bootstrap" : "Bootstrap on the device"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {skipped
            ? "This router is already past initial enrollment — continue to discovery, or pick a re-provision mode below to run Step 1 again."
            : "Paste this once before discovery. Copy it with the button — it comes as a single line on purpose, because RouterOS gives each pasted line its own scope and a line-by-line paste makes every field check fail. It enrolls the router, brings up WireGuard, and pulls the first config; the embedded token is shown only this once."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MStat label="Location code" value={router.locationName} />
        <MStat label="Router status" value={router.status} />
        <MStat label="WireGuard" value={router.status === "online" ? "Reachable" : "Not yet"} />
      </div>

      <RadioGroup
        value={mode ?? ""}
        onValueChange={(value) => onModeChange(value as FleetBootstrapMode)}
        className="grid gap-3 sm:grid-cols-2"
      >
        <ModeCard
          value="onsite"
          title="Technician on site"
          desc="Fresh enrollment with console or WinBox access in hand. Cleans up any stale state first, then enrolls — the standard path."
          disabled={skipped}
          disabledReason="Already enrolled — the on-site script's cleanup-first ordering is for fresh enrollment from the console."
        />
        <ModeCard
          value="remote"
          title="Remote re-provision"
          desc="Re-provision a live router over its own tunnel. Validates first, stages the cutover on the device's scheduler, and arms an automatic revert."
          disabled={neverEnrolled}
          disabledReason="This router has never checked in, so there is no live tunnel to replace — use the on-site script for first enrollment."
        />
      </RadioGroup>

      {remote ? <RemoteBriefing revertWindowMinutes={revertWindowMinutes} /> : null}

      {activePreview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {activePreview.mode === "remote" ? "Remote re-provision" : "On-site"} script ·{" "}
              {activePreview.lineCount} lines · location{" "}
              <span className="font-mono">{activePreview.locationCode}</span> · token expires{" "}
              {new Date(activePreview.tokenExpiresAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ok = await copyToClipboard(activePreview.scriptSingleLine);
                  if (ok)
                    toast.success(
                      activePreview.mode === "remote"
                        ? "Remote script copied as one line — paste it in a single go"
                        : "Copied as one line — paste it in a single go",
                    );
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy script (1 line)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadScript(activePreview)}
              >
                <Download className="h-3.5 w-3.5" /> Download .rsc
              </Button>
            </div>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {activePreview.script}
          </pre>
        </div>
      ) : mode ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {remote
            ? "Generate the remote re-provision script when you are ready to stage the cutover. Generating rewinds the router to pending provisioning and mints a one-time token."
            : "Generate the bootstrap script when you are at the device console."}
        </div>
      ) : null}

      {mode ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onGenerate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {activePreview
              ? "Regenerate script"
              : remote
                ? "Generate remote re-provision script"
                : "Generate bootstrap script"}
          </Button>
          {activePreview ? (
            <div className="flex items-center gap-2">
              <Switch
                id="bootstrap-confirmed"
                checked={confirmed}
                onCheckedChange={onConfirmedChange}
              />
              <Label htmlFor="bootstrap-confirmed" className="text-sm">
                {remote ? "I ran this on the device" : "I pasted this on the device"}
              </Label>
            </div>
          ) : null}
        </div>
      ) : null}

      {remote && activePreview && remotePhase ? (
        <RemoteCutoverStatus
          phase={remotePhase}
          revertWindowMinutes={revertWindowMinutes}
          lastHandshakeAt={remoteLastHandshakeAt}
        />
      ) : null}
    </div>
  );
}
