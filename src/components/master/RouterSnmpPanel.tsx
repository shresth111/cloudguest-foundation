import { useState } from "react";
import { toast } from "sonner";
import { Activity, Loader2, Radio, Save, Upload } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import {
  useApplyRouterSnmp,
  useRouterSnmp,
  useRouterSnmpScript,
  useSaveRouterSnmp,
  useTestRouterSnmp,
} from "@/hooks/useRouterSnmp";
import {
  POLL_STATUS_TEXT,
  mismatchText,
  missingForEnable,
  snmpHeadline,
  uptimeText,
  whenText,
  type RouterSnmpApplyResult,
  type RouterSnmpConfigInput,
  type RouterSnmpStatus,
  type RouterSnmpTestResult,
} from "@/lib/router-snmp";
import { requestErrorOf } from "@/services/api";

/**
 * Master console: SNMP monitoring for one fleet device.
 *
 * WHAT IT IS FOR
 * --------------
 * With SNMP on, the platform reads the router's CPU, memory, uptime and
 * per-port traffic counters every 5 minutes over the management tunnel, in
 * addition to the RouterOS API health check. Those readings land in the same
 * device-health history the venue's Devices screen already charts.
 *
 * THREE SEPARATE, VISIBLE STEPS
 * -----------------------------
 * Save (stores settings, touches nothing on the device), Apply to router
 * (writes the agent config over the RouterOS API and reads it back), Test
 * (a real SNMP read of the router's name and uptime). Each reports what
 * actually happened, including "no reply".
 *
 * WHY IN THE FLEET DRAWER: same reason as `FirewallBandPanel` -- the master
 * host cannot reach the full router screen.
 *
 * Every vendor gets the panel, so the answer for Omada and Instant On is
 * stated (and why), instead of the feature silently not existing there.
 *
 * No modal dialogs: the drawer's z-index sits above the shared AlertDialog,
 * so confirmation is inline.
 */
export function RouterSnmpPanel({
  routerId,
  routerName,
}: {
  routerId: string;
  routerName: string;
}) {
  const { can } = useAuth();
  const status = useRouterSnmp(routerId);
  const s = status.data ?? null;
  const tag = status.isLoading
    ? { label: "Checking…", tone: "muted" }
    : status.isError
      ? { label: "Couldn't check", tone: "offline" }
      : snmpHeadline(s);

  return (
    <div
      className="space-y-2 rounded-lg border border-border p-2.5"
      data-testid="router-snmp-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">SNMP monitoring</p>
        <MTag label={tag.label} tone={tag.tone} />
      </div>
      {status.isError && (
        <p className="text-[11px] text-muted-foreground">
          {requestErrorOf(status.error)?.status === 404
            ? "This backend does not serve SNMP settings yet."
            : (requestErrorOf(status.error)?.message ?? "The SNMP status could not be read.")}
        </p>
      )}
      {s && s.support !== "supported" && <UnsupportedNote s={s} />}
      {s && s.support === "supported" && (
        <SupportedBody
          s={s}
          routerId={routerId}
          routerName={routerName}
          canEdit={can("routers.update")}
        />
      )}
    </div>
  );
}

function UnsupportedNote({ s }: { s: RouterSnmpStatus }) {
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      <p>{s.supportReason}</p>
      {s.metricsVia && <p>Health for this device comes from the {s.metricsVia}, not SNMP.</p>}
    </div>
  );
}

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium" title={title ?? value}>
        {value}
      </span>
    </div>
  );
}

function SupportedBody({
  s,
  routerId,
  routerName,
  canEdit,
}: {
  s: RouterSnmpStatus;
  routerId: string;
  routerName: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const test = useTestRouterSnmp(routerId);
  const apply = useApplyRouterSnmp(routerId);
  const [confirmApply, setConfirmApply] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const script = useRouterSnmpScript(routerId, showScript);
  const [testResult, setTestResult] = useState<RouterSnmpTestResult | null>(null);
  const [applyResult, setApplyResult] = useState<RouterSnmpApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function errorText(err: unknown, fallback: string): string {
    const e = requestErrorOf(err);
    if (e?.status === 403)
      return "Your account does not hold routers.update at platform level, which this needs.";
    const code = typeof e?.data?.code === "string" ? `${e.data.code}: ` : "";
    return `${code}${e?.message ?? fallback}`;
  }

  function runTest() {
    setError(null);
    setTestResult(null);
    test.mutate(undefined, {
      onSuccess: (r) => setTestResult(r),
      onError: (err) => setError(errorText(err, "The test could not run.")),
    });
  }

  function runApply() {
    setConfirmApply(false);
    setError(null);
    setApplyResult(null);
    apply.mutate(undefined, {
      onSuccess: (r) => {
        setApplyResult(r);
        if (r.verified) toast.success(`${routerName}: SNMP settings written and verified`);
        else toast.error(`${routerName}: written, but the router does not match`);
      },
      onError: (err) => setError(errorText(err, "The router could not be written.")),
    });
  }

  const failing = s.lastPollStatus && s.lastPollStatus !== "ok";

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Row label="Status" value={s.enabled ? "On" : "Off"} />
        <Row
          label="Version"
          value={
            s.version === "3"
              ? `v3 (${s.v3AuthProtocol ?? "SHA1"}${s.hasV3PrivPassword ? ` + ${s.v3PrivProtocol ?? "AES"}` : ", no encryption"})`
              : "v2c"
          }
        />
        <Row
          label={s.version === "3" ? "User / passphrase" : "Community"}
          value={
            s.hasCommunity
              ? "Set (hidden)"
              : s.usesPlatformDefaultCommunity
                ? "Platform default"
                : "Not set"
          }
        />
        <Row
          label="Last poll"
          value={
            s.lastPollAt
              ? `${whenText(s.lastPollAt)} · ${POLL_STATUS_TEXT[s.lastPollStatus ?? "error"]}`
              : "—"
          }
        />
        <Row label="Last good reading" value={whenText(s.lastSuccessAt)} />
        <Row
          label="Router configured"
          value={s.deviceAppliedAt ? `Verified ${whenText(s.deviceAppliedAt)}` : "Not verified"}
        />
      </div>
      {s.enabled && failing && s.lastPollDetail && (
        <p className="text-[11px] text-destructive">{s.lastPollDetail}</p>
      )}
      {s.enabled && !s.lastPollAt && (
        <p className="text-[11px] text-muted-foreground">
          The platform polls every {Math.round(s.pollIntervalSeconds / 60)} minutes. Nothing has
          been read from this router yet.
        </p>
      )}

      {testResult && <TestResult r={testResult} />}
      {applyResult && <ApplyResult r={applyResult} />}
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}

      {canEdit ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <MButton
              variant="outline"
              className="justify-center"
              disabled={test.isPending || (!s.hasCommunity && !s.usesPlatformDefaultCommunity)}
              onClick={runTest}
              title="A real SNMP read of the router's name and uptime"
            >
              {test.isPending ? <Loader2 className="animate-spin" /> : <Activity />}
              Test SNMP
            </MButton>
            <MButton
              variant="outline"
              className="justify-center"
              disabled={apply.isPending}
              onClick={() => setConfirmApply(true)}
            >
              {apply.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Apply to router
            </MButton>
          </div>
          {confirmApply && (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px]">
              {s.enabled ? (
                <p>
                  This writes to {routerName} over the RouterOS API: one read-only SNMP community
                  that answers only {s.allowedSources.join(", ") || "(no source configured)"}; the
                  factory &quot;public&quot; community is limited to the router itself; then the
                  SNMP agent is switched on. Guest traffic is not touched. The result is read back.
                </p>
              ) : (
                <p>
                  This removes the platform&apos;s SNMP community from {routerName}. The agent is
                  switched off only if no other community uses it.
                </p>
              )}
              <div className="flex gap-2">
                <MButton variant="primary" onClick={runApply}>
                  Write to router
                </MButton>
                <MButton variant="ghost" onClick={() => setConfirmApply(false)}>
                  Cancel
                </MButton>
                <MButton variant="ghost" onClick={() => setShowScript((v) => !v)}>
                  {showScript ? "Hide" : "Show"} commands
                </MButton>
              </div>
              {showScript && (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[10px]">
                  {script.isLoading
                    ? "Loading…"
                    : script.isError
                      ? (requestErrorOf(script.error)?.message ?? "Could not load the commands.")
                      : (script.data?.lines ?? []).join("\n")}
                </pre>
              )}
            </div>
          )}
          <MButton
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
          >
            <Radio /> {editing ? "Close settings" : "SNMP settings"}
          </MButton>
          {editing && <SettingsForm s={s} routerId={routerId} onSaved={() => setEditing(false)} />}
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Changing SNMP needs routers.update at platform level.
        </p>
      )}
    </div>
  );
}

function TestResult({ r }: { r: RouterSnmpTestResult }) {
  if (r.ok) {
    return (
      <div className="space-y-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-[11px]">
        <p className="font-medium text-emerald-700 dark:text-emerald-400">
          The router answered over SNMP {r.version ? `v${r.version}` : ""}.
        </p>
        <Row label="Name" value={r.sysName ?? "—"} />
        <Row label="Uptime" value={uptimeText(r.uptimeSeconds)} />
        <Row label="System" value={r.sysDescr ?? "—"} />
      </div>
    );
  }
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
      <p className="font-medium">
        {r.status === "no_response"
          ? "No reply from the router."
          : "The SNMP agent returned an error."}
      </p>
      {r.detail && <p>{r.detail}</p>}
    </div>
  );
}

function ApplyResult({ r }: { r: RouterSnmpApplyResult }) {
  return (
    <div
      className={`space-y-0.5 rounded-md border p-2 text-[11px] ${
        r.verified
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-destructive/40 bg-destructive/5 text-destructive"
      }`}
    >
      <p className="font-medium">
        {r.verified
          ? r.action === "remove"
            ? "Removed and confirmed on the router."
            : "Written and confirmed on the router."
          : "Written, but the router does not hold what was sent:"}
      </p>
      {r.mismatches.map((m) => (
        <p key={m}>• {mismatchText(m)}</p>
      ))}
      {r.unverified.length > 0 && (
        <p className="text-muted-foreground">
          The router does not show passphrases back, so they could not be checked. Use Test SNMP.
        </p>
      )}
      {r.changed.length === 0 && r.verified && (
        <p className="text-muted-foreground">Nothing needed changing.</p>
      )}
    </div>
  );
}

function SettingsForm({
  s,
  routerId,
  onSaved,
}: {
  s: RouterSnmpStatus;
  routerId: string;
  onSaved: () => void;
}) {
  const save = useSaveRouterSnmp(routerId);
  const [draft, setDraft] = useState<RouterSnmpConfigInput>({
    enabled: s.enabled,
    version: s.version === "3" ? "3" : "2c",
    v3AuthProtocol: (s.v3AuthProtocol as "SHA1" | "MD5" | null) ?? "SHA1",
    v3PrivProtocol: (s.v3PrivProtocol as "AES" | "DES" | null) ?? "AES",
  });
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<RouterSnmpConfigInput>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const blocker = draft.enabled ? missingForEnable(s, draft) : null;
  const v3 = draft.version === "3";
  const inputCls = "h-8 text-xs";
  const selectCls =
    "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  function submit() {
    if (blocker) {
      setError(blocker);
      return;
    }
    save.mutate(draft, {
      onSuccess: () => {
        toast.success("SNMP settings saved. Use Apply to router to write them to the device.");
        onSaved();
      },
      onError: (err) => {
        const e = requestErrorOf(err);
        setError(e?.message ?? "The settings could not be saved.");
      },
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <label className="flex items-center justify-between gap-2 text-xs">
        <span>Poll this router over SNMP</span>
        <Switch checked={!!draft.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </label>
      <label className="block space-y-1 text-[11px]">
        <span className="text-muted-foreground">Version</span>
        <select
          className={selectCls}
          value={draft.version}
          onChange={(e) => set({ version: e.target.value as "2c" | "3" })}
        >
          <option value="2c">v2c (community string)</option>
          <option value="3">v3 (user + passphrase)</option>
        </select>
      </label>
      {!v3 ? (
        <label className="block space-y-1 text-[11px]">
          <span className="text-muted-foreground">Community</span>
          <Input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            placeholder={s.hasCommunity ? "Set — leave blank to keep" : "6–64 characters"}
            value={draft.community ?? ""}
            onChange={(e) => set({ community: e.target.value })}
          />
        </label>
      ) : (
        <>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">User name</span>
            <Input
              className={inputCls}
              autoComplete="off"
              placeholder={s.hasCommunity ? "Set — leave blank to keep" : "e.g. wyfy-monitor"}
              value={draft.v3Username ?? ""}
              onChange={(e) => set({ v3Username: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-[11px]">
              <span className="text-muted-foreground">Authentication</span>
              <select
                className={selectCls}
                value={draft.v3AuthProtocol}
                onChange={(e) => set({ v3AuthProtocol: e.target.value as "SHA1" | "MD5" })}
              >
                <option value="SHA1">SHA1</option>
                <option value="MD5">MD5</option>
              </select>
            </label>
            <label className="block space-y-1 text-[11px]">
              <span className="text-muted-foreground">Encryption</span>
              <select
                className={selectCls}
                value={draft.v3PrivProtocol}
                onChange={(e) => set({ v3PrivProtocol: e.target.value as "AES" | "DES" })}
              >
                <option value="AES">AES</option>
                <option value="DES">DES</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">Authentication passphrase</span>
            <Input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              placeholder={s.hasV3AuthPassword ? "Set — leave blank to keep" : "8+ characters"}
              value={draft.v3AuthPassword ?? ""}
              onChange={(e) => set({ v3AuthPassword: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">Encryption passphrase (optional)</span>
            <Input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              placeholder={s.hasV3PrivPassword ? "Set — leave blank to keep" : "8+ characters"}
              value={draft.v3PrivPassword ?? ""}
              onChange={(e) => set({ v3PrivPassword: e.target.value })}
            />
          </label>
        </>
      )}
      <p className="text-[10px] text-muted-foreground">
        Letters, digits and _ . - + = @ ! ~ only. Stored encrypted; never shown again. The router
        will answer only {s.allowedSources.join(", ") || "the platform poller"}.
      </p>
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
      <MButton
        variant="primary"
        className="w-full justify-center"
        disabled={save.isPending}
        onClick={submit}
      >
        {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        Save settings
      </MButton>
    </div>
  );
}
