/**
 * The settings an operator types into a TP-Link Omada controller so its
 * guests land on this platform's captive portal, rendered once.
 *
 * ## Why one component
 *
 * Omada has no setup script. Unlike the MikroTik path, where provisioning
 * writes the portal redirect onto the device, a human reads these values off
 * a dashboard and types them into the controller's own UI. This block was
 * the ONLY place they could learn them, and it had grown three copies: the
 * customer's Network Integrations page, the Master console's integration
 * drawer, and the Add customer wizard's result screen -- each with its own
 * wording of the same controller path and a different subset of the
 * hardware findings below. The Router Fleet setup screen for an Omada device
 * would have been a fourth. Every surface now renders this one.
 *
 * ## Two fields, not one string
 *
 * The controller takes the scheme and the host+path+query in SEPARATE
 * inputs, and its `serverUrl` validation pattern REJECTS a value containing
 * a scheme. Both values come straight off the API -- the shape is decided
 * once, server-side, in `validators.build_external_portal_url` -- and are
 * rendered and copied separately. The joined `https://…` form is never shown
 * here: it is the single most likely paste error.
 *
 * ## Steps 2 and 3 are hardware findings, not documentation
 *
 * Measured 2026-09-11 from an associated but unauthorized client: DNS
 * resolves, TCP 443 connects (the AP accepts it in order to intercept), and
 * every HTTPS request times out -- our own portal host included. Omada does
 * not auto-permit the external portal server it is itself redirecting to;
 * with a Pre-Authentication Access entry the same request returned 200 in
 * ~80 ms. And the AP's first redirect is to the CONTROLLER's own portal page
 * on 8088, not to us -- a cloud-hosted controller whose firewall does not
 * admit the venue never shows the guest anything. Neither failure is
 * reported anywhere in the controller's UI, which is why both are numbered
 * steps and not footnotes.
 */
import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Where the portal lives in the controller (Omada v5 Site View). */
const OMADA_EXTERNAL_PORTAL_PATH =
  "Site View → Network Config → Authentication → Portal → (create or edit the portal for the guest SSID) → Authentication Type: External Portal Server → Host Type: URL";

const OMADA_PRE_AUTH_PATH =
  "Authentication → Portal → Access Control → Pre-Authentication Access → add URL entry";

export function CopyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <code className="break-all text-right text-xs">{value}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Copy ${label}`}
          onClick={() => {
            // `navigator.clipboard` is absent on an insecure origin and
            // rejects when the document is unfocused; the value stays on
            // screen and selectable, and "Copied" when nothing was is the
            // thing worth avoiding.
            navigator.clipboard
              ?.writeText(value)
              .then(() => toast.success(`${label} copied`))
              .catch(() => toast.error(`Could not copy — select the ${label} and copy it.`));
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StepTitle({ children }: { children: ReactNode }) {
  return <p className="pt-2 text-xs font-semibold text-foreground">{children}</p>;
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function OmadaPortalSetupSteps({
  scheme,
  hostAndQuery,
  guestSsidName,
}: {
  scheme: string;
  hostAndQuery: string;
  /** The integration's guest SSID, when one is recorded. */
  guestSsidName?: string | null;
}) {
  // The host alone, for the pre-authentication entry. Taken off the URL the
  // server built rather than re-derived, so the host an operator is told to
  // permit is by construction the host their guests are sent to -- those two
  // drifting apart is a walled garden that lets nobody in.
  const host = hostAndQuery.split("/")[0];
  const ssid = guestSsidName?.trim() || null;

  return (
    <div className="space-y-1.5" data-testid="omada-portal-setup-steps">
      <Muted>
        Guests cannot sign in until steps 1–3 are done on the controller. Step 4 checks it.
      </Muted>

      <StepTitle>1. External Portal Server</StepTitle>
      <Muted>{OMADA_EXTERNAL_PORTAL_PATH}</Muted>
      <Muted>
        Scheme and URL are two separate fields — the controller rejects a URL that contains the
        scheme, so paste the URL without {scheme}://.
      </Muted>
      <CopyValueRow label="Scheme" value={scheme} />
      <CopyValueRow label="URL" value={hostAndQuery} />
      {ssid ? (
        <>
          <Muted>Attach the portal to this SSID:</Muted>
          <CopyValueRow label="Guest SSID" value={ssid} />
        </>
      ) : (
        <Muted>
          Attach the portal to the SSID your guests join — no guest SSID is recorded on this
          integration.
        </Muted>
      )}

      <StepTitle>2. Pre-Authentication Access</StepTitle>
      <Muted>
        {OMADA_PRE_AUTH_PATH} for the portal host (switch Pre-Authentication Access on if it is
        off).
      </Muted>
      <CopyValueRow label="Portal host" value={host} />
      <Muted>
        Without it guests hang forever: Omada does not automatically allow the portal server it
        sends them to (measured on hardware), so the sign-in page never loads.
      </Muted>
      <Muted>
        A URL entry permits the address the host is resolved to, not the name, so this one entry
        also covers the API the sign-in page calls — only because both currently resolve to the same
        address.
      </Muted>

      <StepTitle>3. Guests must reach the controller</StepTitle>
      <Muted>
        A guest&rsquo;s browser is first sent to the controller&rsquo;s own portal page on port 8088
        (plain HTTP; 8843 if HTTPS redirection is on), so the controller must be reachable on that
        port from the venue&rsquo;s network. For a self-hosted controller in the cloud, that means
        allowing the venue&rsquo;s public IP.
      </Muted>

      <StepTitle>4. Verify</StepTitle>
      <Muted>
        Connect a phone to {ssid ? <strong>{ssid}</strong> : "the guest SSID"}. The sign-in
        page&rsquo;s address should contain <code>site=</code> and <code>clientMac=</code>. After
        signing in, the phone should browse normally.
      </Muted>
    </div>
  );
}
