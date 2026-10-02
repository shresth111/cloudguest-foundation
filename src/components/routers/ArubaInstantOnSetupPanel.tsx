/**
 * Router Fleet's setup screen for an Aruba Instant On fleet row (Master only).
 *
 * The Omada panel's sibling, and the opposite case: Omada has a controller
 * API and a network integration; Instant On has neither. It is managed only
 * from Aruba's own app, so this platform's whole relationship with it is
 * RADIUS -- the AP sends guests to our portal and asks our hub whether the
 * identifier the guest's browser posted back is signed in (DESIGN.md §2).
 *
 * So the screen is: register the venue's public IP as a RADIUS client (the
 * secret is minted by the backend and shown ONCE), then type the values
 * below into Instant On. PM_SPEC §0.2 / §0.3. Every value comes from the
 * backend (`GET /platform/radius/nas/public/{router_id}`, API_CONTRACT.md
 * §2); nothing is derived or hardcoded here.
 *
 * ## Gaps instead of values
 *
 * Same rule as `OmadaGuidedSetupPanel`: while the backend reports any gap
 * (no location, not registered, hub not confirmed, hub address unset), the
 * checklist is NOT rendered and the gaps are listed instead. A copyable URL beside a
 * warning gets pasted and walked away from.
 *
 * ## What this does NOT do, said on screen
 *
 * It does not open the hub's firewall to the venue IP (a manual engineer
 * step in Wave 1), and nothing here can see the access points: AP status,
 * clients, SSIDs and speeds live in Instant On.
 */
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { CopyValueRow } from "@/components/network-integrations/OmadaPortalSetupSteps";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import {
  PUBLIC_IP_PROBLEM_COPY,
  checkVenuePublicIp,
  describeArubaSetupGap,
  type ArubaRegistration,
  type ArubaSetupStatus,
} from "@/lib/aruba-instant-on-setup";
import { requestErrorMessage } from "@/services/api";
import { arubaInstantOnService } from "@/services/aruba-instant-on.service";
import type { RouterDevice } from "@/types/router";

/** What Wyfy cannot do at an Instant On venue, named for ops (Master copy may
 * name RADIUS). The customer dashboard greys each of these with its own
 * sentence; this is the one place ops sees the whole list. */
const NOT_FROM_HERE: readonly string[] = [
  "Guest speed limits (set per guest network in Instant On)",
  "Disconnecting or blocking a device on the network (no CoA, no Aruba API)",
  "Client lists, AP online/offline, firmware and SSIDs",
  "Allowed domains and the guest network itself (set in Instant On, steps below)",
];

function Gaps({ items }: { items: string[] }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs"
      data-testid="aruba-setup-gaps"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        Guests cannot sign in at this venue yet
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
        {items.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">
        {n}. {title}
      </p>
      <div className="space-y-1.5 pl-4 text-xs text-muted-foreground">{children}</div>
    </li>
  );
}

/** The one-time secret, in the `master.nas.tsx` dialog pattern. */
function SecretOnceDialog({
  result,
  onClose,
}: {
  result: ArubaRegistration | null;
  onClose: () => void;
}) {
  return (
    <MDialog open={!!result} onClose={onClose} title="Shared secret — shown once">
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Type this into Instant On now. It won&rsquo;t be shown again.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <code className="break-all text-sm" data-testid="aruba-secret-once">
              {result.sharedSecret}
            </code>
            <button
              type="button"
              aria-label="Copy shared secret"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(result.sharedSecret)
                  .then(() => toast.success("Shared secret copied"))
                  .catch(() => toast.error("Copy failed — select the secret and copy it."))
              }
              className="shrink-0 text-muted-foreground hover:text-primary"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fingerprint <code>{result.secretFingerprint ?? "—"}</code> · {result.secretLength}{" "}
            chars · NAS-Identifier <code>{result.nasIdentifier}</code>
          </p>
          {!result.hubConfirmed && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              The hub did not confirm this client. Guests will time out until it does — register
              again to retry.
            </p>
          )}
          {result.rotated && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {result.deviceAction ??
                "Instant On still has the old secret. Sign-ins fail until you replace it there."}
            </p>
          )}
        </div>
      )}
    </MDialog>
  );
}

function Checklist({ setup }: { setup: ArubaSetupStatus }) {
  const portal = setup.portalUrl;
  const radius = setup.radiusServer;
  if (!portal || !radius || !setup.nasIdentifier) return null;
  return (
    <ol className="space-y-4" data-testid="aruba-setup-checklist">
      <Step n={1} title="Instant On app › Site › RADIUS › Create RADIUS profile">
        <p>
          Name <code>Wyfy Guest</code>. Shared secret: the one shown once when you registered or
          rotated. Timeout 5, retries 3. RADIUS accounting ON. Require Message-Authenticator ON. NAS
          IP: device IP (default).
        </p>
        <CopyValueRow label="Primary server" value={radius.host} />
        <CopyValueRow label="Authentication port" value={String(radius.authPort)} />
        <CopyValueRow label="Accounting port" value={String(radius.accountingPort)} />
        <CopyValueRow label="NAS-Identifier (custom)" value={setup.nasIdentifier} />
      </Step>
      <Step n={2} title="Site › Guest portal">
        <p>
          Type External, provider Custom, mode Guest authentication (not &ldquo;Acknowledgment&rdquo;).
          RADIUS profile: Wyfy Guest. Use HTTPS {portal.useHttps ? "ON" : "OFF"}.
        </p>
        <CopyValueRow label="Server host" value={portal.serverHost} />
        <CopyValueRow label="Server port" value={String(portal.serverPort)} />
        <CopyValueRow label="Server URL path" value={portal.serverUrlPath} />
      </Step>
      <Step n={3} title="Guest portal › Allowed domains">
        {setup.allowedDomains.map((h) => (
          <CopyValueRow key={h} label="Allowed domain" value={h} />
        ))}
      </Step>
      <Step n={4} title="Networks › Add › Wireless">
        <p>
          Type Guest, security Open, Show guest portal ON. Leave client isolation at the default
          (guests cannot see each other). A per-client speed limit, if wanted, is set here — Wyfy
          cannot set it.
        </p>
      </Step>
      <Step n={5} title="Save, then read back">
        <p>
          Open Guest portal again and confirm the host and path are saved exactly. Instant On may
          strip the <code>?query</code>; if it did, guests land on an incomplete link.
        </p>
      </Step>
      <Step n={6} title="Test">
        <p>
          Join the SSID from a phone, sign in, and open any site. Then check the hub log for an
          Access-Accept and an Accounting-Start from {setup.nasIp ?? "the venue IP"}.
        </p>
      </Step>
      <p className="text-xs text-muted-foreground">
        If the phone shows the portal but sign-in spins and fails: (1) the secret in Instant On
        does not match — compare by rotating, not by retyping; (2) the hub is not open to the venue
        IP; (3) the venue&rsquo;s public IP has changed.
      </p>
    </ol>
  );
}

export function ArubaInstantOnSetupPanel({ router }: { router: RouterDevice }) {
  const qc = useQueryClient();
  const key = ["master", "aruba-instant-on-setup", router.id];
  const setup = useQuery({
    queryKey: key,
    queryFn: () => arubaInstantOnService.getSetup(router.id),
    retry: false,
  });

  const [ip, setIp] = useState("");
  const [staticConfirmed, setStaticConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<ArubaRegistration | null>(null);
  const ipProblem = checkVenuePublicIp(ip);

  const HUB_RESTART_WARNING =
    "This restarts RADIUS on the hub for 1 to 2 seconds. Every venue's sign-ins pause briefly. Avoid peak hours.";

  async function run(action: () => Promise<ArubaRegistration>, fallback: string) {
    setBusy(true);
    try {
      setReveal(await action());
      // The secret stays in `reveal` only; the refetch reads the fingerprint.
      await qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      // The backend pushes to the hub before it writes, so a refusal here
      // means nothing changed. A 422's message is the reason, verbatim.
      toast.error(requestErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  function register() {
    if (!window.confirm(HUB_RESTART_WARNING)) return;
    void run(
      () => arubaInstantOnService.register(router.id, ip.trim()),
      "Could not register this venue — nothing was changed.",
    );
  }

  function rotate(nasId: string) {
    if (
      !window.confirm(
        "Rotate this venue's RADIUS secret?\n\nGuest sign-ins at this venue fail until the new secret is typed into Instant On.\n\n" +
          HUB_RESTART_WARNING,
      )
    )
      return;
    void run(
      () => arubaInstantOnService.rotate(nasId),
      "Could not rotate the secret — nothing was changed.",
    );
  }

  async function deregister(nasId: string, label: string) {
    if (
      !window.confirm(
        `Deregister "${label}"? This removes the venue's RADIUS client from the hub, and every guest sign-in at ${router.locationName || "this venue"} fails from then on. This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await arubaInstantOnService.deregister(nasId);
      toast.success(`${label} deregistered`);
      await qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error(requestErrorMessage(err, "Could not deregister this venue."));
    } finally {
      setBusy(false);
    }
  }

  let content: ReactNode;
  if (setup.isLoading) {
    content = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Looking up this venue&rsquo;s RADIUS
        registration…
      </p>
    );
  } else if (setup.isError || !setup.data) {
    content = (
      <Gaps
        items={[requestErrorMessage(setup.error, "This device's RADIUS registration did not load.")]}
      />
    );
  } else {
    const s = setup.data;
    const registration =
      s.registered && s.nasId ? (
        <div
          className="space-y-2 rounded-lg border border-border p-3 text-xs"
          data-testid="aruba-registered"
        >
          <p className="text-sm font-medium text-foreground">Registered with RADIUS</p>
          <p className="text-muted-foreground">
            NAS-Identifier <code>{s.nasIdentifier ?? "—"}</code> · venue public IP{" "}
            <code>{s.nasIp ?? "—"}</code> · status {s.nasStatus ?? "—"} · secret fingerprint{" "}
            <code>{s.secretFingerprint ?? "—"}</code>
            {s.secretLength ? ` · ${s.secretLength} chars` : ""} · hub{" "}
            {s.hubConfirmed ? "confirmed" : "NOT confirmed"}
          </p>
          <p className="text-muted-foreground">
            The secret is never shown again; rotate to issue a new one.
          </p>
          <p className="text-amber-700 dark:text-amber-400">
            Ask an engineer to open UDP {s.radiusServer?.authPort ?? 1812}-
            {s.radiusServer?.accountingPort ?? 1813} from {s.nasIp ?? "the venue IP"}/32 on the
            hub. Until then every sign-in times out. This panel does not do it.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <MButton variant="outline" disabled={busy} onClick={() => rotate(s.nasId as string)}>
              Rotate secret
            </MButton>
            <MButton
              variant="ghost"
              disabled={busy}
              onClick={() => deregister(s.nasId as string, s.nasIdentifier ?? "this NAS")}
            >
              Deregister
            </MButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
          <p className="text-sm font-medium text-foreground">Register with RADIUS</p>
          <label className="block text-muted-foreground" htmlFor="aruba-venue-ip">
            Venue public IP
          </label>
          <input
            id="aruba-venue-ip"
            className={M_INPUT}
            inputMode="decimal"
            placeholder="203.0.113.10"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
          />
          <p className="text-muted-foreground">
            Measure it from a phone on the venue WiFi: open checkip.amazonaws.com.
          </p>
          {ip && ipProblem && (
            <p className="text-destructive">{PUBLIC_IP_PROBLEM_COPY[ipProblem]}</p>
          )}
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={staticConfirmed}
              onChange={(e) => setStaticConfirmed(e.target.checked)}
            />
            The ISP confirms this IP is static
          </label>
          <p className="text-muted-foreground">
            If the IP changes, every sign-in at this venue times out silently.
          </p>
          <MButton disabled={!!ipProblem || !staticConfirmed || busy} onClick={register}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Register with RADIUS
          </MButton>
        </div>
      );
    // Gaps instead of values: the backend nulls `portal_url` whenever it
    // reports a gap, and the checklist renders only when nothing is missing.
    const ready = s.gaps.length === 0 && s.portalUrl && s.radiusServer && s.nasIdentifier;
    content = (
      <>
        {registration}
        {ready ? (
          <Checklist setup={s} />
        ) : (
          <Gaps
            items={
              s.gaps.length > 0
                ? s.gaps.map(describeArubaSetupGap)
                : ["The platform returned no setup values and gave no reason."]
            }
          />
        )}
      </>
    );
  }

  return (
    <div
      className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm"
      data-testid="aruba-instant-on-setup"
    >
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Aruba Instant On is set up in Aruba&rsquo;s Instant On app, not by a script
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Wyfy has no API to Instant On. The access points send guests to our portal and ask our
            RADIUS hub whether they signed in — that is the whole connection. One Instant On site
            maps to this one location; its guest portal and RADIUS settings are site-wide.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {router.organizationName} / {router.locationName} · {router.name} · serial{" "}
            {router.serialNumber || "—"} · MAC {router.macAddress || "—"}
          </p>
        </div>
      </div>

      {content}

      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Not possible from Wyfy at this venue</p>
        <ul className="list-disc space-y-0.5 pl-5">
          {NOT_FROM_HERE.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <SecretOnceDialog result={reveal} onClose={() => setReveal(null)} />
    </div>
  );
}
