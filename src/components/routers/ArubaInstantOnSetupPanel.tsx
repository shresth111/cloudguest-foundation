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
 * step in Wave 1). RADIUS stays the sign-in path. Since backend #327 a
 * READ-ONLY poller can read AP status, clients, SSIDs and alerts from
 * Instant On once the service account is configured and polling is on for
 * the site; this panel shows that poll state, not the data. Nothing can be
 * WRITTEN to Instant On: speed limits, disconnect/block, allowed domains and
 * the SSID itself stay in Aruba's app.
 */
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { CopyValueRow } from "@/components/network-integrations/OmadaPortalSetupSteps";
import { MButton, MDialog, MTag, M_INPUT } from "@/components/master/MasterKit";
import {
  ARUBA_RADIUS_PROFILE_NAME,
  PUBLIC_IP_PROBLEM_COPY,
  arubaSetupBadge,
  arubaSetupIsReady,
  checkVenuePublicIp,
  describeArubaSetupGap,
  describeInstantOnReadAccess,
  type ArubaRegistration,
  type ArubaSetupStatus,
} from "@/lib/aruba-instant-on-setup";
import { requestErrorMessage } from "@/services/api";
import { arubaInstantOnService } from "@/services/aruba-instant-on.service";
import { ArubaSpeedGatewaySection } from "@/components/routers/ArubaSpeedGatewaySection";
import type { RouterDevice } from "@/types/router";

/** What Wyfy cannot do at an Instant On venue, named for ops (Master copy may
 * name RADIUS). The customer dashboard greys each of these with its own
 * sentence; this is the one place ops sees the whole list. */
const NOT_FROM_HERE: readonly string[] = [
  "Guest speed limits on the access points themselves (set per guest network in Instant On). Per-guest speed needs a Wyfy MikroTik gateway, below",
  "Disconnecting or blocking a device on the network (no CoA, and the Instant On API is read-only)",
  "Allowed domains and the guest network / SSID settings (set in Instant On, steps below)",
];

/** One query key for the status read, shared with the page header's badge
 * so the two never disagree and React Query issues one request. */
export function arubaSetupQueryKey(routerId: string) {
  return ["master", "aruba-instant-on-setup", routerId];
}

/** The setup page header's badge for an Aruba row: RADIUS registration, not
 * the agent check-in an Instant On site can never perform. */
export function ArubaSetupHeaderBadge({ router }: { router: RouterDevice }) {
  const setup = useQuery({
    queryKey: arubaSetupQueryKey(router.id),
    queryFn: () => arubaInstantOnService.getSetup(router.id),
    retry: false,
  });
  const badge = arubaSetupBadge(setup.data);
  return (
    <span data-testid="aruba-header-badge">
      <MTag label={badge.label} tone={badge.tone} />
    </span>
  );
}

/** Whether Wyfy is reading this venue from Instant On (backend #327). A
 * cheap platform-DB read; on any failure it says so and nothing else. */
function InstantOnReadAccess({ routerId }: { routerId: string }) {
  const sites = useQuery({
    queryKey: ["master", "instant-on-sites"],
    queryFn: () => arubaInstantOnService.listInstantOnSites(),
    retry: false,
    staleTime: 30_000,
  });
  let sentence: string;
  if (sites.isLoading) sentence = "Checking whether Wyfy is reading this site from Instant On…";
  else if (sites.isError || !sites.data)
    sentence = "Could not check whether Wyfy is reading this site from Instant On.";
  else sentence = describeInstantOnReadAccess(sites.data, routerId).sentence;
  return (
    <p className="mt-1 text-xs text-foreground" data-testid="aruba-read-access">
      {sentence}
    </p>
  );
}

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
    <MDialog
      open={!!result}
      onClose={onClose}
      title="Shared secret — shown once"
      footer={
        <MButton variant="primary" onClick={onClose}>
          Done — it&rsquo;s in Instant On
        </MButton>
      }
    >
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
            Fingerprint <code>{result.secretFingerprint ?? "—"}</code> · {result.secretLength} chars
            · NAS-Identifier <code>{result.nasIdentifier}</code>
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

/** A value ops types into Instant On -- or, while the backend still reports a
 * gap, a placeholder with NO copy button (PM_SPEC §0.2 "gaps instead of
 * values": a copyable value beside a warning gets pasted and walked away
 * from). */
function Value({ label, value }: { label: string; value: string | null | undefined }) {
  if (value) return <CopyValueRow label={label} value={value} />;
  return (
    <p className="text-xs" data-testid="aruba-value-pending">
      <span className="text-foreground">{label}:</span>{" "}
      <span className="italic">appears once the gaps above are fixed</span>
    </p>
  );
}

/**
 * PM_SPEC §0.3, in order. Rendered whether or not the venue is ready, so ops
 * can see the whole job up front; every value that comes from the backend is
 * withheld (`ready === false`) until the backend reports no gaps.
 */
function Checklist({ setup, ready }: { setup: ArubaSetupStatus; ready: boolean }) {
  const portal = ready ? setup.portalUrl : null;
  const radius = ready ? setup.radiusServer : null;
  const nasIdentifier = ready ? setup.nasIdentifier : null;
  return (
    <ol className="space-y-4" data-testid="aruba-setup-checklist" data-ready={ready}>
      <Step n={1} title="Instant On app › Site › RADIUS › Create RADIUS profile">
        <p>
          Shared secret: the one shown once when you registered or rotated (it is never shown
          again). Timeout 5, retries 3. <strong>RADIUS accounting ON.</strong>{" "}
          <strong>Require Message-Authenticator ON.</strong> NAS IP: device IP (default).
        </p>
        <Value label="Profile name" value={ARUBA_RADIUS_PROFILE_NAME} />
        <Value label="Primary server" value={radius?.host} />
        <Value label="Authentication port" value={radius ? String(radius.authPort) : null} />
        <Value label="Accounting port" value={radius ? String(radius.accountingPort) : null} />
        <Value label="NAS-Identifier (custom)" value={nasIdentifier} />
      </Step>
      <Step n={2} title="Site › Guest portal">
        <p>
          Type External, provider Custom, mode Guest authentication (not
          &ldquo;Acknowledgment&rdquo;). RADIUS profile: {ARUBA_RADIUS_PROFILE_NAME}. Use HTTPS{" "}
          {portal ? (portal.useHttps ? "ON" : "OFF") : "ON"}.
        </p>
        <Value label="Server host" value={portal?.serverHost} />
        <Value label="Server port" value={portal ? String(portal.serverPort) : null} />
        <Value label="Server URL path" value={portal?.serverUrlPath} />
      </Step>
      <Step n={3} title="Guest portal › Allowed domains">
        {ready && setup.allowedDomains.length > 0 ? (
          setup.allowedDomains.map((h) => <Value key={h} label="Allowed domain" value={h} />)
        ) : (
          <Value label="Allowed domains" value={null} />
        )}
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
        If the phone shows the portal but sign-in spins and fails: (1) the secret in Instant On does
        not match — compare by rotating, not by retyping; (2) the hub is not open to the venue IP;
        (3) the venue&rsquo;s public IP has changed.
      </p>
    </ol>
  );
}

export function ArubaInstantOnSetupPanel({ router }: { router: RouterDevice }) {
  const qc = useQueryClient();
  const key = arubaSetupQueryKey(router.id);
  const setup = useQuery({
    queryKey: key,
    queryFn: () => arubaInstantOnService.getSetup(router.id),
    retry: false,
  });

  const [ip, setIp] = useState("");
  const [staticConfirmed, setStaticConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<ArubaRegistration | null>(null);
  // "Venue IP changed": re-registering takes the backend's rotate/move path
  // (API_CONTRACT §3), so it mints a new secret too.
  const [moving, setMoving] = useState(false);
  const ipProblem = checkVenuePublicIp(ip);

  const HUB_RESTART_WARNING =
    "This restarts RADIUS on the hub for 1 to 2 seconds. Every venue's sign-ins pause briefly. Avoid peak hours.";

  async function run(action: () => Promise<ArubaRegistration>, fallback: string) {
    setBusy(true);
    try {
      setReveal(await action());
      setMoving(false);
      setIp("");
      setStaticConfirmed(false);
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
        items={[
          requestErrorMessage(setup.error, "This device's RADIUS registration did not load."),
        ]}
      />
    );
  } else {
    const s = setup.data;
    const registerForm = (title: string, cta: string) => (
      <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
        <p className="text-sm font-medium text-foreground">{title}</p>
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
        {ip && ipProblem && <p className="text-destructive">{PUBLIC_IP_PROBLEM_COPY[ipProblem]}</p>}
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
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {cta}
        </MButton>
      </div>
    );
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
            {s.radiusServer?.accountingPort ?? 1813} from {s.nasIp ?? "the venue IP"}/32 on the hub.
            Until then every sign-in times out. This panel does not do it.
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
            <MButton variant="ghost" disabled={busy} onClick={() => setMoving((m) => !m)}>
              Venue IP changed
            </MButton>
          </div>
          {moving &&
            registerForm(
              "Register the venue's new public IP (issues a new secret, shown once)",
              "Register new IP",
            )}
        </div>
      ) : (
        registerForm("Register with RADIUS", "Register with RADIUS")
      );
    // Gaps instead of values: the backend nulls `portal_url` whenever it
    // reports a gap, and the checklist renders only when nothing is missing.
    const ready = arubaSetupIsReady(s);
    content = (
      <>
        {registration}
        {!ready && (
          <Gaps
            items={
              s.gaps.length > 0
                ? s.gaps.map(describeArubaSetupGap)
                : ["The platform returned no setup values and gave no reason."]
            }
          />
        )}
        <Checklist setup={s} ready={ready} />
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
            Guests sign in over RADIUS: the access points send guests to our portal and ask our
            RADIUS hub whether they signed in. That is the only path that lets a guest online, and
            the setup below is all it needs. One Instant On site maps to this one location; its
            guest portal and RADIUS settings are site-wide.
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Separately, Wyfy can <em>read</em> (never change) AP status, connected clients, SSIDs
            and alerts from Instant On, once the Wyfy service account is configured and polling is
            switched on for this site.
          </p>
          <InstantOnReadAccess routerId={router.id} />
          <p className="mt-1 text-xs text-muted-foreground">
            {router.organizationName} / {router.locationName} · {router.name} · serial{" "}
            {router.serialNumber || "—"} · MAC {router.macAddress || "—"}
          </p>
        </div>
      </div>

      {content}

      <ArubaSpeedGatewaySection routerId={router.id} />

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
