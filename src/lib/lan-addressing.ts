/**
 * The LAN network and DHCP pool a generated MikroTik setup script hands
 * out, derived from the operator's LAN address and CIDR prefix.
 *
 * Its own module rather than a helper inside `RouterDetailTabs.tsx` for
 * the same reason `setup-script-secrets.ts` is:
 * `scripts/test-setup-script-generator.mjs` asserts this arithmetic
 * directly -- every prefix from /1 to /32, the subnets that were silently
 * wrong before, and the ones that have no usable pool at all -- and it can
 * only do that if the function can be imported without React, the router
 * and the axios client coming with it.
 */

export type LanAddressing =
  | {
      ok: true;
      /** `<network address>/<prefix>` -- the value `/ip dhcp-server network
       * add address=` needs. Computed by masking `lanIp`, NOT by assuming
       * the third octet is the network. */
      network: string;
      poolStart: string;
      poolEnd: string;
      /** How many addresses the pool actually spans. Reported so the
       * operator can see a `/29` giving them six guests before they
       * discover it at the venue. */
      poolSize: number;
    }
  | { ok: false; reason: string };

/** Turns the operator's LAN address + CIDR prefix into the two things the
 * DHCP chunk actually needs: the network the DHCP server serves, and the
 * range of addresses it hands out.
 *
 * WHY THIS IS NOT `${first three octets}.0/${cidr}` AND `.10-.254`.
 * Confirmed by reading the emitted script, not inferred: the generator
 * used to build both from the first three octets of `lanIp` and ignore
 * the prefix entirely. `lanCidr` is a free-text field on the Master
 * console's Advanced panel, validated only as "an integer in 1..32" (see
 * `isValidCidr` there), so every prefix below is reachable from the UI:
 *
 *  - `192.168.88.1/25` -- the router's own subnet stops at `.127`, and
 *    the pool handed guests `.128` through `.254`. Those guests get a
 *    lease, cannot reach their own default gateway, and the hotspot login
 *    page never loads. The router reports nothing: `/ip pool add` is
 *    perfectly happy to hold a range that is not in any local subnet.
 *  - `192.168.88.130/25` -- the network is `192.168.88.128/25`, but the
 *    old code wrote `192.168.88.0/25`, a network this router has no
 *    address in at all, so the DHCP server had no matching network entry
 *    and leased addresses with no gateway and no DNS.
 *  - `10.5.50.1/23` -- the pool stopped at `10.5.50.254` and silently
 *    threw away half the addresses the operator asked for.
 *
 * `.10` of head-room below the pool is kept from the original (it is what
 * leaves space for hand-assigned statics), but only when the subnet is
 * big enough to spare it, and the pool is moved above `lanIp` if the
 * router's own address would otherwise fall inside it -- a DHCP server
 * that can lease its own gateway's address is its own outage.
 *
 * Returns a REASON rather than a fallback when the input cannot describe a
 * usable subnet. Silently substituting a `/24` here is the exact shape of
 * defect this function exists to remove. */
export function deriveLanAddressing(lanIp: string, lanCidr: string): LanAddressing {
  const octets = lanIp.trim().split(".");
  if (octets.length !== 4)
    return { ok: false, reason: `LAN IP "${lanIp}" is not a dotted-quad IPv4 address` };
  const nums = octets.map((o) => (/^\d{1,3}$/.test(o) ? Number(o) : Number.NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return { ok: false, reason: `LAN IP "${lanIp}" is not a valid IPv4 address` };
  const trimmedCidr = lanCidr.trim();
  const prefix = /^\d{1,2}$/.test(trimmedCidr) ? Number(trimmedCidr) : Number.NaN;
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 32)
    return { ok: false, reason: `LAN CIDR "${lanCidr}" is not a prefix length between 1 and 32` };
  // `>>> 0` on every step: JS bitwise operators work on SIGNED 32-bit
  // integers, so anything with the top bit set (a 128.x.x.x LAN, a /1)
  // comes back negative and every comparison below silently inverts.
  const toInt = (parts: number[]) =>
    ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  const toDotted = (n: number) =>
    [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  const ipInt = toInt(nums);
  const maskInt = (0xffffffff << (32 - prefix)) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  if (prefix > 30)
    return {
      ok: false,
      reason: `a /${prefix} LAN has no room for a DHCP pool (it holds ${broadcastInt - networkInt + 1} address(es) in total)`,
    };
  const hostMin = networkInt + 1;
  const hostMax = broadcastInt - 1;
  if (ipInt === networkInt || ipInt === broadcastInt)
    return {
      ok: false,
      reason: `LAN IP ${lanIp} is the ${ipInt === networkInt ? "network" : "broadcast"} address of ${toDotted(networkInt)}/${prefix}, not a usable host address`,
    };
  // Head-room for hand-assigned statics, but only when the subnet can
  // spare it -- on a /28 the old fixed `.10` offset would have eaten most
  // of the pool, and on a /30 all of it.
  let startInt = hostMax - hostMin + 1 >= 20 ? hostMin + 9 : hostMin;
  // Never lease the router its own address back.
  if (ipInt >= startInt && ipInt <= hostMax) startInt = ipInt + 1;
  if (startInt > hostMax)
    return {
      ok: false,
      reason: `no address is left for a DHCP pool in ${toDotted(networkInt)}/${prefix} once ${lanIp} is reserved for the router`,
    };
  return {
    ok: true,
    network: `${toDotted(networkInt)}/${prefix}`,
    poolStart: toDotted(startInt),
    poolEnd: toDotted(hostMax),
    poolSize: hostMax - startInt + 1,
  };
}
