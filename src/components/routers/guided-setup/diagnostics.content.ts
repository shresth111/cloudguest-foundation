/**
 * Guided Setup -- network-layer diagnostics content.
 *
 * Pure data. No imports, no React, no runtime logic. The Guided Setup UI
 * renders this as "aapko yeh dikh raha hai? -> yeh command chalao -> output
 * me yeh token dhoondo -> yeh fix paste karo".
 *
 * Rules this file follows, on purpose:
 *  - Prose Hinglish, commands English. Reader network engineer nahi hai.
 *  - Har `tell` ek LITERAL token hai jo woh output me match kar sake
 *    (`Is` vs `As`, `bound` vs `searching`, `gateway=0.0.0.0`,
 *    `last-handshake=`, counter ka naam). "Dekho sahi lag raha hai kya"
 *    kabhi nahi.
 *  - `causes` real-world likelihood ke order me, sabse common pehle.
 *  - Jo cheez darawni dikhti hai par actually harmless hai, woh saaf
 *    likhi hai -- taaki koi uske peeche time waste na kare.
 *
 * Fleet defaults jinke against yeh commands likhe hain (agar aapke script
 * me alag naam hai to command me wahi naam daalna):
 *   LAN bridge `bridge` (generator emits `/interface bridge add
 *   name="bridge"`; confirm on any box with `/interface bridge print`),
 *   router LAN IP `10.5.50.1`, guest pool
 *   `10.5.50.10-10.5.50.254`, hotspot profile `hsprof1`, hotspot dns-name
 *   `wifi.wyfyguest.com`, portal `auth.wyfyguest.com`, WireGuard
 *   interface `wg-cloudguest`, hub tunnel IP `10.20.0.1`, hub endpoint
 *   `20.219.72.235:51820`.
 */

export type Symptom = {
  id: string;
  /** Hinglish, what he SEES — on the router, in the portal, or on his phone */
  seen: string;
  /** where it shows up */
  surface: "router" | "portal" | "phone" | "dashboard";
  /** one command that distinguishes the real cause from the lookalikes */
  probe: string;
  /** each possible reading of the probe output, most likely first */
  causes: {
    /** Hinglish: what in the probe output points here */
    tell: string;
    /** Hinglish: the actual cause */
    cause: string;
    /** paste-able fix, if there is one */
    fix?: string;
    /** Hinglish note — why, or what to do when there is no one-line fix */
    note: string;
  }[];
};

export const SYMPTOMS: Symptom[] = [
  // ---------------------------------------------------------------------
  // 1. WAN / default route
  // ---------------------------------------------------------------------
  {
    id: "wan-no-route-to-host",
    seen: 'Router par kuch bhi ping karo to "no route to host" aata hai, jabki `/ip route print` me 0.0.0.0/0 ki line dikh rahi hai.',
    surface: "router",
    probe: '/ip route print detail where dst-address="0.0.0.0/0"',
    causes: [
      {
        tell: "Flags me `Is` (I = inactive) aur line me `gateway=0.0.0.0`.",
        cause:
          "Script `/import` se chali. `/import` kahin rukta nahi -- DHCP client add hone ke microseconds baad hi lease ka gateway padh liya gaya, lease tab tak aayi hi nahi thi, isliye route gateway `0.0.0.0` ke saath ban gaya aur permanently Inactive hai.",
        fix: '/ip dhcp-client print detail\n# upar wali output me `gateway=` ki value copy karo, phir:\n/ip route set [find comment="cloudguest-plain-wan1"] gateway=<gw>\n/ping 8.8.8.8 count=4',
        note: "Yeh live fix hai, chala hua hai. Chunk-by-chunk terminal paste me yeh kabhi nahi hota kyunki insaan ki typing delay me DHCP bind ho jaati hai -- `.rsc` `/import` karne par hi aata hai. Fix ke baad flag `As` ho jaana chahiye.",
      },
      {
        tell: "Flags me `Is` par `gateway=` me ek asli IP hai (jaise `gateway=192.168.2.1`).",
        cause:
          "Gateway sahi likha hai par woh ping ka jawab nahi de raha, isliye `check-gateway=ping` ne route ko khud inactive kar diya. Matlab WAN cable/ISP link actually down hai.",
        fix: '/interface ethernet monitor [find name="ether1"] once\n/ping <gw> count=4',
        note: "`status: no-link` matlab cable/port ka masla, `status: link-ok` par ping fail matlab ISP ka side. Yeh route ka bug nahi hai -- gateway theek hote hi RouterOS khud route ko `As` kar dega, koi command nahi chalani.",
      },
      {
        tell: "Command kuch print hi nahi karta -- 0.0.0.0/0 ki koi line nahi hai.",
        cause:
          "WAN Routing chunk ne route banaya hi nahi, kyunki uss waqt gateway blank tha (DHCP bind nahi hui thi ya PPPoE connect nahi hua tha). Chunk error nahi deta, chup-chaap skip kar deta hai.",
        fix: "# WAN Routing chunk dobara paste karo -- woh idempotent hai, dobara chalana safe hai.",
        note: "Pehle `/ip dhcp-client print detail` me `status: bound` confirm karo, warna dobara paste karne par bhi wahi blank gateway milega. Heartbeat scheduler bhi har 5 minute me yahi try karta hai, to 5 min ruk kar dekh sakte ho.",
      },
      {
        tell: "Flags me `As` (A = active) aur `gateway=` me asli IP -- route bilkul theek hai.",
        cause:
          "Routing ka koi masla nahi hai. `no route to host` naam se dikha tha par asli dikkat DNS ya firewall me hai.",
        fix: "/ping 8.8.8.8 count=4",
        note: "Agar `8.8.8.8` ping ho raha hai par naam resolve nahi ho rahe, to `dns-servers-empty` symptom par jao. `As` route ke saath WAN ko blame karna band kar do.",
      },
    ],
  },

  {
    id: "wan-dhcp-client-not-bound",
    seen: "WAN port me cable laga hai par router ko upstream se IP mil hi nahi rahi -- WAN Connectivity Check FAIL de raha hai.",
    surface: "router",
    probe: "/ip dhcp-client print detail",
    causes: [
      {
        tell: "`status: searching...`",
        cause:
          "Router DHCP request bhej raha hai par upstream se koi jawab nahi. Ya to cable galat port me hai, ya upstream router/ONT ka DHCP band hai.",
        fix: '/interface ethernet monitor [find name="ether1"] once',
        note: "`status: no-link` aaye to cable/port hai; `link-ok` ke saath bhi `searching` matlab upstream ka DHCP server jawab nahi de raha -- venue ka ISP box check karao.",
      },
      {
        tell: "`status: bound` aur `gateway=` me asli IP.",
        cause: "DHCP bilkul theek hai. Dikkat routing ya DNS me hai, addressing me nahi.",
        fix: '/ip route set [find comment="cloudguest-plain-wan1"] gateway=<gw>',
        note: "Yahan se `gateway=` ki value copy karke seedha `wan-no-route-to-host` wala fix laga do -- 90% cases me `.rsc` import ke baad yahi bacha hua kaam hota hai.",
      },
      {
        tell: "Command khaali output deta hai -- koi dhcp-client entry hai hi nahi.",
        cause:
          "Ya to venue static-IP par hai (script static mode me generate hua tha), ya WAN Addressing chunk paste hi nahi hua.",
        fix: '/ip address print detail where interface="ether1"',
        note: "Agar wahan `cloudguest-addr-wan1` comment ke saath static address dikh raha hai to yeh static venue hai -- gateway ISP ne diya hoga, DHCP se nahi aayega, aur us case me route ka gateway generate time par hi hardcode ho chuka hota hai. Agar wahan bhi kuch nahi to WAN Addressing chunk paste karo.",
      },
      {
        tell: "`status: bound` par `gateway=` line hai hi nahi / khaali hai.",
        cause:
          "Upstream ne address to diya par default gateway option nahi bheja -- sasta/misconfigured upstream router. Bahut rare.",
        fix: '# Upstream router ka LAN IP pata karo aur haath se set karo:\n/ip route set [find comment="cloudguest-plain-wan1"] gateway=<upstream-lan-ip>',
        note: "Aam taur par upstream ka LAN IP wahi subnet ka `.1` hota hai jo aapko lease me mila hai. Yeh ek baar ka manual step hai, iska koi auto fix nahi.",
      },
    ],
  },

  {
    id: "wan-pppoe-not-connected",
    seen: "Venue PPPoE par hai (BSNL/JioFiber type), script paste ho gaya par internet nahi -- default route bana hi nahi.",
    surface: "router",
    probe: '/interface pppoe-client monitor [find name~"cloudguest-pppoe"] once',
    causes: [
      {
        tell: "`status: connected` aur `remote-address:` me ek asli IP.",
        cause:
          "PPPoE session up hai. Route sirf isliye missing hai kyunki WAN Routing chunk tab chala tha jab session abhi negotiate ho raha tha.",
        fix: "# WAN Routing chunk dobara paste karo -- ab `remote-address` mil jayega.",
        note: "`remote-address` hi asli next hop hai (ISP ka BRAS). PPPoE me `/ip dhcp-client` kabhi nahi dekhna, wahan kuch hoga hi nahi.",
      },
      {
        tell: "`status: connecting...` ya baar-baar `dialing`.",
        cause:
          "PPPoE server tak pahunch to raha hai par session ban nahi raha -- aksar ONT/modem abhi bhi khud PPPoE dial kar raha hai, aur ISP ek hi session deta hai.",
        fix: '# Upstream modem ko bridge mode me daalo, ya uska PPPoE session band karao. Phir:\n/interface pppoe-client disable [find name~"cloudguest-pppoe"]\n/interface pppoe-client enable [find name~"cloudguest-pppoe"]',
        note: "Do jagah se ek hi PPPoE account dial karna sabse common field galti hai. Modem me session band hote hi router seconds me connect ho jayega.",
      },
      {
        tell: "`status: authenticating` par atka hai ya log me `authentication failed`.",
        cause: "PPPoE username/password galat hai jo Generate karte waqt type hua tha.",
        fix: '/interface pppoe-client set [find name~"cloudguest-pppoe"] user="<user>" password="<pass>"',
        note: "Yahan haath se theek kar lo -- Generate dobara mat click karna, woh WireGuard aur RADIUS ke secrets rotate kar deta hai aur router brick ho jaata hai.",
      },
      {
        tell: "Command error deta hai: `no such item`.",
        cause: "pppoe-client interface bana hi nahi -- WAN Addressing chunk paste nahi hua.",
        fix: "# WAN Addressing chunk paste karo, phir WAN Routing chunk.",
        note: "Order matter karta hai: pppoe interface pehle exist karna chahiye, tabhi routing chunk uska gateway padh sakta hai.",
      },
    ],
  },

  {
    id: "double-nat-private-wan-ip",
    seen: "WAN port par `192.168.2.199/24` type private IP mila hai, public IP nahi -- lagta hai kuch galat ho gaya.",
    surface: "router",
    probe: '/ip address print detail where interface="ether1"',
    causes: [
      {
        tell: "`address=192.168.x.x/24` ya `10.x.x.x` ya `172.16-31.x.x`, `dynamic=yes`.",
        cause:
          "Double NAT hai -- hamara router upstream router ke peeche baitha hai. Captive portal ke liye yeh bilkul normal hai aur 95% venues me aisa hi hota hai.",
        note: "Ismein kuch mat karo. Guest ka traffic do baar NAT hoga, bas -- portal, OTP, RADIUS, WireGuard, bandwidth queue, sab isse theek chalte hain. Yeh sirf tab todta hai jab kisi ko bahar internet se router par port-forward chahiye ho (yaani WinBox/SSH remote se) -- aur woh hum kabhi karte hi nahi, hum WireGuard tunnel se andar aate hain. Iske peeche time waste mat karo.",
      },
      {
        tell: "`address=100.64.x.x` ya `100.65-127.x.x`.",
        cause:
          "ISP khud CGNAT (carrier-grade NAT) kar raha hai. Yeh bhi hamare liye theek hai, par upstream UDP filtering yahan zyada common hai.",
        note: "Agar WireGuard handshake nahi ho raha to `wg-handshake-missing` symptom dekho -- CGNAT wale connections par ISP ka UDP block sabse zyada milta hai.",
      },
      {
        tell: "`address=` me asli public IP (private range me nahi).",
        cause: "Router seedha ISP se juda hai, koi double NAT hai hi nahi.",
        note: "Ismein bhi kuch karne ki zarurat nahi. Sirf itna dhyan rakho ki ab router internet se seedha exposed hai, isliye Firewall chunk paste hona chahiye (`cloudguest-fw-drop-wan-input` maujood ho).",
      },
      {
        tell: "Command khaali output deta hai.",
        cause: "Us interface par koi address hai hi nahi -- WAN abhi up nahi hua.",
        note: "`wan-dhcp-client-not-bound` par jao. Yeh double NAT ka sawaal hi nahi hai.",
      },
    ],
  },

  // ---------------------------------------------------------------------
  // 2. DNS
  // ---------------------------------------------------------------------
  {
    id: "dns-servers-empty",
    seen: 'Router se `8.8.8.8` ping ho jaata hai par guest ke phone par koi bhi website nahi khulti -- "server not found".',
    surface: "router",
    probe: "/ip dns print",
    causes: [
      {
        tell: "`servers:` line khaali hai (kuch bhi nahi likha uske aage).",
        cause:
          "Router ke paas koi upstream resolver hai hi nahi. Hamara DHCP client `use-peer-dns=no` ke saath chalta hai (jaan-boojh kar), isliye ISP ke DNS apne aap kabhi nahi aate -- aur DHCP server guests ko `10.5.50.1` yaani router khud deta hai. Router kuch resolve nahi kar sakta, to guest bhi kuch resolve nahi kar sakta.",
        fix: '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes\n/ip dns cache flush\n:put [:resolve "auth.wyfyguest.com"]',
        note: "Yeh poore setup ka sabse zyada dohraaya jaane wala failure hai. `allow-remote-requests=yes` zaroori hai warna guests router se poochh hi nahi paayenge. Fix ke baad `walled-garden-https-entry-missing` bhi zaroor check karo -- kharab DNS ne shayad wahan bhi entry nahi banne di.",
      },
      {
        tell: '`servers: 8.8.8.8,1.1.1.1` set hai par `:put [:resolve "google.com"]` phir bhi fail karta hai.',
        cause:
          "Resolver set hai par router unn tak pahunch nahi pa raha -- yaani WAN/route down hai, DNS ka masla nahi.",
        fix: "/ping 8.8.8.8 count=4",
        note: "Ping bhi fail ho to `wan-no-route-to-host` par jao. DNS servers badal-badal kar try karna yahan bekaar hai.",
      },
      {
        tell: "`allow-remote-requests: no`",
        cause:
          "Router khud to resolve kar leta hai, par guests ki queries reject karta hai -- unko DHCP se `10.5.50.1` mila hai aur wahan darwaza band hai.",
        fix: "/ip dns set allow-remote-requests=yes",
        note: "Router par `:resolve` chalta hai lekin guest ke phone par kuch nahi khulta -- yeh exactly wahi combination hai. Ismein WAN ko blame mat karna.",
      },
      {
        tell: "`servers:` bhara hua hai aur `:resolve` bhi chal raha hai.",
        cause: "DNS bilkul theek hai. Dikkat aage hai -- walled garden ya hotspot L2 me.",
        note: "`walled-garden-https-entry-missing` aur `portal-never-loads` par jao.",
      },
    ],
  },

  {
    id: "walled-garden-https-entry-missing",
    seen: "Guest WiFi se judta hai, login page aa bhi jaata hai, par portal khulta hi nahi / white screen / timeout.",
    surface: "phone",
    probe: "/ip hotspot walled-garden ip print detail",
    causes: [
      {
        tell: '`comment="cloudguest-portal-https"` wali koi line hai hi nahi.',
        cause:
          "Yeh entry paste ke waqt on-device `:resolve` se banti hai, aur uska `on-error` sirf log me warning likhta hai. Matlab paste ke waqt DNS kharab tha -> entry bani hi nahi, koi error dikha hi nahi. HTTPS portal ke liye guest ke paas koi raasta nahi bachta.",
        fix: '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes\n:global portalIp [:resolve "auth.wyfyguest.com"]\n/ip hotspot walled-garden ip add action=accept dst-address=$portalIp comment="cloudguest-portal-https"\n/ip hotspot walled-garden ip print detail',
        note: 'Yeh EK failure poore guest portal ko pahunch se bahar kar deta hai, aur router par aur sab kuch "green" dikhta hai. Pehle DNS theek karo, phir yeh chalao -- ulta karoge to entry phir nahi banegi. Ya Walled Garden chunk dobara paste kar do, ab woh khud resolve kar lega.',
      },
      {
        tell: '`comment="cloudguest-portal-https"` hai par `dst-address=` me purani/galat IP hai.',
        cause:
          "Portal ka IP badal gaya hai (host ya CDN move hua) aur device par purani IP pinned hai.",
        fix: ':global portalIp [:resolve "auth.wyfyguest.com"]\n/ip hotspot walled-garden ip set [find comment="cloudguest-portal-https"] dst-address=$portalIp',
        note: "Walled Garden chunk dobara paste karne se bhi yeh update ho jaata hai -- woh add-if-missing nahi, set-if-present hai. Confirm karo ki nayi IP `:resolve` wali IP se match karti hai.",
      },
      {
        tell: "Entry maujood hai, `dst-address=` sahi hai, `action=accept` hai.",
        cause: "Walled garden theek hai. Dikkat guest ke DNS me ya hotspot L2 me hai.",
        note: "Ek aur cheez check karo: `/ip hotspot walled-garden print detail` (yeh alag, host-based table hai) me `cloudguest-portal` entry honi chahiye -- HTTP redirect ke liye woh chahiye, HTTPS ke liye IP wali. Dono alag mechanisms hain.",
      },
    ],
  },

  {
    id: "portal-never-loads",
    seen: "Guest WiFi se juda hai par portal page bilkul nahi aata -- na login page, na error, bas spinner ya timeout.",
    surface: "phone",
    probe: '/tool fetch url="https://auth.wyfyguest.com" mode=https output=none',
    causes: [
      {
        tell: "`status: finished` / `downloaded: ...KiB` -- router khud portal tak pahunch gaya.",
        cause:
          "Router ka WAN aur DNS dono theek hain. Matlab guest ka raasta band hai -- walled-garden ki HTTPS entry missing hai.",
        fix: '/ip hotspot walled-garden ip print detail\n# `cloudguest-portal-https` dhoondo; nahi mile to:\n:global portalIp [:resolve "auth.wyfyguest.com"]\n/ip hotspot walled-garden ip add action=accept dst-address=$portalIp comment="cloudguest-portal-https"',
        note: "Yeh sabse zyada time khaane wala lookalike hai -- router se sab kaam karta hai, guest ke liye kuch nahi. Poori detail `walled-garden-https-entry-missing` me hai.",
      },
      {
        tell: "`failure: dns name does not exist` ya `resolving failed`.",
        cause: "Router ke paas DNS hi nahi hai -- `/ip dns` me servers khaali honge.",
        fix: "/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes\n/ip dns cache flush",
        note: "DNS theek karne ke turant baad walled-garden entry bhi banwao -- woh paste ke waqt kharab DNS ki wajah se skip ho chuki hogi.",
      },
      {
        tell: "`failure: connection timed out` ya `closed connection`.",
        cause: "WAN/route down hai. Naam resolve ho gaya par packet bahar nahi ja raha.",
        fix: "/ping 8.8.8.8 count=4",
        note: "`wan-no-route-to-host` par jao. Walled garden ya portal ko yahan blame karna bekaar hai.",
      },
      {
        tell: "`status: finished` aata hai aur walled-garden entry bhi maujood hai.",
        cause:
          "Network side clean hai. Guest ka traffic router tak pahunch hi nahi raha, ya guest ka phone hi portal trigger nahi kar raha.",
        note: "Ab `guests-get-nothing` (L2/DHCP) par jao. Ek self-signed certificate warning interstitial bhi guest ke URL params kha jaata hai -- agar phone par cert warning dikhi thi to yeh network ka issue nahi hai.",
      },
    ],
  },

  // ---------------------------------------------------------------------
  // 3. WireGuard
  // ---------------------------------------------------------------------
  {
    id: "wg-handshake-missing",
    seen: 'Dashboard me router "offline" ya WireGuard "not connected", jabki router ke saamne baithe ho aur internet chal raha hai.',
    surface: "router",
    probe: "/interface wireguard peers print detail",
    causes: [
      {
        tell: "`last-handshake=` line hai hi nahi (ya value blank hai), aur `tx=` badh raha hai par `rx=0 B`.",
        cause:
          "Hamare packets bahar ja rahe hain, hub se kuch wapas nahi aa raha. Aksar upstream ISP UDP egress block karta hai (hotel/mall ke managed connections me common), ya endpoint tak raasta nahi hai.",
        fix: "/ping 20.219.72.235 count=4\n/interface wireguard peers print detail",
        note: "Agar ICMP ping chal raha hai par `rx=0 B` bana hua hai, to ISP UDP/51820 rok raha hai -- yeh router par fix nahi hota, venue ke ISP se baat karni padegi ya doosra uplink lagana padega. Yeh sirf remote management todta hai; guests ka portal aur internet isse rukta nahi.",
      },
      {
        tell: "`tx=0 B` aur `rx=0 B` dono, `last-handshake=` bhi nahi.",
        cause:
          "Router ne ek bhi packet bheja hi nahi -- ya to peer galat/adhoora hai, ya tunnel interface par IP address nahi laga.",
        fix: '/interface wireguard peers print detail where interface="wg-cloudguest"\n/ip address print where interface="wg-cloudguest"\n/interface wireguard print detail',
        note: "`endpoint-address=20.219.72.235`, `endpoint-port=51820`, `persistent-keepalive=25s` aur tunnel par `10.20.0.x/24` -- chaaron honi chahiye. Ek bhi missing ho to WireGuard Tunnel chunk dobara paste karo. Generate dobara mat click karna: woh keys rotate kar deta hai aur chunk add-if-missing hai, isliye re-paste se bhi repair NAHI hoga.",
      },
      {
        tell: "Do interfaces dikh rahe hain: `wg-cloudguest` aur `wg-cloudguard`.",
        cause:
          "Frontend chunk `wg-cloudguest` banata hai, backend bootstrap `wg-cloudguard` -- dono raaste chal gaye. Firewall rule ek naam se bandhi hai, traffic doosre se jaa raha hai.",
        fix: '/interface wireguard remove [find name="wg-cloudguard"]\n/ip firewall filter print where comment="cloudguest-fw-allow-wg-mgmt"',
        note: "Jo bhi tunnel par asli `last-handshake=` dikh raha ho use rakho, doosra hata do. Firewall rule ka `in-interface=` bache hue tunnel ke naam se match hona chahiye.",
      },
      {
        tell: "`last-handshake=1m30s` type recent value dikh rahi hai.",
        cause: "Handshake ho raha hai. Tunnel ban chuka hai -- yeh symptom yahan khatam.",
        note: "Handshake hona aur traffic bahna do alag baatein hain. Ab `wg-handshake-ok-no-traffic` par jao aur `/ping 10.20.0.1` se asli claim verify karo.",
      },
    ],
  },

  {
    id: "wg-handshake-ok-no-traffic",
    seen: "WireGuard handshake dikh raha hai par dashboard phir bhi router ko offline dikhata hai / RADIUS timeout de raha hai.",
    surface: "router",
    probe: "/ping 10.20.0.1 count=4",
    causes: [
      {
        tell: "`sent=4 received=0` (saare timeout).",
        cause:
          "Handshake hua par tunnel se data nahi ja raha. Sabse aam wajah: peer ka `allowed-address` hub ke tunnel subnet ko cover nahi karta, ya `wg-cloudguest` par router ka apna tunnel IP laga hi nahi.",
        fix: '/ip address print where interface="wg-cloudguest"\n/interface wireguard peers print detail\n# tunnel IP missing ho to (apna assigned IP daalo):\n/ip address add address=10.20.0.<n>/24 interface="wg-cloudguest"',
        note: '`allowed-address` me `10.20.0.0/24` (ya jo tunnel subnet script me tha) hona chahiye. `last-handshake=` hone ka matlab sirf itna hai ki keys match ho gayi -- routing alag cheez hai. Isliye dashboard "handshake OK" par bharosa mat karo, hamesha yeh ping chalao.',
      },
      {
        tell: "`no route to host` ya `host unreachable`.",
        cause:
          "Tunnel interface par address nahi hai, isliye `10.20.0.0/24` ke liye router ke paas koi connected route hi nahi.",
        fix: '/ip address add address=10.20.0.<n>/24 interface="wg-cloudguest"\n/ping 10.20.0.1 count=4',
        note: "Sahi `<n>` Router Fleet me is router ke management IP se milta hai -- galat number daal doge to doosre router se clash hoga. Andaaza mat lagao, dashboard se dekho.",
      },
      {
        tell: "`sent=4 received=4` -- ping chal raha hai.",
        cause:
          "Tunnel poori tarah kaam kar raha hai. Dashboard-offline ya RADIUS-timeout ki wajah kahin aur hai.",
        note: "Dashboard offline hai to `router-offline-in-dashboard` (aksar NTP/ghadi ka masla) dekho. RADIUS timeout hai to `radius-counters` par jao -- tunnel ab suspect nahi hai.",
      },
      {
        tell: "Kabhi reply, kabhi timeout (`packet-loss=50%` type).",
        cause: "Uplink flap kar raha hai ya do default routes aapas me lad rahe hain.",
        fix: '/ip route print detail where dst-address="0.0.0.0/0"',
        note: "Agar bina `cloudguest-` comment wali extra 0.0.0.0/0 route dikhe (RouterOS ke apne dhcp-client ki banayi hui), to use hata do -- woh hamari check-gateway wali route se ladti hai.",
      },
    ],
  },

  {
    id: "wg-firewall-rule-order",
    seen: "Tunnel to ban jaata hai par hub se router tak kuch nahi pahunchta -- WinBox/API tunnel ke through nahi khulta.",
    surface: "router",
    probe: "/ip firewall filter print where chain=input",
    causes: [
      {
        tell: "`cloudguest-fw-allow-wg-mgmt` ka row number `cloudguest-fw-drop-wan-input` se BADA hai (yaani neeche hai).",
        cause:
          "RouterOS rules upar se neeche chalata hai. Drop rule pehle match kar jaata hai, to tunnel wala accept kabhi chalta hi nahi.",
        fix: '/ip firewall filter move [find comment="cloudguest-fw-allow-wg-mgmt"] destination=[find comment="cloudguest-fw-drop-wan-input"]\n/ip firewall filter print where chain=input',
        note: "Yeh tab hota hai jab Firewall chunk WireGuard chunk ke BAAD paste kiya gaya ho. Move ke baad allow ka number chhota hona chahiye. Sirf number dekho, aur kuch nahi.",
      },
      {
        tell: "`cloudguest-fw-allow-wg-mgmt` wali line hai hi nahi.",
        cause: "WireGuard chunk paste hi nahi hua, ya sirf uska firewall wala hissa nahi chala.",
        fix: '/ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt" place-before=[find comment="cloudguest-fw-drop-wan-input"]',
        note: "`place-before=` zaroori hai -- plain `add` hamesha list ke aakhir me jodta hai, matlab drop rule ke neeche, matlab bekaar.",
      },
      {
        tell: "Allow rule upar hai aur uske aage flag `X` (disabled) hai.",
        cause: "Rule maujood hai par kisi ne WinBox me debug karte waqt disable kar diya.",
        fix: '/ip firewall filter enable [find comment="cloudguest-fw-allow-wg-mgmt"]',
        note: "`X` flag aasani se miss ho jaata hai, order sahi hone par bhi. Print output me flags column zaroor dekho.",
      },
      {
        tell: "Allow rule upar hai, enabled hai, phir bhi hub se kuch nahi aata.",
        cause: "Firewall ka masla nahi hai -- tunnel hi actual me traffic nahi le ja raha.",
        note: "`wg-handshake-ok-no-traffic` par jao. Firewall me aur kuch mat chhedo.",
      },
    ],
  },

  // ---------------------------------------------------------------------
  // 4. RADIUS
  // ---------------------------------------------------------------------
  {
    id: "radius-counters",
    seen: 'Guest ka OTP verify ho jaata hai, app "connected" dikhata hai, par internet nahi chalta.',
    surface: "router",
    probe: "/radius monitor 0 once",
    causes: [
      {
        tell: "Chaaron counters `0` hain -- `accepts=0 rejects=0 timeouts=0 bad-replies=0`.",
        cause:
          "Router tak ek bhi RADIUS request aayi hi nahi. Matlab hotspot ka login POST kabhi bheja hi nahi gaya -- yeh portal side ka bug hai, network ka nahi.",
        fix: '/ip hotspot active print\n/log print where topics~"hotspot"',
        note: "Yeh 2026-08-18 wali outage ka asli final blocker tha: portal ke paas `guestIdentifier` set hi nahi hota tha to hotspot POST silently no-op kar deta tha, aur router ke logs bilkul khaali rehte the. Router par kuch mat badlo -- backend/portal team ko bolo. Counters `0` hone ka matlab hai router ne kabhi kuch dekha hi nahi.",
      },
      {
        tell: "`bad-replies` badh raha hai.",
        cause:
          "Server ka jawab aaya to sahi, par RouterOS ne use validate hone se pehle hi phenk diya. Aam taur par reply me Message-Authenticator attribute hai hi nahi, aur router `require-message-auth=yes-for-request-resp` par set hai.",
        fix: "/radius print detail\n# `require-message-auth=` ki value dekho, phir `radius-bad-replies` symptom follow karo.",
        note: "Yeh reject NAHI hai aur timeout bhi NAHI hai -- teesra alag counter hai, aur yahi cheez 2026-08-18 ko ghanton kha gayi thi. Asli fix FreeRADIUS hub par hai. Ise reject samajh kar credentials debug karna time waste hai.",
      },
      {
        tell: "`timeouts` badh raha hai.",
        cause:
          "Request gayi, jawab aaya hi nahi. Ya to tunnel down hai (server tunnel IP par hai), ya shared secret galat hai -- galat secret par FreeRADIUS chup-chaap drop karta hai, reject nahi bhejta.",
        fix: "/ping 10.20.0.1 count=4\n/radius print detail",
        note: "Ping fail = tunnel ka masla, `wg-handshake-ok-no-traffic` par jao. Ping chal raha hai to secret galat hai -- `POST /radius/nas/register-external/{router_id}` se dobara register karo aur usi baithak me `/radius` chunk paste karo (register karne par secret rotate hota hai).",
      },
      {
        tell: "`rejects` badh raha hai.",
        cause:
          "Server ne request dekhi, samjhi, aur mana kar diya. Sabse aam: is router ka identifier/registration backend ke router record se match nahi karta -- request kisi aur router ke naam se authenticate ho rahi hai.",
        fix: '/radius print detail\n/ip hotspot profile print detail where name="hsprof1"',
        note: "Yeh khaas taur par doosre aur uske baad ke routers par hota hai: agar hub ka `sites-enabled/default` abhi bhi router #1 ka identifier hardcode kiye baitha hai, to naya router 401 nahi hoga -- woh router #1 ban kar authenticate hoga aur phir `router_id` mismatch par HTTP 200 ke andar Reject aayega, logs me kuch nahi. Yeh router par fix nahi hota.",
      },
      {
        tell: "`accepts` badh raha hai.",
        cause: "RADIUS bilkul theek chal raha hai. Guest authorize ho raha hai.",
        note: "`/ip hotspot active print` chalao -- guest wahan dikhna chahiye. Dikh raha hai aur phir bhi internet nahi, to masla WAN/DNS me hai, auth me nahi.",
      },
      {
        tell: "Command error deti hai: `no such item`.",
        cause: "`/radius` par koi entry hai hi nahi -- RADIUS chunk paste nahi hua.",
        fix: "/radius print\n# khaali ho to RADIUS chunk paste karo.",
        note: "`monitor 0` ka matlab hai pehli entry. Entry hi nahi hogi to command index par hi fail ho jayegi.",
      },
    ],
  },

  {
    id: "radius-bad-replies",
    seen: "`/radius monitor 0 once` me `bad-replies` ka counter chadh raha hai, `rejects` aur `timeouts` zero hain.",
    surface: "router",
    probe: "/radius print detail",
    causes: [
      {
        tell: "`require-message-auth=yes-for-request-resp`",
        cause:
          "RouterOS reply me Message-Authenticator attribute maang raha hai. FreeRADIUS ka `rlm_rest`-se-bana Access-Accept usko apne aap attach NAHI karta, isliye router har jawab chup-chaap discard kar deta hai.",
        fix: "# Hub VM par (router par nahi) -- authorize{} me rest module call ke turant baad:\n#   update reply { Message-Authenticator := 0x00 }\n# Phir router par:\n/radius monitor 0 once",
        note: "Yeh exactly 2026-08-18 wala root cause #4 hai. Server-side fix hi asli fix hai. Router par `require-message-auth=no` karke aage badhna sirf demo bachane ke liye hai -- security kamzor karta hai aur asli bug chhupa deta hai, isliye ticket zaroor raise karo.",
      },
      {
        tell: "`require-message-auth=no` aur phir bhi `bad-replies` badh raha hai.",
        cause:
          "Reply aa raha hai par uska authenticator hash match nahi kar raha -- dono taraf ka shared secret alag hai.",
        fix: '# Backend par dobara register karo (yeh secret rotate karta hai), phir usi baithak me:\n/radius set [find service=hotspot] secret="<naya-secret>"\n/radius monitor 0 once',
        note: "Adha-galat secret timeouts ki jagah bad-replies deta hai jab server jawab to de raha ho. Register aur paste ke beech Generate mat click karna, warna secret phir badal jayega.",
      },
      {
        tell: "`timeout=300ms` (ya `timeout=3s` se kam).",
        cause:
          "RouterOS ka default 300ms hai, jo tunnel wale raaste ke liye bahut kam hai -- der se aaya jawab kabhi-kabhi bad-reply/timeout ban jaata hai.",
        fix: "/radius set [find service=hotspot] timeout=3s",
        note: "Script `timeout=3s` set karta hai; 300ms dikhe to entry haath se banayi gayi hai ya kisi purane paste se bachi hai.",
      },
    ],
  },

  // ---------------------------------------------------------------------
  // 5. Hotspot / L2
  // ---------------------------------------------------------------------
  {
    id: "guests-get-nothing",
    seen: 'Dashboard me router "online" hai par guest ke phone ko IP hi nahi milti -- WiFi "obtaining IP address" par atka rehta hai.',
    surface: "router",
    probe: "/ip dhcp-server lease print",
    causes: [
      {
        tell: "Ek bhi lease nahi -- output khaali hai.",
        cause:
          "Guest ka traffic bridge tak pahunch hi nahi raha. Aksar AP jis port me laga hai woh guest bridge ka member nahi hai (kisi purane `bridgeLocal` me atka hai).",
        fix: '/interface bridge port print\n/interface ethernet monitor [find name="ether3"] once',
        note: "Print ke `BRIDGE` column me har LAN port hamare guest bridge (default naam `bridge`) ke neeche dikhna chahiye. Jo port kisi doosre bridge me hai woh guests ke liye poori tarah dead hai -- LAN Ports chunk dobara paste karo, woh port ko detach karke sahi bridge me daal deta hai.",
      },
      {
        tell: "Leases dikh rahi hain aur `status` column me `bound` likha hai.",
        cause: "L2 aur DHCP dono theek hain. Guests ko IP mil rahi hai, dikkat aage hai.",
        fix: "/ip hotspot active print",
        note: "Ab hotspot/portal/RADIUS layer dekho. `guests-get-nothing` yahan khatam -- L2 clean hai.",
      },
      {
        tell: "Leases hain par sab `waiting` / `offered` par atki hain.",
        cause:
          "Guest DISCOVER bhej raha hai, OFFER pahunch raha hai, par ACK complete nahi hota -- aksar us subnet par doosra DHCP server bhi bol raha hai (venue ka purana router abhi bhi on hai).",
        fix: "/ip dhcp-server print detail\n/tool dhcp-client-watch",
        note: "Ek hi LAN par do DHCP server sabse ganda field issue hai -- guests random-random dono se IP lete hain aur aadhe portal par pahunchte hi nahi. Purana router ka DHCP band karwao.",
      },
      {
        tell: "`/ip dhcp-server print` khaali hai -- koi server define hi nahi.",
        cause: "Hotspot chunk paste nahi hua, ya us waqt bridge par LAN IP nahi tha.",
        fix: "/ip address print\n# bridge wali line par `10.5.50.1/24` dikhna chahiye. Na dikhe to pehle LAN IP + DNS chunk, phir Hotspot chunk paste karo.",
        note: "Interface ka naam yahan type karne ki zarurat nahi -- poori list chhoti hoti hai, bridge wali line saamne dikh jaayegi. Order matter karta hai: bridge par address pehle, DHCP server baad me. Ulta paste karoge to server banega hi nahi aur koi error bhi nahi aayega.",
      },
    ],
  },

  {
    id: "hotspot-traffic-not-reaching-bridge",
    seen: 'Guest ka phone WiFi se "connected" dikhata hai par router par uska koi nishaan nahi -- na lease, na hotspot host.',
    surface: "router",
    probe: "/tool sniffer quick interface=[/ip hotspot get [find] interface] duration=10",
    causes: [
      {
        tell: "Guest ke phone ka MAC output me kahin dikhta hi nahi.",
        cause:
          "Phone AP se juda hai par uske packets router tak aa hi nahi rahe. Ya to AP apne andar hi NAT/isolation kar raha hai, ya uska uplink kisi doosre switch/VLAN me chala gaya hai.",
        fix: "/interface bridge host print\n/interface bridge port print",
        note: 'Sniffer HAMESHA LAN bridge par chalao, WireGuard tunnel par nahi -- yeh farq hi ek poori galat theory ("network kharab hai") ko ek minute me kaat deta hai. Probe me `[/ip hotspot get [find] interface]` isliye hai ki bridge ka naam khud router se aaye, aap type na karo. AP ko bridge/AP mode me hona chahiye, router mode me nahi.',
      },
      {
        tell: "MAC dikh raha hai, DHCP Discover packets bhi dikh rahe hain.",
        cause:
          "Traffic bridge tak pahunch raha hai. Dikkat DHCP server ya hotspot config me hai, cabling/AP me nahi.",
        fix: "/ip dhcp-server print detail\n/ip pool print",
        note: '`guests-get-nothing` par jao. Ab cable, AP ya "network" ko blame karna band kar do -- packets aa rahe hain.',
      },
      {
        tell: "MAC dikh raha hai par sirf ARP, koi DHCP nahi.",
        cause: "Phone ke paas pehle se static/purani IP hai aur woh naya lease maang hi nahi raha.",
        fix: "# Phone par: WiFi network ko 'Forget' karke dobara join karao.",
        note: 'Testing wale phone par yeh bahut hota hai. Ek doosre, bilkul naye device se test karo -- aadhi baar "router ka bug" yahi nikalta hai.',
      },
      {
        tell: "Command hi error deti hai: `no such item` ya `input does not match any value of interface`.",
        cause:
          "Hotspot bana hi nahi hai, isliye probe bridge ka naam nikaal nahi paya -- sniffer se pehle Hotspot chunk paste karna baaki hai.",
        fix: "/interface bridge print\n# jo bridge naam dikhe (default `bridge`) wahi daal kar:\n/tool sniffer quick interface=bridge duration=10",
        note: "Yeh khud ek jawab hai: hotspot missing hai. Sniffer phir bhi chala sakte ho -- bas bridge ka naam `/interface bridge print` se dekh kar haath se daalo, kabhi andaaza mat lagao.",
      },
    ],
  },

  {
    id: "hotspot-session-leak",
    seen: 'Kuch guests ko "device limit reached" milta hai ya naye guests connect hi nahi ho pa rahe, jabki venue khaali hai.',
    surface: "router",
    probe: "/ip hotspot active print",
    causes: [
      {
        tell: "Bahut saari active entries hain aur `uptime` ghanton/dino me hai.",
        cause:
          "Sessions band ho hi nahi rahe. Script `keepalive-timeout=none` set karta hai par `idle-timeout` kabhi set nahi karta -- guest ke ghar chale jaane ke baad bhi session zinda rehta hai.",
        fix: '/ip hotspot user profile set [find name="default"] idle-timeout=5m\n/ip hotspot active remove [find uptime>4h]',
        note: "Sirf pehli line asli fix hai; doosri abhi ke atke sessions saaf karti hai. Yeh generator ka khula hua bug hai -- har naye router par yeh line haath se lagao.",
      },
      {
        tell: "Ek hi guest ke naam par 5 entries aur `shared-users=5` limit hit ho rahi hai.",
        cause:
          "Har reconnect ek naya session banata hai, purana idle-timeout ke bina marta nahi -- ek hi phone 5 slots kha jaata hai.",
        fix: '/ip hotspot user profile print detail where name="default"\n/ip hotspot user profile set [find name="default"] idle-timeout=5m',
        note: "`shared-users=5` jaan-boojh kar hai (ek guest ke phone + laptop). Ise badhao mat -- idle-timeout theek karo, wahi asli wajah hai.",
      },
      {
        tell: "`user=guest` naam ki entry dikh rahi hai.",
        cause:
          "Local `guest` hotspot user portal ka poora bypass hai -- RouterOS local users ko RADIUS se PEHLE check karta hai. Na OTP, na session, na consent, na bandwidth cap, na accounting.",
        fix: '/ip hotspot user print\n/ip hotspot user disable [find name="guest"]',
        note: 'Yeh har naye router par disable karna hai. Jab tak yeh on hai, "OTP kaam nahi kar raha" waali har report shak ke daayre me hai -- ho sakta hai guest kabhi portal se guzra hi na ho.',
      },
      {
        tell: "Output khaali hai par guests ke paas IP hai.",
        cause: "Kisi ne hotspot gate paar hi nahi kiya -- ya sabhi walled garden par atke hain.",
        note: "`portal-never-loads` par jao. Active list khaali hona matlab authorization bilkul shuru hi nahi ho raha.",
      },
    ],
  },

  {
    id: "router-offline-in-dashboard",
    seen: 'Router dashboard me "offline" dikhta hai par venue me guests aaram se internet chala rahe hain.',
    surface: "dashboard",
    probe: "/system clock print",
    causes: [
      {
        tell: "`date:` me galat/purani date (jaise `jan/01/1970` ya `jan/02/2020`).",
        cause:
          "hEX me battery clock nahi hai, to fresh/power-cycled box galat date par boot hota hai. Scheduler ne galat `start-time` pakad liya, heartbeat ka `run-count=0` reh gaya, aur HTTPS `/tool fetch` bhi cert validity fail hone par mar jaata hai.",
        fix: "/system clock set time-zone-name=Asia/Kolkata\n/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1\n/system clock print\n/system scheduler print detail",
        note: 'Yeh sabse aam "offline par guests theek hain" ka karan hai. Ghadi theek hone ke baad scheduler ko dobara banwana pad sakta hai -- `run-count=0` bana rahe to Heartbeat chunk dobara paste karo.',
      },
      {
        tell: "Date sahi hai par `/system scheduler print detail` me `run-count=0`.",
        cause:
          "Scheduler galat ghadi ke saath bana tha aur uska `next-run` ab bhi past me atka hai.",
        fix: "# Heartbeat chunk dobara paste karo, phir:\n/system scheduler print detail",
        note: "`run-count` 5 minute ke andar 1 hona chahiye. Nahi hota to scheduler ka `start-time` abhi bhi kharab hai.",
      },
      {
        tell: "Date sahi hai, `run-count` badh raha hai, par dashboard phir bhi offline.",
        cause:
          "Heartbeat chal raha hai par backend tak pahunch nahi raha -- tunnel ya DNS ka masla.",
        fix: '/log print where message~"cloudguest-heartbeat"\n/ping 10.20.0.1 count=4',
        note: "Log me `status: failed, downloaded: 0KiB` matlab fetch nikal hi nahi paaya -- `dns-servers-empty` ya `wg-handshake-ok-no-traffic` par jao.",
      },
      {
        tell: "`/system scheduler print` me heartbeat wali entry hai hi nahi.",
        cause: "Heartbeat chunk kabhi paste hua hi nahi.",
        fix: "# Heartbeat chunk paste karo.",
        note: "Iske bina router dashboard me kabhi online nahi dikhega, chahe baaki sab perfect ho. Guests par iska koi asar nahi padta.",
      },
    ],
  },
];
