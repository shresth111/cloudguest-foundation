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
 *              name="wg-cloudguard"]] = 0) do={ add private-key=NEW }`
 *              and the same add-if-missing shape for the peer. NO `else`.
 *              A device that already has the interface keeps the OLD key
 *              and RouterOS reports nothing -- every command "succeeded".
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
    repairableByRepaste: false,
    why: "the WireGuard chunk only adds an interface/peer if none exists and has no update branch, so re-pasting is a silent no-op -- the device keeps the old key and the tunnel never handshakes. Delete the wg-cloudguard interface and peer on the device first",
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
