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

      {/* THE TWO ENDS THAT WERE MISSING, and their absence is what produced
          "I provisioned a TP-Link customer and nothing appeared on the Omada
          side". The steps below began at "attach a portal to the guest SSID"
          and quietly assumed a site, an adopted AP, a guest SSID and an Open
          API app already existed -- which are exactly the things an operator
          coming from MikroTik expects provisioning to have created, because
          for MikroTik it does. They are not created here, deliberately: the
          controller belongs to the customer. Saying so is the difference
          between a prerequisite and a thing someone waits for. */}
      <StepTitle>Before you start — on the customer&rsquo;s controller</StepTitle>
      <Muted>
        <strong>The platform does not create any of these, and will not.</strong> The controller is
        the customer&rsquo;s, and a site, an adopted access point and an SSID are decisions about
        their network rather than records about the venue. Provisioning records the venue and
        connects to the controller they already run; it does not build their network for them.
      </Muted>
      <Muted>
        1. <strong>A site</strong> for this venue, under Sites. 2.{" "}
        <strong>The access points adopted</strong> into that site. 3. <strong>A guest SSID</strong>{" "}
        the public connects to. 4. <strong>An Open API app</strong>, under Settings → Platform
        Integration → Open API, which is what the client ID and client secret come from.
      </Muted>
      <Muted>
        The Open API app is the one people skip. Without it the integration can still authorise
        guests, but <strong>Configure controller cannot run</strong> and the device and client lists
        stay permanently empty — hotspot-operator credentials cannot read inventory at all.
      </Muted>

      {/* The automatic path first. Steps 1 and 2 below are precisely what
          `_configure_controller` does -- the portal URL, the
          pre-authentication entry, and the hotspot operator account it
          generates and stores itself -- and reading the manual steps as the
          only route is why operators were being talked through inventing an
          operator password by hand. */}
      <StepTitle>The quickest route: Configure controller</StepTitle>
      <Muted>
        <strong>Steps 1 and 2 below are done for you</strong> by Configure controller on this
        venue&rsquo;s integration: it writes the External Portal Server URL, adds the
        Pre-Authentication Access entry, and creates the hotspot operator account — generating and
        storing the password, so nobody has to invent or remember one. Preview it first; it reports
        what it will change before it changes anything.
      </Muted>
      <Muted>
        It needs an <strong>Open API</strong> client (the prerequisite above). With hotspot-operator
        credentials it refuses, and the steps below are the fallback. Do them by hand when you want
        the audit trail, when the controller is managed by someone who will not share an Open API
        app, or when automatic setup has refused and you need the venue live now.
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

      {/* Cloud-hosted controllers, asked about specifically and both facts
          cheaper to read here than to discover after a purchase. */}
      <StepTitle>If the controller is TP-Link&rsquo;s cloud, not your own</StepTitle>
      <Muted>
        <strong>The Omada ID is required.</strong> One cloud address fronts every controller in a
        region, so without that id nothing can tell which controller is yours — it is on the
        controller&rsquo;s API credentials screen and in its web address, and it goes in the
        Certificate &amp; Omada ID section when connecting.
      </Muted>
      <Muted>
        <strong>Its devices need a paid licence.</strong> An access point adopted by a cloud-based
        controller requires an Omada Central Standard licence <em>per device</em>. Until one is
        bought the device adopts successfully and then sits <code>Unactivated</code> and inert — it
        will look adopted and authorise nobody.
      </Muted>

      {/* THE QUESTION BEHIND THE QUESTION: "why does TP-Link feel like it did
          less than MikroTik?" Answered in two sentences, because that answers
          it better than any list of steps.

          An earlier draft of this block claimed a MikroTik venue gets a NAS
          record and an Omada venue does not. That is FALSE and is removed:
          `location/provisioning_service.py` states plainly that RADIUS NAS
          registration is not part of that flow in either case --
          `RouterService.create_router` does not register a NAS. NAS is not a
          vendor difference and must not be shown as one; presenting a
          non-difference as a difference is how an operator ends up hunting
          for a record that was never created for anybody.

          Nothing here names the management tunnel or RADIUS internals: this
          component also renders on the customer-facing Network Integrations
          page, where that is a hard constraint. */}
      <StepTitle>Why this felt different from a MikroTik venue</StepTitle>
      <Muted>
        <strong>Provisioning did not do less for this venue.</strong> The customer, the location,
        the owner account, permissions, billing and the plan are all created exactly as they are for
        a MikroTik site — what differs is only the device half, because the two are configured in
        opposite directions: a MikroTik is set up by a script this platform generates and someone
        pastes into the router, while an Omada controller is set up by this platform calling the
        controller&rsquo;s own API, which is what Configure controller does.
      </Muted>
      <Muted>
        So the one manual thing above is the direct analogue of pasting that script:{" "}
        <strong>on MikroTik you paste a script, on Omada you create an Open API app.</strong> After
        that, both are automatic.
      </Muted>
    </div>
  );
}
