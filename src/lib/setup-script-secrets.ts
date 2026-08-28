/**
 * What a click of "Generate script" rotates, and -- the part that
 * matters -- whether re-pasting the new script actually repairs a router
 * that already has the old values.
 *
 * Its own module rather than a const inside
 * `RouterSetupScriptAdvanced.tsx` for one reason:
 * `scripts/test-setup-script-generator.mjs` asserts this table against
 * what `buildRouterSetupScriptChunks` REALLY emits, and it can only do
 * that if the table can be imported without dragging React, the router
 * and the axios client in with it. The whole value of the table is that
 * it stays true; a claim nothing checks is how the founder ended up
 * pasting a dead heartbeat block on 2026-08-22 and reading
 * `ERROR parsing http: 401 should contain www-authenticate header` with
 * nothing anywhere to explain it.
 */

export type RotatingSecret = "agent" | "wireguard" | "radius" | "api";

/** What each secret a Generate can rotate actually costs, and -- the part
 * that matters -- WHETHER RE-PASTING THE NEW SCRIPT REPAIRS IT.
 *
 * Every claim here was checked against the emitted chunk in
 * `buildRouterSetupScriptChunks`, not assumed, on 2026-08-23:
 *
 *   WireGuard  Add-if-missing PLUS a real update branch, as of
 *              2026-08-27. Three separate pieces of identity rotate on
 *              every Generate and all three are now converged by a
 *              re-paste: `/interface wireguard set [find ...]
 *              private-key=NEW`, `/interface wireguard peers set [find
 *              where interface=...] public-key=NEW endpoint-address=...`,
 *              and `/ip address set [find where interface=... address!=
 *              NEW] address=NEW` for the tunnel IP.
 *              Before that it was add-only with NO `else`: a device that
 *              already had the interface kept the OLD key and RouterOS
 *              reported nothing -- every command "succeeded". That is what
 *              left router 01c9171e with the hub holding three peers
 *              (10.20.0.2/.3/.4), a handshake only on .3, and the platform
 *              tracking .4.
 *              The tunnel IP matters beyond WireGuard:
 *              `register_external_radius_nas` binds the router's
 *              FreeRADIUS `client{}` stanza to the tunnel IP the PLATFORM
 *              holds, so a device left on an older address is an unknown
 *              client to the hub and its RADIUS packets are dropped
 *              without a reply.
 *              (`wg-cloudguard` is the authoritative name -- it is what the
 *              backend's `network_config/renderers.py` uses. Routers
 *              provisioned before that fix carry a `wg-cloudguest`
 *              interface as well; the WireGuard chunk counts and reports
 *              it, and deleting THAT one is a separate manual step from
 *              the key-rotation repair described here.)
 *   RADIUS     `:if ([:len [/radius find where address="..."]] = 0)
 *              do={ add secret=NEW } else={ /radius set [find ...]
 *              secret=NEW disabled=no }`. The `else` branch used to clear
 *              `disabled` and nothing else -- an existing entry kept the
 *              old shared secret and every reply was a reject, silently,
 *              because RouterOS reports a secret mismatch as a timeout
 *              rather than as a mismatch. It writes `secret=` as of
 *              2026-08-23, so this one IS repairable now. The suite
 *              asserts the two halves together: the `else` branch writing
 *              `secret=` and `repairableByRepaste: true` move as a pair,
 *              in either direction.
 *   Agent      Embedded literally in the Heartbeat chunk's
 *              `http-header-field="...X-Agent-Credential: ..."`, and the
 *              scheduler chunk does `/system scheduler remove
 *              $existingHeartbeatSched` before re-adding. Both copies are
 *              overwritten by a re-paste, so this one IS repairable.
 *   API        The "API Access" chunk has a real update branch --
 *              `else={ /user set [find name="..."] password=NEW }` -- so
 *              this one is repairable too. It also no longer rotates on
 *              every Generate (only when the router has no credentials
 *              yet, or the operator explicitly ticks the box).
 *
 * If a future change gives the WireGuard chunk a real update path, flip
 * `repairableByRepaste` here and the dialog, the banner and
 * `scripts/test-setup-script-generator.mjs`'s guard all follow. */
export const SECRET_REPAIR: Record<
  RotatingSecret,
  { label: string; repairableByRepaste: boolean; why: string }
> = {
  agent: {
    label: "the platform agent credential (heartbeat)",
    repairableByRepaste: true,
    why: 'the Heartbeat chunks carry it inline and the scheduler is removed and re-added, so re-pasting "Heartbeat" and "Heartbeat Scheduler" does fix it',
  },
  wireguard: {
    label: "the WireGuard keypair",
    repairableByRepaste: true,
    why: "the WireGuard chunk now writes all three halves on a re-paste -- `/interface wireguard set ... private-key=`, `/interface wireguard peers set ... public-key=/endpoint-address=`, and `/ip address set ...` for the tunnel IP -- so re-pasting converges a device that already has an older identity",
  },
  radius: {
    label: "the RADIUS shared secret",
    repairableByRepaste: true,
    why: "the RADIUS chunk's else-branch writes `secret=` as well as clearing `disabled`, so re-pasting that chunk does fix an entry that already exists at the hub address",
  },
  api: {
    label: "the RouterOS API password",
    repairableByRepaste: true,
    why: 'the "API Access" chunk has a real `else={ /user set ... password=... }` branch, so re-pasting that chunk does fix it',
  },
};

/** Which secrets THIS Generate will rotate, given the panel's current
 * toggles. The agent credential always rotates (both branches of
 * `onGenerate`'s credential block mint a fresh plaintext); the other three
 * only rotate when their subsystem is actually being generated. */
export function rotatingSecrets(opts: {
  enableWireguard: boolean;
  enableRadius: boolean;
  mintApiSecret: boolean;
}): RotatingSecret[] {
  const out: RotatingSecret[] = ["agent"];
  if (opts.enableWireguard) out.push("wireguard");
  if (opts.enableRadius) out.push("radius");
  if (opts.mintApiSecret) out.push("api");
  return out;
}
