/**
 * Security -> Firewall, in the words a venue owner uses.
 *
 * The firewall domain speaks RouterOS: chain, action, protocol, ports,
 * source and destination. A venue owner does not, and should never have to
 * -- "chain=forward action=drop protocol=tcp dst-port=443" is a sentence
 * nobody at a front desk can check. So this module is the whole translation,
 * both ways:
 *
 *  - a rule on the wire -> "Block · Anyone -> 203.0.113.9 · Web browsing
 *    (secure)", and
 *  - a form made of plain pickers -> the fields the backend takes.
 *
 * It is also where the push's failures become sentences
 * (`firewallPushErrorSentence`), so the screen never shows a bare
 * `ACCESS_RULES_BAND_MISSING`.
 *
 * Pure and dependency-free on purpose, so the nav guards can execute it
 * rather than grep it (scripts/test-controller-venue-network-screens.mjs).
 *
 * WHAT A CUSTOMER RULE ALWAYS IS
 * ------------------------------
 * Between-network (`forward`) traffic, and nothing else. cloud-guest#304's
 * writer only manages `forward` -- `input`/`output` is traffic to and from
 * the router itself (the management tunnel, the RouterOS API, RADIUS), and a
 * misplaced rule there is how a router was cut off from the platform on
 * 2026-08-16. The customer form therefore never offers a chain, and a
 * non-forward rule an operator created elsewhere is shown read-only with the
 * reason (`isCustomerEditable`).
 */

// Structural rather than importing `@/types/firewall`, so this file stays
// dependency-free for the harnesses that bundle it on their own.
export interface PlainFirewallRule {
  chain: string;
  action: string;
  protocol: string;
  sourceAddress: string | null;
  destinationAddress: string | null;
  sourcePort: number | null;
  destinationPort: number | null;
  priority: number;
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Services: the "what kind of traffic" picker.
// ---------------------------------------------------------------------------

export type FirewallServiceId =
  | "everything"
  | "web-secure"
  | "web"
  | "dns"
  | "email-send"
  | "remote-desktop"
  | "ping"
  | "custom";

export interface FirewallServiceOption {
  id: FirewallServiceId;
  label: string;
  /** What reaches the backend. `custom` takes its protocol and port from
   * the form instead. */
  protocol: "all" | "tcp" | "udp" | "icmp";
  port: number | null;
}

/** Deliberately short. Each entry is a service a venue owner can name
 * without knowing what a port is; anything else is "A specific port".
 *
 * No SSH preset, on purpose: 22 is one of `MANAGEMENT_PORTS`, so a Block
 * rule on it is always refused. Offering it would be a picker entry that can
 * only fail. */
export const FIREWALL_SERVICES: readonly FirewallServiceOption[] = [
  { id: "everything", label: "Everything", protocol: "all", port: null },
  { id: "web-secure", label: "Web browsing (secure, HTTPS)", protocol: "tcp", port: 443 },
  { id: "web", label: "Web browsing (HTTP)", protocol: "tcp", port: 80 },
  { id: "dns", label: "Looking up website names (DNS)", protocol: "udp", port: 53 },
  { id: "email-send", label: "Sending email", protocol: "tcp", port: 587 },
  { id: "remote-desktop", label: "Remote desktop", protocol: "tcp", port: 3389 },
  { id: "ping", label: "Ping", protocol: "icmp", port: null },
  { id: "custom", label: "A specific port", protocol: "tcp", port: null },
];

/** Which picker entry a stored rule corresponds to. Only the destination
 * port is considered: a rule with a SOURCE port is an operator-made rule the
 * customer form cannot express, and `isCustomerEditable` says so. */
export function serviceOf(rule: Pick<PlainFirewallRule, "protocol" | "destinationPort">): {
  id: FirewallServiceId;
  protocol: FirewallServiceOption["protocol"];
  port: number | null;
} {
  const proto = (["all", "tcp", "udp", "icmp"] as const).find((p) => p === rule.protocol) ?? "all";
  const preset = FIREWALL_SERVICES.find(
    (s) => s.id !== "custom" && s.protocol === proto && s.port === rule.destinationPort,
  );
  if (preset) return { id: preset.id, protocol: preset.protocol, port: preset.port };
  return { id: "custom", protocol: proto, port: rule.destinationPort };
}

/** "Web browsing (secure, HTTPS)", "Port 8080 (TCP)", "Everything (UDP)". */
export function describeService(rule: Pick<PlainFirewallRule, "protocol" | "destinationPort">) {
  const s = serviceOf(rule);
  if (s.id !== "custom") {
    return FIREWALL_SERVICES.find((o) => o.id === s.id)?.label ?? "Everything";
  }
  const proto = s.protocol === "all" ? "" : ` (${s.protocol.toUpperCase()})`;
  if (s.port == null)
    return s.protocol === "all" ? "Everything" : `All ${s.protocol.toUpperCase()}`;
  return `Port ${s.port}${proto}`;
}

/** "Anyone" for no address -- that is what an empty match means. */
export function describeWho(address: string | null): string {
  return address && address.trim() ? address.trim() : "Anyone";
}

/** "Anywhere" for no address. */
export function describeWhere(address: string | null): string {
  return address && address.trim() ? address.trim() : "Anywhere";
}

/** Allow / Block. `reject` is a block too -- the device answers "refused"
 * instead of staying silent -- and a customer need not tell them apart. */
export function describeAction(action: string): "Allow" | "Block" {
  return action === "accept" ? "Allow" : "Block";
}

/** The rules in the order the router checks them: lowest number first,
 * creation order as the tie-break the backend's own list uses. Never
 * mutates its input. */
export function inRouterOrder<T extends { priority: number; createdAt?: string }>(
  rules: readonly T[],
): T[] {
  return [...rules].sort(
    (a, b) => a.priority - b.priority || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
}

/**
 * Whether this screen may edit the rule, and if not, the sentence saying why.
 *
 * Two shapes are read-only here, both of which only the operator screen can
 * create: a rule on the router's own traffic (`input`/`output`), and one
 * matching a source port or an interface -- fields the plain form has no
 * picker for, which an edit through it would silently keep while showing
 * nothing. Read-only with a reason beats an edit that lies about what it
 * saved.
 */
export function isCustomerEditable(
  rule: PlainFirewallRule & { inInterface?: string | null },
): { editable: true } | { editable: false; reason: string } {
  if (rule.chain !== "forward") {
    return {
      editable: false,
      reason:
        "This rule protects the router itself and was set up by our team. It can't be changed or applied from here.",
    };
  }
  if (rule.sourcePort != null || (rule.inInterface ?? "").trim()) {
    return {
      editable: false,
      reason:
        "This rule was set up by our team with options this screen can't show. Contact support to change it.",
    };
  }
  return { editable: true };
}

// ---------------------------------------------------------------------------
// The form.
// ---------------------------------------------------------------------------

export interface FirewallRuleDraft {
  name: string;
  decision: "allow" | "block";
  /** Empty = anyone. */
  who: string;
  /** Empty = anywhere. */
  where: string;
  service: FirewallServiceId;
  /** Only read when `service === "custom"`. */
  customProtocol: "tcp" | "udp";
  customPort: string;
  priority: number;
  isEnabled: boolean;
}

/** The ports the router is managed on. cloud-guest#304's writer refuses a
 * Block rule naming any of them (`ACCESS_RULES_WOULD_ORPHAN_MANAGEMENT`),
 * because it would cut the router off from this platform. Mirrored here so
 * the form can say so before Save rather than at Apply. The backend's list is
 * the authority; this is the early warning. */
export const MANAGEMENT_PORTS: readonly number[] = [
  22, 8291, 8728, 8729, 1812, 1813, 3799, 13231, 51820,
];

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** An IPv4 address or CIDR range. The backend validates again; this only
 * catches the typo before a round trip. */
export function isAddressOrRange(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const [ip, prefix, ...rest] = v.split("/");
  if (rest.length) return false;
  if (!IPV4.test(ip)) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,2}$/.test(prefix)) return false;
  return Number(prefix) <= 32;
}

/** Field -> message for everything wrong with a draft; empty when it can be
 * saved. */
export function validateFirewallDraft(
  d: FirewallRuleDraft,
): Partial<Record<keyof FirewallRuleDraft, string>> {
  const errors: Partial<Record<keyof FirewallRuleDraft, string>> = {};
  const name = d.name.trim();
  if (name.length < 2) errors.name = "Give the rule a name (at least 2 characters).";
  else if (name.length > 64) errors.name = "Keep the name under 64 characters.";
  if (d.who.trim() && !isAddressOrRange(d.who)) {
    errors.who = "Enter an address like 192.168.88.50, or a range like 192.168.88.0/24.";
  }
  if (d.where.trim() && !isAddressOrRange(d.where)) {
    errors.where = looksLikeWebsite(d.where)
      ? 'That\'s a website name. Use "Block a website" above instead — it blocks by name, no address needed.'
      : "Enter an address like 203.0.113.9, or a range like 203.0.113.0/24.";
  }
  let port: number | null = null;
  if (d.service === "custom") {
    const n = Number(d.customPort);
    if (!/^\d+$/.test(d.customPort.trim()) || n < 1 || n > 65535) {
      errors.customPort = "Enter a port number between 1 and 65535.";
    } else port = n;
  } else {
    port = FIREWALL_SERVICES.find((s) => s.id === d.service)?.port ?? null;
  }
  if (!Number.isInteger(d.priority) || d.priority < 0) {
    errors.priority = "Use a whole number, 0 or more.";
  }
  if (d.decision === "block") {
    // cloud-guest#304 refuses both at Apply; saying it here saves the owner
    // a rule that can never reach the router.
    if (!d.who.trim() && !d.where.trim()) {
      errors.where =
        "A Block rule needs a device or a destination. Blocking anyone from going anywhere would cut every guest off.";
    }
    if (port != null && MANAGEMENT_PORTS.includes(port)) {
      const msg = `Port ${port} is how we manage this router. Blocking it would cut the router off from us.`;
      if (d.service === "custom") errors.customPort = msg;
      else errors.service = msg;
    }
  }
  return errors;
}

/** The fields the backend takes, from a valid draft. Always `forward`. */
export function draftToFields(d: FirewallRuleDraft): {
  name: string;
  chain: "forward";
  action: "accept" | "drop";
  protocol: "all" | "tcp" | "udp" | "icmp";
  sourceAddress: string | null;
  destinationAddress: string | null;
  destinationPort: number | null;
  priority: number;
  isEnabled: boolean;
} {
  const preset = FIREWALL_SERVICES.find((s) => s.id === d.service) ?? FIREWALL_SERVICES[0];
  const custom = d.service === "custom";
  return {
    name: d.name.trim(),
    chain: "forward",
    action: d.decision === "allow" ? "accept" : "drop",
    protocol: custom ? d.customProtocol : preset.protocol,
    sourceAddress: d.who.trim() || null,
    destinationAddress: d.where.trim() || null,
    destinationPort: custom ? Number(d.customPort) : preset.port,
    priority: d.priority,
    isEnabled: d.isEnabled,
  };
}

/** A draft pre-filled from a stored rule, for Edit. */
export function ruleToDraft(rule: PlainFirewallRule & { name: string }): FirewallRuleDraft {
  const s = serviceOf(rule);
  return {
    name: rule.name,
    decision: rule.action === "accept" ? "allow" : "block",
    who: rule.sourceAddress ?? "",
    where: rule.destinationAddress ?? "",
    service: s.id,
    customProtocol: s.protocol === "udp" ? "udp" : "tcp",
    customPort: s.id === "custom" && s.port != null ? String(s.port) : "",
    priority: rule.priority,
    isEnabled: rule.isEnabled,
  };
}

// ---------------------------------------------------------------------------
// Status and errors.
// ---------------------------------------------------------------------------

export type PlainPushStatus = "pending" | "active" | "failed";

/** The badge. "Saved, not applied" is literal: the row exists here and not
 * on the router. */
export const PUSH_STATUS_LABEL: Record<PlainPushStatus, string> = {
  pending: "Saved, not applied",
  active: "Applied",
  failed: "Failed",
};

/** What the router-level band check means, for the owner. `null` = unknown
 * (the endpoint is absent or unreadable), which says nothing rather than
 * guessing. */
export function bandStateSentence(state: "ready" | "missing" | "invalid" | null): string | null {
  switch (state) {
    case "ready":
      return "This router is ready for firewall rules.";
    case "missing":
    case "invalid":
      return BAND_MISSING_SENTENCE;
    default:
      return null;
  }
}

export const BAND_MISSING_SENTENCE =
  "This router hasn't been prepared for firewall rules yet. Our team needs to set it up once — contact support.";
export const PUSH_IN_PROGRESS_SENTENCE =
  "Another change is being applied to this router — try again in a minute.";
export const NOT_RESTORED_SENTENCE =
  "The change failed partway; we could not confirm the router's previous rules were restored — contact support.";
export const RESTORED_SENTENCE =
  "The router didn't accept the change, so its previous firewall rules were put back. Nothing on the router changed.";

/** A request failure, structurally -- `AppError` from `services/api`. */
export interface PushFailure {
  status?: number | null;
  message?: string;
  data?: Record<string, unknown>;
}

export interface PushErrorExplained {
  /** The sentence to show. */
  sentence: string;
  /** The backend's own detail, when it adds something the sentence does
   * not (the router's words on a failure). Shown smaller, never instead. */
  detail: string | null;
  /** True when the owner cannot fix this themselves -- support has to. */
  needsSupport: boolean;
  /** The code, for tests and for deciding what else to show. */
  code: string | null;
}

/**
 * One sentence for every way `POST /firewall-rules/routers/{id}/push` can
 * fail (cloud-guest#304 and the lock PR beside it):
 *
 *  - 409 `ACCESS_RULES_BAND_MISSING` / `_PARTIAL` -- the router was never
 *    prepared. Support's job, not a retry, and no button: the action that
 *    fixes it is Master-only.
 *  - 409 `FIREWALL_PUSH_IN_PROGRESS` -- another push holds the router's lock.
 *  - 502 `ACCESS_RULES_PUSH_FAILED` with `restored` -- said as it is.
 *    `restored: false` is the one that matters: the router may hold a partial
 *    set, and the owner must hear that, not "try again".
 *  - 422 `ACCESS_RULES_CHAIN_UNSUPPORTED` -- names the rules.
 *  - 409 `ACCESS_RULES_WOULD_ORPHAN_MANAGEMENT` / `_WOULD_BREAK_GUEST_PATH`.
 *  - 422 controller-managed refusal (no code) -- its message is already
 *    written for a duty manager, so it is shown as it is.
 *
 * Anything else falls back to the backend's message: a real reason beats a
 * generic one.
 */
export function firewallPushErrorSentence(err: PushFailure | null | undefined): PushErrorExplained {
  const data = err?.data ?? {};
  const code = typeof data.code === "string" ? data.code : null;
  const message = err?.message?.trim() || null;
  switch (code) {
    case "ACCESS_RULES_BAND_MISSING":
    case "ACCESS_RULES_BAND_PARTIAL":
    case "ACCESS_RULES_BAND_INVALID":
      return { sentence: BAND_MISSING_SENTENCE, detail: null, needsSupport: true, code };
    case "FIREWALL_PUSH_IN_PROGRESS":
      return { sentence: PUSH_IN_PROGRESS_SENTENCE, detail: null, needsSupport: false, code };
    case "ACCESS_RULES_PUSH_FAILED":
      return data.restored === false
        ? { sentence: NOT_RESTORED_SENTENCE, detail: message, needsSupport: true, code }
        : { sentence: RESTORED_SENTENCE, detail: message, needsSupport: false, code };
    case "ACCESS_RULES_CHAIN_UNSUPPORTED": {
      const rules = Array.isArray(data.rules)
        ? data.rules.filter((r) => typeof r === "string")
        : [];
      return {
        sentence:
          "Some rules on this router protect the router itself and can't be applied from here" +
          (rules.length ? `: ${rules.join(", ")}` : "") +
          ". Switch them off, or contact support.",
        detail: null,
        needsSupport: false,
        code,
      };
    }
    case "ACCESS_RULES_WOULD_ORPHAN_MANAGEMENT":
      return {
        sentence:
          "One of the Block rules would cut this router off from our platform, so nothing was applied. Change that rule and try again.",
        detail: message,
        needsSupport: false,
        code,
      };
    case "ACCESS_RULES_TARGETS_ROUTER":
      return {
        sentence:
          "One rule points at this router's own address. Traffic to the router itself never passes through these rules, so it would never do anything. Nothing was applied — remove or change that rule and try again.",
        detail: message,
        needsSupport: false,
        code,
      };
    case "ACCESS_RULES_WOULD_BREAK_GUEST_PATH":
      return {
        sentence:
          "One Block rule would cut every guest off the internet (and the login page), so nothing was applied. Narrow it to one device or a specific destination and try again.",
        detail: message,
        needsSupport: false,
        code,
      };
    case "ACCESS_RULES_FLOOD_NO_GUEST_NETWORK":
      return {
        sentence:
          "This router has no guest network we can see, so there is nobody to limit. Nothing was changed.",
        detail: null,
        needsSupport: true,
        code,
      };
    case "ACCESS_RULES_FLOOD_LIMIT_INVALID":
      return {
        sentence: "That limit isn't one we can apply. Nothing was changed.",
        detail: message,
        needsSupport: false,
        code,
      };
    case "ACCESS_RULES_FLOOD_OUTSIDE_BAND":
    case "ACCESS_RULES_MARKER_MALFORMED":
    case "ACCESS_RULES_MARKER_OUTSIDE_BAND":
    case "ACCESS_RULES_ORPHAN_MARKER":
      // The writer found entries on the router carrying our marker that it
      // cannot account for, and refused before touching anything. Not
      // something the owner can fix from here.
      return {
        sentence:
          "The router has firewall entries we can't account for, so nothing was changed. Contact support and we'll sort it out.",
        detail: null,
        needsSupport: true,
        code,
      };
    default:
      break;
  }
  if (code && code.startsWith("ACCESS_RULES_")) {
    // A refusal we have no sentence for yet: nothing was written (every
    // ACCESS_RULES_* refusal happens before the first write).
    return {
      sentence: "The router's rules were not changed.",
      detail: message,
      needsSupport: false,
      code,
    };
  }
  if (err?.status === 502) {
    return {
      sentence: "We couldn't reach the router, so nothing was changed. Try again in a few minutes.",
      detail: message,
      needsSupport: false,
      code,
    };
  }
  return {
    sentence: message ?? "The rules could not be applied to the router.",
    detail: null,
    needsSupport: false,
    code,
  };
}

/**
 * What Apply will do, for the confirmation dialog -- counted from the rules
 * on screen, so the dialog states the change rather than describing the
 * feature.
 */
export function applySummary(rules: readonly PlainFirewallRule[]): {
  on: number;
  off: number;
  blocks: number;
  unpushable: number;
} {
  const forward = rules.filter((r) => r.chain === "forward");
  const on = forward.filter((r) => r.isEnabled);
  return {
    on: on.length,
    off: forward.length - on.length,
    blocks: on.filter((r) => r.action !== "accept").length,
    unpushable: rules.filter((r) => r.chain !== "forward" && r.isEnabled).length,
  };
}

// ---------------------------------------------------------------------------
// Websites by name (DNS), not by address.
// ---------------------------------------------------------------------------

const DOMAIN_LABEL = "[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN = new RegExp(`^${DOMAIN_LABEL}(\\.${DOMAIN_LABEL})+$`);

/**
 * What an owner typed -> the bare name the content-filtering domain takes,
 * or `null` when it is not a website name.
 *
 * Owners paste what is in their address bar: "https://www.youtube.com/watch",
 * "YouTube.com", "m.facebook.com/". The router's DNS block already covers
 * every subdomain of the name it is given, so a leading `www.` is dropped:
 * blocking `youtube.com` blocks `www.youtube.com` too, while blocking
 * `www.youtube.com` would leave `youtube.com` and `m.youtube.com` open.
 *
 * Mirrors the backend's `normalize_domain` grammar (at least two labels,
 * RFC 1035 labels) so a name accepted here is not refused on Save. An IPv4
 * address is not a name -- that is a firewall rule's job -- and returns null.
 */
export function websiteToDomain(input: string): string | null {
  let v = input.trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.split(/[/?#]/, 1)[0];
  v = v.replace(/:\d+$/, "").replace(/\.$/, "");
  if (v.startsWith("www.")) v = v.slice(4);
  // A real top-level domain is never all digits; "999.1.1.1" is a mistyped
  // address, not a website.
  if (IPV4.test(v) || /\.\d+$/.test(v)) return null;
  return DOMAIN.test(v) ? v : null;
}

/** True when a "where to" entry is a website name rather than an address --
 * the one mistake the address field invites most. */
export function looksLikeWebsite(input: string): boolean {
  return !isAddressOrRange(input) && websiteToDomain(input) !== null;
}

/** Where a new rule goes in the list. An Allow is almost always an exception
 * to a Block ("block the office network, except the printer"), and the router
 * stops at the first match, so it has to sit above the Blocks to do anything.
 * A Block goes at the bottom, after every existing rule. */
export function newRulePriority(
  decision: "allow" | "block",
  rules: readonly { priority: number }[],
): number {
  if (!rules.length) return 100;
  const ps = rules.map((r) => r.priority);
  return decision === "allow" ? Math.max(0, Math.min(...ps) - 10) : Math.max(...ps) + 10;
}

// ---------------------------------------------------------------------------
// "Keep guests off your private networks" -- one switch, no addresses typed.
// ---------------------------------------------------------------------------

/** Every private (RFC 1918) range. A guest has no business reaching any of
 * them: the office PCs, the POS, CCTV, the ISP router's settings page. */
export const PRIVATE_RANGES: readonly string[] = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];

/** Stamped in the comment of every rule the switch creates, so the switch
 * can find (and remove) exactly its own rules and nothing the owner wrote. */
export const PRIVATE_NETWORKS_MARK = "wyfy-template:private-networks";

export interface TemplateRuleFields {
  name: string;
  chain: "forward";
  action: "accept" | "drop";
  protocol: "all" | "tcp" | "udp";
  sourceAddress: string;
  destinationAddress: string;
  destinationPort: number | null;
  comment: string;
  isEnabled: true;
}

function ipv4ToInt(ip: string): number | null {
  if (!IPV4.test(ip)) return null;
  return ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);
}

/** Whether `ip` (a bare IPv4 address) is inside `cidr`. */
export function ipInRange(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (a == null || b == null || !(bits >= 0 && bits <= 32)) return false;
  const size = 2 ** (32 - bits);
  return Math.floor(a / size) === Math.floor(b / size);
}

/**
 * The rules the switch puts on the router, from what the router itself
 * reported (cloud-guest#317's band status):
 *
 *  - for each guest network, a Block to each private range; and
 *  - first, an Allow for DNS (udp+tcp 53) to any DNS server DHCP hands
 *    guests that is private and NOT on the guest network itself -- typically
 *    the ISP router. Without it the Blocks would take guests' DNS with them.
 *    A DNS server on the guest network is the router (or a guest), which
 *    the forward chain never sees.
 *
 * Only IPv4 networks are used: the private ranges are IPv4. Empty when the
 * router reported no guest network -- the switch is then not offered.
 */
export function privateNetworkRules(
  guestNetworks: readonly string[],
  dnsServers: readonly string[],
): { allows: TemplateRuleFields[]; blocks: TemplateRuleFields[] } {
  const nets = guestNetworks.filter((n) => isAddressOrRange(n));
  const allows: TemplateRuleFields[] = [];
  const blocks: TemplateRuleFields[] = [];
  for (const net of nets) {
    for (const dns of dnsServers) {
      if (!IPV4.test(dns)) continue;
      if (!PRIVATE_RANGES.some((r) => ipInRange(dns, r))) continue;
      if (ipInRange(dns, net)) continue;
      for (const protocol of ["udp", "tcp"] as const) {
        allows.push({
          name: `Guests may use DNS at ${dns}`,
          chain: "forward",
          action: "accept",
          protocol,
          sourceAddress: net,
          destinationAddress: `${dns}/32`,
          destinationPort: 53,
          comment: PRIVATE_NETWORKS_MARK,
          isEnabled: true,
        });
      }
    }
    for (const range of PRIVATE_RANGES) {
      blocks.push({
        name: `Keep guests off ${range}`,
        chain: "forward",
        action: "drop",
        protocol: "all",
        sourceAddress: net,
        destinationAddress: range,
        destinationPort: null,
        comment: PRIVATE_NETWORKS_MARK,
        isEnabled: true,
      });
    }
  }
  return { allows, blocks };
}

/** The switch's rules among a router's rules. */
export function privateNetworkRulesIn<T extends { comment?: string | null }>(
  rules: readonly T[],
): T[] {
  return rules.filter((r) => (r.comment ?? "") === PRIVATE_NETWORKS_MARK);
}

/** On only when every rule the switch would create is there and switched
 * on -- matched by source, destination, port and action, not by name. */
export function privateNetworksOn(
  rules: readonly (PlainFirewallRule & { comment?: string | null })[],
  wanted: { allows: TemplateRuleFields[]; blocks: TemplateRuleFields[] },
): boolean {
  const all = [...wanted.allows, ...wanted.blocks];
  if (!all.length) return false;
  const norm = (a: string | null) => (a ?? "").replace(/\/32$/, "");
  const ours = privateNetworkRulesIn(rules);
  return all.every((w) =>
    ours.some(
      (r) =>
        r.isEnabled &&
        r.action === w.action &&
        r.protocol === w.protocol &&
        norm(r.sourceAddress) === norm(w.sourceAddress) &&
        norm(r.destinationAddress) === norm(w.destinationAddress) &&
        (r.destinationPort ?? null) === w.destinationPort,
    ),
  );
}
