/**
 * QA-023 / D11: the partner console never names WireGuard or shows tunnel
 * addresses. Those are platform internals, kept to the Master console.
 *
 * The router setup page mounts the shared `RouterSetupDrilldown` unchanged.
 * Its Master wording ("WireGuard tunnel", "the WireGuard hub", "tunnel
 * (10.66.0.16)") is translated at display time by `PartnerWordingScope`,
 * which runs this function over the page's text, toasts and browser dialogs.
 * The generated RouterOS script is NOT touched: the scope skips
 * pre/code/textarea, and the downloaded `.rsc` is built from data, not from
 * the DOM.
 *
 * Pure and idempotent: partnerWording(partnerWording(s)) === partnerWording(s).
 */

const IPV4 = String.raw`(?:\d{1,3}\.){3}\d{1,3}`;

const RULES: Array<[RegExp, string]> = [
  // a tunnel address in parentheses, e.g. "tunnel (10.66.0.16)" -> "tunnel".
  // Only after tunnel/link/peer: a LAN address in parentheses stays.
  [new RegExp(String.raw`\b(tunnel|link|peer)\s*\(${IPV4}(?:/\d{1,2})?\)`, "gi"), "$1"],
  // "tunnel IP 10.66.0.16" / "tunnel IP: 10.66.0.16" -> "cloud link address"
  [new RegExp(String.raw`\btunnel IP(?: address)?:?\s*${IPV4}`, "gi"), "cloud link address"],
  [/\btunnel IP(?: address)?\b/gi, "cloud link address"],
  [/\bRotate the WireGuard tunnel\b/g, "Re-issue the cloud link"],
  [/\bthe WireGuard hub\b/g, "the platform"],
  [/\bWireGuard hub\b/g, "platform"],
  [/\bWireGuard tunnel\b/g, "cloud link"],
  [/\bWireGuard config\b/g, "cloud link settings"],
  [/\bWireGuard peer\b/g, "cloud link"],
  [/\bWireGuard\b/g, "cloud link"],
  [/\bwireguard\b/g, "cloud link"],
  [/\bthe hub\b/g, "the platform"],
  [/\bhub address\b/g, "platform address"],
  [/\bcloud link cloud link\b/g, "cloud link"],
];

export function partnerWording(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

/** True when `text` still names a platform internal (for tests and a dev
 * warning). */
export function namesPlatformInternals(text: string): boolean {
  return /wireguard/i.test(text) || new RegExp(String.raw`tunnel\s*\(${IPV4}`).test(text);
}
