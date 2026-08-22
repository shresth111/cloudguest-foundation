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
 *   WireGuard  `:if ([:len [/interface wireguard find where
 *              name="wg-cloudguest"]] = 0) do={ add private-key=NEW }`
 *              and the same add-if-missing shape for the peer. NO `else`.
 *              A device that already has the interface keeps the OLD key
 *              and RouterOS reports nothing -- every command "succeeded".
 *   RADIUS     `:if ([:len [/radius find where address="..."]] = 0)
 *              do={ add secret=NEW } else={ /radius set [find ...]
 *              disabled=no }`. The `else` branch exists but only clears
 *              `disabled`; it NEVER writes `secret=`. So an existing entry
 *              keeps the old shared secret and every reply is a reject.
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
 * If a future change gives the WireGuard or RADIUS chunk a real update
 * path, flip `repairableByRepaste` here and the dialog, the banner and
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
    repairableByRepaste: false,
    why: "the WireGuard chunk only adds an interface/peer if none exists and has no update branch, so re-pasting is a silent no-op -- the device keeps the old key and the tunnel never handshakes. Delete the wg-cloudguest interface and peer on the device first",
  },
  radius: {
    label: "the RADIUS shared secret",
    repairableByRepaste: false,
    why: "the RADIUS chunk's else-branch only clears `disabled`, it never writes `secret=`, so re-pasting is a silent no-op -- the device keeps the old secret and every RADIUS reply is a reject. Remove the /radius entry for the hub address on the device first",
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
