/**
 * Guided Setup — RouterOS content.
 *
 * Ye file sirf DATA hai: phases, paste-blocks, checks aur fixes. Koi React
 * nahi, koi import nahi. UI is file ko render karta hai.
 *
 * Design rules (jo QA pass se nikle):
 *  - Har check ka output literally match hona chahiye (`As`, `bound`,
 *    `00:05:00`, `40.80.86.193`). "Verify it works" kabhi nahi.
 *  - Jahan ho sake, block khud `RESULT: PASS` / `RESULT: FAIL` print kare,
 *    taaki table padh ke judge na karna pade.
 *  - Yahan ke saare paste-blocks UNIVERSAL hain — inme koi per-router secret
 *    nahi hai, isliye kisi bhi router pe safe hain aur dobara chalane pe bhi
 *    kuch nahi tootta. Jin steps me per-router secret chahiye (WireGuard key,
 *    RADIUS secret, portal URL with org/location/router IDs) wahan Master
 *    console ke generated chunks use hote hain — un phases me `paste` khaali
 *    hai aur instruction `why` / `stopGate` me hai.
 */

export type Check = {
  id: string;
  label: string;
  command: string;
  expect: string;
  failFix?: Fix[];
};

export type Fix = {
  when: string;
  command?: string;
  note: string;
};

export type Phase = {
  id: string;
  n: number;
  title: string;
  why?: string;
  estMinutes: number;
  paste: { label: string; script: string }[];
  checks: Check[];
  stopGate?: string;
  oncePerRouter: boolean;
};

export const PHASES: Phase[] = [
  // ---------------------------------------------------------------------
  {
    id: "audit",
    n: 0,
    title: "Router saaf hai ya nahi",
    why: "Purana provisioning bacha ho to nayi setting uske upar chadh jaati hai aur galat org/location IDs chalte rehte hain.",
    estMinutes: 3,
    oncePerRouter: false,
    paste: [
      {
        label: "Router audit — purana config dhoondo",
        script: `:put "==== ROUTER AUDIT ===="
:local dirty 0
:put ("identity     : " . [/system identity get name])
:if ([:len [/ip hotspot find]] > 0) do={ :put "  purana HOTSPOT mila"; :set dirty ($dirty + 1) }
:if ([:len [/radius find]] > 0) do={ :put "  purana RADIUS mila"; :set dirty ($dirty + 1) }
:if ([:len [/interface wireguard find where name="wg-cloudguest"]] > 0) do={ :put "  purana WIREGUARD mila"; :set dirty ($dirty + 1) }
:if ([:len [/user find where name="cloudguest-api"]] > 0) do={ :put "  purana API USER mila"; :set dirty ($dirty + 1) }
:if ([:len [/certificate find where name~"cloudguest"]] > 0) do={ :put "  purana CERTIFICATE mila"; :set dirty ($dirty + 1) }
:if ([:len [/file find where name~"cloudguest"]] > 0) do={ :put "  purani FILES/FOLDER mili"; :set dirty ($dirty + 1) }
:if ([:len [/ip firewall filter find where comment~"cloudguest"]] > 0) do={ :put "  purane FIREWALL rules mile"; :set dirty ($dirty + 1) }
:foreach f in=[/file find where name~"cloudguest"] do={ :put ("    -> " . [/file get $f name]) }
:put "===================="
:if ($dirty = 0) do={ :put "RESULT: CLEAN -- ye router factory-fresh hai, aage badho" } else={ :put "RESULT: PURANA CONFIG MILA -- pehle reset karo" }`,
      },
    ],
    checks: [
      {
        id: "audit-clean",
        label: "Router pe koi purana Wyfy config to nahi",
        command: "(upar wala block chalao)",
        expect: "RESULT: CLEAN -- ye router factory-fresh hai, aage badho",
        failFix: [
          {
            when: "RESULT: PURANA CONFIG MILA aaya",
            command: "/system reset-configuration skip-backup=yes",
            note: "Router reboot hoga aur connection tut jayega — ye normal hai. 2 minute wait karo, phir WinBox me MAC se dobara connect karo aur ye audit dobara chalao. Ab CLEAN aana chahiye.",
          },
          {
            when: "purani FILES/FOLDER mili, jaise flash/cloudguest-hotspot/",
            command: "/system reset-configuration skip-backup=yes",
            note: "July wale provisioning ka bacha hua folder hai. Isme purane org/location/router ID wale portal links hain jo aaj bhi guests ko galat jagah bhejenge. Sirf files delete karna kaafi nahi — poora reset karo.",
          },
          {
            when: "Reset ke baad bhi router nahi mil raha",
            note: "Laptop ka cable ether2 me daalo (ether1 nahi — wo internet ke liye hai). WinBox kholo, 'Neighbors' tab me MAC address pe click karo, login admin / password blank.",
          },
        ],
      },
    ],
    stopGate:
      "Agar CLEAN nahi aaya to ruk jao aur reset karo — purane config ke upar setup karoge to guests ko purana portal dikhega aur ghanto debug karna padega.",
  },

  // ---------------------------------------------------------------------
  {
    id: "clock",
    n: 1,
    title: "Internet aur ghadi",
    why: "hEX me battery wali ghadi nahi hoti — har bar power jaane pe date galat ho jaati hai, aur galat date pe heartbeat scheduler aur HTTPS dono chup-chaap fail hote hain.",
    estMinutes: 3,
    oncePerRouter: true,
    paste: [
      {
        label: "Ghadi aur NTP set karo",
        script: `/system clock set time-zone-name=Asia/Kolkata
/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1`,
      },
      {
        label: "Internet aur ghadi check karo",
        script: `:put "==== INTERNET + CLOCK ===="
:delay 6s
:local pingOk false
:if ([/ping 8.8.8.8 count=4] > 0) do={ :set pingOk true }
:put ("ping 8.8.8.8 : " . [:tostr $pingOk])
:put ("date         : " . [/system clock get date])
:put ("time         : " . [/system clock get time])
:do { :put ("ntp status   : " . [/system ntp client get status]) } on-error={ :put "ntp status   : (is RouterOS version pe available nahi)" }
:put "===================="
:if ($pingOk) do={ :put "RESULT: PASS -- internet chal raha hai" } else={ :put "RESULT: FAIL -- ether1 ka cable check karo" }`,
      },
    ],
    checks: [
      {
        id: "clock-internet",
        label: "Internet chal raha hai",
        command: "(upar wala check block chalao)",
        expect: "RESULT: PASS -- internet chal raha hai",
        failFix: [
          {
            when: "ping false aaya",
            note: "ISP ka cable ether1 me hona chahiye, laptop ka ether2 me. Ulta mat lagao. Cable lagane ke baad 30 second wait karke block dobara chalao.",
          },
        ],
      },
      {
        id: "clock-date",
        label: "Router ki date aaj ki hai",
        command: "/system clock print",
        expect: "date: aaj ki date (1970 ya 2000 nahi)",
        failFix: [
          {
            when: "date 1970 / jan/01/1970 dikha raha hai",
            command: "/system ntp client set enabled=yes servers=216.239.35.0,162.159.200.1",
            note: "NTP ko internet chahiye. Pehle upar wala ping PASS karao, phir ye command chalao aur 10 second baad /system clock print dobara dekho.",
          },
          {
            when: "ntp status: synchronized nahi aa raha",
            command: "/system clock set date=jan/01/2026 time=12:00:00",
            note: "Manually date daal do (aaj ki date). Ye temporary hai par kaafi hai — NTP baad me khud theek kar lega. Galat date pe aage mat badho.",
          },
        ],
      },
    ],
    stopGate:
      "Date aaj ki na ho to ruk jao. Galat date pe router set ho jayega par Master console me hamesha offline dikhega — aur ye baad me pakadna bahut mushkil hai.",
  },

  // ---------------------------------------------------------------------
  {
    id: "wan",
    n: 2,
    title: "WAN aur route repair",
    why: "Script DHCP client banane ke turant baad gateway padhti hai — lease abhi mila hi nahi hota, isliye route gateway 0.0.0.0 ke saath banta hai aur poora internet band ho jata hai.",
    estMinutes: 5,
    oncePerRouter: true,
    paste: [
      {
        label: "DHCP lease ka wait + route repair (script ke baad hamesha chalao)",
        script: `:put "==== WAN LEASE + ROUTE REPAIR ===="
:local wanIf "ether1"
:local gw ""
:local st "no-client"
:if ([:len [/ip dhcp-client find where interface=$wanIf]] = 0) do={ :put "DHCP client nahi hai (static WAN hoga) -- repair skip" }
:if ([:len [/ip dhcp-client find where interface=$wanIf]] > 0) do={
  :for i from=1 to=20 do={
    :if ($gw = "") do={ :set gw [/ip dhcp-client get [find interface=$wanIf] gateway] }
    :if ($gw = "") do={ :delay 2s }
  }
  :set st [/ip dhcp-client get [find interface=$wanIf] status]
}
:put ("dhcp status  : " . $st)
:put ("dhcp gateway : " . $gw)
:if ($gw != "") do={
  :foreach r in=[/ip route find where comment="cloudguest-plain-wan1"] do={ /ip route set $r gateway=$gw }
  :put "route repair : ho gaya"
}
:put "===================="
:if ($gw != "") do={ :put "RESULT: PASS -- gateway mil gaya aur route theek hai" }
:if (($gw = "") && ($st != "no-client")) do={ :put "RESULT: FAIL -- 40 second me DHCP lease nahi mila" }
:if ($st = "no-client") do={ :put "RESULT: SKIP -- static WAN, gateway khud check karo" }`,
      },
    ],
    checks: [
      {
        id: "wan-lease",
        label: "ISP se address mil gaya",
        command: "/ip dhcp-client print",
        expect: "STATUS column me bound",
        failFix: [
          {
            when: "status searching... pe atka hai",
            note: "ISP ka cable ether1 me theek se laga hai? ISP ka apna router on hai? Cable nikal ke dobara lagao aur 30 second baad phir dekho.",
          },
        ],
      },
      {
        id: "wan-route-active",
        label: "Default route ACTIVE hai, inactive nahi",
        command: '/ip route print where dst-address="0.0.0.0/0"',
        expect: "flags me As (Active, static). Is (Inactive) hua to galat hai.",
        failFix: [
          {
            when: "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
            command: `:local gw [/ip dhcp-client get [find interface="ether1"] gateway]
:foreach r in=[/ip route find where comment="cloudguest-plain-wan1"] do={ /ip route set $r gateway=$gw }
:put ("gateway set: " . $gw)`,
            note: "Yahi wo bug hai. Route ban gaya tha par gateway khaali tha. Ye chalane ke baad route As ho jayega aur ping chalne lagega.",
          },
          {
            when: "gw khaali print hua",
            note: "Matlab lease abhi tak nahi mila. 30 second wait karo aur upar wala repair block dobara chalao — dobara chalana bilkul safe hai.",
          },
        ],
      },
    ],
    stopGate:
      "Route As na ho to aage bilkul mat badho — hotspot, tunnel aur RADIUS sab isi route pe chalte hain aur teeno chup-chaap fail honge.",
  },

  // ---------------------------------------------------------------------
  {
    id: "gate",
    n: 3,
    title: "Internet ka asli gate",
    estMinutes: 2,
    oncePerRouter: false,
    paste: [
      {
        label: "Internet + DNS dono ek saath test karo",
        script: `:put "==== INTERNET GATE ===="
:local pingOk false
:local dnsOk false
:if ([/ping 8.8.8.8 count=4] > 0) do={ :set pingOk true }
:do { :set dnsOk ([:len [:resolve "portal.wyfyguest.com"]] > 0) } on-error={ :set dnsOk false }
:put ("ping 8.8.8.8            : " . [:tostr $pingOk])
:put ("resolve portal.wyfy...  : " . [:tostr $dnsOk])
:put "===================="
:if (($pingOk) && ($dnsOk)) do={ :put "RESULT: PASS -- aage badho" } else={ :put "RESULT: FAIL -- niche wala fix chalao" }`,
      },
    ],
    checks: [
      {
        id: "gate-pass",
        label: "Internet aur DNS dono kaam kar rahe hain",
        command: "(upar wala block chalao)",
        expect: "RESULT: PASS -- aage badho",
        failFix: [
          {
            when: "ping true par resolve false",
            command: "/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes",
            note: "Script DNS servers baad wale chunk me set karti hai, isliye ye check usse pehle chalne pe jhoota FAIL de deta hai. Ye command chalao aur gate dobara chalao — ab PASS aayega. Router theek hi tha.",
          },
          {
            when: "ping bhi false",
            note: "Wapas Phase 2 pe jao — route As hai ya Is, wahi asli problem hai.",
          },
        ],
      },
    ],
    stopGate:
      "PASS na aaye to ruk jao. Iske aage har chunk ko internet chahiye aur kuch to bina error ke chup-chaap fail ho jayenge.",
  },

  // ---------------------------------------------------------------------
  {
    id: "hotspot",
    n: 4,
    title: "LAN aur hotspot",
    why: "Master console ke LAN aur Hotspot chunks paste karne ke baad teen setting reh jaati hain jo script set nahi karti.",
    estMinutes: 5,
    oncePerRouter: true,
    paste: [
      {
        label: "Hotspot hardening (LAN + Hotspot chunks ke baad chalao)",
        script: `/ip hotspot set [find] idle-timeout=5m
/ip hotspot user profile set [find name="default"] shared-users=5
/ip hotspot user profile set [find name="default"] keepalive-timeout=none
/ip hotspot user set [find name="guest"] disabled=yes
:put "hotspot hardening: ho gaya"`,
      },
      {
        label: "Hotspot audit — sab setting sahi hai?",
        script: `:put "==== HOTSPOT AUDIT ===="
:if ([:len [/ip hotspot find]] = 0) do={ :put "FAIL: koi hotspot server nahi mila" }
:foreach h in=[/ip hotspot find] do={ :put ("server       : " . [/ip hotspot get $h name] . "  interface=" . [/ip hotspot get $h interface] . "  idle-timeout=" . [:tostr [/ip hotspot get $h idle-timeout]]) }
:foreach p in=[/ip hotspot profile find where name="hsprof1"] do={ :put ("login-by     : " . [:tostr [/ip hotspot profile get $p login-by]]) }
:foreach p in=[/ip hotspot profile find where name="hsprof1"] do={ :put ("dns-name     : " . [/ip hotspot profile get $p dns-name]) }
:foreach p in=[/ip hotspot profile find where name="hsprof1"] do={ :put ("use-radius   : " . [:tostr [/ip hotspot profile get $p use-radius]]) }
:foreach u in=[/ip hotspot user profile find where name="default"] do={ :put ("shared-users : " . [:tostr [/ip hotspot user profile get $u shared-users]]) }
:foreach u in=[/ip hotspot user profile find where name="default"] do={ :put ("keepalive    : " . [:tostr [/ip hotspot user profile get $u keepalive-timeout]]) }
:if ([:len [/ip hotspot user find where name="guest"]] = 0) do={ :put "guest user   : nahi hai (accha)" }
:foreach g in=[/ip hotspot user find where name="guest"] do={ :put ("guest user   : disabled=" . [:tostr [/ip hotspot user get $g disabled]]) }
:put "===================="`,
      },
    ],
    checks: [
      {
        id: "hs-idle",
        label: "Session apne aap band hoti hai (warna sessions jama hote rehte hain)",
        command: "(upar wala audit block chalao)",
        expect: "idle-timeout=00:05:00",
        failFix: [
          {
            when: "idle-timeout=none dikha raha hai",
            command: "/ip hotspot set [find] idle-timeout=5m",
            note: "keepalive band hai, to idle-timeout hi akela backstop hai. none rahega to session kabhi close nahi hogi, data cap kabhi nahi lagega aur active list badhti rahegi.",
          },
        ],
      },
      {
        id: "hs-loginby",
        label: "Login form router accept karega",
        command: "(audit block ka login-by line)",
        expect: "login-by me http-pap hona chahiye",
        failFix: [
          {
            when: "login-by: cookie,http-chap dikha raha hai",
            command: '/ip hotspot profile set [find name="hsprof1"] login-by=https,http-pap',
            note: "Ye RouterOS ka default hai aur portal ka form isse satisfy nahi kar sakta. Guest sahi OTP daalega, kuch nahi hoga, aur router ke log me bhi kuch nahi aayega.",
          },
        ],
      },
      {
        id: "hs-shared",
        label: "Ek guest do device chala sakta hai (phone + laptop)",
        command: "(audit block ka shared-users line)",
        expect: "shared-users : 5",
        failFix: [
          {
            when: "shared-users : 1",
            command: '/ip hotspot user profile set [find name="default"] shared-users=5',
            note: "1 rahega to guest ka laptop 'no more sessions are allowed for user' error dega — aur ye soft error nahi hai, poora login fail hota hai.",
          },
        ],
      },
      {
        id: "hs-guest",
        label: "Local guest user band hai (portal bypass band)",
        command: "/ip hotspot user print",
        expect: "guest wali row pe X flag (disabled), ya guest user hai hi nahi",
        failFix: [
          {
            when: "guest user enabled dikha raha hai",
            command: '/ip hotspot user set [find name="guest"] disabled=yes',
            note: "Router pehle apna local user check karta hai, RADIUS baad me. Matlab jise guest ka password pata hai wo portal ko poora bypass kar sakta hai — bina OTP, bina record, bina data cap. Password Master console screen pe likha hota hai, isliye ye asli risk hai.",
          },
        ],
      },
    ],
    stopGate:
      "Chaaron check PASS hone chahiye. Inme se koi bhi galat rahega to guest login karega aur usko lagega sab theek hai, par asli me kuch kaam nahi karega.",
  },

  // ---------------------------------------------------------------------
  {
    id: "portal",
    n: 5,
    title: "Portal tak raasta",
    why: "Bina walled-garden ke guest ka browser portal tak pahunch hi nahi sakta — captive portal apne hi server ko bhi block karta hai.",
    estMinutes: 5,
    oncePerRouter: false,
    paste: [
      {
        label: "Walled garden — dono list set karo (ye khud FAIL bolega)",
        script: `:put "==== WALLED GARDEN ===="
:local host "portal.wyfyguest.com"
:local pip ""
:do { :set pip [:resolve $host] } on-error={ :put "resolve fail hua" }
:put ("resolved     : " . $pip)
:if ($pip != "") do={
  :if ([:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]] = 0) do={ /ip hotspot walled-garden add dst-host=$host action=allow comment="cloudguest-portal" }
  :local e [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]
  :if ([:len $e] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address=$pip comment="cloudguest-portal-https" } else={ /ip hotspot walled-garden ip set $e dst-address=$pip }
}
:put "===================="
:if ($pip != "") do={ :put "RESULT: PASS -- dono list set ho gayi" } else={ :put "RESULT: FAIL -- DNS ne portal ka IP nahi diya, kuch set nahi hua" }`,
      },
      {
        label: "Portal files kahan hain aur sahi hain?",
        script: `:put "==== PORTAL FILES ===="
:local found 0
:foreach f in=[/file find where name~"login.html"] do={ :put ("  " . [/file get $f name] . "   size=" . [:tostr [/file get $f size]]); :set found ($found + 1) }
:put "===================="
:if ($found = 0) do={ :put "RESULT: FAIL -- login.html mila hi nahi" } else={ :put "RESULT: OK -- upar wala poora path note kar lo" }`,
      },
    ],
    checks: [
      {
        id: "wg-ip",
        label: "HTTPS wali list me portal ka IP hai (yahi sabse zyada tootta hai)",
        command: "/ip hotspot walled-garden ip print",
        expect: 'comment="cloudguest-portal-https" aur dst-address=40.80.86.193',
        failFix: [
          {
            when: "list khaali hai",
            note: "Upar wala walled garden block dobara chalao. Agar phir bhi FAIL bole to Phase 3 ka DNS fix chalao (/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes) aur uske baad ye block. DNS theek na ho to ye block chup-chaap kuch set nahi karta — isliye ye check skip mat karna.",
          },
          {
            when: "dst-address kuch aur IP dikha raha hai",
            note: "Portal ka IP badal gaya hoga. Upar wala block dobara chalao — wo purani entry ko update kar dega, duplicate nahi banayega.",
          },
        ],
      },
      {
        id: "wg-host",
        label: "HTTP wali list bhi set hai",
        command: "/ip hotspot walled-garden print",
        expect: "dst-host=portal.wyfyguest.com, action=allow",
        failFix: [
          {
            when: "khaali hai",
            command:
              '/ip hotspot walled-garden add dst-host=portal.wyfyguest.com action=allow comment="cloudguest-portal"',
            note: "Dono list alag alag cheez hain — HTTP wali sirf http ke liye, IP wali https ke liye. Dono chahiye.",
          },
        ],
      },
      {
        id: "portal-files",
        label: "Portal ke redirect page router pe chadh gaye",
        command: '/file print detail where name~"login.html"',
        expect: "contents me literal text $(link-login-only) dikhna chahiye",
        failFix: [
          {
            when: "login.html mila hi nahi",
            note: "Master console ke 'Portal Redirect Page' wale paanch chunks abhi paste nahi hue. Wo paste karo phir ye check dobara.",
          },
          {
            when: "file to hai par size chhota hai / $(link-login-only) nahi dikh raha",
            note: "Script flash/hotspot/login.html path maanti hai par kuch models pe path sirf hotspot/login.html hota hai. Aise me paste chalti hai, error kuch nahi aata, aur file badalti hi nahi. Upar wale block me jo asli path dikha, wo Master console team ko bhejo — unhe path badalna padega.",
          },
          {
            when: "guest ko neela MikroTik login page dikh raha hai Wyfy portal ki jagah",
            note: "Yahi upar wali problem ka asli symptom hai. Router theek hai, sirf redirect page nahi chadha.",
          },
        ],
      },
      {
        id: "cert-optional",
        label: "Certificate wala chunk (optional — skip kar sakte ho)",
        command: '/certificate print where name~"cloudguest"',
        expect: "khaali ho to bhi chalta hai — guest flow ke liye zaroori nahi",
        failFix: [
          {
            when: "'input does not match any value of ca' error aaya",
            command: '/certificate remove [find name~"cloudguest"]',
            note: "Ye chunk ka purana bug hai. Ye command chala ke saaf karo aur certificate chunk chhod do — guest ka portal iske bina bhi poora kaam karta hai, kyunki walled-garden wala raasta hotspot ke certificate ko touch hi nahi karta.",
          },
        ],
      },
    ],
    stopGate:
      "walled-garden ip list khaali rahegi to koi bhi guest portal khol hi nahi payega — aur router pe kahin koi error nahi dikhega. Ye check kabhi skip mat karna.",
  },

  // ---------------------------------------------------------------------
  {
    id: "tunnel",
    n: 6,
    title: "Tunnel aur RADIUS",
    why: "OTP verify karne ke liye router ko tunnel ke through hub tak pahunchna hota hai — tunnel down to guest ka OTP hamesha spinner pe atka rahega.",
    estMinutes: 5,
    oncePerRouter: true,
    paste: [
      {
        label: "Firewall order + RADIUS src-address theek karo (WireGuard/RADIUS chunks ke baad)",
        script: `:put "==== TUNNEL FIXES ===="
:local a [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local d [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:if (([:len $a] > 0) && ([:len $d] > 0)) do={ /ip firewall filter move $a destination=$d; :put "firewall order: theek kar diya" }
:local tip ""
:foreach ad in=[/ip address find where interface="wg-cloudguest"] do={ :set tip [:pick [/ip address get $ad address] 0 [:find [/ip address get $ad address] "/"]] }
:if ($tip != "") do={ /radius set [find] src-address=$tip; :put ("radius src-address: " . $tip) }
:if ($tip = "") do={ :put "wg-cloudguest pe koi address nahi -- WireGuard chunk paste hua?" }
:put "===================="`,
      },
      {
        label: "Tunnel aur RADIUS zinda hai?",
        script: `:put "==== TUNNEL + RADIUS ===="
:foreach p in=[/interface wireguard peers find] do={ :put ("last-handshake : " . [:tostr [/interface wireguard peers get $p last-handshake]]) }
:local h ""
:foreach r in=[/radius find] do={ :set h [/radius get $r address] }
:put ("radius server  : " . $h)
:if ($h = "") do={ :put "RESULT: FAIL -- koi RADIUS entry nahi hai" }
:if ($h != "") do={
  :if ([/ping $h count=4] > 0) do={ :put "RESULT: PASS -- hub tak pahunch gaye" } else={ :put "RESULT: FAIL -- tunnel down hai" }
}
:put "===================="`,
      },
    ],
    checks: [
      {
        id: "tunnel-up",
        label: "Tunnel ke through hub tak ping ja rahi hai",
        command: "(upar wala tunnel check block chalao)",
        expect: "RESULT: PASS -- hub tak pahunch gaye",
        failFix: [
          {
            when: "last-handshake bahut purana hai ya blank hai",
            command: `:local a [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]
:local d [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]
:if (([:len $a] > 0) && ([:len $d] > 0)) do={ /ip firewall filter move $a destination=$d }`,
            note: "Sabse common wajah: firewall ka allow rule drop rule ke NEECHE aa gaya, to tunnel ka jawab hi block ho jata hai. Ye command usse upar utha deti hai. 30 second baad handshake aa jana chahiye.",
          },
          {
            when: "RESULT: FAIL -- koi RADIUS entry nahi hai",
            note: "Master console ka RADIUS chunk paste nahi hua. Dhyan rakho: RADIUS ke liye WireGuard pehle chahiye, isliye dono chunks order me paste karo.",
          },
        ],
      },
      {
        id: "radius-counters",
        label: "RADIUS ke counters (guest test ke baad dekhna)",
        command: "/radius monitor 0 once",
        expect: "accepts badhna chahiye. timeouts/rejects/bad-replies 0 rehne chahiye.",
        failFix: [
          {
            when: "timeouts badh rahe hain",
            note: "Packet hub tak pahunch hi nahi raha — tunnel wala check dobara chalao.",
          },
          {
            when: "rejects badh rahe hain",
            note: "Hub tak pahunch to raha hai par secret match nahi ho raha. Master console me Generate DOBARA mat karna — Phase 8 wala recovery follow karo.",
          },
          {
            when: "bad-replies badh rahe hain",
            note: "Jawab aa raha hai par router usse reject kar raha hai. Ye server side ki problem hai, router ki nahi — team ko batao.",
          },
        ],
      },
    ],
    stopGate:
      "Hub tak ping na jaye to guest ka OTP kabhi verify nahi hoga — spinner chalta rahega aur guest ko lagega app kharab hai.",
  },

  // ---------------------------------------------------------------------
  {
    id: "phonetest",
    n: 7,
    title: "Phone se asli test",
    why: "Router ke saare check pass ho sakte hain aur phir bhi guest ka experience toota ho — sirf asli phone hi sach batata hai.",
    estMinutes: 6,
    oncePerRouter: false,
    paste: [
      {
        label: "Live dekho — guest connect hua ya nahi",
        script: `:put "==== LIVE GUEST CHECK ===="
:put ("hosts (dikhe)   : " . [:tostr [:len [/ip hotspot host find]]])
:put ("active (login)  : " . [:tostr [:len [/ip hotspot active find]]])
:foreach a in=[/ip hotspot active find] do={ :put ("  -> " . [/ip hotspot active get $a user] . "  " . [:tostr [/ip hotspot active get $a address]]) }
:put "===================="`,
      },
    ],
    checks: [
      {
        id: "phone-mobiledata",
        label: "Phone pe mobile data BAND hai",
        command: "(phone settings me mobile data off karo, phir WiFi se connect karo)",
        expect:
          "Mobile data off — warna phone chupke se 4G use karega aur test jhoota pass ho jayega",
        failFix: [
          {
            when: "test pass lag raha hai par doubt hai",
            note: "Mobile data off kiye bina kabhi test mat karo. Phone background me 4G pe chala jata hai aur tumhe lagta hai WiFi chal raha hai.",
          },
        ],
      },
      {
        id: "phone-portal",
        label: "Portal khud khulta hai",
        command: "(WiFi connect karo, portal apne aap khulna chahiye)",
        expect: "Wyfy portal ka sign-in page — neela MikroTik page nahi",
        failFix: [
          {
            when: "kuch nahi khula",
            note: "Browser ka ADDRESS BAR kholo aur type karo: wifi.wyfyguest.com — search box me mat likhna, address bar me. Ye khud portal pe le jayega.",
          },
          {
            when: "neela MikroTik login page khula",
            note: "Portal ke redirect page router pe nahi chadhe. Phase 5 ka portal-files check dobara dekho.",
          },
          {
            when: "page load hi nahi hua / timeout",
            note: "walled-garden ip list khaali hogi. Phase 5 ka pehla block dobara chalao.",
          },
        ],
      },
      {
        id: "phone-otp",
        label: "OTP se login ho jata hai",
        command: "(apna asli number daalo, OTP daalo)",
        expect: "Login ke baad connected/session screen dikhni chahiye",
        failFix: [
          {
            when: "OTP daalne ke baad spinner chalta rehta hai",
            note: "Phase 6 ka tunnel check chalao — hub tak ping ja rahi hai ya nahi.",
          },
          {
            when: "login safal hua, internet bhi chal raha hai, par turant 'session expired' aa gaya",
            note: "Ye expiry NAHI hai. Guest ka browser storage block kar raha hai (iPhone ka WiFi login window, ya private browsing). Internet chal raha hai matlab router ka kaam poora ho gaya. Ye app side ki known problem hai — team ko batao, router pe kuch mat badlo.",
          },
        ],
      },
      {
        id: "phone-realsite",
        label: "Login ke baad asli internet chalta hai",
        command: "(koi nayi https site kholo jo pehle kabhi na kholi ho)",
        expect: "Site normal khulni chahiye",
        failFix: [
          {
            when: "portal to khula par baaki sab band hai",
            command: "/ip hotspot active print",
            note: "Agar yahan tumhara phone dikh raha hai to router ne login maan liya hai. Agar nahi dikh raha to login poora hua hi nahi.",
          },
        ],
      },
      {
        id: "phone-reconnect",
        label: "WiFi off/on karke dobara connect",
        command: "(phone ka WiFi band karo, 10 second ruko, wapas chalu karo)",
        expect: "Ya to seedha chal jaye, ya portal dobara khule aur login ho jaye",
        failFix: [
          {
            when: "reconnect ke baad 'connected' dikhta hai par internet nahi",
            note: "Ye purana known bug hai jo fix ho chuka hai. Agar phir bhi aaye to team ko batao — ye router ki nahi, portal app ki problem hai.",
          },
        ],
      },
    ],
    stopGate:
      "Ye phase pass hone tak router ko live mat maano. Baaki sab check pass hone ke baad bhi asli phone pe fail ho sakta hai.",
  },

  // ---------------------------------------------------------------------
  {
    id: "recovery",
    n: 8,
    title: "Kuch galat ho gaya",
    why: "Master console me dobara Generate dabate hi saare secret badal jaate hain, par router pe purane hi rehte hain — aur ye chup-chaap fail hota hai.",
    estMinutes: 8,
    oncePerRouter: false,
    paste: [
      {
        label: "Kya secret mismatch hai? (pehle ye check karo)",
        script: `:put "==== SECRET MISMATCH CHECK ===="
:local bad 0
:foreach l in=[/log find where message~"login failure for user cloudguest-api"] do={ :set bad ($bad + 1) }
:put ("login failure entries : " . [:tostr $bad])
:put "===================="
:if ($bad > 0) do={ :put "RESULT: MISMATCH -- Generate dobara dabaya gaya tha, niche wala reset chalao" } else={ :put "RESULT: OK -- secret mismatch nahi hai" }`,
      },
      {
        label: "Sirf secrets ka reset (router ka baaki config bacha rehta hai)",
        script: `/radius remove [find]
/interface wireguard remove [find name="wg-cloudguest"]
/user remove [find name="cloudguest-api"]
:put "purane secrets hata diye -- ab Master console me EK BAAR Generate karo aur naye WireGuard + RADIUS + API chunks paste karo"`,
      },
      {
        label: "Poora factory reset (jab kuch samajh na aaye)",
        script: `/system reset-configuration skip-backup=yes`,
      },
    ],
    checks: [
      {
        id: "rec-secrets-gone",
        label: "Purane secrets hat gaye",
        command: '/user print where name="cloudguest-api"',
        expect: "koi row nahi honi chahiye",
        failFix: [
          {
            when: "row abhi bhi hai",
            command: '/user remove [find name="cloudguest-api"]',
            note: "Ye command dobara chalao.",
          },
        ],
      },
      {
        id: "rec-regenerated",
        label: "Naye secrets chadh gaye",
        command: "/radius print detail",
        expect: "ek entry, address=hub ka tunnel IP, timeout=3s, disabled nahi",
        failFix: [
          {
            when: "do entries dikh rahi hain",
            command: "/radius remove [find]",
            note: "Sab hata do aur RADIUS chunk sirf ek baar paste karo. Do entry hone pe router galat wali try karta reh sakta hai.",
          },
          {
            when: "log me abhi bhi login failure aa raha hai",
            note: "Master console me Generate DOBARA mat dabao. Jo script pehle se generate hai wahi use karo — har Generate naye secret banata hai aur problem wapas aa jati hai.",
          },
        ],
      },
      {
        id: "rec-full",
        label: "Factory reset ke baad router mil raha hai",
        command: "/system routerboard print",
        expect: "model: wali line dikhni chahiye",
        failFix: [
          {
            when: "reset ke baad connect nahi ho raha",
            note: "2 minute wait karo. Laptop ka cable ether2 me. WinBox → Neighbors tab → MAC pe click. Login admin, password khaali. Phir Phase 0 se shuru karo.",
          },
        ],
      },
    ],
    stopGate:
      "Secret mismatch hone pe guests chalte rehte hain par Master console router ko control nahi kar pata — isliye ise 'baad me dekhenge' me mat daalo.",
  },
];
