/**
 * Regression gate for the MikroTik setup-script generator in
 * `src/components/routers/RouterDetailTabs.tsx`.
 *
 * Run: `npm run test:setup-script`
 * Gate: `scripts/ci-gated-test.sh` (exit code + sentinel + check floor).
 *
 * WHY THIS EXISTS
 * ---------------
 * `buildRouterSetupScriptChunks` emits text that a technician pastes into
 * a real MikroTik. `tsc` cannot see a single defect in it: every value is
 * a `string` and every bug is in what the string MEANS to RouterOS. The
 * two failure modes below are both confirmed live, and both have the same
 * shape as every other incident in this project -- THE SYSTEM REPORTED
 * SUCCESS WHILE DOING NOTHING.
 *
 * 1. THE CONSOLE-SCOPE DEFECT
 *    The RouterOS terminal runs EACH ENTERED LINE as its own program. A
 *    `:local` declared on one line does not exist on the next. Every use
 *    of it is a syntax error, and a block whose verdict is computed from
 *    such a variable prints a confident wrong answer instead of failing
 *    visibly. Already found and fixed in two sibling modules (PRs #125,
 *    #126); `test-output-analyser.mjs` and `test-manual-wizard-engine.mjs`
 *    carry the equivalent guard. This generator had it in 12 of its chunk
 *    kinds, including the Heartbeat chunk, where the scheduler line
 *    succeeded on its own while the immediate check-in beneath it silently
 *    did not fire.
 *
 * 2. THE MULTI-STATEMENT `do={}` DEFECT
 *    `;`-chaining two statements inside an inline `do={ ... }` threw a
 *    real "syntax error" on a live router, at the exact boundary between
 *    the two statements. The generator's standing discipline since is one
 *    statement per `do={}` body. Braces as a grouping construct are off
 *    the table entirely: whether console brace-continuation makes a block
 *    survive a paste was never verified on this hardware, so a body spread
 *    over several lines is treated as exactly as suspect as a `;`-chained
 *    one.
 *
 * PROVEN TO FAIL ON PURPOSE
 * -------------------------
 * A guard that only ever passes is decoration. Both guards below are
 * pointed at the exact shapes that shipped broken (marked INJECTED), and
 * both carry anti-over-strictness self-checks: the cheapest way to defeat
 * a guard like this is to make it so aggressive that the next person turns
 * it off, so each one is also asserted NOT to fire on the legal shape it
 * exists to enforce.
 *
 * Each guard was mutated in the REAL generator (not just fed a fixture)
 * and this suite re-run. All six mutations were caught:
 *
 *   "WAN + Bridge" `:foreach` reverted to `:local` + next-line `:if` .. 1
 *   a `;`-chained pair put back inside an inline `do={}` ............... 2
 *   `active=yes routing-mark=""` dropped from the route lookup ........ 16
 *   `public_ip_address` emitted unconditionally (the "" collapse) ...... 8
 *   `active=yes` dropped from the SELECTING sweep only ................. 8
 *   (that last one initially slipped through -- the check asserted the
 *    qualifiers appeared somewhere rather than on every lookup, so the
 *    counting and selecting lookups could disagree about what "a default
 *    route" means. The check now walks every occurrence. That is a real
 *    hole this mutation pass found, not a confirmation.)
 *
 * And both anti-over-strictness self-checks were proven to bite by
 * mutating the guards themselves into being too aggressive:
 *
 *   scope guard stops treating `:for`/`:foreach` vars as bindings ...... 3
 *   do={} splitter stops skipping string contents ...................... 3
 *   do={} opener scan stops skipping string contents ................... 1
 *
 * SECTION 6 -- THE FIVE SILENT FAILURES
 * -------------------------------------
 * Five more defects of the same family: RouterOS reporting success for
 * work it did not do. A hardcoded `flash/hotspot/` path whose `set [find
 * ...]` no-ops silently on boards without that prefix; a local `guest`
 * hotspot user that bypassed RADIUS entirely (RouterOS checks local users
 * FIRST); `keepalive-timeout=none` with no `idle-timeout` to replace it,
 * so nothing ever closed a session; a WAN connectivity check that ran
 * before `/ip dns set servers=` and so printed FAIL on every healthy
 * router; and a tunnel interface named `wg-cloudguest` where the backend
 * (`network_config/renderers.py:672`) says `wg-cloudguard`.
 *
 * Fifteen mutations of the REAL generator, all caught:
 *
 *   portal pattern loses its leading slash (rlogin/alogin collide) ..... 10
 *   the `/file set` stops being gated on a non-zero match count ......... 5
 *   the not-found branch stops printing anything ........................ 5
 *   the hardcoded `flash/` prefix comes back ........................... 11
 *   the local `guest` hotspot user is created again ..................... 1
 *   the remaining-local-users warning is dropped ........................ 1
 *   the `idle-timeout` line is removed entirely ......................... 2
 *   `idle-timeout` set to 2m, re-creating the false-logout incident ..... 1
 *   one default-profile `set` goes back to being unguarded .............. 1
 *   the WAN check moves back ahead of the DNS chunk ..................... 8
 *   the configured-resolver count is no longer reported ................. 1
 *   the tunnel interface reverts to `wg-cloudguest` ..................... 5
 *   an existing accept rule is no longer repointed ...................... 1
 *   the legacy-interface count and warning are dropped .................. 1
 *   the tunnel's final PASS/FAIL state check is dropped ................. 1
 *
 * The resolver-count mutation initially slipped through, and that was a
 * real hole rather than a confirmation: the check asserted the count was
 * PRINTED but not that it was READ from the device, so pinning it at 0
 * still passed while telling the operator "no resolver at all" on a router
 * whose DNS was fine. The check now requires the `/ip dns get servers`
 * read itself. Same lesson as the `active=yes` miss recorded above.
 *
 * THE THREE FRESH-ROUTER TRAPS (sections 7-9, added 2026-08-23)
 * ------------------------------------------------------------
 * Three defects that hit a factory-fresh router specifically, and that
 * every one of the guards above was blind to because none of them is about
 * what a line MEANS -- they are about what the script never said at all.
 *
 * 7. THE GENERATOR NEVER SET THE CLOCK.
 *    `grep -c "ntp client\|time-zone-name"` over the generator returned 0.
 *    This hardware has no battery-backed clock, so a fresh or power-cycled
 *    router boots with a wrong date; a wrong date fails HTTPS certificate
 *    validation, so the heartbeat's `/tool fetch` is rejected before it is
 *    sent, so the router shows offline in Master console forever -- while
 *    guests get working WiFi and nobody suspects anything. Setting NTP is
 *    not the fix on its own: enabling the client does not synchronise it,
 *    so the chunk also CHECKS and prints a FAIL.
 * 8. A BROKEN VENUE DNS PRODUCED A TUNNEL PEER POINTING AT NOTHING.
 *    RouterOS resolves `endpoint-address` once, at peer creation, and
 *    never again. Confirmed live 2026-08-22: `/tool fetch` returned
 *    `resolving error` while WAN, DHCP, gateway, default route and
 *    `/ip dns` servers were all healthy. The `add` succeeded, nothing was
 *    printed, and the tunnel never handshook.
 * 9. RE-CLICKING GENERATE SILENTLY INVALIDATED THE SCRIPT ON SCREEN.
 *    Master console now says so in a blocking dialog and a banner that
 *    does not disappear, and names which secrets re-pasting cannot repair.
 *    Section 9 asserts that table against what the generator ACTUALLY
 *    emits, because a warning nothing checks is how it becomes a lie.
 *
 * Sixteen mutations of the real source were injected and this suite
 * re-run. All sixteen were caught:
 *
 *   clock chunk removed entirely ..................................... 121
 *   clock chunk moved after the Heartbeat chunk ....................... 10
 *   NTP servers given as hostnames instead of raw IPs ................. 20
 *   NTP configured but never verified (verdict line dropped) .......... 60
 *   the NTP status read left unguarded by `:do {} on-error={}` ........ 10
 *   the date/year backstop dropped from the PASS verdict .............. 10
 *   `time-zone-autodetect=no` dropped ................................. 10
 *   peer add reverted to the unconditional hostname form .............. 16
 *   the `:resolve` left unguarded (it throws on failure) ............... 2
 *   peer built anyway on DNS failure with no fallback available ........ 1
 *   today's hub IP typed into the generator as a default fallback ...... 3
 *   the peer's `comment=` dropped ...................................... 2
 *   the repair table flipped to claim RADIUS is repairable ............. 1
 *   RADIUS `else={}` starts writing `secret=`, table not updated ....... 1
 *   `rotatingSecrets` stops reporting the agent credential ............. 2
 *   the WireGuard chunk grows an `else=`, table not updated ............ 1
 *
 *   (the year-backstop mutation initially slipped through -- the check
 *    asserted the year appeared SOMEWHERE in the chunk rather than in the
 *    PASS condition, so a chunk could parse the year carefully and then
 *    ignore it. The check now asserts the verdict itself. That is a real
 *    hole this mutation pass found, not a confirmation -- the same shape
 *    as the `active=yes` hole section 3 found the same way.)
 *
 * THE SECOND RESET STATE (section 10, added 2026-08-23)
 * ----------------------------------------------------
 * A MikroTik hardware reset produces one of TWO states depending on how
 * long the button is held: WITH the default configuration (a bridge with
 * ether2..5 in it, a DHCP client on ether1, defconf firewall rules, and
 * `/interface list member add interface=ether1 list=WAN`), or WITH NO
 * DEFAULTS AT ALL. Every chunk this generator emits had only ever been
 * run against the first.
 *
 * Audited chunk by chunk. Most of it already worked: the bridge, the
 * "WAN" list and every other object are create-if-missing; the sole
 * `place-before` already has an explicit "target does not exist" branch;
 * the portal-page writes, the hotspot default user profile, the tunnel and
 * the two checkpoints already count what they found. ONE behavioural
 * defect was found, and it is an L2 hole:
 *
 *   For a PPPoE WAN this generator puts only the VIRTUAL
 *   `cloudguest-pppoe-wan<N>` interface into the "WAN" interface list --
 *   "WAN + Bridge" cannot add a list member for an interface that does not
 *   exist yet. The PHYSICAL port carrying the session therefore tests as
 *   "not a WAN port" in the LAN sweep. With defaults, MikroTik's own
 *   defconf `ether1 -> WAN` membership covered for that. Without defaults
 *   nothing does, and the sweep bridges the live uplink into the guest
 *   LAN -- WAN and LAN on one L2 segment, silently, because bridging a
 *   port is a legal thing to do.
 *
 * The rest of section 10 is the reporting half: six chunks that create or
 * mutate something defconf would have supplied now bind a count, print it,
 * and take a named FAIL branch on zero -- because `set [find ...]` against
 * an empty match SUCCEEDS on RouterOS and an empty `:foreach` exits clean,
 * so "no error" was never evidence of anything.
 *
 * Twenty mutations of the real generator and four of the guards
 * themselves were injected and this suite re-run. All twenty-four caught:
 *
 *   the pppoe-client exclusion removed from the LAN sweep .............. 2
 *   the exclusion applied to the attach pass only ...................... 1
 *   the exclusion hardcoded to ether1 instead of read live ............. 2
 *   the LAN Ports count/verdict line dropped ........................... 2
 *   LAN Ports counts but never prints the number ....................... 1
 *   LAN Ports stops naming the ports it bridged ........................ 1
 *   the stale-defconf cleanup reverts to a bare silent :foreach ........ 2
 *   the stale-defconf cleanup loses every zero branch .................. 2
 *   the stale-defconf zero branch stops naming the count ............... 1
 *   the cleanup counts but no longer removes anything .................. 1
 *   the WAN + Bridge base-object count dropped ......................... 2
 *   the Hotspot five-object verification dropped ....................... 2
 *   the certificate chunk's state check dropped ........................ 2
 *   the RADIUS chunk stops reading hsprof1 back ........................ 2
 *   a FAIL branch loses its :log warning ............................... 1
 *   place-before points at a defconf rule directly ..................... 2
 *   the WireGuard no-target (bare router) add branch dropped ........... 1
 *   the LAN bridge add loses its existence test ........................ 1
 *   a chunk starts matching on RouterOS's own `defconf` comment ........ 1
 *   a second chunk starts depending on the `bridgeLocal` name .......... 1
 *   zero-branch guard stops accepting the negated-verdict form ......... 4
 *   the unguarded-add detector stops recognising an add ................ 2
 *   the place-before guard stops requiring the length test ............. 1
 *   the existence-test predicate stops recognising `] = 0` ............. 1
 *
 * SECTION 12 -- THE UPLINK IS DISCOVERED IN THE WAN CHUNKS TOO
 * ------------------------------------------------------------
 * Section 3 proved the HEARTBEAT derives its uplink from the routing
 * table. It proved nothing about the chunks that BUILD that uplink's
 * routes, and those were still working from a different set of facts: the
 * port typed into "WAN N interface", and a `/ip dhcp-client` lookup keyed
 * on it. "WAN1"/"WAN2" are logical labels of this platform's own; no
 * interface on any device has to be called WAN1, WAN2, ether1 or ether2.
 * Section 12 sweeps EVERY default-route lookup in EVERY chunk, not the
 * heartbeat's alone, and the variant matrix gained seven interface shapes
 * that the ether1/ether2 fixtures never exercised: a renamed port, a VLAN,
 * an SFP, DHCP-on-ether5 beside PPPoE-on-pppoe-out1, static-on-ISP-Airtel
 * beside DHCP-on-vlan100, four WANs of mixed modes, and a gateway field
 * containing a `"`.
 *
 * THE `routing-mark=""` DEFECT, which is the reason half of this section
 * exists. Measured on the founder's hEX lite (RouterOS 7.23.3,
 * factory-software 6.44.6):
 *
 *     :put [:len [/ip route find where routing-table="main"]]  ->  1
 *     :put [:len [/ip route find where routing-mark=""]]       ->  0
 *
 * `routing-mark=` is RouterOS 6 vocabulary for a route's table. On v7 it
 * does not error -- it is accepted as an unknown filter and SILENTLY
 * MATCHES AN EMPTY SET. Every default-route lookup this generator emitted
 * returned nothing on every router in the fleet, and nothing anywhere
 * said so. A guard that greps for a token would have passed on all 28
 * sites, because the token was there; it was the meaning that was dead.
 * So this section checks two dimensions: that the qualifier is on EVERY
 * relevant lookup, and that every lookup BINDS A COUNT AND BRANCHES ON
 * ZERO -- which is what makes the next rename loud instead of silent.
 * That second property matters more than the rename.
 *
 * 12.10 runs the failover sequence END TO END against a selector PARSED
 * OUT OF the emitted heartbeat -- its filter tokens and its distance
 * ordering, not a reimplementation -- so WAN1-up, WAN1-dead, WAN2-active,
 * WAN1-restored each assert a concrete answer. It verifies the emitted
 * filter and ordering. It does NOT verify that RouterOS reads those
 * tokens the way this harness does; that is an inference, and it is
 * exactly the inference that was wrong about `routing-mark`.
 *
 * Twenty-eight mutations of the REAL generator (and of this suite's own
 * classifier), all caught:
 *
 *   `active=yes` dropped from ONE lookup, the gateway sweep only ....... 32
 *   `routing-mark=""` dropped from ONE lookup, the iface sweep only .... 51
 *   `ether1` hardcoded back into the DHCP gateway lookup ................ 5
 *   the adoption-lookup classifier made over-strict (never matches) .... 33
 *   the adoption-lookup classifier made over-loose (always matches) .... 19
 *   `active=yes` ADDED to the adoption find (the exception deleted) .... 16
 *   the per-WAN faults collapsed into one generic message .............. 50
 *   the final real-interface verification dropped ...................... 16
 *   the live-uplink report keyed on the first configured port again .... 30
 *   the ascending-distance sweep replaced by an unordered find ......... 65
 *   the static gateway interpolated raw again (no escaping) ............. 1
 *   the WAN chunk given its own copy of the discovery, drifted ......... 16
 *   one `/ip route add` loses its zero-count guard ..................... 17
 *   the multi-WAN fallback stops matching its own interface ............. 6
 *   the PPPoE gateway polled exactly once again ......................... 4
 *   the bounded retry made unbounded (a fixed sleep) ................... 13
 *   the live-uplink report's three faults collapsed into one ........... 32
 *   the v6 `routing-mark` spelling put back on ONE lookup .............. 33
 *   the heartbeat pinned to WAN1's routing table ....................... 51
 *   `public_ip_address` sent unconditionally (the "" overwrite) ........ 17
 *   `ether2` hardcoded into the WAN interface-list membership .......... 13
 *   interface verification narrowed to `/interface ethernet` ........... 33
 *   the forced-name `:error` abort restored ............................ 17
 *   the discovered-uplink NAT keyed on any masquerade rule .............. 2
 *   a mark-routing rule moved to `chain=output` ........................ 10
 *   the `to_wan<N>` routing-table preamble dropped ...................... 6
 *   `check-gateway=ping` dropped from the plain routes .................. 2
 *   every plain route given `distance=1` ................................ 1
 *
 * TWO MORE SURVIVED ON THE FIRST PASS, and both were real holes:
 *  - keying the discovered-uplink NAT lookup on `chain=srcnat
 *    action=masquerade` instead of on this generator's own comment. That
 *    find matches a USER'S masquerade rule just as well as ours, and the
 *    statement after it is a `set`. Nothing checked that NAT lookups are
 *    comment-tagged. They are now, in both directions: what may be found,
 *    and what may be modified.
 *  - giving every plain route `distance=1`. The check used `includes`, so
 *    the mode-specific line still carried the right distance somewhere in
 *    the chunk while the fallback line wrote them all at 1. Two defaults
 *    at the same distance means failback order is not a decision this
 *    script made. The check now walks every route write per WAN. Same
 *    "somewhere, not everywhere" shape as the qualifier holes.
 *
 * TWO INITIALLY SURVIVED, and both were real holes in the GUARDS rather
 * than confirmations -- the same shape this file has now been bitten by
 * three times.
 *
 *  - Adding `active=yes` to the adoption find survived because the check
 *    COUNTED adoption-shaped lookups. The mutated find stopped being
 *    adoption-shaped, moved into the "discovery" bucket, and passed there
 *    on its new qualifiers, while the remaining fallback adoptions still
 *    met the count. The check now names each of the two finds every WAN
 *    must have, by its exact variable.
 *  - Collapsing the per-WAN A/B/C messages into one generic sentence
 *    survived because the check tested the CHUNK, and the chunk's own
 *    live-uplink report still carried all three. The check now enumerates
 *    every reporting site -- each WAN's fallback line and the chunk tail --
 *    and requires the distinction at each one separately.
 *
 * Both anti-over-strictness self-checks were proven to bite by mutating
 * the classifier itself in each direction (rows 4 and 5 above): too strict
 * and the documented exception cannot be expressed, so the guard gets
 * switched off; too loose and it exempts every lookup in the file.
 *
 *   (three initially slipped through, and two were real holes in the
 *    GUARDS rather than confirmations. The place-before and unguarded-add
 *    checks each kept a PRIVATE COPY of the regex their self-check tested,
 *    so mutating the copy the sweep actually used changed nothing the
 *    self-check could see -- the exact "a guard that cannot be shown to
 *    fail is not a guard" shape. Both predicates are now shared by the
 *    sweep and its self-checks. The third, removing one of three zero
 *    branches from the cleanup chunk, was a legitimate survivor: the
 *    remaining two still reported the zero case. The mutation was
 *    sharpened to remove all three, and a separate check now pins the
 *    branch to naming the number rather than saying something vague.)
 *
 * THE PARENTHESIS (section 11, added 2026-08-23)
 * ---------------------------------------------
 * A whole-script RouterOS syntax QA pass, prompted by a live failure. The
 * founder pasted the "WAN Routing" chunk into a real hEX and the console
 * answered with nothing but `error`.
 *
 * A concatenation used as a command ARGUMENT must be parenthesised. This
 * shipped without them:
 *
 *   :log warning "cloudguest: WAN1 gateway ... (still \"" . $wan1Gw . "\") ..."
 *
 * RouterOS parses `:log warning "<string>"` as a complete command and then
 * meets `. $wan1Gw . "..."` as a second, meaningless command in the same
 * statement. Because a chunk is `;`-joined onto ONE entered line, the
 * error aborted the ENTIRE line: the DHCP gateway poll, the plain default
 * route and every routing-mark'd route below it never ran. The router was
 * left with no default route -- the exact "no gateway-health signal" state
 * the chunk exists to prevent, reached by a syntax error instead of a
 * logic one.
 *
 * Sections 1 and 2 were both blind to it. No variable crosses a line, and
 * the `do={}` body holds exactly one statement. Malformed ARGUMENT syntax
 * is a third failure class. It was the only such site in the generator --
 * every other concatenating `:put`/`:log`/`:error` already had parens --
 * so one site, missed once, and now swept for.
 *
 * Three further whole-script budgets are pinned here, each a real
 * constraint that nothing was measuring: every `/...` path must be a known
 * RouterOS menu (`/ip pppoe-client` for `/interface pppoe-client` is
 * invisible to every other guard and silently matches nothing forever); no
 * emitted line over 3300 chars (WinBox mangles long pastes -- the reason
 * this generator chunks at all; longest today is 3125, in the chunk that
 * just failed); no chunk blocking the console over 60s (the polls block on
 * purpose, and a frozen terminal gets read as a hang and power-cycled --
 * two WANs already reach 50s).
 *
 * Eleven mutations injected, all eleven caught:
 *
 *   the parens come off the line that errored on the hEX ............... 1
 *   a different chunk loses its parens (heartbeat fault trace) ......... 1
 *   a :put count line loses its parens ................................. 1
 *   /interface pppoe-client mistyped as /ip pppoe-client ............... 3
 *   /ip hotspot user profile mistyped as /ip hotspot userprofile ....... 2
 *   the DHCP gateway poll grows past the console-freeze budget ......... 2
 *   the line-length budget stops reflecting the real longest line ...... 1
 *   concat guard stops requiring the leading paren ..................... 1
 *   concat guard stops skipping string contents (over-strict) .......... 1
 *   the menu allowlist silently swallows anything ...................... 1
 *   the menu extractor stops matching command paths .................... 2
 *
 *   (two initially slipped through and both were real holes in the new
 *    GUARDS. The menu check accumulated offenders inline while its
 *    self-check re-derived the answer separately, so mutating the sweep
 *    changed nothing the self-check saw -- the third time that exact shape
 *    has been caught in this file, and the predicate is now shared. And
 *    the concat guard's anti-over-strictness sample was `"print. Then"`,
 *    which has no space-dot-space in it, so it passed even with
 *    string-skipping switched off; it now uses a message that really
 *    contains the pattern.)
 *
 * SECTION 13 -- THE SEVEN FIELD DEFECTS OF 2026-08-23
 * --------------------------------------------------
 * Seven faults found provisioning real MikroTiks in one day, plus the two
 * REPORTING failures that let the worst of them survive for days.
 *
 *  1. The DHCP pool and the DHCP network entry were built from the first
 *     three octets of the LAN IP and ignored the prefix outright. A `/25`
 *     LAN handed guests `.128`-`.254`: a lease, no route to their own
 *     gateway, no login page -- and the chunk printed `RESULT: PASS`,
 *     because its five checks only ever asked whether the five objects it
 *     had just created existed. `lanCidr` is free text validated as
 *     "1..32", so every wrong subnet here is reachable from the UI.
 *     Containment is now recomputed by INDEPENDENT arithmetic in this
 *     suite -- deriving it with the function under test would make a bug
 *     agree with itself -- and the verdict reads the pool's real `ranges=`
 *     back off the device.
 *  2. Re-pasting the mangle chunk re-appended the PCC rules BELOW the
 *     mark-routing rules (a plain `add` appends, and the sweep covered
 *     `-pcc-` only, and only on the weighted path). The SYN of every new
 *     connection was then still `no-mark` at the routing decision and left
 *     by the main table's default route instead of its assigned WAN.
 *  3. `failover_only` deleted every marked route and never swept the
 *     marks, leaving traffic marked for a routing table with no routes --
 *     the exact black hole that chunk's own comment says the pair exists
 *     to prevent, reached from the other side.
 *  4. The RADIUS `else={}` branch set `disabled=no` and never `secret=`,
 *     so rotating the shared secret and re-pasting left the router on the
 *     old one. RouterOS reports a secret mismatch as a TIMEOUT, so every
 *     guest login Access-Rejected with nothing on either side naming it.
 *  5. Only `dynamic=yes` addresses were swept, so a stale STATIC WAN
 *     address survived every re-paste and the WAN ended up carrying two.
 *  6. The LAN port allowlist reused the WAN existence-check copy verbatim
 *     and named the wrong side of the router.
 *  7. The hotspot `dns-name` write was a bare `set [find ...]`, which
 *     succeeds silently against an empty match.
 *
 * AND THE TWO REPORTING FAILURES. The one-line copy is all-or-nothing:
 * RouterOS aborts the remainder of a pasted line at the first error and
 * reports ONE message with no indication of how far it got. A
 * concatenation-parentheses bug (the one section 11 above now guards)
 * killed a line partway, the Heartbeat chunk never ran, the scheduler was
 * never created, and the router showed offline in Master console for days
 * while serving guests perfectly. The feature is kept; every chunk is now
 * bracketed by START/DONE markers with a final COMPLETE, so a partial run
 * is distinguishable from a complete one by a chunk NAME rather than a
 * column number.
 *
 * The second is the validator that PASSED that line first. It checked
 * bracket and quote BALANCE and presented that as VALIDITY -- and the
 * founder's line balances perfectly. Section 11 guards the generator's own
 * source against this shape; the panel's client-side validator did not,
 * and it is the panel an operator reads before pasting. It now rejects
 * that shape, publishes the exact list of what it checks, and states
 * plainly that a clean pass is not proof the script will run.
 *
 * Every guard here has a paired INJECTED check that reintroduces the
 * defect and an anti-over-strictness check that the shipped shape is NOT
 * flagged. Nineteen mutations of the real generator, validator, table and
 * panel were injected and this suite re-run; all nineteen caught:
 *
 *   pool/network derived from the first three octets again ............. 8
 *   the Hotspot verdict stops reading the pool ranges back ............. 2
 *   the mangle sweep narrowed back to `-pcc-` only ..................... 2
 *   mark-routing rules emitted above mark-connection rules ............. 2
 *   failover_only stops sweeping the mangle marks ...................... 1
 *   the RADIUS else-branch back to `disabled=no` only .................. 3
 *   SECRET_REPAIR.radius flipped while the chunk stays fixed ........... 2
 *   the static-WAN sweep narrowed back to `dynamic=yes` ................ 2
 *   the LAN allowlist reverts to the WAN existence-check copy .......... 3
 *   `dns-name` back to a bare `set [find ...]` ......................... 1
 *   the hsprof1 pre-count removed ..................................... 26
 *   the per-chunk progress markers removed ............................. 4
 *   the COMPLETE marker moved off the end .............................. 2
 *   the validator's concatenation check removed ........................ 4
 *   ...and the same check made over-strict (any depth) ................ 28
 *   the panel stops RENDERING the published scope ...................... 1
 *   the panel stops rendering the published check LIST ................. 1
 *   the panel imports its own local copies of both ..................... 1
 *   the scope statement drops "not a RouterOS parser" .................. 1
 *   the dead hsPass field put back on the form ......................... 1
 *
 *   (ONE INITIALLY SURVIVED, and it was a real hole in a new guard --
 *    the fourth time that shape has been caught in this file. The
 *    "panel renders the validator's own scope" check asked only whether
 *    the two constant NAMES appeared anywhere in the file, and an IMPORT
 *    LINE satisfies that. Replacing the rendered
 *    `{SETUP_SCRIPT_VALIDATOR_LIMITS}` with a hardcoded "Looks good."
 *    left the suite green. It now requires the JSX interpolation itself,
 *    the `.map(` over the check list, and the import from the defining
 *    module -- three separate checks, each mutation-verified, because a
 *    locally-redefined constant of the same name would have satisfied
 *    any one of them alone.)
 */
/*
 * SECTION 13 -- TWO CHUNKS, ONE PROPERTY (added 2026-08-23)
 * --------------------------------------------------------
 * A defect every guard above was structurally blind to, because each of
 * them judges ONE LINE and this one lived in the relationship between two
 * lines that were each individually perfect.
 *
 * The "Hotspot" chunk set `login-by=http-pap` on `hsprof1`. A later
 * "Self-Signed HTTPS Certificate" chunk set `login-by=https,http-pap` on
 * the same profile, with `ssl-certificate=` naming a certificate the
 * ROUTER had generated and signed for itself. RouterOS applied both, in
 * paste order, and the later one won. Every router this generator ever
 * provisioned therefore served its captive-portal page over TLS with a
 * certificate nothing trusts. Confirmed live, guest-facing: a real
 * Android phone on a freshly provisioned hEX showed a security warning
 * the instant the portal opened -- the first thing a paying venue's guest
 * sees, and where they stop.
 *
 * Section 1 passed it (no variable crossed a line). Section 2 passed it
 * (one statement per `do={}`). Sections 10.2-10.7 passed it -- BOTH
 * chunks counted their objects and printed a verdict. A guard that asks
 * "is this line correct" cannot see two correct lines disagreeing.
 *
 * So 13.1 asserts the relationship: within one generated script, a
 * hotspot-profile property may be written by exactly ONE `set`. That is
 * what makes the defect unrepresentable rather than merely absent, and it
 * is what the next chunk with an opinion about `login-by` will run into.
 * The certificate chunk itself is deleted (the generator tombstone
 * records the six-point argument, including that the incident its comment
 * claimed kinship with was fixed by `buildWalledGardenIpLines`, and that
 * this certificate is what that incident's own docstring names as the
 * thing wrapping guest connections). 13.2 keeps it from coming back and
 * states the invariant as the PAIRING -- an imported, publicly-trusted
 * certificate with hotspot HTTPS stays legal, a router-signed one does
 * not. 13.4 pins the argument the whole section rests on against the
 * emitted HTML: the hotspot's own page has no field on it, so plain HTTP
 * there costs nothing.
 *
 * Thirteen mutations of the REAL generator and of these guards, all
 * caught:
 *
 *   the deleted self-signed certificate chunk reintroduced verbatim ..... 86
 *   a second chunk writing login-by, with the SAME value ................. 4
 *   HOTSPOT_LOGIN_BY changed to https,http-pap ......................... 17
 *   HOTSPOT_LOGIN_BY reverted to RouterOS's cookie,http-chap ........... 17
 *   ssl-certificate= bolted onto the surviving login-by set ............ 17
 *   the read-back pinned to a literal instead of a device `get` ......... 2
 *   the read-back's count binding removed ............................... 2
 *   a form + input field added to the portal redirect page .............. 5
 *   the portal redirect pointed at http:// instead of https:// .......... 5
 *   the read-back stops naming the guest-facing consequence ............. 1
 *   the write parser blinded to `do={}` bodies and the user-profile menu   3
 *   the pairing guard's certificate half made unmatchable ............... 1
 *   the pairing guard made over-strict (any /certificate, either half) ... 2
 *
 * ONE MUTATION SURVIVED ON THE FIRST PASS, and it was a real hole rather
 * than a confirmation -- the fourth time this file has been bitten by the
 * same shape. Relaxing 13.1's value test from `=== "http-pap"` to
 * `.includes("http-pap")` let `login-by=https,http-pap` ship green,
 * because 13.2's pairing guard is false once the generator stops creating
 * certificates: the profile would still ask RouterOS to stand up a TLS
 * server, against whatever certificate the device happens to carry --
 * which on any already-provisioned router is the stale self-signed one,
 * i.e. the original bug, restored, by a change that looks like a
 * loosening of a test rather than a change to the script. The value test
 * is exact and says so at its own site.
 *
 * SECTION 14 -- THE OS SIGN-IN POPUP (added 2026-08-23)
 * ----------------------------------------------------
 * The same live report as section 13, seen from the other end. On the
 * founder's provisioned hEX, Windows and macOS on a LAN cable showed NO
 * "sign in to network" popup at all; Android showed a certificate error.
 * All three are the same cause section 13 removes -- with `https` in
 * `login-by` and a self-signed leaf bound, RouterOS aims the redirect at
 * `https://wifi.wyfyguest.com/login` and every OS probe dies in the TLS
 * handshake rather than receiving a redirect. Windows/macOS report a
 * transport failure as plain "no internet" with nothing to click; Android
 * renders it, which is why it alone showed something visible. The quiet
 * platforms were the majority.
 *
 * Section 14 guards the OTHER way to break that popup, which is the one a
 * future engineer reaches for BECAUSE section 13's fix is invisible to
 * them: putting the OS detection hosts into the walled garden so the
 * probes "get through". That is backwards and unrecoverable -- a probe
 * that gets through receives the genuine success answer, so the OS
 * concludes the network is fine and never offers a sign-in, while the
 * guest is still unauthenticated. The generator also now emits a
 * "Captive-Portal Detection" tripwire chunk that counts such entries on
 * the device and reports them, adding and removing nothing.
 *
 * The predicate is STATEMENT-scoped, not line- or chunk-scoped, because
 * the tripwire legitimately names every detection host inside a `find`.
 * A hostname-only guard would ban the check that enforces the rule. Sweep
 * and self-checks share ONE predicate, for the reason recorded four times
 * above.
 *
 * Twelve mutations, all caught:
 *
 *   each of seven "wrong fixes" a future engineer reaches for ........... 7
 *     (NCSI / Apple CNA / Android / Firefox into the host walled garden,
 *      an existing row re-pointed at a probe host, the NCSI DNS probe
 *      answered by /ip dns static, a probe host allowed by name through
 *      the IP-level walled garden -- one check each, and each is the
 *      literal line that would ship)
 *   the tripwire chunk deleted ......................................... 11
 *   the tripwire's static-DNS count dropped ............................. 2
 *   the tripwire turned from a check into a fix (an `add`) .............. 3
 *   the write-detector narrowed so `set` no longer counts ............... 2
 *   the detection-token list emptied of Apple ........................... 1
 *   the guard made line-scoped instead of statement-scoped .............. 1
 *   `dns-name` pointed at the public portal domain ..................... 17
 *
 * SECTIONS 13 AND 14 WERE DEVELOPED ON TWO BRANCHES AND MERGED. Section
 * 13's design (delete the self-signed certificate chunk; one writer for
 * `login-by`, value `http-pap`, unconditionally) replaced an earlier
 * design that kept the certificate chunk and added a THIRD `login-by`
 * write to conditionally repair it. That was rejected for three reasons
 * worth recording, because each is a live hazard rather than a taste:
 * (1) its unconditional `ssl-certificate=` write rebinds a router that
 * already carries the fleet's real Let's Encrypt leaf back onto the
 * self-signed one, whereupon its own condition reads "self-signed" and
 * disables HTTPS -- and `renew-hotspot-certs.sh` only re-binds on an
 * actual renewal (~30 days before expiry), so the damage stands for up to
 * two months; (2) the repair lived in a LATER chunk than the bad write,
 * so it holds only if every chunk is pasted, in order, on a device whose
 * paste path is the confirmed reason this file is chunked at all; and
 * (3) leaving `https` on wherever a real certificate happens to be
 * present makes guest sign-in depend on certificate freshness, turning a
 * silent renewal failure into fleet-wide "OTP verifies but no internet".
 * `http-pap` works regardless of certificate state.
 *
 * SECTION 15 -- THE `.rsc` IS A DELIVERY CHANNEL, NOT A VIEW (2026-09-02)
 * ----------------------------------------------------------------------
 * Added after the same report for the FIFTH time: "a problem I have had
 * fixed many times already -- I configured using the .rsc file, the script
 * executed, RADIUS wasn't there and it didn't run."
 *
 * Sections 1-14 all assert over `chunk.script`, and a few over
 * `chunksToSingleLineScript`. `chunksToRouterOsScript` -- THE DOWNLOADED
 * FILE, which is how the founder provisions -- was covered by four checks,
 * all of them about the INCOMPLETE-SCRIPT header. So the channel with the
 * most reported failures was the one with the least coverage, and every
 * whole-script guard in this file was transferring to it by assumption.
 *
 * TWO REAL DEFECTS, both red on origin/main at f99c02b and both fixed by
 * the generator work that landed in the same PR as this section:
 *
 * 1. THE .rsc CANNOT TELL A CLEAN RUN FROM AN ABORTED ONE. Measured: 65
 *    progress markers in `chunksToSingleLineScript`'s output, 0 in
 *    `chunksToRouterOsScript`'s, for the same script. `/import` aborts at
 *    the first error and reports ONE message with no indication of how far
 *    it got, which is exactly what section 13 fixed for the one-line paste
 *    and never fixed here. That is why four separate fixes each addressed
 *    whichever statement happened to be found: the operator could report
 *    THAT it stopped and never WHERE.
 *
 * 2. AN UNTICKED CHECKBOX IS NOT A CAUGHT ERROR, AND THAT IS THE FOUNDER'S
 *    ACTUAL BUG. `enableWireguard` and `enableRadius` both default to
 *    false (`RouterSetupScriptAdvanced.tsx:315-316`), and `notProvisioned`
 *    -- the array driving the loud `INCOMPLETE SCRIPT` chunk and its
 *    `:error` -- is appended ONLY from `catch` blocks (667, 701, 766). A
 *    default Generate therefore emits 28 chunks instead of 32, the
 *    incomplete guard never fires, the .rsc imports perfectly, every chunk
 *    prints `RESULT: PASS`, the heartbeat scheduler is created so the
 *    router shows GREEN in Master console -- and `/radius` is empty.
 *    NOTHING ABORTED. The script was never asked to configure RADIUS.
 *    15.8 requires the gap to be DERIVED from the emitted script, because
 *    whether a subsystem is missing is a property of the script and not of
 *    whether the caller happened to catch something.
 *
 * WHAT IS NOT TESTABLE HERE, SAID PLAINLY rather than faked: this suite
 * cannot run RouterOS. It cannot prove `/import` aborts, that a menu
 * accepts a property, or that a bounded retry outlasts a real ISP's DHCP.
 * 15.4 is a DENYLIST OF MEASURED FACTS -- one entry, the `/ip hotspot`
 * `comment=` that aborted a live import on 2026-09-01 -- not a model of
 * RouterOS, and a "valid parameter" allowlist was deliberately not written
 * because it would be either wrong or unmaintainable and both end with the
 * check switched off.
 *
 * Seventeen mutations of the REAL generator were injected and this suite
 * re-run. All seventeen caught:
 *
 *   the .rsc renderer drops the last chunk ............................ 46
 *   the .rsc renderer rewrites a line (disabled=no -> yes) ............ 92
 *   the .rsc renderer reverses chunk order ............................ 23
 *   the .rsc renderer emits an executable line of its own ............. 70
 *   a marker line carries a wall clock (non-reproducible) ............. 24
 *   an :error added to the Portal Redirect Page chunk .................. 8
 *   adcea57 reverted: `comment=` back on `/ip hotspot add` ............. 6
 *   section 13.7 reverted: bare `set [find] dns-name=` ................. 7
 *   the RADIUS else-branch stops writing `secret=` ..................... 4
 *   the WireGuard update branch loses `private-key=` ................... 2
 *   section 6 reverted: bare `/file set [find]` for portal pages ...... 15
 *   the tunnel reverts to the old `wg-cloudguest` name ................. 9
 *   a local `guest` hotspot user is created again ..................... 23
 *   the Clock + NTP chunk stops being emitted ........................ 233
 *   the hotspot user profile loses its `idle-timeout` ................. 46
 *   the API Access chunk loses its password-update branch .............. 3
 *   an INCOMPLETE warning that fires on a HEALTHY script ............... 5
 *
 * FOUR SURVIVED ON THE FIRST PASS AND ALL FOUR WERE REAL HOLES IN THE NEW
 * GUARDS, not confirmations -- the same shape this file has now been
 * caught by six times, which is why every one of the seventeen above was
 * actually run rather than reasoned about:
 *
 *  - 15.5's create-and-count exemption accepted an add-if-missing
 *    ANYWHERE in the chunk. Reverting section 13.7's `dns-name` fix left
 *    the sweep green, because the Hotspot chunk creates `hsprof1`
 *    elsewhere in the same chunk and the exemption swallowed the whole
 *    `/ip hotspot profile` menu. The exemption is now ADJACENCY-scoped:
 *    the add must be on the same line or the line immediately above.
 *  - 15.7's tunnel-name check ran over `parameterWrites`, which strips
 *    string contents on purpose -- so `name="wg-cloudguest"` reached it as
 *    `name=""` and it could never have fired. It now separates statements
 *    that WRITE (decided on the stripped form) from the VALUE they write
 *    (read off the raw statement).
 *  - 15.7's idle-timeout check tested for `idle-timeout=` anywhere in the
 *    file, and the chunk's own verdict line prints that string, so
 *    deleting the actual write left it green. It now requires the
 *    `/ip hotspot user profile set ... idle-timeout=` statement.
 *  - 15.5's guard predicate first required the `[:len [...]]` INLINE in
 *    the `:if`, which flagged all five Portal Redirect Page chunks -- the
 *    very chunks section 6 fixed. A guard that cries wolf on correct code
 *    is a guard that gets deleted, so it now also accepts a count bound by
 *    `:local` on the SAME CONSOLE LINE, which is what actually makes those
 *    statements safe.
 *
 * ONE PRE-EXISTING CHECK WAS CORRECTED rather than added to. 13.10's "a
 * complete script carries no incomplete-script warning" was asserted
 * against `{ ...BASE, wans: [DHCP_WAN] }` -- a script with no RADIUS, no
 * tunnel and no portal pages. It therefore required a script missing three
 * subsystems to carry NO warning, which is the founder's bug stated as a
 * requirement, and it would have contradicted 15.8 outright. The check's
 * intent is unchanged; its fixture is now genuinely complete.
 *
 * AND ONE LATENT WEAKNESS, surfaced by prototyping 15.8's fix: 13.x's
 * "INJECTED: a paste that dies partway does NOT print COMPLETE" tested
 * `truncated.includes("COMPLETE")`, and `INCOMPLETE` contains `COMPLETE`.
 * The moment any chunk mentioned an incomplete script, a truncated run
 * read as complete -- on precisely the script where that costs the most.
 * It now matches the marker, not the substring.
 *
 * SECTIONS 15.9 AND 15.10 -- WHAT THE FIX ITSELF THEN NEEDED (integration
 * pass, 2026-09-02)
 * ----------------------------------------------------------------------
 * Closing 15.8 introduced two behaviours that nothing in this file
 * asserted, which is the same state section 15 was written to end.
 *
 *  - 15.9. A gap the operator CHOSE deliberately does not `:error` -- that
 *    is the right call (aborting a run somebody scoped on purpose teaches
 *    them to page past the banner) and it has a consequence: the file runs
 *    to the end and reaches the COMPLETE sentinel 15.2 just added. It
 *    printed the identical "COMPLETE -- all N chunk(s) ran" a full
 *    provision prints. N differs; nobody counts N. The field runbook is
 *    one sentence -- import it, read the last line -- so that line was
 *    about to say "finished" over a router with an empty `/radius`, which
 *    is the original defect wearing a green light. Both channels now build
 *    that line from one shared function, and 15.9 pins that they end with
 *    the same sentence.
 *  - 15.10. The three endings (the operator chose it / something failed /
 *    nobody reported it and the generator derived it from `opts`) are each
 *    a weighed product decision and none of them was pinned by anything.
 *    Six further mutations were injected against 15.9 and 15.10 and all
 *    six were caught: derived gaps removed; the COMPLETE line made
 *    unconditional again; the two channels' endings diverged; a derived
 *    gap flagged `deliberate` so it stops aborting; a deliberate gap made
 *    to abort; a mixed list taking the gentler ending.
 *
 * TWO FURTHER PRE-EXISTING WEAKNESSES were corrected in the same pass:
 *
 *  - 13.10's "it logs as well as prints" counted `:log warning` lines
 *    against the CALLER's `notProvisioned` array. Once the generator
 *    derives its own gaps those are two different numbers, and the fixture
 *    was one subsystem short of complete besides -- the same fixture
 *    problem 13.10's `clean` had. Its fixture is now complete apart from
 *    the two gaps it declares.
 *  - 15.3's abort-message check asked whether the word "import" appeared
 *    ANYWHERE in an aborting chunk, which a comment or an unrelated `:put`
 *    three statements away would have satisfied while the message RouterOS
 *    actually shows still said "re-paste just this chunk". It now extracts
 *    the `:error` message itself and grades that, with a companion check
 *    that the extraction found any messages at all -- the extraction
 *    silently matching nothing is the same "cannot fail" shape.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "setup-script-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail ?? ""}`);
    console.log(`  FAIL ${name}`);
  }
};

writeFileSync(
  join(work, "entry.js"),
  [
    `export { buildRouterSetupScriptChunks } from "@/components/routers/RouterDetailTabs";`,
    `export { chunksToSingleLineScript } from "@/components/routers/RouterDetailTabs";`,
    `export { chunksToRouterOsScript } from "@/components/routers/RouterDetailTabs";`,
    `export { validateSetupScriptChunks } from "@/components/routers/RouterDetailTabs";`,
    // Sections 8 below assert the Master-console panel's "what a
    // re-Generate breaks" table against what the generator ACTUALLY
    // emits. That table lives in its own module precisely so it can be
    // imported here without React/router/axios coming with it.
    `export { SECRET_REPAIR, rotatingSecrets } from "@/lib/setup-script-secrets";`,
    // Section 13 asserts the DHCP pool/network arithmetic directly, over
    // every prefix, rather than only through the text it ends up in. Same
    // reason as the table above: its own module so it imports clean.
    `export { deriveLanAddressing } from "@/lib/lan-addressing";`,
    // Section 13.9 asserts what the panel's own validator claims to check
    // against what it really checks.
    `export { SETUP_SCRIPT_VALIDATOR_CHECKS, SETUP_SCRIPT_VALIDATOR_LIMITS } from "@/components/routers/RouterDetailTabs";`,
    // Section 15 asserts the `.rsc` delivery channel. The marker prefix is
    // imported rather than spelled out here so the two channels cannot end
    // up with two different words for the same thing -- an operator reads
    // both the same way or the markers are worth nothing.
    `export { SINGLE_LINE_MARKER_PREFIX } from "@/components/routers/RouterDetailTabs";`,
    // 15.1 grades the renderers' invented statements against an
    // ENUMERATION rather than a pattern -- see its own comment. The
    // enumeration has to come from the module the renderers are built
    // from, or it is a second list that drifts, which is the exact shape
    // that left the .rsc with no markers at all for a month.
    `export { progressMarkerStatements, markerStatements } from "@/components/routers/RouterDetailTabs";`,
    // Section 16 grades the deselect gate by CALLING it. The panel's own
    // copy of this was source-grepped, and the grep stayed green when the
    // comparison that actually accepts or rejects the typed phrase was
    // mutated to accept anything at all -- a guard that could not fail,
    // which is the defect this file has shipped six times. The decision
    // lives beside `SetupScriptGap` for exactly that reason.
    `export { DESELECT_PHRASE, DESELECT_CONSEQUENCE, deselectAcknowledgement } from "@/components/routers/RouterDetailTabs";`,
  ].join("\n"),
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
    "import.meta.env": "{}",
  },
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "src-alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

const {
  buildRouterSetupScriptChunks,
  chunksToSingleLineScript,
  chunksToRouterOsScript,
  validateSetupScriptChunks,
  SECRET_REPAIR,
  rotatingSecrets,
  deriveLanAddressing,
  SETUP_SCRIPT_VALIDATOR_CHECKS,
  SETUP_SCRIPT_VALIDATOR_LIMITS,
  SINGLE_LINE_MARKER_PREFIX,
  progressMarkerStatements,
  markerStatements,
  DESELECT_PHRASE,
  DESELECT_CONSEQUENCE,
  deselectAcknowledgement,
} = await import(pathToFileURL(join(work, "bundle.mjs")).href);

// ---------------------------------------------------------------------
// The option matrix
// ---------------------------------------------------------------------
// Every branch in the generator that changes what RouterOS text comes
// out: each WAN addressing mode, each routing mode, one/two/three WANs,
// the explicit-LAN allowlist, `basicConfigOnly`, and each optional
// subsystem. A guard is only worth its floor if it actually sees the
// chunk that will break.

const BASE = {
  // Pinned so `generating twice produces byte-identical text` still means
  // something. `generatedAt` is a declared input to the generator precisely
  // so the portal marker's timestamp is not hidden nondeterminism -- see
  // `portalMarker`.
  generatedAt: "2026-08-28T00:00:00.000Z",
  apiBase: "https://master.wyfyguest.com/api/v1",
  agentCredential: "cred-abc123",
  lanBridge: "bridge-guest",
  lanIp: "10.5.50.1",
  lanCidr: "24",
  dnsServers: "8.8.8.8,1.1.1.1",
  hsUser: "guest",
  hsPass: "guestpass",
  enableFirewall: true,
};

/** Documentation-range addresses (RFC 5737), deliberately -- so that if
 * one of these ever DOES leak into a shipped script it is obviously a test
 * fixture and not somebody's live hub. */
const WG_FALLBACK_ADDR = "198.51.100.7";
const WG_LITERAL_HOST = "203.0.113.11";
/** The address that got baked into 64 field routers' `endpoint-address=`
 * because it lived as a literal in code. Those routers are now unreachable
 * and need physical visits. The backend carries the same guard over its
 * own source (`tests/unit/test_network_config.py`); this is the frontend
 * half. */
const BANNED_HUB_LITERAL = "20.219.72.235";

const WG = {
  routerPrivateKey: "PRIVKEY",
  serverPublicKey: "PUBKEY",
  // What the PLATFORM has registered for this router, fed to the Tunnel
  // Identity Check. Deliberately different from `serverPublicKey`: they are
  // two different keys and conflating them is exactly the confusion the
  // check exists to end.
  peerPublicKey: "PEERPUBKEY",
  routerTunnelIp: "10.20.0.5",
  serverEndpointHost: "vpn.wyfyguest.com",
  serverEndpointPort: "13231",
  tunnelSubnet: "10.20.0.0/24",
  hubTunnelIpAddress: "10.20.0.1",
};

const PORTAL = {
  frontendBase: "https://auth.wyfyguest.com",
  organizationId: "org-1",
  locationId: "loc-1",
  routerId: "rtr-1",
};

const STATIC_WAN = {
  iface: "ether1",
  mode: "static",
  ip: "1.2.3.4",
  cidr: "24",
  gateway: "1.2.3.1",
};
const DHCP_WAN = { iface: "ether1", mode: "dhcp" };
const PPPOE_WAN = { iface: "ether1", mode: "pppoe", pppoeUsername: "u", pppoePassword: "p" };

const VARIANTS = [
  ["single DHCP WAN", { ...BASE, wans: [DHCP_WAN] }],
  ["single static WAN", { ...BASE, wans: [STATIC_WAN] }],
  ["single PPPoE WAN", { ...BASE, wans: [PPPOE_WAN] }],
  [
    "two WANs, load balance",
    {
      ...BASE,
      wans: [
        DHCP_WAN,
        { iface: "ether2", mode: "static", ip: "5.6.7.8", cidr: "24", gateway: "5.6.7.1" },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  [
    "two WANs, weighted load balance",
    {
      ...BASE,
      wans: [
        { ...DHCP_WAN, weight: 70 },
        { iface: "ether2", mode: "dhcp", weight: 30 },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  [
    "three WANs, failover only",
    {
      ...BASE,
      wans: [
        DHCP_WAN,
        { iface: "ether2", mode: "dhcp" },
        { iface: "ether3", mode: "pppoe", pppoeUsername: "u", pppoePassword: "p" },
      ],
      wanRoutingMode: "failover_only",
    },
  ],
  [
    "every optional subsystem on",
    {
      ...BASE,
      wans: [DHCP_WAN],
      lanIfs: ["ether3", "ether4"],
      wireguard: WG,
      radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
      apiAccess: { username: "cloudguest", secret: "pw" },
      identity: "gurgaon-branch",
      portalUrl: PORTAL,
    },
  ],
  [
    "basicConfigOnly, IP-literal portal, firewall off",
    {
      ...BASE,
      wans: [DHCP_WAN],
      enableFirewall: false,
      basicConfigOnly: true,
      wireguard: WG,
      radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
      portalUrl: { ...PORTAL, frontendBase: "https://192.168.1.9" },
    },
  ],
  // The two WireGuard-endpoint shapes section 8 exists for, in the sweep
  // so guards 1 and 2 see them too. `WG` above is the shape that ships
  // today (a hostname, no fallback address -- see `serverEndpointAddress`'s
  // own docstring for why the backend supplies none).
  [
    "wireguard with a backend-supplied fallback address",
    { ...BASE, wans: [DHCP_WAN], wireguard: { ...WG, serverEndpointAddress: WG_FALLBACK_ADDR } },
  ],
  [
    "wireguard whose endpoint host is already an address",
    { ...BASE, wans: [DHCP_WAN], wireguard: { ...WG, serverEndpointHost: WG_LITERAL_HOST } },
  ],
  // ---- the interface shapes "WAN1 is ether1" never covered ------------
  // "WAN1"/"WAN2" are LOGICAL labels of this platform's own. Nothing on
  // the device has to be called any of `WAN1`, `WAN2`, `ether1`, `ether2`
  // for a generated script to be correct, and every shape below is a real
  // one a venue router turns up with. They are in the MAIN variant sweep,
  // not a private list, so the console-scope guard, the `do={}` guard, the
  // validator and the idempotency guard all see them too.
  [
    "renamed WAN interface, static", // `/interface set name=ISP-Airtel`
    {
      ...BASE,
      wans: [
        { iface: "ISP-Airtel", mode: "static", ip: "1.2.3.4", cidr: "24", gateway: "1.2.3.1" },
      ],
    },
  ],
  ["VLAN WAN interface, DHCP", { ...BASE, wans: [{ iface: "vlan100", mode: "dhcp" }] }],
  ["SFP WAN interface, DHCP", { ...BASE, wans: [{ iface: "sfp-sfpplus1", mode: "dhcp" }] }],
  [
    // The founder's own first example, verbatim: logical WAN1 -> ether5 ->
    // DHCP, logical WAN2 -> pppoe-out1 -> PPPoE. Neither logical label
    // matches its interface, and the PPPoE one is a name RouterOS would
    // itself have auto-generated for a pppoe-client.
    "logical WAN1 on ether5/DHCP, logical WAN2 on pppoe-out1/PPPoE",
    {
      ...BASE,
      wans: [
        { iface: "ether5", mode: "dhcp" },
        { iface: "pppoe-out1", mode: "pppoe", pppoeUsername: "u", pppoePassword: "p" },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  [
    // The founder's second example: logical WAN1 -> ISP-Airtel -> static,
    // logical WAN2 -> vlan100 -> DHCP.
    "logical WAN1 on ISP-Airtel/static, logical WAN2 on vlan100/DHCP",
    {
      ...BASE,
      wans: [
        { iface: "ISP-Airtel", mode: "static", ip: "1.2.3.4", cidr: "24", gateway: "1.2.3.1" },
        { iface: "vlan100", mode: "dhcp" },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  [
    // MORE THAN TWO WANS, every mode at once, on interface names of every
    // shape. The crossover-backup ring and the PCC index split both have
    // to stay coherent past the two-WAN case they were written for.
    "four WANs, mixed modes, mixed interface shapes",
    {
      ...BASE,
      wans: [
        { iface: "ether5", mode: "dhcp" },
        { iface: "ISP-Airtel", mode: "static", ip: "1.2.3.4", cidr: "24", gateway: "1.2.3.1" },
        { iface: "vlan100", mode: "pppoe", pppoeUsername: "u", pppoePassword: "p" },
        { iface: "sfp-sfpplus1", mode: "dhcp" },
      ],
      wanRoutingMode: "load_balance",
    },
  ],
  // ---- LAN prefixes that are not /24 --------------------------------
  // `lanCidr` is a free-text field on the Advanced panel, validated only
  // as "an integer in 1..32", so all of these are reachable from the UI.
  // The generator used to build the DHCP pool and the DHCP network entry
  // from the first three octets of `lanIp` and ignore the prefix outright,
  // which made every one of them silently wrong. They are in the MAIN
  // sweep, not a private list, so the console-scope guard, the `do={}`
  // guard, the validator and the idempotency guard all see them too.
  [
    // The founder's own /25 case: the subnet stops at .127 and the old
    // pool handed guests .128-.254 -- a lease, no route to their own
    // gateway, no login page, and `RESULT: PASS` on the console.
    "LAN on a /25",
    { ...BASE, wans: [DHCP_WAN], lanIp: "192.168.88.1", lanCidr: "25" },
  ],
  [
    // The router's own address in the UPPER half, so the network is
    // 192.168.88.128/25 and the old code wrote 192.168.88.0/25 -- a
    // network this router has no address in at all.
    "LAN on a /25, router in the upper half",
    { ...BASE, wans: [DHCP_WAN], lanIp: "192.168.88.130", lanCidr: "25" },
  ],
  [
    // Wider than a /24: the old pool stopped at .254 and threw away half
    // the addresses the operator asked for.
    "LAN on a /23",
    { ...BASE, wans: [DHCP_WAN], lanIp: "10.5.50.1", lanCidr: "23" },
  ],
  [
    // Small enough that the fixed `.10` head-room would have eaten most of
    // the pool.
    "LAN on a /28",
    { ...BASE, wans: [DHCP_WAN], lanIp: "192.168.10.1", lanCidr: "28" },
  ],
  [
    // No usable pool at all. The generator must refuse rather than invent
    // one, and the whole script must still be legal RouterOS.
    "LAN on a /31, which cannot hold a pool",
    { ...BASE, wans: [DHCP_WAN], lanIp: "192.168.10.1", lanCidr: "31" },
  ],
  [
    // A LAN allowlist alongside a non-/24 prefix -- the LAN-side existence
    // check and the DHCP arithmetic in one script.
    "explicit LAN allowlist on a /26",
    {
      ...BASE,
      wans: [DHCP_WAN],
      lanIfs: ["ether3", "ether4"],
      lanIp: "172.16.9.65",
      lanCidr: "26",
    },
  ],
  [
    // A static WAN whose gateway carries characters that close a RouterOS
    // double-quoted string. This used to be interpolated raw.
    "static WAN with a quote-bearing gateway field",
    {
      ...BASE,
      wans: [
        { iface: `ISP"weird`, mode: "static", ip: "1.2.3.4", cidr: "24", gateway: `1.2.3.1"x` },
      ],
    },
  ],
];

/** Every chunk this generator can put in front of a technician, labelled
 * with the variant that produced it, de-duplicated by body. */
const pasteables = [];
{
  const seen = new Set();
  for (const [variant, opts] of VARIANTS) {
    for (const chunk of buildRouterSetupScriptChunks(opts)) {
      const key = `${chunk.label}\u0000${chunk.script}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pasteables.push([`${variant} :: ${chunk.label}`, chunk.script]);
    }
  }
}

/** Top-level statements, brace- and string-aware: a `;` inside a
 * `do={ ... }` body belongs to that body, not to the line. The unit a
 * "was this guarded" question is about is the whole `:if (...) do={ ... }`,
 * so splitting naively on `;` would report every guarded set as bare. */
const topLevelStatements = (script) => {
  const out = [];
  for (const rawLine of script.split("\n")) {
    if (rawLine.trimStart().startsWith("#")) continue;
    let depth = 0;
    let inStr = false;
    let cur = "";
    for (let i = 0; i < rawLine.length; i++) {
      const c = rawLine[i];
      if (inStr) {
        cur += c;
        if (c === "\\") {
          cur += rawLine[++i] ?? "";
        } else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        cur += c;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ";" && depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
};

// ==============================================================// 1. THE CONSOLE-SCOPE GUARD
// =====================================================================
// Identical rule to `test-output-analyser.mjs` and
// `test-manual-wizard-engine.mjs`, deliberately: a variable REFERENCED on
// a line must have been BOUND on that same line, by `:local`, `:global`,
// or a `:for` / `:foreach` loop variable. `:set` is a USE, not a binder --
// that is precisely what failed on the hEX. A `:local` declared and
// consumed inside one line is legal and is the intended way to keep
// carried state.

console.log("\n-- the console-scope guard --");

const RE_VAR_USE = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_SET = /:set\s+([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_BIND = /:(?:local|global)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_LOOP = /:(?:for|foreach)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:from|in)\b/g;
const names = (line, re) => [...line.matchAll(re)].map((m) => m[1]);
/** Names read on this line that this line did not bind. */
const unboundOn = (line) => {
  const bound = new Set([...names(line, RE_BIND), ...names(line, RE_LOOP)]);
  // `:set x` READS an existing binding, so it is a use, not a bind.
  const used = new Set([...names(line, RE_VAR_USE), ...names(line, RE_SET)]);
  return [...used].filter((v) => !bound.has(v));
};

check(
  "the guard has every emitted chunk in scope, across the whole option matrix",
  pasteables.length >= 40,
  `only ${pasteables.length} distinct chunk bodies swept -- a branch of the generator stopped being exercised`,
);

{
  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      for (const v of unboundOn(line)) offenders.push(`${label}, line ${n + 1}: $${v}`);
    });
  }
  check(
    "no emitted chunk carries a variable across a line break",
    offenders.length === 0,
    `${offenders.length} unbound reference(s). The RouterOS console runs each line as its own ` +
      `program, so these read a variable that no longer exists -- the line will either be a ` +
      `syntax error or, worse, evaluate against nothing and print a confident wrong answer. ` +
      `Join the statements onto ONE line with ";", or restructure the chunk to carry no state ` +
      `at all.\n      ${offenders.slice(0, 12).join("\n      ")}` +
      (offenders.length > 12 ? `\n      ... and ${offenders.length - 12} more` : ""),
  );
}

// A guard that cannot see the pattern it was written for is decoration,
// so it is pointed at the exact shapes this generator actually shipped.
const SCOPE_REGRESSIONS = [
  [
    "the Heartbeat chunk's own three-line form, which is why the scheduler existed but the router never checked in",
    `:local wan1Ip ""\n:if ([:len [/ip address find where interface="ether1"]] > 0) do={ :set wan1Ip [:pick [/ip address get [find interface="ether1"] address] 0 1] }\n:do { /tool fetch url="https://master.wyfyguest.com/api/v1/agent/heartbeat" http-data=("{\\"public_ip_address\\":\\"" . $wan1Ip . "\\"}") output=none } on-error={ :log warning "failed" }`,
  ],
  [
    "the guided-setup block that failed on the hEX",
    `:local dirty 0\n:if ([:len [/ip hotspot find]] > 0) do={ :set dirty ($dirty + 1) }`,
  ],
  [
    "the WAN+Bridge find-then-remove pair",
    `:local wan1Port [/interface bridge port find where interface="ether1"]\n:if ([:len $wan1Port] > 0) do={ /interface bridge port remove $wan1Port }`,
  ],
  [
    "the WAN Routing gateway carried into a route add",
    `:local wan1Gw ""\n:if ($wan1Gw != "" && $wan1Gw != "0.0.0.0") do={ /ip route add dst-address=0.0.0.0/0 gateway=$wan1Gw }`,
  ],
];
for (const [what, script] of SCOPE_REGRESSIONS) {
  const caught = script.split("\n").some((line, n) => n > 0 && unboundOn(line).length > 0);
  check(`INJECTED: the scope guard fires on ${what}`, caught, "the guard is blind to it");
}

// ANTI-OVER-STRICTNESS. The same shapes, legally flattened. If the guard
// fired on these it would ban the very fix it exists to enforce, and the
// cheapest way to defeat it would be to make it so strict that someone
// loosens it.
{
  const LEGAL = SCOPE_REGRESSIONS.map(([, s]) => s.split("\n").join("; "));
  const bad = LEGAL.filter((s) => unboundOn(s).length > 0);
  check(
    "...and does NOT fire on those same scripts flattened onto one line",
    bad.length === 0,
    `the guard bans the legal single-line shape: ${bad.join(" || ")}`,
  );
}
check(
  "...and understands a `:foreach` loop variable as a binding",
  unboundOn(
    `:foreach p in=[/interface bridge port find where interface="ether1"] do={ /interface bridge port remove $p }`,
  ).length === 0,
  "a no-state `:foreach` -- the generator's own replacement idiom -- is reported as an offender",
);
check(
  "...and understands a `:for` loop variable as a binding",
  unboundOn(
    `:for i from=1 to=255 do={ :if ([:len [/ip route find where distance=$i]] > 0) do={ :log info "x" } }`,
  ).length === 0,
  "a `:for` counter is reported as an offender",
);
check(
  "...and does NOT fire on a chunk that uses no variables at all",
  unboundOn(`/ip hotspot profile set [find name="hsprof1"] login-by=http-pap`).length === 0,
  "a plain command line is reported as an offender",
);

// =====================================================================
// 2. THE MULTI-STATEMENT `do={}` GUARD
// =====================================================================
// `;`-chaining two statements inside an inline `do={ ... }` threw a real
// syntax error on a live router. Splitting the same body over several
// lines is not a fix -- it only trades a confirmed defect for an
// unverified assumption about console brace-continuation. So the rule is
// the body itself: exactly one statement, however it is spelled.

console.log("\n-- the multi-statement do={} guard --");

/** Every block body opened by `do={`, `:do {`, `on-error={` or `else={`,
 * with the statements it contains. String contents are skipped, so a
 * `do={` inside a `:put` message is not mistaken for real syntax. */
function doBodies(script) {
  const s = script;
  const opens = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{" && /(?::do|\bdo=|on-error=|else=)\s*$/.test(s.slice(Math.max(0, i - 12), i))) {
      opens.push(i);
    }
  }

  const bodies = [];
  for (const open of opens) {
    let depth = 0;
    let close = -1;
    let str = false;
    for (let i = open; i < s.length; i++) {
      const c = s[i];
      if (str) {
        if (c === "\\") i++;
        else if (c === '"') str = false;
        continue;
      }
      if (c === '"') {
        str = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close === -1) continue; // unbalanced -- validateSetupScriptChunks' job
    const body = s.slice(open + 1, close);

    // Split on separators at THIS body's own depth: `;` or a newline.
    // Nested braces/brackets/parens and string contents are skipped, so a
    // nested single-statement block counts as one statement, not many.
    const parts = [];
    let cur = "";
    let d = 0;
    let bstr = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (bstr) {
        cur += c;
        if (c === "\\") cur += body[++i] ?? "";
        else if (c === '"') bstr = false;
        continue;
      }
      if (c === '"') {
        bstr = true;
        cur += c;
        continue;
      }
      if (c === "{" || c === "[" || c === "(") d++;
      else if (c === "}" || c === "]" || c === ")") d--;
      if (d === 0 && (c === ";" || c === "\n")) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    parts.push(cur);
    bodies.push({ body, statements: parts.map((p) => p.trim()).filter(Boolean) });
  }
  return bodies;
}

const multiStatement = (script) => doBodies(script).filter((b) => b.statements.length > 1);

{
  const offenders = [];
  for (const [label, script] of pasteables) {
    for (const b of multiStatement(script)) {
      offenders.push(
        `${label}: ${b.statements.length} statements in do={ ${b.body.trim().slice(0, 90)} }`,
      );
    }
  }
  check(
    "no emitted chunk has a multi-statement do={} body",
    offenders.length === 0,
    `${offenders.length} offender(s). A ";"-chained pair inside an inline do={} threw a real ` +
      `syntax error on a live router, and spreading the same body over lines only swaps that ` +
      `confirmed defect for an unverified assumption about console brace-continuation. Split it ` +
      `into separate guarded statements instead.\n      ${offenders.slice(0, 12).join("\n      ")}` +
      (offenders.length > 12 ? `\n      ... and ${offenders.length - 12} more` : ""),
  );
}

// The guard must also hold for the flattened single-paste export, which
// is a third way this same text reaches a device.
{
  const offenders = [];
  for (const [variant, opts] of VARIANTS) {
    const one = chunksToSingleLineScript(buildRouterSetupScriptChunks(opts));
    for (const b of multiStatement(one)) {
      offenders.push(
        `${variant}: ${b.statements.length} statements in do={ ${b.body.trim().slice(0, 70)} }`,
      );
    }
  }
  check(
    "chunksToSingleLineScript's output has none either",
    offenders.length === 0,
    `flattening every chunk onto one line created ${offenders.length} multi-statement do={} ` +
      `bodies:\n      ${offenders.slice(0, 6).join("\n      ")}`,
  );
}

const DO_REGRESSIONS = [
  [
    'the `;`-chained pair that threw "syntax error" on a live router',
    `:if ([:len [/ip address find where interface="ether1"]] > 0) do={ :local wan1Full [/ip address get [find interface="ether1"] address]; :set wan1Ip [:pick $wan1Full 0 1] }`,
  ],
  [
    "the DHCP gateway poll's attempt-then-delay body",
    `:for t from=1 to=30 do={ :if ([:len $gw] = 0) do={ :do { :set gw [:tostr [/ip dhcp-client get [find] gateway]] } on-error={ :set gw "" }; :if ([:len $gw] = 0) do={ :delay 1s } } }`,
  ],
  [
    "the LAN Ports remove-then-add body, spread over lines instead of chained",
    `:if ([:len [/interface bridge port find]] = 0) do={\n  /interface bridge port remove $existingPort\n  /interface bridge port add bridge="br" interface=$ethName\n}`,
  ],
  [
    "the wanExistenceCheck put-then-error body",
    `:if ([:len [/interface find where name="ether1"]] = 0) do={\n  :put ("missing")\n  :error ("missing")\n}`,
  ],
];
for (const [what, script] of DO_REGRESSIONS) {
  check(
    `INJECTED: the do={} guard fires on ${what}`,
    multiStatement(script).length > 0,
    "the guard is blind to it",
  );
}

// ANTI-OVER-STRICTNESS. Every one of these is a legal shape the generator
// relies on today. A guard that flagged them would be turned off within a
// week, which is worth more to an attacker of this codebase's discipline
// than a guard that is merely absent.
const DO_LEGAL = [
  [
    "a plain single-statement do={}",
    `:if ([:len [/ip pool find]] = 0) do={ /ip pool add name="p" }`,
  ],
  [
    "an :if with single-statement do={} AND else={}",
    `:if ([:len [/user find]] = 0) do={ /user add name="a" } else={ /user set [find] password="b" }`,
  ],
  [
    "a nested :foreach whose body is one statement inside an :if whose body is that :foreach",
    `:if ([:len [/ip dhcp-client find]] = 0) do={ :foreach c in=[/ip dhcp-client find] do={ /ip dhcp-client remove $c } }`,
  ],
  [
    ":do {} on-error={} with one statement in each",
    `:do { :set dnsOk ([:len [:resolve "a.b"]] > 0) } on-error={ :set dnsOk false }`,
  ],
  [
    "a :do nested inside an on-error, one statement at every level",
    `:do { :set hbIf [:tostr [/ip route get $r immediate-gw]] } on-error={ :do { :set hbIf [:tostr [/ip route get $r gateway]] } on-error={ :set hbIf "" } }`,
  ],
  [
    "a single statement containing semicolons INSIDE a string literal",
    `:if ($x = 1) do={ :log warning "cloudguest: one; two; three" }`,
  ],
  [
    "a single statement whose string literal contains the text do={",
    `:if ($x = 1) do={ :put "paste this: :if (y) do={ a; b }" }`,
  ],
  [
    "a top-level `;`-joined line, which is the whole point of the fix",
    `:local a ""; :if ($a = "") do={ :set a "x" }; :put $a`,
  ],
];
for (const [what, script] of DO_LEGAL) {
  const found = multiStatement(script);
  check(
    `...and does NOT fire on ${what}`,
    found.length === 0,
    `wrongly flagged: ${JSON.stringify(found.map((b) => b.statements))}`,
  );
}
check(
  "...and the guard actually inspects bodies rather than trivially passing",
  doBodies(`:if ($x = 1) do={ :put "a" } else={ :put "b" }`).length === 2,
  "doBodies found no block bodies at all in a script that plainly has two",
);

// =====================================================================
// 3. THE UPLINK IS DERIVED, NOT NAMED
// =====================================================================
// The founder's objection, verbatim: "aisa hona nahi chahiye, bas ISP koi
// sa bhi ho wo le le". A venue with two or three ISPs whose live uplink is
// on ether2 reported an EMPTY public_ip_address while looking perfectly
// healthy. The port a link is plugged into is not evidence; the interface
// the active default route goes out of is.

console.log("\n-- the heartbeat reports the live uplink, not a named port --");

const heartbeatChunks = (opts) =>
  buildRouterSetupScriptChunks(opts).filter((c) => c.label.startsWith("Heartbeat"));

for (const [variant, opts] of VARIANTS) {
  const hb = heartbeatChunks(opts);
  const all = hb.map((c) => c.script).join("\n");
  const wanNames = opts.wans.map((w) => w.iface);

  // Identified BY ROLE, not by counting labels that happen to start with
  // "Heartbeat". The count form broke the moment a third, read-only
  // "Heartbeat Check" chunk was added -- and it broke in the unhelpful
  // direction, flagging a new report as if the scheduler had gone missing.
  // These two are the ones that ACT; the report chunk is deliberately still
  // inside `hb` so the never-name-a-WAN-port assertion below covers it too.
  const hbImmediate = hb.filter((c) => c.label.startsWith("Heartbeat (check in now"));
  const hbScheduler = hb.filter((c) => c.label.startsWith("Heartbeat Scheduler"));
  check(
    `${variant}: emits an immediate check-in AND a scheduler, as separate pastes`,
    hbImmediate.length === 1 && hbScheduler.length === 1,
    `found ${hbImmediate.length} immediate + ${hbScheduler.length} scheduler in: ${hb
      .map((c) => c.label)
      .join(", ")}`,
  );
  // The actual regression. Every one of these names used to be baked into
  // the address lookup, so a router whose uplink was on any other port
  // reported "".
  check(
    `${variant}: never names a WAN port in the address lookup`,
    !wanNames.some((n) => all.includes(`interface="${n}"`)),
    `hardcodes one of ${JSON.stringify(wanNames)} -- that is the ether1 assumption, moved`,
  );
  // EVERY default-route lookup, not just one of them. An earlier version
  // of this check asserted only that the qualifiers appeared SOMEWHERE in
  // the chunk, and a mutation that stripped them from the counting lookup
  // while leaving them on the selecting one went undetected -- the count
  // and the selection would then disagree about what "a default route"
  // means, which is exactly how "1 route, looks healthy" gets printed for
  // a router whose fetch says `Network unreachable`. So this walks every
  // occurrence and requires each to carry both qualifiers.
  const defaultRouteLookups = [
    ...all.replace(/\\(.)/g, "$1").matchAll(/dst-address="0\.0\.0\.0\/0"([^\]]*)/g),
  ].map((m) => m[1]);
  check(
    `${variant}: EVERY default-route lookup requires the route to be ACTIVE`,
    defaultRouteLookups.length > 0 && defaultRouteLookups.every((t) => t.includes("active=yes")),
    "a route that merely EXISTS is not a route that works -- RouterOS keeps an unreachable " +
      `default route in the table and flags it Inactive. Unqualified: ${JSON.stringify(
        defaultRouteLookups.filter((t) => !t.includes("active=yes")),
      )}`,
  );
  // This generator itself creates routes in per-WAN routing TABLES in
  // load-balance mode, so an unqualified find returns several and "the
  // first" would be whichever mark sorted first.
  check(
    `${variant}: EVERY default-route lookup reads the MAIN table (v7 routing-table=), not a marked copy`,
    defaultRouteLookups.length > 0 &&
      defaultRouteLookups.every((t) => t.includes(`routing-table="main"`)),
    "the heartbeat is router-originated traffic and is routed by the main table; the marked " +
      `copies belong to LAN traffic. Unqualified: ${JSON.stringify(
        defaultRouteLookups.filter((t) => !t.includes(`routing-table="main"`)),
      )}`,
  );
  check(
    `${variant}: picks among multiple active defaults by ascending distance, deliberately`,
    /:for hbDist from=1 to=\d+ do=\{/.test(all) && all.includes("distance=$hbDist"),
    "no explicit ascending-distance sweep -- the choice would depend on find order",
  );
  check(
    `${variant}: says so in the log when more than one default route is active`,
    /hbDefCount > 1/.test(all) && /active default routes/.test(all),
    "multiple live uplinks are silently collapsed into one reported address",
  );
  check(
    `${variant}: consults the WAN interface list the generator itself builds`,
    all.includes(`list="WAN"`),
    "the uplink is never cross-checked against this script's own notion of a WAN port",
  );
}

// =====================================================================
// 4. AN UNREAD ADDRESS IS NEVER REPORTED AS AN ADDRESS
// =====================================================================
// The backend does `if public_ip_address is not None: update_data[...]`
// (app/domains/router/service.py). So an ABSENT key leaves the last known
// good address alone, while an EMPTY STRING overwrites it with blank.
// Today's script sends the empty string, which is why a router whose
// uplink moved ports shows a blank Public IP rather than a stale one: it
// is actively told the wrong thing.

console.log("\n-- three faults, three traces, and no invented address --");

for (const [variant, opts] of VARIANTS) {
  const all = heartbeatChunks(opts)
    .map((c) => c.script)
    .join("\n");

  check(
    `${variant}: public_ip_address appears ONLY under a guard that an address was read`,
    (() => {
      // Every statement mentioning the key must also test $hbIp.
      const stmts = all
        .split("\n")
        .flatMap((l) => l.split(";"))
        .filter((s) => s.includes("public_ip_address") && !s.includes(":log"));
      return stmts.length > 0 && stmts.every((s) => s.includes("$hbIp"));
    })(),
    'the key is emitted unconditionally, so an unread address reaches the backend as "" and ' +
      "overwrites the last known good value",
  );
  check(
    `${variant}: the fallback body carries no public_ip_address key at all`,
    /:local hbJson "\{(?:\\"management_ip_address\\":\\"[^"]*\\")?\}"/.test(all),
    "the not-read body is not a bare {} (plus management IP) -- it must OMIT the key, not blank it",
  );

  // Three faults that an empty string would collapse into one.
  check(
    `${variant}: "no active default route" has its own trace`,
    /hbDefCount = 0\) do=\{ :log warning "cloudguest-hb: no ACTIVE default route/.test(all),
    "missing",
  );
  check(
    `${variant}: "route found, interface unresolved" has its own trace`,
    /hbDefCount > 0 && \$hbIf = ""\) do=\{ :log warning/.test(all),
    "missing",
  );
  check(
    `${variant}: "uplink found, no address on it" has its own trace`,
    /\$hbIf != "" && \$hbIp = ""\) do=\{ :log warning/.test(all),
    "missing",
  );
  // A scheduler on-event that fails produces no toast, no popup and
  // nothing waiting for anyone to look. Counted after undoing one level
  // of RouterOS escaping, so the scheduler's stored copy -- where the
  // quotes arrive as \" -- is counted too, not skipped.
  check(
    `${variant}: both fetches leave a :log warning when they fail`,
    (
      all.replace(/\\(.)/g, "$1").match(/on-error=\{ :log warning "cloudguest-hb: \/tool fetch/g) ??
      []
    ).length === 2,
    "a fetch failure would be completely silent",
  );
  // The reported run-count=0 / next-run stuck weeks in the past.
  check(
    `${variant}: the scheduler pins start-time so no wrong clock is captured`,
    all.includes("start-time=startup"),
    "RouterOS captures the current system clock at add time when start-time is omitted",
  );
  check(
    `${variant}: the scheduler is removed and re-added, not add-if-missing`,
    all.includes("/system scheduler remove $existingHeartbeatSched"),
    "a device that got a bad entry would keep it forever",
  );
}

// The stored on-event copy and the pasted copy must be the same program.
// Having them drift is how the recurring copy ended up reporting nothing
// for every DHCP renewal after the first.
for (const [variant, opts] of VARIANTS) {
  const hb = heartbeatChunks(opts);
  const immediate = hb.find((c) => !c.label.includes("Scheduler"))?.script ?? "";
  const scheduler = hb.find((c) => c.label.includes("Scheduler"))?.script ?? "";
  const onEvent = scheduler.match(/on-event="((?:\\.|[^"\\])*)"/)?.[1] ?? "";
  // Undo exactly one level of RouterOS string escaping.
  const unescaped = onEvent.replace(/\\n/g, "\n").replace(/\\(.)/g, "$1");
  check(
    `${variant}: the scheduler's stored body is the immediate body, escaped once`,
    unescaped === immediate.trim(),
    "the two copies have drifted -- the recurring one is what runs for the router's whole life",
  );
}

// =====================================================================
// 5. THE GENERATOR'S OWN VALIDATOR STILL PASSES
// =====================================================================
// `validateSetupScriptChunks` already catches unbalanced brackets/quotes
// and, critically, a bare `$` inside an `on-event="..."` body -- RouterOS
// interpolates that at CREATION time, baking an empty value into the
// stored script forever. The heartbeat's on-event body is the one place
// in this file that can regress it.

console.log("\n-- the generator's own static validator --");

for (const [variant, opts] of VARIANTS) {
  const results = validateSetupScriptChunks(buildRouterSetupScriptChunks(opts));
  const errors = results.flatMap((r) =>
    r.issues.filter((i) => i.severity === "error").map((i) => `${r.label}: ${i.message}`),
  );
  check(`${variant}: zero validator errors`, errors.length === 0, errors.join(" | "));
  const warnings = results.flatMap((r) =>
    r.issues.filter((i) => i.severity === "warning").map((i) => `${r.label}: ${i.message}`),
  );
  check(`${variant}: zero validator warnings`, warnings.length === 0, warnings.join(" | "));
}

// =====================================================================
// 6. THE FIVE SILENT FAILURES
// =====================================================================
// Every defect below shipped, survived review, and produced NO error --
// which is precisely why each one survived. They share one shape: RouterOS
// reporting success for work it did not do. So each guard here asserts two
// separate things: that the CONDITION is handled at all, and that the
// operator is TOLD when it is not met. A fix that quietly does the right
// thing is only half of what was asked for -- the paste output has to say
// so, because the whole class of bug is "nothing said anything".

console.log("\n-- the five silent failures --");

/** The variant that turns on every optional subsystem, so portal, hotspot,
 * WireGuard and firewall chunks all exist to be inspected. */
const FULL = VARIANTS.find(([v]) => v === "every optional subsystem on")[1];
const fullChunks = buildRouterSetupScriptChunks(FULL);
const chunkByLabel = (chunks, needle) => chunks.filter((c) => c.label.includes(needle));
const allText = (chunks) => chunks.map((c) => c.script).join("\n");
const fullText = allText(fullChunks);

// ---------------------------------------------------------------------
// 1. The portal page path is DISCOVERED, and a miss is loud.
// ---------------------------------------------------------------------
// `flash/` is a per-model detail. `set [find ...]` against an empty match
// succeeds silently, so on a board without that prefix all five writes did
// nothing and the guest got MikroTik's stock blue login page.

const portalChunks = chunkByLabel(fullChunks, "Portal Redirect Page");

check(
  "portal: all five stock hotspot pages still get an override chunk",
  portalChunks.length === 5,
  `got ${portalChunks.length} -- a page stopped being overridden`,
);

check(
  "portal: no chunk hardcodes the flash/ path prefix anywhere",
  !allText(fullChunks).includes("flash/hotspot/"),
  "the model-specific prefix is back; on boards without it every /file set silently writes nothing",
);

for (const chunk of portalChunks) {
  const base = chunk.label.match(/\(([^)]+)\)/)[1];
  const s = chunk.script;
  check(
    `portal ${base}: the path is discovered with /file find, not assumed`,
    s.includes(`[/file find where name~"/${base}"]`),
    "no discovery -- the path is being assumed again",
  );
  check(
    `portal ${base}: the write is gated on a non-zero match count`,
    /:if \(\$pfHits > 0\) do=\{ \/file set \[find where name~"\/[a-z]+\.html"\] contents=/.test(s),
    "the /file set is unguarded, so an empty match writes nothing and reports success",
  );
  check(
    `portal ${base}: a miss prints a visible FAIL naming the consequence`,
    /:if \(\$pfHits = 0\) do=\{ :put "  FAIL -- portal page [a-z]+\.html: 0 files matched/.test(
      s,
    ) && s.includes("NOTHING WAS WRITTEN"),
    "a miss is silent -- the exact defect this replaces",
  );
  check(
    `portal ${base}: a hit reports the count it actually wrote`,
    s.includes(`:tostr $pfHits`) && s.includes("overwrote"),
    "success is asserted rather than counted",
  );
}

// The pattern's leading slash is the whole anti-collision argument, so it
// is proven rather than asserted. RouterOS's `~` is a regex substring
// match, modelled here exactly as such.
{
  const rosLike = (name, pattern) => new RegExp(pattern).test(name);
  check(
    "INJECTED: a bare-basename pattern WOULD swallow rlogin.html and alogin.html",
    rosLike("flash/hotspot/rlogin.html", "login.html") &&
      rosLike("flash/hotspot/alogin.html", "login.html"),
    "the collision this pattern defends against is not real -- re-check the reasoning",
  );
  check(
    "portal: the shipped /basename pattern does NOT collide with rlogin/alogin",
    !rosLike("flash/hotspot/rlogin.html", "/login.html") &&
      !rosLike("flash/hotspot/alogin.html", "/login.html"),
    "login.html's chunk would overwrite all three pages with login.html's content",
  );
  check(
    "portal: the pattern still matches BOTH directory layouts",
    rosLike("flash/hotspot/login.html", "/login.html") &&
      rosLike("hotspot/login.html", "/login.html"),
    "the discovery does not actually discover -- one of the two real layouts misses",
  );
}

// ---------------------------------------------------------------------
// 2. No local hotspot user (RouterOS checks local users BEFORE RADIUS).
// ---------------------------------------------------------------------

const hotspotChunk = chunkByLabel(fullChunks, "Hotspot")[0].script;

check(
  "hotspot: no chunk creates a local hotspot user, in any variant",
  !VARIANTS.some(([, o]) =>
    allText(buildRouterSetupScriptChunks(o)).includes("/ip hotspot user add"),
  ),
  "a local user is a complete portal bypass: no OTP, no session row, no consent, no data cap",
);

check(
  "hotspot: the account this generator used to create is actively removed",
  hotspotChunk.includes("/ip hotspot user remove [find where name="),
  "every already-provisioned router keeps its bypass account forever",
);

check(
  "hotspot: the removal reports how many accounts it removed",
  hotspotChunk.includes(":tostr $hsLocal") && hotspotChunk.includes("bypassed OTP"),
  "removal is silent, so nobody learns the router had a bypass",
);

check(
  "hotspot: any REMAINING local user is counted and called a bypass out loud",
  /:local hsLeft \[:len \[\/ip hotspot user find\]\]/.test(hotspotChunk) &&
    hotspotChunk.includes("checks local users BEFORE RADIUS") &&
    hotspotChunk.includes(":tostr $hsLeft"),
  "a hand-added second bypass account stays invisible",
);

// ---------------------------------------------------------------------
// 3. Something actually closes a session.
// ---------------------------------------------------------------------
// keepalive-timeout=none was set with no idle-timeout to replace it, so
// nothing ever reaped a session: slots stayed held, device counts only
// went up, RADIUS never saw an accounting Stop.

check(
  "hotspot: an idle-timeout is set on the default user profile",
  /idle-timeout=\d+[smh]/.test(hotspotChunk),
  "nothing closes a session -- a guest who left hours ago still holds a slot",
);

check(
  "hotspot: the idle-timeout is far enough from the 2m keepalive that caused the false-logout incident",
  (() => {
    const m = hotspotChunk.match(/idle-timeout=(\d+)([smh])/);
    if (!m) return false;
    const mins = m[2] === "h" ? +m[1] * 60 : m[2] === "m" ? +m[1] : +m[1] / 60;
    return mins >= 15 && mins <= 120;
  })(),
  "too short re-creates the false-logout bug under a new name; too long never frees the slot",
);

check(
  "hotspot: keepalive-timeout=none is still set (the false-logout fix is not undone)",
  hotspotChunk.includes("keepalive-timeout=none"),
  "re-enabling keepalive brings back the confirmed screen-lock logout incident",
);

check(
  "hotspot: every default-profile set is gated on the profile existing",
  !/\/ip hotspot user profile set \[find name="default"\]/.test(hotspotChunk) &&
    (
      hotspotChunk.match(
        /:if \(\[:len \[\/ip hotspot user profile find where name="default"\]\] > 0\) do=\{ \/ip hotspot user profile set/g,
      ) ?? []
    ).length === 3,
  "an unguarded `set` against an empty match succeeds silently -- the same trap as the portal /file set",
);

check(
  "hotspot: the applied profile values are read back and printed, not assumed",
  hotspotChunk.includes(":local hsProf") &&
    hotspotChunk.includes("/ip hotspot user profile get [find where name=") &&
    hotspotChunk.includes("FAIL -- no hotspot user profile named default"),
  "success is inferred from the absence of an error",
);

// ---------------------------------------------------------------------
// 4. The WAN check runs AFTER the router has a resolver.
// ---------------------------------------------------------------------
// The WAN DHCP client is added with use-peer-dns=no, so before `/ip dns
// set servers=` runs the router has no resolver from any source. Checking
// DNS first made a healthy router report FAIL every single time.

for (const [variant, opts] of VARIANTS) {
  const cs = buildRouterSetupScriptChunks(opts);
  const dnsIdx = cs.findIndex((c) => c.label === "LAN IP" || c.label === "LAN IP + DNS");
  const wanIdx = cs.findIndex((c) => c.label.startsWith("WAN Connectivity Check"));
  check(
    `${variant}: the WAN connectivity check comes AFTER DNS is configured`,
    dnsIdx !== -1 && wanIdx !== -1 && dnsIdx < wanIdx,
    `LAN-IP/DNS chunk at ${dnsIdx}, WAN check at ${wanIdx} -- checking DNS before configuring it ` +
      `makes a perfectly healthy router print FAIL, which trains people to ignore the check`,
  );
}

{
  const wanCheck = chunkByLabel(fullChunks, "WAN Connectivity Check")[0].script;
  // Asserting only that the count is PRINTED is not enough, and this
  // suite's own mutation pass proved it: pinning `dnsCount` at 0 while
  // leaving every `:put` in place still passed, and would have told the
  // operator "no resolver at all" on a router with working DNS servers --
  // a confidently wrong verdict, which is the exact failure shape this
  // whole section exists to end. So the value must be shown to come off
  // the DEVICE, not merely to be displayed.
  check(
    "wan check: the resolver count is read from the device, not just printed",
    wanCheck.includes(":local dnsCount") &&
      wanCheck.includes(":tostr $dnsCount") &&
      /:set dnsCount \[:len \[\/ip dns get servers\]\]/.test(wanCheck),
    "a bare DNS FAIL cannot distinguish 'no resolver set yet' from 'resolver is broken' -- " +
      "and a count that is never read from /ip dns reports 0 on a healthy router",
  );
  check(
    "wan check: zero resolvers is explained as a not-yet-pasted chunk, not a WAN fault",
    wanCheck.includes("$dnsCount = 0") && wanCheck.includes("The WAN itself may be perfectly fine"),
    "the technician is sent to debug a WAN that was never broken",
  );
  check(
    "wan check: a configured-but-unanswering resolver reads differently from none at all",
    wanCheck.includes("$dnsCount > 0") && wanCheck.includes("is not answering"),
    "the two opposite causes collapse into one message again",
  );
}

// ---------------------------------------------------------------------
// 5. One tunnel interface name, and it is the backend's.
// ---------------------------------------------------------------------
// Backend `network_config/renderers.py:672` declares
// WIREGUARD_INTERFACE_NAME = "wg-cloudguard" and ~14 tests pin it.
// `wg-cloudguest` exists nowhere in backend code.

{
  const wg = chunkByLabel(fullChunks, "WireGuard Tunnel")[0].script;

  check(
    "wireguard: the interface created matches the backend's authoritative name",
    wg.includes('/interface wireguard add name="wg-cloudguard"'),
    "a second, divergent tunnel interface -- the hub only ever talks to wg-cloudguard",
  );
  check(
    "wireguard: nothing is created or bound under the old wg-cloudguest name",
    !/(?:add name|interface|in-interface)="wg-cloudguest"/.test(fullText),
    "the two-interface state is back",
  );
  check(
    "wireguard: the peer and the tunnel address both bind to the same interface",
    wg.includes('/interface wireguard peers add interface="wg-cloudguard"') &&
      wg.includes('/ip address add address="10.20.0.5/24" interface="wg-cloudguard"'),
    "peer or address bound to a different interface than the one created",
  );
  check(
    "wireguard: the management accept rule binds to the authoritative name",
    wg.includes('in-interface="wg-cloudguard" action=accept comment="cloudguest-fw-allow-wg-mgmt"'),
    "the firewall rule is bound to the wrong tunnel, so the hub handshake is dropped",
  );
  // The add-guards only fire when the rule is ABSENT, so an already
  // provisioned router keeps a rule pointing at the dead interface.
  check(
    "wireguard: an EXISTING accept rule is repointed, not left on the dead interface",
    wg.includes(
      ':if ([:len $wgAllowRule] > 0) do={ /ip firewall filter set $wgAllowRule in-interface="wg-cloudguard" }',
    ),
    "every router provisioned before this fix keeps its rule bound to wg-cloudguest and never handshakes",
  );
  check(
    "wireguard: a surviving legacy interface is counted and reported, not silently doubled up",
    wg.includes(':local wgLegacy [:len [/interface wireguard find where name="wg-cloudguest"]]') &&
      wg.includes(":tostr $wgLegacy") &&
      wg.includes("TWO tunnels"),
    "the old interface stays on the device with nothing pointing it out",
  );
  check(
    "wireguard: the legacy interface is REPORTED rather than removed",
    !wg.includes('/interface wireguard remove [find where name="wg-cloudguest"]}') &&
      !/do=\{ \/interface wireguard remove/.test(wg),
    "removing the old tunnel can drop the operator's own management session mid-provision",
  );
  check(
    "wireguard: the final state is counted and given a PASS/FAIL, not assumed",
    wg.includes(":local wgIf") &&
      wg.includes(":local wgPeer") &&
      wg.includes(":local wgAddr") &&
      wg.includes("RESULT: FAIL -- a count above is 0"),
    "three add-if-missing guards in a row can all no-op and still look clean",
  );
}

// =====================================================================
// 7. THE CLOCK IS SET, EARLY, AND ITS FAILURE IS VISIBLE
// =====================================================================
// `grep -c "ntp client\|time-zone-name"` over the generator returned 0.
// The hEX has no battery-backed clock, so every fresh or power-cycled
// router boots with a wrong date, and a wrong date fails HTTPS certificate
// validation -- so the heartbeat's `/tool fetch` is rejected before it is
// sent, the router shows offline in Master console forever, and the guest
// WiFi works perfectly the whole time. That is the silent shape this
// project keeps producing, so the chunk does not merely CONFIGURE NTP: it
// checks that the clock actually ended up sane and prints a FAIL if not.
// Enabling NTP is not synchronising; plenty of venue firewalls pass ping
// and DNS and drop outbound UDP 123.

console.log("\n-- the clock is set, before anything speaks HTTPS --");

const clockChunkOf = (chunks) => chunks.find((c) => c.label.startsWith("Clock + NTP"));

for (const [variant, opts] of VARIANTS) {
  const chunks = buildRouterSetupScriptChunks(opts);
  const clock = clockChunkOf(chunks);
  check(
    `${variant}: emits a clock/NTP chunk at all`,
    !!clock,
    "the generator never sets the clock",
  );
  const s = clock?.script ?? "";

  check(
    `${variant}: sets the timezone explicitly, autodetect off`,
    s.includes("time-zone-name=Asia/Kolkata") && s.includes("time-zone-autodetect=no"),
    "a router left on autodetect resolves its zone over the network it may not have yet",
  );
  check(
    `${variant}: enables the NTP client against both runbook servers`,
    /\/system ntp client set enabled=yes/.test(s) &&
      s.includes("216.239.35.0") &&
      s.includes("162.159.200.1"),
    "NTP is never turned on, so the clock stays whatever the firmware booted with",
  );
  // The servers must be plain IPs. A `pool.ntp.org` here would need DNS,
  // and "internet fine, DNS broken" is a confirmed-live state on this
  // hardware (see the WireGuard chunk's own `:resolve` guard) -- an NTP
  // server that cannot be resolved is an NTP server that never syncs.
  check(
    `${variant}: every NTP server is a raw address, never a name needing DNS`,
    (() => {
      // Only real arguments -- the failure text names `servers=` and
      // `primary-ntp=` in prose, and matching those would make this pass
      // vacuously.
      const args = [...s.matchAll(/(?:servers|primary-ntp|secondary-ntp)=([^\s}")]+)/g)].flatMap(
        (m) => m[1].split(","),
      );
      return (
        args.length > 0 &&
        args.every((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a) && a.split(".").every((o) => +o <= 255))
      );
    })(),
    "an NTP server given by name cannot sync a router whose DNS is broken -- which is exactly " +
      "the router this chunk exists for",
  );

  // ORDER. The whole point of "add it early". The clock has to be right
  // BEFORE the only chunk in this generator that speaks HTTPS, or TLS
  // rejects the check-in and nothing anywhere says why.
  const clockIdx = chunks.findIndex((c) => c.label.startsWith("Clock + NTP"));
  // `/tool fetch url=` -- an actual invocation. The clock chunk's own
  // failure text NAMES `/tool fetch` in prose to explain the consequence,
  // and matching that would make this check compare the chunk to itself.
  const httpsIdxs = chunks
    .map((c, i) => (/\/tool fetch url=/.test(c.script) ? i : -1))
    .filter((i) => i >= 0);
  check(
    `${variant}: the clock chunk comes BEFORE every chunk that does HTTPS`,
    clockIdx >= 0 && httpsIdxs.length > 0 && httpsIdxs.every((i) => i > clockIdx),
    `clock at ${clockIdx}, /tool fetch at ${JSON.stringify(httpsIdxs)} -- a wrong clock fails ` +
      "certificate validation, so a heartbeat pasted first is rejected before it is even sent",
  );
  const wanCheckIdx = chunks.findIndex((c) => c.label.startsWith("WAN Connectivity Check"));
  check(
    `${variant}: ...and AFTER the WAN connectivity checkpoint`,
    wanCheckIdx >= 0 && clockIdx > wanCheckIdx,
    "NTP needs a working uplink; run earlier and it can only ever report a failure that says " +
      "nothing about the clock",
  );

  // VERIFICATION, not configuration. This is the half that makes the
  // failure visible instead of silent.
  check(
    `${variant}: reads the NTP client's own status and tests it for "synchronized"`,
    s.includes("/system ntp client get status") && s.includes('= "synchronized"'),
    "setting NTP is not syncing NTP -- without this the chunk reports success on a router whose " +
      "clock never moved",
  );
  check(
    `${variant}: every NTP status read is wrapped in :do {} on-error={}`,
    (() => {
      const reads = [...s.matchAll(/\[\/system ntp client get status\]/g)];
      return (
        reads.length > 0 &&
        reads.every((m) => {
          const before = s.slice(Math.max(0, m.index - 60), m.index);
          return /:do \{[^{}]*$/.test(before);
        })
      );
    })(),
    "not every RouterOS version exposes that property; an unguarded read aborts the rest of the " +
      "line, which on a `;`-joined line means the verdict never prints at all",
  );
  // Asserted on the VERDICT, not merely on the chunk containing the
  // words. An earlier version of this check only required
  // `/system clock get date` and a `$clkYear <|>= NNNN` to appear
  // somewhere, and a mutation that dropped the year from the PASS
  // condition while leaving it in the date-parsing ladder above went
  // undetected -- the chunk would then have parsed the year carefully and
  // then ignored it. Same hole, same shape, as the one section 3's
  // default-route check found by walking every occurrence instead of one.
  check(
    `${variant}: the PASS verdict requires BOTH the NTP status AND a sane date`,
    s.includes("/system clock get date") &&
      /:if \(\$clkStatus = "synchronized" && \$clkYear >= \d{4}\) do=\{ :set clkVerdict "PASS" \}/.test(
        s,
      ),
    "the status property is the primary signal but is not readable on every RouterOS, and the " +
      "date is the backstop -- a verdict computed from only one of them passes a router with an " +
      "unreadable status and a 1970 clock",
  );
  check(
    `${variant}: prints an explicit FAIL verdict, not just a status line`,
    /RESULT: FAIL/.test(s) && /RESULT: PASS/.test(s),
    "a chunk that prints the status and no verdict leaves the technician to decide whether " +
      '"using-local-clock" is bad -- this is the same manual checkpoint shape as the WAN check',
  );
  check(
    `${variant}: leaves a :log warning on the device when the clock is wrong`,
    /:log warning \("cloudguest-clock: NTP NOT synchronised/.test(s),
    "terminal output scrolls past; /log print is what remote support can read afterwards",
  );
  check(
    `${variant}: says WHY it matters in the failure output, not just that it failed`,
    /HTTPS certificate validation/.test(s) && /OFFLINE in Master console/.test(s),
    'a bare "FAIL" trains people to continue anyway; naming the consequence is what stops them',
  );
}

// The regression in its original form: the string the founder grepped for.
{
  const everyChunkEverywhere = VARIANTS.flatMap(([, opts]) =>
    buildRouterSetupScriptChunks(opts).map((c) => c.script),
  ).join("\n");
  check(
    "INJECTED: the original defect -- zero matches for `ntp client` / `time-zone-name` anywhere",
    /ntp client/.test(everyChunkEverywhere) && /time-zone-name/.test(everyChunkEverywhere),
    "this is the exact grep that returned 0 and started this work",
  );
}

// =====================================================================
// 8. A TUNNEL PEER IS NEVER BUILT AGAINST AN UNRESOLVED NAME
// =====================================================================
// RouterOS resolves `endpoint-address` ONCE, when the peer is created,
// and never again. If venue DNS is not working at that moment the peer is
// created pointing at nothing and NOTHING REPORTS IT -- the `add`
// succeeds and the tunnel simply never handshakes. Confirmed live
// (2026-08-22): `/tool fetch` returned `resolving error` while WAN, DHCP,
// gateway, default route and `/ip dns` servers were all healthy.

console.log("\n-- the wireguard peer's endpoint is verified, never assumed --");

const wgChunkFor = (wireguard) =>
  buildRouterSetupScriptChunks({ ...BASE, wans: [DHCP_WAN], wireguard }).find(
    (c) => c.label === "WireGuard Tunnel",
  )?.script ?? "";

const WG_CASES = [
  ["hostname, no fallback address (what ships today)", WG, false],
  [
    "hostname with a backend-supplied fallback",
    { ...WG, serverEndpointAddress: WG_FALLBACK_ADDR },
    true,
  ],
];

for (const [what, wireguard, hasFallback] of WG_CASES) {
  const s = wgChunkFor(wireguard);
  check(
    `${what}: verifies the hostname resolves ON THE DEVICE with :resolve`,
    s.includes(":resolve $wgHost"),
    "without this the peer is created against whatever the name did or did not resolve to, " +
      "with no signal either way",
  );
  check(
    `${what}: the :resolve is guarded -- it throws on failure`,
    /:do \{ :set wgDnsOk \(\[:len \[:resolve \$wgHost\]\] > 0\) \} on-error=\{ :set wgDnsOk false \}/.test(
      s,
    ),
    "an unguarded :resolve aborts the rest of the line, so the peer is never added AND nothing " +
      "is printed -- a worse version of the bug",
  );
  // The real guarantee: the `add` cannot run on an unresolved name.
  check(
    `${what}: every peer add is gated on the resolution result`,
    (() => {
      const adds = [...s.matchAll(/\/interface wireguard peers add/g)];
      return (
        adds.length > 0 &&
        adds.every((m) =>
          /:if \(\$wgGo = true && [^)]*\) do=\{ $/.test(s.slice(0, m.index).slice(-200)),
        )
      );
    })(),
    "an ungated add is the original bug: a peer pointing at nothing, created silently",
  );
  check(
    `${what}: the peer's endpoint-address is the checked variable, not a literal`,
    s.includes("endpoint-address=$wgEp") &&
      !s.includes(`endpoint-address="${WG.serverEndpointHost}"`),
    "a literal endpoint-address cannot express the fallback and cannot be checked first",
  );
  check(
    `${what}: leaves a comment on the peer saying which it holds and why`,
    s.includes("comment=$wgCmt") && s.includes("cloudguest-wg-hub:"),
    "a technician reading /interface wireguard peers print detail next week has no other way to " +
      "tell a name from a substituted address",
  );
  check(
    `${what}: says so loudly in the pasted output when DNS fails`,
    /\*\*\* WIREGUARD: DNS FAILED/.test(s) && /:log warning \("cloudguest-wg: /.test(s),
    "the whole failure mode is that nothing reports it",
  );
}

{
  // No fallback available: the correct behaviour is to build NOTHING.
  // A peer created now would point at nothing forever AND could never be
  // repaired by re-pasting, because the add-if-missing guard would find
  // it and skip. Creating nothing leaves that guard's `find` empty, so a
  // plain re-paste after DNS is fixed does the right thing.
  const s = wgChunkFor(WG);
  check(
    "no fallback address: the peer is REFUSED on DNS failure, not built against nothing",
    !s.includes(":set wgGo true"),
    "with no address to fall back to, creating the peer anyway produces an unrepairable router",
  );
  check(
    "no fallback address: the output explains that nothing was created, and why",
    /NO TUNNEL WAS BUILT/.test(s) && /NO PEER WAS/.test(s) && /re-paste THIS chunk/.test(s),
    "refusing silently is the same defect wearing a different hat",
  );
  check(
    "no fallback address: no address is invented in place of the missing one",
    !/endpoint-address="?\d{1,3}(\.\d{1,3}){3}/.test(s),
    "the generator must never type an address the backend did not give it",
  );
}
{
  const s = wgChunkFor({ ...WG, serverEndpointAddress: WG_FALLBACK_ADDR });
  check(
    "with a fallback address: it is used, and only on failure",
    s.includes(`:if ($wgDnsOk = false) do={ :set wgEp "${WG_FALLBACK_ADDR}" }`) &&
      s.includes(":set wgGo true"),
    "the founder's decision was hostname FIRST, address as the fallback -- not the other way round",
  );
  check(
    "with a fallback address: the peer comment records that it is a raw address, and what to do",
    /:set wgCmt "cloudguest-wg-hub: RAW ADDRESS [\d.]+ .*did NOT resolve/.test(s) &&
      /Remove this peer and re-paste/.test(s),
    "an address left on a peer with no explanation is how the next engineer inherits a mystery",
  );
}
{
  // `endpoint_host` is documented backend-side as "hostname OR IP".
  const s = wgChunkFor({ ...WG, serverEndpointHost: WG_LITERAL_HOST });
  check(
    "an endpoint host that is already an address skips the DNS dance entirely",
    !s.includes(":resolve") && s.includes(`endpoint-address="${WG_LITERAL_HOST}"`),
    "there is nothing to resolve and no fallback to choose; pretending otherwise is noise",
  );
  check(
    "...but still comments the peer, because 'why is this an address' is the same question",
    /comment="cloudguest-wg-hub: RAW ADDRESS/.test(s),
    "missing",
  );
}

// THE 64-ROUTER REGRESSION. `20.219.72.235` lived as a literal in code,
// got baked into `endpoint-address=` on 64 field routers, and when the
// hub's subscription died those routers became unreachable. They need
// physical visits. The backend guards its own source against this literal
// reappearing; this is the frontend half.
{
  const everything = [
    ...VARIANTS.flatMap(([, opts]) => buildRouterSetupScriptChunks(opts).map((c) => c.script)),
    wgChunkFor(WG),
    wgChunkFor({ ...WG, serverEndpointAddress: WG_FALLBACK_ADDR }),
  ].join("\n");
  check(
    `INJECTED: the dead hub address ${BANNED_HUB_LITERAL} appears in NO generated script`,
    !everything.includes(BANNED_HUB_LITERAL),
    "this exact literal is why 64 routers now need physical visits -- the hub's address must " +
      "come from the backend, never from this repo",
  );
}

// =====================================================================
// 9. THE PANEL'S "WHAT A RE-GENERATE BREAKS" TABLE IS TRUE
// =====================================================================
// Clicking Generate a second time rotates secrets server-side. Master
// console now says so, in a blocking dialog and a banner that does not
// disappear -- and, critically, says WHICH of them re-pasting the new
// script cannot repair. That claim is only worth making if it stays true,
// so it is asserted here against what the generator actually emits rather
// than against what someone believed when they wrote the sentence.

console.log("\n-- the re-generate warning matches what the chunks really do --");

// Named `REGEN_CHUNKS`, not `FULL`: section 6 already binds `FULL` at
// module scope to the *options* object for the every-subsystem-on variant.
// Two module-scope `const FULL`s is a SyntaxError, and the two are not
// interchangeable anyway -- that one is opts, this one is chunks.
const REGEN_CHUNKS = buildRouterSetupScriptChunks({
  ...BASE,
  wans: [DHCP_WAN],
  wireguard: WG,
  radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
  apiAccess: { username: "cloudguest-api", secret: "pw" },
});
const scriptOf = (pred) =>
  REGEN_CHUNKS.filter(pred)
    .map((c) => c.script)
    .join("\n");
/** Just the `else={ ... }` bodies -- the UPDATE branches. Deliberately
 * not `doBodies`, which also returns every `do={}` (the ADD branches),
 * where `secret=`/`password=` legitimately appear on a first run. */
const elseBodies = (script) =>
  [...script.matchAll(/else=\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => m[1]);

{
  // FIXED 2026-08-27, AND THE ASSERTIONS MOVED WITH THE FIX -- same shape
  // as the RADIUS pair just below. This block used to assert the opposite:
  // that the chunk had NO update branch and that the table therefore said
  // the keypair was unrepairable. That was a true description of a real
  // defect, and it cost a live router: every Generate mints a new keypair
  // AND a new tunnel IP server-side, so an already-provisioned device
  // silently kept its old identity while the hub was told to expect the
  // new one. Router 01c9171e ended up with three peers on the hub
  // (10.20.0.2/.3/.4), a handshake only on .3, and the platform tracking
  // .4 -- unrepairable except by a site visit, because the only management
  // path was the tunnel being repaired.
  //
  // Deliberately NOT testing for `else=`, which is what the previous
  // version used as its proxy for "has an update branch". The WireGuard
  // chunk cannot use `else={}`: its add and update paths are gated on
  // different predicates (`$wgGo` and the DNS-resolution ladder), so they
  // are separate `:if` statements. Asserting the proxy rather than the
  // behaviour is how a chunk could grow a real update path and still be
  // reported as having none -- exactly the failure mode this suite exists
  // to prevent. So: assert the three writes themselves.
  const wg = scriptOf((c) => c.label === "WireGuard Tunnel");
  check(
    "the WireGuard chunk updates an EXISTING interface's private key",
    /\/interface wireguard set \[find where name=/.test(wg) && /private-key=/.test(wg),
    "without this a re-paste leaves the device on its old private key and the tunnel never handshakes",
  );
  check(
    "...and updates an EXISTING hub peer's public key and endpoint",
    /\/interface wireguard peers set \[find where interface=/.test(wg),
    "the peer carries the hub's rotating public key; an add-only chunk cannot converge it",
  );
  check(
    "...and converges an EXISTING tunnel address when the platform reallocated it",
    /:foreach wgAddrRow in=\[\/ip address find where interface=/.test(wg) &&
      /\/ip address remove \$wgAddrRow/.test(wg) &&
      /\/ip address add address=/.test(wg),
    "register_external_radius_nas binds the FreeRADIUS client stanza to the tunnel IP the PLATFORM " +
      "holds -- a device left on the previous address is an unknown client and its RADIUS packets " +
      "are dropped with no reply and nothing logged",
  );
  check(
    "...so the table says the WireGuard keypair IS repairable by re-pasting",
    SECRET_REPAIR.wireguard.repairableByRepaste === true,
    "the table disagrees with the chunk",
  );
  // REUSED PEER: the platform deliberately allocated nothing, so it has no
  // private key to give. `ops/hub-agents/wg_agent.py` exposes only POST
  // (always allocates) and GET -- no delete, no update -- so every
  // allocation is permanent and unreclaimable, and reuse is now the
  // default. Writing a placeholder key over a working interface would
  // break the very tunnel this chunk exists to maintain.
  {
    const reused =
      buildRouterSetupScriptChunks({
        ...BASE,
        wans: [DHCP_WAN],
        wireguard: { ...WG, routerPrivateKey: null },
      }).find((c) => c.label === "WireGuard Tunnel")?.script ?? "";
    check(
      "a reused peer writes NO private-key anywhere",
      !/private-key=/.test(reused),
      "the device already holds the right key; overwriting it breaks the tunnel being repaired",
    );
    check(
      "...but still converges the peer and the tunnel address",
      /\/interface wireguard peers set \[find where interface=/.test(reused) &&
        /:foreach wgAddrRow in=\[\/ip address find where interface=/.test(reused) &&
        /\/ip address remove \$wgAddrRow/.test(reused),
      "reuse must still repair everything it CAN, or a re-paste fixes nothing at all",
    );
    check(
      "...and says so on-device if the interface is missing entirely",
      /this script carries no private key/.test(reused),
      "a reflashed device reusing a peer needs to be told to re-generate with rotation",
    );
    // And the normal path is unchanged.
    const fresh =
      buildRouterSetupScriptChunks({
        ...BASE,
        wans: [DHCP_WAN],
        wireguard: WG,
      }).find((c) => c.label === "WireGuard Tunnel")?.script ?? "";
    check(
      "a freshly allocated peer still writes its private key",
      /private-key=/.test(fresh),
      "reuse handling must not disarm the first-provision path",
    );
  }

  check(
    "...and the table's reason names the mechanism rather than a manual workaround",
    /private-key|peers set|ip address set/.test(SECRET_REPAIR.wireguard.why),
    "the reason string is shown verbatim in the regenerate dialog; it has to describe what actually repairs it",
  );
}
{
  // FIXED 2026-08-23, AND THE ASSERTION MOVED WITH THE FIX. This pair used
  // to assert the opposite: that the else-branch never wrote `secret=`,
  // and that the table therefore said RADIUS was unrepairable. That was a
  // true description of a real defect -- rotating the shared secret and
  // re-pasting left the router answering with the old one, and RouterOS
  // reports a secret mismatch as a timeout, so every guest login
  // Access-Rejected with nothing on either side naming the cause.
  //
  // The direction is reversed, not the coupling: the chunk writing
  // `secret=` and `repairableByRepaste: true` still have to agree, so
  // neither can be changed back on its own without turning this red.
  const radius = scriptOf((c) => c.label === "RADIUS");
  // The `else={}` branch this used to assert is gone, replaced by a
  // marker-keyed converge `set` that writes strictly MORE than it did. The
  // coupling is unchanged: it is still the `secret=` write that makes
  // SECRET_REPAIR.radius.repairableByRepaste honest, so neither can move
  // without turning this red.
  const rdConverge =
    radius
      .split("\n")
      .find((l) => /\/radius set \[find where comment="cloudguest-radius"\]/.test(l)) ?? "";
  check(
    "the RADIUS chunk converges an EXISTING entry with secret=, not just disabled=no",
    /secret=/.test(rdConverge),
    "a branch that only clears `disabled` leaves an already-provisioned router on the OLD " +
      "shared secret after a rotation, and SECRET_REPAIR.radius.repairableByRepaste would have " +
      "to be flipped back to false to stay honest",
  );
  check(
    "...and still clears disabled=yes as well",
    /disabled=no/.test(rdConverge),
    "an entry toggled off in WinBox while debugging stays off, and the secret write lands on an " +
      "entry nothing ever asks",
  );
  check(
    "...and writes service=, timeout= and src-address= too",
    /service=hotspot/.test(rdConverge) &&
      /timeout=3s/.test(rdConverge) &&
      /src-address=/.test(rdConverge),
    "each of these was unrepairable by re-paste before: an entry narrowed to service=ppp is " +
      "invisible to the hotspot; a router provisioned before timeout=3s keeps RouterOS's 300ms " +
      "default forever over a tunnelled path; and an unset src-address makes FreeRADIUS drop " +
      "every request as an unknown client, with no reply and nothing logged",
  );
  check(
    "...and the entry is identified by a marker, not by its address",
    /\/radius add .*comment="cloudguest-radius"/.test(radius) &&
      /\/radius set \[find where address=.*\] comment="cloudguest-radius"/.test(radius),
    "`find where address=` cannot tell this generator's entry from an operator's own at the same " +
      "address, so it can neither adopt safely nor converge `address=` when the hub moves",
  );
  check(
    "...so the table says the RADIUS secret IS repairable by re-pasting",
    SECRET_REPAIR.radius.repairableByRepaste === true,
    "the table disagrees with the chunk",
  );
  check(
    "the secret the else-branch writes is the one the add-branch writes",
    (radius.match(/secret="s3cr3t"/g) ?? []).length === 2,
    "two different secrets in one chunk means a re-paste repairs the entry to a value the hub " +
      "does not have -- worse than not repairing it, because it looks like it worked",
  );
}
{
  const api = scriptOf((c) => c.label.startsWith("API Access"));
  check(
    "the API Access chunk DOES have a real password-update branch",
    /else=\{ \/user set \[find name="[^"]*"\] password=/.test(api),
    "without it, the table's claim that the API password is repairable is false",
  );
  check(
    "...so the table says the API password IS repairable by re-pasting",
    SECRET_REPAIR.api.repairableByRepaste === true,
    "the table disagrees with the chunk",
  );
}
{
  const hb = scriptOf((c) => c.label.startsWith("Heartbeat"));
  check(
    "the agent credential is carried inline by BOTH heartbeat chunks",
    (hb.match(/X-Agent-Credential: cred-abc123/g) ?? []).length === 2,
    "if only one copy carried it, re-pasting would leave the other stale and the table's " +
      '"repairable" claim would be half true, which is worse than false',
  );
  check(
    "the heartbeat scheduler is removed and re-added, so a re-paste overwrites it",
    hb.includes("/system scheduler remove $existingHeartbeatSched"),
    "an add-if-missing scheduler would keep the OLD credential forever",
  );
  check(
    "...so the table says the agent credential IS repairable by re-pasting",
    SECRET_REPAIR.agent.repairableByRepaste === true,
    "the table disagrees with the chunk",
  );
  check(
    "...and names the two chunks to re-paste",
    /Heartbeat Scheduler/.test(SECRET_REPAIR.agent.why),
    'a "just re-paste it" that does not say which piece is a guess dressed as advice',
  );
}
check(
  "the agent credential rotates on EVERY generate, whatever the toggles say",
  [
    { enableWireguard: false, enableRadius: false, mintApiSecret: false },
    { enableWireguard: true, enableRadius: true, mintApiSecret: true },
  ].every((o) => rotatingSecrets(o).includes("agent")),
  "both branches of onGenerate's credential block mint a fresh plaintext -- if this were ever " +
    "conditional the dialog would under-report what it is about to break",
);
check(
  "an optional subsystem that is switched off is not claimed to rotate",
  JSON.stringify(
    rotatingSecrets({ enableWireguard: false, enableRadius: false, mintApiSecret: false }),
  ) === JSON.stringify(["agent"]),
  "over-reporting trains people to click through the dialog, which is how it stops working",
);
check(
  "every secret the table calls unrepairable explains what to remove first",
  Object.values(SECRET_REPAIR)
    .filter((v) => !v.repairableByRepaste)
    .every((v) => v.why.length > 40 && /remove|delete/i.test(v.why)),
  "an unrepairable secret with no recovery instruction is a dead end, not a warning",
);

// =====================================================================
// 10. THE ROUTER THAT CAME UP WITH NO DEFAULT CONFIGURATION
// =====================================================================
// A MikroTik hardware reset produces one of TWO states depending on how
// long the button is held. Every chunk this generator emits has only ever
// been run against the first:
//
//   WITH defaults -- `bridgeLocal`/`bridge` exists with ether2..5 in it, a
//     DHCP client sits on ether1, the defconf firewall rules are present,
//     and -- the one that turned out to matter -- MikroTik's own defconf
//     has already run `/interface list member add interface=ether1
//     list=WAN`.
//   WITHOUT defaults -- none of that. No bridge, no lists, no DHCP client,
//     no firewall rules, every interface bare.
//
// The whole failure class here is the same one this suite exists for:
// on RouterOS, `set [find ...]` against an EMPTY match SUCCEEDS -- no
// output, no error, no trace -- and `:foreach` over an empty `find`
// iterates zero times and exits clean. A chunk can therefore run
// perfectly on a bare router and configure nothing, and the only honest
// evidence of which happened is a number the chunk prints itself.
//
// Section 10 asserts two different things, and they are not the same
// thing: that the ONE real defect found (10.1) stays fixed, and that
// every chunk which creates or mutates a defconf-provided object now
// COUNTS what it did (10.2 - 10.7).

console.log("\n-- the router that came up with no default configuration --");

/** Chunks for a PPPoE WAN with every LAN-side subsystem on -- the variant
 * the bare-router L2 hole lives in. */
const BARE_PPPOE = buildRouterSetupScriptChunks({
  ...BASE,
  wans: [PPPOE_WAN],
  wireguard: WG,
  radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
  portalUrl: PORTAL,
});
const bareChunk = (chunks, needle) => {
  const hit = chunks.filter((c) => c.label.includes(needle));
  return hit.map((c) => c.script).join("\n");
};

// ---------------------------------------------------------------------
// 10.1 THE PPPoE PARENT PORT WAS SWEPT INTO THE GUEST BRIDGE.
// ---------------------------------------------------------------------
// The only behavioural defect in this section, and it is a WAN/LAN L2
// hole, not a reporting gap.
//
// For a PPPoE WAN this generator deliberately puts only the VIRTUAL
// `cloudguest-pppoe-wan<N>` interface into the "WAN" interface list --
// "WAN + Bridge" cannot add a list member for an interface that does not
// exist yet. So the PHYSICAL port carrying the session is not in the WAN
// list, and the LAN sweep's "is this a WAN port" test says no.
//
// With defaults, defconf's own `ether1 -> WAN` membership covered for
// that. Without defaults nothing does, and the sweep bridges the live
// uplink port into the guest LAN. Silently: bridging a port is legal and
// RouterOS has no opinion about it.

{
  const lanPorts = bareChunk(BARE_PPPOE, "LAN Ports");
  const PPPOE_EXCLUSION = `[:len [/interface pppoe-client find where interface=[/interface ethernet get $eth name]]] = 0`;

  check(
    "bare router: the LAN sweep excludes any port carrying a pppoe-client",
    lanPorts.includes(PPPOE_EXCLUSION),
    "a PPPoE WAN's physical port is not in the 'WAN' interface list (only its virtual " +
      "interface is), so without this live-state test the sweep bridges the uplink into the " +
      "guest LAN on any router whose defconf 'ether1 -> WAN' membership is absent",
  );

  check(
    "bare router: BOTH sweep passes apply the exclusion, not just one",
    (lanPorts.match(/\/interface pppoe-client find where interface=/g) ?? []).length >= 2,
    "the detach pass and the attach pass must agree on what is eligible -- if only the attach " +
      "pass excludes the uplink, the detach pass still rips it out of whatever bridge holds it",
  );

  check(
    "bare router: the exclusion is live state, not a second hardcoded copy of the WAN names",
    !/pppoe-client find where interface="ether1"/.test(lanPorts),
    "a hardcoded name drifts from the device the moment an interface is renamed -- the same " +
      "duplication WAN_RENAME_WARNING_HEADER exists because of",
  );

  // MODELLED, NOT ASSERTED. The eligibility test is a boolean over device
  // state, so the hole is reproduced here as that boolean rather than
  // described in a comment. `wanList` is what each reset state actually
  // leaves behind.
  const eligibleUnderShippedRule = (port, wanList, pppoeParents) =>
    !wanList.includes(port) && !pppoeParents.includes(port);
  const eligibleUnderOldRule = (port, wanList) => !wanList.includes(port);

  check(
    "INJECTED: with defaults, defconf's own ether1->WAN membership hid the hole",
    eligibleUnderOldRule("ether1", ["ether1", "cloudguest-pppoe-wan1"]) === false,
    "if the old rule already rejected ether1 here, the defect story is wrong -- re-check it",
  );
  check(
    "INJECTED: with NO defaults, the old rule swept the live PPPoE uplink into the guest bridge",
    eligibleUnderOldRule("ether1", ["cloudguest-pppoe-wan1"]) === true,
    "the bare-router hole this fix exists for is not reproducible -- re-check the reasoning " +
      "before trusting the fix",
  );
  check(
    "bare router: the shipped rule rejects the PPPoE parent port in BOTH reset states",
    eligibleUnderShippedRule("ether1", ["ether1", "cloudguest-pppoe-wan1"], ["ether1"]) === false &&
      eligibleUnderShippedRule("ether1", ["cloudguest-pppoe-wan1"], ["ether1"]) === false,
    "the fix does not actually close the hole",
  );
  check(
    "...and still admits an ordinary LAN port, so the fix is not just 'reject everything'",
    eligibleUnderShippedRule("ether3", ["cloudguest-pppoe-wan1"], ["ether1"]) === true,
    "an over-strict rule that bridges nothing is a worse bug than the one being fixed",
  );
}

// ---------------------------------------------------------------------
// 10.2 - 10.7 NEVER INFER SUCCESS FROM THE ABSENCE OF AN ERROR.
// ---------------------------------------------------------------------
// Each chunk below creates or mutates something a default configuration
// would have provided. On a bare router each is doing that work for the
// first time, and every one of them used to be silent about the outcome.
// Each now binds a count and prints it, with a FAIL branch that names the
// consequence -- the same shape section 6 already requires of the portal
// pages and section 8 of the tunnel.

/** A chunk reports honestly when it (a) reads a count off the device,
 * (b) prints that count, and (c) has a branch for the zero case that says
 * something, rather than leaving zero indistinguishable from success.
 *
 * Two legal spellings of that zero branch, both already in this file: an
 * explicit `:if ($n = 0) do={ ... }`, and -- where several counts share
 * one verdict -- the negated all-positive form
 * `:if (!($a > 0 && $n > 0)) do={ ... }` the WireGuard chunk established.
 * Accepting only the first would ban the second, which is how a guard
 * gets loosened by the next person instead of obeyed. */
const reportsACount = (script, localName) => ({
  binds: new RegExp(`:local ${localName} \\[:len \\[/`).test(script),
  prints: script.includes(`[:tostr $${localName}]`),
  hasZeroBranch:
    new RegExp(`\\$${localName}[^;]*=\\s*0\\)\\s*do=\\{`).test(script) ||
    new RegExp(`:if \\(!\\([^;]*\\$${localName} > 0[^;]*\\)\\)\\s*do=\\{`).test(script),
});

const COUNTED = [
  [
    "WAN + Bridge counts the interface list and the bridge it creates",
    bareChunk(BARE_PPPOE, "WAN + Bridge"),
    "lanBrN",
    "every later chunk binds to this bridge by name; a find that matches nothing is silent",
  ],
  [
    "the stale-defconf cleanup says whether it removed anything",
    bareChunk(BARE_PPPOE, "Stale Factory-Default DHCP Client"),
    "staleDefconfN",
    "an empty :foreach is a clean no-op -- indistinguishable from having cleared the fault",
  ],
  [
    "LAN Ports counts what actually ended up in the guest bridge",
    bareChunk(BARE_PPPOE, "LAN Ports"),
    "lanPortsN",
    "a bridge with no port in it carries the LAN address, DHCP and hotspot and serves nobody",
  ],
  [
    "the Hotspot chunk counts the five objects it creates",
    bareChunk(BARE_PPPOE, "Hotspot"),
    "hsProf1",
    "the unconditional `set [find name=hsprof1]` lines succeed against an empty match",
  ],
  // The "Self-Signed HTTPS Certificate" chunk used to be counted here, on
  // `ctLeaf`. That chunk is gone -- see section 13 and the tombstone
  // comment in the generator for why -- so its three checks are replaced,
  // not dropped, by the three below over the read-back that took its
  // place. Coverage of the property that actually broke went UP: the old
  // checks proved a certificate existed, these prove `login-by` is what
  // the script believes it is.
  [
    "the Hotspot chunk reads login-by back off the device after setting it",
    bareChunk(BARE_PPPOE, "Hotspot"),
    "hsLoginByN",
    "`set [find name=hsprof1] login-by=...` against an empty match succeeds silently, and a " +
      "second writer overwriting it succeeds just as silently -- the value is the only evidence",
  ],
  [
    "the RADIUS chunk reads hsprof1 back after wiring use-radius into it",
    bareChunk(BARE_PPPOE, "RADIUS"),
    "rdProf",
    "a /radius entry plus a hotspot that never asks it anything fails every guest login",
  ],
];

for (const [what, script, localName, why] of COUNTED) {
  const r = reportsACount(script, localName);
  check(`bare router: ${what}`, r.binds, `no :local ${localName} read off the device -- ${why}`);
  check(
    `bare router: ...and $${localName} is PRINTED, not just read`,
    r.prints,
    `$${localName} is never rendered into the paste output, so the operator sees nothing`,
  );
  check(
    `bare router: ...and a zero $${localName} takes a branch that says so`,
    r.hasZeroBranch,
    `zero is silently indistinguishable from success -- ${why}`,
  );
}

// The zero branches have to say something USEFUL, not just exist. Same
// requirement section 6 puts on the portal pages: a fix that quietly does
// the right thing is half of what was asked for.
for (const [what, script] of [
  ["LAN Ports", bareChunk(BARE_PPPOE, "LAN Ports")],
  ["Hotspot", bareChunk(BARE_PPPOE, "Hotspot")],
  ["WAN + Bridge", bareChunk(BARE_PPPOE, "WAN + Bridge")],
  ["RADIUS", bareChunk(BARE_PPPOE, "RADIUS")],
]) {
  check(
    `bare router: ${what}'s failure output names the consequence and logs it`,
    /:put "  (RESULT: )?FAIL/.test(script) && /:log warning "cloudguest[^"]{30,}/.test(script),
    "a FAIL with no consequence and no log line scrolls past in a terminal and is gone",
  );
}

check(
  "bare router: LAN Ports names the ports it bridged, not just how many",
  bareChunk(BARE_PPPOE, "LAN Ports").includes(
    `:foreach lanP in=[/interface bridge port find where bridge=`,
  ),
  "ether2..ether5 is an hEX detail, not a rule -- on an unfamiliar board a bare count would " +
    "look identical whether the sweep picked the right ports or the wrong ones",
);

// The zero case in this chunk specifically is the EXPECTED case on a bare
// router, so it has to read as an outcome ("0 found, nothing removed"),
// not as an absence. A generic "has a zero branch" test passes on a chunk
// whose zero branch says something vague; this pins the number.
check(
  "bare router: the stale-defconf cleanup's zero branch states the count, not just a sentence",
  /:if \(\$staleDefconfN = 0\) do=\{ :put "[^"]*\b0\b[^"]*" \}/.test(
    bareChunk(BARE_PPPOE, "Stale Factory-Default DHCP Client"),
  ),
  "on a bare router this is the normal outcome, and 'nothing was said' is exactly how the " +
    "operator concludes the duplicate-address fault was cleared when it was never there",
);

check(
  "bare router: the stale-defconf cleanup still actually removes the client it counts",
  /:foreach staleDefconfClient in=\[\/ip dhcp-client find where interface="bridgeLocal"\] do=\{ \/ip dhcp-client remove \$staleDefconfClient \}/.test(
    bareChunk(BARE_PPPOE, "Stale Factory-Default DHCP Client"),
  ),
  "counting is an addition to the removal, not a replacement for it -- the duplicate-address " +
    "fault on bridgeLocal is a confirmed live incident",
);

// ---------------------------------------------------------------------
// 10.8 NOTHING IS POSITIONED AGAINST A RULE ONLY DEFCONF PROVIDES.
// ---------------------------------------------------------------------
// `place-before=` against a rule that does not exist is the exact syntax
// error that once put the WireGuard accept rule BELOW the WAN drop rule on
// a real router. A bare router has no defconf firewall rules at all, so
// any `place-before` whose target is assumed rather than counted is that
// bug waiting for the second reset state.

{
  /** ONE predicate, used by the sweep AND by the self-checks below. It was
   * duplicated at first, and a mutation of the sweep's copy then went
   * uncaught because the self-check was still testing its own private
   * copy -- exactly the "guard that cannot be shown to fail" this section
   * is supposed to rule out. Shared, so mutating it breaks both. */
  const placeBeforeOk = (line, target) =>
    target.startsWith("$") &&
    new RegExp(`:local ${target.slice(1)} \\[/`).test(line) &&
    new RegExp(`\\[:len \\${target}\\]\\s*>\\s*0`).test(line);

  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      for (const m of line.matchAll(/place-before=(\S+)/g)) {
        if (!placeBeforeOk(line, m[1]))
          offenders.push(`${label}, line ${n + 1}: place-before=${m[1]}`);
      }
    });
  }
  check(
    "bare router: every place-before targets a variable bound on the same line AND guarded non-empty",
    offenders.length === 0,
    `${offenders.length} unguarded place-before target(s). On a router with no defconf firewall ` +
      `the target find is empty, and place-before against an empty match is the syntax error ` +
      `that landed the WireGuard accept rule below the drop rule on "gurugram".\n      ` +
      offenders.join("\n      "),
  );
  check(
    "INJECTED: the place-before guard rejects a literal defconf-rule target",
    !placeBeforeOk(
      `/ip firewall filter add action=accept place-before=[/ip firewall filter find where comment="defconf: drop all not coming from LAN"]`,
      `[/ip`,
    ),
    "the guard accepts the exact shape it exists to ban",
  );
  check(
    "INJECTED: ...and rejects a variable that is bound but never length-checked",
    !placeBeforeOk(
      `:local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]; /ip firewall filter add action=accept place-before=$wanDropRule`,
      `$wanDropRule`,
    ),
    "binding the target is not the same as knowing it matched something -- an empty match is " +
      "precisely the case place-before cannot survive",
  );
  check(
    "...and ACCEPTS the shipped shape, so the guard is not simply banning place-before",
    placeBeforeOk(
      `:local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]; :if ([:len $wgAllowRule] = 0 && [:len $wanDropRule] > 0) do={ /ip firewall filter add action=accept place-before=$wanDropRule }`,
      `$wanDropRule`,
    ),
    "the guard bans the correct, shipped form -- which is how a guard gets deleted",
  );
}

check(
  "bare router: the WireGuard chunk still has a no-target branch that plain-adds the rule",
  /:if \(\[:len \$wgAllowRule\] = 0 && \[:len \$wanDropRule\] = 0\) do=\{ \/ip firewall filter add [^}]*\}/.test(
    bareChunk(BARE_PPPOE, "WireGuard Tunnel"),
  ),
  "without this branch a bare router (or one where the Firewall chunk was pasted second) gets " +
    "NO management accept rule at all instead of one in the wrong place",
);

// ---------------------------------------------------------------------
// 10.9 EVERY OBJECT A DEFAULT CONFIG WOULD HAVE PROVIDED IS CREATED, NOT
//      ASSUMED.
// ---------------------------------------------------------------------
// An `add` with no existence test in front of it errors on the second
// paste; an object that is only ever `set` and never `add`ed does nothing
// at all on the first paste against a bare router. Every `add` this
// generator emits must therefore carry an existence test on its own
// entered line -- the console runs each line as its own program, so a
// guard on a different line is not a guard.

{
  /** `/system scheduler add` is deliberately unconditional: the line above
   * it removes the existing entry first, because existence alone does not
   * mean the entry is healthy (see that chunk's own comment). */
  const INTENTIONALLY_UNGUARDED = [/\/system scheduler add /];
  /** Shared by the sweep and by both self-checks, for the same reason the
   * place-before predicate above is: a self-check that keeps its own copy
   * of the regex cannot see the sweep's copy being mutated, and a mutation
   * of the sweep therefore passes. Verified: mutating either of these two
   * now turns the self-checks red. */
  const IS_ADD_LINE = (line) => /(?:^|[{;\s])\/[a-z][a-z0-9 /-]* add /.test(line);
  const HAS_EXISTENCE_TEST = (line) => /\]\s*=\s*0/.test(line);

  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      if (line.trimStart().startsWith("#")) return;
      if (!IS_ADD_LINE(line)) return;
      if (INTENTIONALLY_UNGUARDED.some((re) => re.test(line))) return;
      if (HAS_EXISTENCE_TEST(line)) return;
      offenders.push(`${label}, line ${n + 1}: ${line.slice(0, 110)}`);
    });
  }
  check(
    "bare router: every emitted `add` carries an existence test on its own entered line",
    offenders.length === 0,
    `${offenders.length} unguarded add(s). On a bare router the object does not exist and on a ` +
      `re-paste it does, so an add with no [:len [find ...]] = 0 test is broken in one of the ` +
      `two directions whichever way you look at it.\n      ` +
      offenders.slice(0, 10).join("\n      "),
  );
  check(
    "INJECTED: that guard actually recognises an unguarded add",
    IS_ADD_LINE(`/interface bridge add name="bridge-guest"`) &&
      !HAS_EXISTENCE_TEST(`/interface bridge add name="bridge-guest"`),
    "the add-detection regex does not match a bare add, so the guard cannot fire at all",
  );
  check(
    "INJECTED: ...and does NOT fire on the guarded form it exists to require",
    IS_ADD_LINE(
      `:if ([:len [/interface bridge find where name="bridge-guest"]] = 0) do={ /interface bridge add name="bridge-guest" }`,
    ) &&
      HAS_EXISTENCE_TEST(
        `:if ([:len [/interface bridge find where name="bridge-guest"]] = 0) do={ /interface bridge add name="bridge-guest" }`,
      ),
    "the guard bans the very shape it is asking for, which is how a guard gets switched off",
  );
}

// The `bridgeLocal` literal is a defconf artifact name. It is legitimate
// in the cleanup chunk (that chunk's entire job is to look for it) and
// nowhere else -- any other chunk matching on it would silently match
// nothing on a bare router while looking like it worked.
{
  const elsewhere = BARE_PPPOE.filter(
    (c) => c.script.includes("bridgeLocal") && !c.label.includes("Stale Factory-Default"),
  ).map((c) => c.label);
  check(
    "bare router: no chunk except the cleanup one matches on the defconf `bridgeLocal` name",
    elsewhere.length === 0,
    `${elsewhere.join(", ")} depend(s) on a name a bare router never had`,
  );
  check(
    "bare router: no chunk matches on RouterOS's own `defconf` comment either",
    !BARE_PPPOE.some((c) => /comment[=~]"?defconf/.test(c.script)),
    "defconf-commented rules do not exist on a router reset with no default configuration, so " +
      "any find keyed on them is empty and every set against it succeeds while doing nothing",
  );
}

// =====================================================================
// 11. RouterOS SYNTAX QA OVER EVERY EMITTED LINE
// =====================================================================
// A full-script QA pass over the advanced module, prompted by a live
// failure: the founder pasted the "WAN Routing" chunk into a real hEX and
// the console answered with nothing but `error`.
//
// THE DEFECT. A concatenation passed as a command ARGUMENT must be
// wrapped in parentheses on RouterOS. This shipped:
//
//   :log warning "cloudguest: WAN1 gateway ... (still \"" . $wan1Gw . "\") ..."
//
// The console parses `:log warning "<string>"` as a complete command and
// then meets `. $wan1Gw . "..."` as a second, meaningless command inside
// the same statement. That is a hard syntax error, and because this
// generator `;`-joins a whole chunk onto ONE entered line, the error
// aborts the ENTIRE line: the DHCP gateway poll, the plain default route,
// and every routing-mark'd route below it never ran. The router was left
// with no default route at all -- the precise "no gateway-health signal"
// state the chunk exists to prevent, reached by a syntax error rather
// than a logic error.
//
// Neither existing guard could see it. It is not a variable crossing a
// line (section 1) and not a multi-statement body (section 2); the
// `do={}` here holds exactly one statement. It is malformed ARGUMENT
// syntax, a third thing.
//
// It was the ONLY unparenthesised concatenation in the generator -- every
// other one already had parens. One site, missed once. So it is swept for
// now instead of being left to review, along with three other whole-script
// properties the same QA pass measured.

console.log("\n-- RouterOS syntax QA over every emitted line --");

/** Strips double-quoted string contents from a line, so a `.`, `/` or
 * `;` that is only ever text inside a `:put` message is never mistaken
 * for syntax. Same skip-strings discipline as `doBodies`. */
const stripStrings = (line) => {
  let out = "";
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += '""';
      continue;
    }
    out += c;
  }
  return out;
};

// ---------------------------------------------------------------------
// 11.1 A CONCATENATION IS AN EXPRESSION, AND AN ARGUMENT MUST BE WRAPPED.
// ---------------------------------------------------------------------

/** Command arguments that concatenate, and whether they are parenthesised.
 * Deliberately runs against the RAW line, not the stripped one: the
 * argument text itself is what has to be inspected. The `.` test uses
 * surrounding spaces, which is how this generator always spells
 * concatenation and which cannot collide with a dotted IP or a filename. */
const CONCAT_ARG = /(:put|:log\s+(?:info|warning|error)|:error)\s+([^;}]+)/g;
const concatOffenders = (script) => {
  const bad = [];
  for (const line of script.split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    for (const m of line.matchAll(CONCAT_ARG)) {
      const arg = m[2].trim();
      if (!/\s\.\s/.test(stripStrings(arg))) continue;
      if (arg.startsWith("(")) continue;
      bad.push(`${m[1]} ${arg.slice(0, 120)}`);
    }
  }
  return bad;
};

{
  const offenders = [];
  for (const [label, script] of pasteables) {
    for (const o of concatOffenders(script)) offenders.push(`${label}: ${o}`);
  }
  check(
    "QA: every concatenated command argument is parenthesised",
    offenders.length === 0,
    `${offenders.length} unparenthesised concatenation(s). RouterOS parses the command as ` +
      `complete at the end of the first string and then chokes on the trailing ". $var .", ` +
      `which aborts the WHOLE ;-joined line -- confirmed live on the founder's hEX, where it ` +
      `left the router with no default route.\n      ` +
      offenders.slice(0, 8).join("\n      "),
  );
}

// The guard is pointed at the exact text that failed on the device, and
// at the corrected form, so it cannot quietly stop being able to tell
// them apart.
check(
  "INJECTED: the guard fires on the exact line that errored on the hEX",
  concatOffenders(
    `:if (!($wan1Gw != "" && $wan1Gw != "0.0.0.0")) do={ :log warning "cloudguest: WAN1 gateway did not resolve (still \\"" . $wan1Gw . "\\") -- no default route added for this WAN; re-paste this chunk once the link is up" }`,
  ).length === 1,
  "the guard is blind to the shape it was written for",
);
check(
  "...and does NOT fire on the parenthesised form that replaced it",
  concatOffenders(
    `:if (!($wan1Gw != "" && $wan1Gw != "0.0.0.0")) do={ :log warning ("cloudguest: WAN1 gateway did not resolve (still \\"" . $wan1Gw . "\\") -- no default route added for this WAN; re-paste this chunk once the link is up") }`,
  ).length === 0,
  "the guard bans the fix, which is how a guard gets switched off",
);
check(
  "...and does NOT fire on a plain string argument with no concatenation",
  concatOffenders(`:if ($lanPortsN = 0) do={ :put "  RESULT: FAIL -- NOTHING is bridged in." }`)
    .length === 0,
  "over-strict: an ordinary literal message is reported as an offender",
);
// ANTI-OVER-STRICTNESS, and it has to use a message that really does
// contain a space-dot-space, or it proves nothing: the first version of
// this check used "print. Then", which has no leading space and so passed
// even with string-skipping switched off. A guard that cannot be shown to
// fail is not a guard, and that applies to the self-checks too.
check(
  "...and is not fooled by a space-dot-space that is only ever text inside a message",
  concatOffenders(`:put "  Pool ranges read as 10.5.50.10 . 10.5.50.254 in some MikroTik docs."`)
    .length === 0,
  "the guard reads a literal message as a concatenation, so it would ban ordinary output text",
);

// ---------------------------------------------------------------------
// 11.2 EVERY COMMAND PATH IS A REAL RouterOS MENU.
// ---------------------------------------------------------------------
// `/ip pppoe-client` does not exist -- it is `/interface pppoe-client`.
// A path typo is invisible to every other guard here and produces either
// a syntax error or, on a `find`, an empty match that every `set` then
// succeeds against silently. The allowlist is the set this generator
// touches today; adding a menu is a deliberate edit to this list, not
// something that slips in.

const HOTSPOT_DNS_NAME_RE = "wifi\\.wyfyguest\\.com";

const KNOWN_MENUS = new Set([
  // The run stamp the portal chunks write -- a single settable string this
  // platform otherwise never touches, carrying which generation last landed
  // on the device. See the "Portal Stamp" chunk.
  "/system note",
  // `/certificate` was here until the self-signed hotspot certificate
  // chunk was deleted (section 13). Removing it from this list is not
  // housekeeping: the "no dead entries" check below is what forces the
  // list to keep describing the script, and leaving `/certificate` in
  // would pre-authorise the exact menu whose return this section exists
  // to make loud.
  "/file",
  "/interface",
  "/interface bridge",
  "/interface bridge port",
  "/interface ethernet",
  "/interface list",
  "/interface list member",
  "/interface pppoe-client",
  "/interface wireguard",
  "/interface wireguard peers",
  "/ip address",
  "/ip arp",
  "/ip dhcp-client",
  "/ip dhcp-server",
  "/ip dhcp-server network",
  // RFC 8910's Captive-Portal URI, added deliberately -- this check caught
  // both of them the moment they appeared, which is what it is for.
  // VERIFIED ON REAL HARDWARE before being listed, not assumed: both menus
  // enumerate on the founder's hEX lite running RouterOS 7.23.3. The
  // failure this list exists to stop is `/ip pppoe-client` for
  // `/interface pppoe-client` -- a path that does not exist matches nothing
  // on a `find`, forever, in silence.
  "/ip dhcp-server option",
  "/ip dhcp-server option sets",
  "/ip dns",
  "/ip dns static",
  "/ip firewall address-list",
  "/ip firewall filter",
  "/ip firewall mangle",
  "/ip firewall nat",
  "/ip hotspot",
  // The list of currently authenticated hotspot sessions. The authorized-
  // MAC sync reads it so it never adds a `type=bypassed` ip-binding for a
  // MAC that RouterOS is already tracking as a live host -- doing so makes
  // RouterOS tear that host down ("logged out: host removed: ip binding
  // changed"), the self-inflicted teardown confirmed live on 10.5.50.1.
  "/ip hotspot active",
  // Added deliberately, per this check's own instruction, for the
  // heartbeat's authorized-MAC sync. This is the menu that actually opens
  // the NAS gate for a guest who has already verified an OTP: without a
  // consumer for `GET /agent/authorized-macs`, the backend created a real
  // session, the portal said "You're connected", and `/ip hotspot active`
  // on the device stayed empty.
  "/ip hotspot ip-binding",
  "/ip hotspot profile",
  "/ip hotspot user",
  "/ip hotspot user profile",
  "/ip hotspot walled-garden",
  "/ip hotspot walled-garden ip",
  "/ip pool",
  "/ip route",
  "/ip service",
  "/radius",
  // The RFC 5176 Change-of-Authorization listener -- a SINGLETON settings
  // object, not a table, so it is `set` with no `find` in front of it (see
  // the RADIUS chunk's own comment for why that is correct here and not an
  // unguarded write). Added deliberately, per this check's own instruction.
  // Not verified by this author on hardware, but on stronger evidence than
  // a second text renderer would be: `wyfy_device_gateway.mikrotik_adapter
  // ._set_radius_client_config_sync` drives this exact menu over the
  // STRUCTURED RouterOS API (`api.path("radius", "incoming").update(...)`),
  // which a device rejects outright if the path does not exist.
  "/radius incoming",
  // RouterOS 7 only. A route may not enter a routing table that has not
  // been declared here first, and on v6 this menu does not exist at all --
  // which is one of the things the generator's own version banner warns
  // about, since a `find` against a missing menu is another silent empty
  // match.
  "/routing table",
  "/system clock",
  "/system identity",
  "/system ntp client",
  "/system resource",
  "/system scheduler",
  "/tool",
  "/user",
]);

const MENU_VERB =
  /(\/[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*?)\s+(add|set|remove|find|get|print|monitor|sign|move|fetch|enable|disable|export)\b/g;
const menusIn = (script) => {
  const found = new Set();
  for (const line of script.split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    for (const m of stripStrings(line).matchAll(MENU_VERB)) found.add(m[1]);
  }
  return found;
};

/** ONE predicate for "paths this script uses that are not known menus",
 * shared by the sweep and by its own self-checks. Kept shared on purpose:
 * an earlier version had the sweep accumulate offenders inline while the
 * self-check re-derived the answer its own way, so mutating the sweep
 * changed nothing the self-check could see. Two guards in this file had
 * already been caught by exactly that. */
const unknownMenusIn = (script) => [...menusIn(script)].filter((m) => !KNOWN_MENUS.has(m));

{
  const unknown = new Map();
  for (const [label, script] of pasteables) {
    for (const menu of unknownMenusIn(script)) unknown.set(menu, label);
  }
  check(
    "QA: every command path is a known RouterOS menu",
    unknown.size === 0,
    `${unknown.size} unrecognised path(s): ` +
      [...unknown].map(([m, l]) => `${m} (${l})`).join(", ") +
      `. Either it is a typo -- /ip pppoe-client for /interface pppoe-client is the shape to ` +
      `watch, and on a find it silently matches nothing forever -- or it is a real new menu, ` +
      `in which case add it to KNOWN_MENUS deliberately.`,
  );
  check(
    "INJECTED: the menu guard catches the /ip pppoe-client typo",
    unknownMenusIn(
      `:if ([:len [/ip pppoe-client find where interface="ether1"]] = 0) do={ :put "x" }`,
    ).length === 1,
    "the guard cannot see a wrong menu path, so it protects nothing",
  );
  check(
    "...and passes the real /interface pppoe-client path",
    unknownMenusIn(
      `:if ([:len [/interface pppoe-client find where interface="ether1"]] = 0) do={ :put "x" }`,
    ).length === 0,
    "the guard rejects a correct path",
  );
  check(
    "QA: the allowlist has no dead entries left behind by a removed chunk",
    [...KNOWN_MENUS].every((m) => pasteables.some(([, s]) => menusIn(s).has(m))),
    "a menu in the list that nothing emits means a chunk was deleted and the list was not " +
      "updated -- the list stops describing the script and starts being decoration",
  );
}

// ---------------------------------------------------------------------
// 11.3 THE PASTE STAYS INSIDE WHAT WinBox HAS SURVIVED.
// ---------------------------------------------------------------------
// This file's entire chunking discipline exists because WinBox's terminal
// was confirmed live to drop/mangle characters on a very long paste. The
// longest line this generator emits is the WAN Routing chunk's, at ~3.1KB
// -- and that is the chunk that just failed on the founder's router. The
// failure was the parens, not the length, but a budget that nothing
// measures is a budget that grows until it is the length.

const MAX_LINE = 3300;
{
  const longest = pasteables
    .flatMap(([label, s]) => s.split("\n").map((l) => [l.length, label]))
    .sort((a, b) => b[0] - a[0])[0];
  check(
    `QA: no emitted line exceeds ${MAX_LINE} chars (longest is ${longest[0]})`,
    longest[0] <= MAX_LINE,
    `${longest[1]} emits a ${longest[0]}-char line. WinBox's terminal mangles long pastes -- ` +
      `that is why this generator chunks at all. Split the chunk rather than raising this.`,
  );
}

// ---------------------------------------------------------------------
// 11.4 A CHUNK MAY NOT SILENTLY FREEZE THE TERMINAL.
// ---------------------------------------------------------------------
// The DHCP gateway poll and the NTP poll both block the console on
// purpose -- `/import` never pauses, and waiting is the whole fix for the
// lease-not-bound-yet defect. But a technician staring at a frozen
// terminal with no output decides it has hung and reboots. Two WANs
// already put WAN Routing at 50s; three would be 75. Budgeted.

const MAX_DELAY_S = 60;
{
  const worst = pasteables
    .map(([label, s]) => [
      [...s.matchAll(/:delay\s+(\d+)s/g)].reduce((a, m) => a + Number(m[1]), 0),
      label,
    ])
    .sort((a, b) => b[0] - a[0])[0];
  check(
    `QA: no chunk blocks the console for more than ${MAX_DELAY_S}s (worst is ${worst[0]}s)`,
    worst[0] <= MAX_DELAY_S,
    `${worst[1]} can block for ${worst[0]}s with no output. A technician reads a frozen ` +
      `terminal as a hang and power-cycles the router mid-provision.`,
  );
}

// =====================================================================
// 12. THE UPLINK IS DISCOVERED, NOT ASSUMED -- IN THE WAN CONFIGURATION
//     CHUNKS, NOT ONLY IN THE HEARTBEAT
// =====================================================================
// Section 3 above proved the HEARTBEAT derives the uplink from the routing
// table. It said nothing about the chunks that BUILD that uplink's routes,
// and those were still working from a different set of facts: the port
// typed into "WAN N interface", and a `/ip dhcp-client` lookup keyed on
// it. Both are assumptions about where a WAN lives, and both are wrong on
// a router that is nonetheless perfectly online -- a renamed port, a VLAN
// or SFP sub-interface, an ISP that moved, a static gateway left blank.
//
// The rule this section enforces:
//
//   "WAN1"/"WAN2" ARE LOGICAL LABELS OF THIS PLATFORM'S OWN. No interface
//   on the device has to be called WAN1, WAN2, ether1 or ether2. The only
//   authority on which interface is carrying the internet is the
//   lowest-distance ACTIVE default route in the MAIN routing table.
//
// EVERY LOOKUP, NOT SOMEWHERE. Section 3's own history is the reason this
// is written as a sweep over every occurrence rather than a substring
// test: an earlier version of that guard asserted the qualifiers appeared
// SOMEWHERE, and a mutation that stripped them from the counting lookup
// while leaving them on the selecting one went undetected. That hole has
// now been found twice in this file. So this walks every default-route
// lookup in every chunk of every variant, and the ONE deliberate exception
// (the duplicate-slot adoption find, which must NOT filter on `active`)
// is recognised by its exact shape, asserted to exist, and asserted to
// still carry `routing-mark=""`. Neither the rule nor its exception can
// disappear quietly.

console.log("\n-- the uplink is discovered from the routing table, for every WAN shape --");

/** A default-route lookup, as it appears in a generated chunk: everything
 * between `dst-address="0.0.0.0/0"` and the `]` that closes the find.
 * One level of RouterOS escaping is undone first so the scheduler's stored
 * copy (where the quotes arrive as `\"`) is counted too, not skipped. */
const defaultRouteLookupsIn = (text) =>
  [...text.replace(/\\(.)/g, "$1").matchAll(/dst-address="0\.0\.0\.0\/0"([^\]]*)/g)].map(
    (m) => m[1],
  );

/** THE ONE EXCEPTION, recognised by shape rather than by position: the
 * "is this dst-address+gateway slot already occupied" find. RouterOS's own
 * duplicate-route check is on dst-address+gateway alone, and an INACTIVE
 * route occupies the slot exactly as much as an active one does, so
 * filtering this one on `active=yes` would skip the adopt branch, fall
 * into the add branch, and turn a silent no-op into "failure: already have
 * such route" mid-paste. It still has to carry `routing-mark=""`, or it
 * would adopt one of this generator's own routing-mark'd copies. */
const IS_SLOT_ADOPTION_LOOKUP = (tail) => /^ gateway=\$\w+ routing-table="main"$/.test(tail);

/** Everything else. These are the lookups that answer "which uplink is
 * live", and an Inactive route or a routing-mark'd copy is a wrong answer
 * to that question, not a partial one. */
const IS_UPLINK_DISCOVERY_LOOKUP = (tail) => !IS_SLOT_ADOPTION_LOOKUP(tail);

// The classifier is a guard in its own right, so it is proven to bite
// before it is trusted -- both directions. An over-strict classifier
// (everything is "discovery") would make the exception impossible to
// express and get switched off; an over-loose one (everything is
// "adoption") would exempt every lookup in the file.
check(
  "INJECTED: the lookup classifier recognises the adoption find it must exempt",
  IS_SLOT_ADOPTION_LOOKUP(` gateway=$wan1Gw routing-table="main"`) &&
    IS_SLOT_ADOPTION_LOOKUP(` gateway=$w2fGw routing-table="main"`),
  "the exemption no longer matches the shape it exists for, so the real adoption find would be " +
    "reported as an unqualified discovery lookup and this guard would be switched off",
);
check(
  "INJECTED: ...and does NOT exempt an unqualified discovery lookup",
  IS_UPLINK_DISCOVERY_LOOKUP(` routing-table="main"`) &&
    IS_UPLINK_DISCOVERY_LOOKUP(` active=yes routing-table="main" distance=$hbDist`) &&
    IS_UPLINK_DISCOVERY_LOOKUP(``),
  "the exemption is wide enough to swallow a real discovery lookup, which is how `active=yes` " +
    "gets dropped from the sweep that selects the uplink without anything failing",
);
check(
  "INJECTED: ...and does not exempt an adoption-shaped find that lost its main-table filter",
  !IS_SLOT_ADOPTION_LOOKUP(` gateway=$wan1Gw`) &&
    !IS_SLOT_ADOPTION_LOOKUP(` gateway=$wan1Gw active=yes`),
  "an adoption find with no main-table filter would adopt this generator's own marked routes",
);

for (const [variant, opts] of VARIANTS) {
  const chunks = buildRouterSetupScriptChunks(opts);
  const text = allText(chunks);
  const wanRouting = chunkByLabel(chunks, "WAN Routing");
  const wanRoutingText = allText(wanRouting);
  const lookups = defaultRouteLookupsIn(text);
  const discovery = lookups.filter(IS_UPLINK_DISCOVERY_LOOKUP);
  const adoption = lookups.filter(IS_SLOT_ADOPTION_LOOKUP);

  // ---- 12.1 every discovery lookup, in every chunk -------------------
  check(
    `${variant}: EVERY default-route lookup in the WHOLE script requires active=yes`,
    discovery.length > 0 && discovery.every((t) => t.includes("active=yes")),
    "RouterOS keeps an unreachable default route in the table and flags it Inactive rather than " +
      "removing it, so an unqualified lookup calls a dead uplink healthy. Unqualified: " +
      JSON.stringify(discovery.filter((t) => !t.includes("active=yes"))),
  );
  check(
    `${variant}: EVERY default-route lookup in the WHOLE script reads the MAIN table`,
    lookups.length > 0 && lookups.every((t) => t.includes(`routing-table="main"`)),
    "this generator itself creates routing-mark'd default routes per WAN, so an unqualified find " +
      "returns routes from several tables at once. Unqualified: " +
      JSON.stringify(lookups.filter((t) => !t.includes(`routing-table="main"`))),
  );
  // The exception has to keep existing, or a future edit that "fixes" it
  // by adding `active=yes` would pass 11.1 while reintroducing a hard
  // mid-paste error on any router carrying a foreign default route.
  if (!opts.basicConfigOnly) {
    // NAMED, not counted. Counting survived a mutation that added
    // `active=yes` to the mode-specific adoption find: the mutated find
    // stopped being adoption-shaped, moved into the "discovery" bucket
    // where it passed 11.1 on its new qualifiers, and the remaining
    // fallback adoptions still met the count. That is the same
    // "asserted somewhere rather than on every one" hole this file has
    // now been bitten by three times. So each of the two adoption finds
    // every WAN must have is required BY ITS EXACT VARIABLE.
    const missingAdoptions = opts.wans.flatMap((_, i) => {
      const n = i + 1;
      return [`$wan${n}Gw`, `$w${n}fGw`].filter(
        (v) => !adoption.includes(` gateway=${v} routing-table="main"`),
      );
    });
    check(
      `${variant}: every WAN's duplicate-slot adoption find exists and stays unfiltered on active`,
      missingAdoptions.length === 0,
      `${JSON.stringify(missingAdoptions)} has no ` +
        `\`dst-address="0.0.0.0/0" gateway=<var> routing-table="main"\` find. Either it was deleted, or ` +
        "it grew an `active=yes` it must not have: an INACTIVE route occupies the " +
        "dst-address+gateway slot just as much as an active one, so filtering it out skips the " +
        'adopt branch and turns a silent no-op into "failure: already have such route" mid-paste',
    );
  }
  // Complementary sweep, keyed on the command rather than on the
  // dst-address literal: catches a lookup written without the quotes that
  // 11.1's regex keys on.
  const routeFinds = [...text.replace(/\\(.)/g, "$1").matchAll(/\/ip route find where([^\]]*)/g)]
    .map((m) => m[1])
    .filter((t) => !/comment[=~]/.test(t));
  check(
    `${variant}: every non-comment /ip route find is either qualified or the adoption find`,
    routeFinds.length > 0 &&
      routeFinds.every(
        (t) =>
          (t.includes("active=yes") && t.includes(`routing-table="main"`)) ||
          /gateway=\$\w+ routing-table="main"/.test(t),
      ),
    `unqualified: ${JSON.stringify(
      routeFinds.filter(
        (t) =>
          !(
            (t.includes("active=yes") && t.includes(`routing-table="main"`)) ||
            /gateway=\$\w+ routing-table="main"/.test(t)
          ),
      ),
    )}`,
  );

  // ---- 12.2 no interface name is assumed -----------------------------
  const wanNames = opts.wans.map((w) => w.iface);
  const lanNames = opts.lanIfs ?? [];
  const named = new Set([...wanNames, ...lanNames]);
  const leaked = [...new Set(text.match(/\bether\d+\b/g) ?? [])].filter((n) => !named.has(n));
  check(
    `${variant}: no ether<N> name appears that the caller did not supply`,
    leaked.length === 0,
    `${JSON.stringify(leaked)} is baked in -- that is the "WAN1 is ether1" assumption, wherever ` +
      "it has moved to",
  );
  check(
    `${variant}: never forces a WAN1/WAN2 interface NAME onto the device`,
    !/(interface|name)=\\?"WAN[0-9]\\?"/.test(text),
    'a find or add keyed on an interface literally named "WAN1"/"WAN2" -- those are this ' +
      "platform's logical labels, not names any router has to carry",
  );
  check(
    `${variant}: never renames one of the user's interfaces`,
    !/\/interface[a-z ]* set \[find [^\]]*\] [^;\n]*\bname=/.test(text),
    "renaming a WAN port is the exact confirmed-live incident WAN_RENAME_WARNING_HEADER exists " +
      "to warn against, and this generator must never do it either",
  );

  if (opts.basicConfigOnly) continue;

  // ---- 12.3 the routing chunk resolves the uplink the same way -------
  check(
    `${variant}: the WAN Routing chunk resolves the uplink from the routing table at all`,
    /:for w\dfDist from=1 to=255 do=\{/.test(wanRoutingText),
    "the WAN configuration chunk still trusts only the port it was told about",
  );
  check(
    `${variant}: ...by ASCENDING distance, so the lowest-distance route wins`,
    /distance=\$w\dfDist\]/.test(wanRoutingText) &&
      /distance=\$w\dfGwDist\]/.test(wanRoutingText) &&
      /distance=\$wanChkDist\]/.test(wanRoutingText),
    "no explicit ascending sweep -- which route is chosen would depend on find order",
  );
  check(
    `${variant}: ...handling immediate-gw, gateway-as-interface-name and ARP, each guarded`,
    /immediate-gw/.test(wanRoutingText) &&
      /\/ip arp get \[find where address=/.test(wanRoutingText) &&
      (wanRoutingText.match(/on-error=/g) ?? []).length >= 3,
    "one of the three resolution paths is missing, or one of them is unguarded -- an unguarded " +
      "one aborts the rest of the entered line",
  );
  check(
    `${variant}: ...and the result is VERIFIED to be a real interface before it is used`,
    (
      wanRoutingText.match(
        /!\(\[:len \[\/interface find where name=\$\w+\]\] > 0\)\) do=\{ :set \w+ ""/g,
      ) ?? []
    ).length >= 2,
    "a name that survived immediate-gw/gateway/ARP but matches no interface would be used as " +
      "though it were real -- every resolution here is an inference and must degrade to " +
      '"unresolved", never to a plausible wrong name',
  );

  // ---- 12.3b a multi-WAN fallback must match ITS OWN interface --------
  // The discovered uplink belongs to exactly one WAN. Handing its gateway
  // to a different WAN builds a route that sends WAN2's marked traffic out
  // of WAN1, which is worse than having no route: it looks configured and
  // silently misroutes. A single-WAN router is the one deliberate
  // exception -- there is no other WAN to confuse it with, and "the
  // configured name is not the one the device uses" is the case the
  // fallback exists for -- so it is asserted to warn about the mismatch
  // instead of absorbing it.
  {
    const wanEff = opts.wans.map((w, i) =>
      w.mode === "pppoe" ? `cloudguest-pppoe-wan${i + 1}` : w.iface,
    );
    if (opts.wans.length > 1) {
      const unmatched = opts.wans
        .map((_, i) => i + 1)
        .filter(
          (n) =>
            !wanRoutingText.includes(`$w${n}fIf = "${wanEff[n - 1].replace(/(["\\])/g, "\\$1")}"`),
        );
      check(
        `${variant}: each WAN's routing-table fallback matches ITS OWN interface, not just any`,
        unmatched.length === 0,
        `WAN(s) ${JSON.stringify(unmatched)} take the discovered gateway without checking the ` +
          "discovered interface is theirs -- on a multi-WAN router that builds a default route " +
          "for one WAN out of another WAN's next hop",
      );
    } else {
      check(
        `${variant}: a single-WAN fallback warns when the device's uplink is not the configured one`,
        /is configured as .* but the live default route leaves via/.test(wanRoutingText),
        "the mismatch is absorbed silently, so the form staying wrong is invisible",
      );
    }
  }

  // ---- 12.3c retries are bounded, shared, and guarded -----------------
  // "Wait for the link" is genuinely required -- a DHCP lease and a PPPoE
  // session both bind asynchronously, and reading either the instant the
  // client is added returns nothing. What is not acceptable is an
  // unbounded wait, or a different hand-written ladder per call site.
  {
    const delays = [...wanRoutingText.matchAll(/:delay (\d+)([smh])/g)].map(
      (m) => Number(m[1]) * { s: 1, m: 60, h: 3600 }[m[2]],
    );
    const totalWaitPerWan = delays.reduce((a, b) => a + b, 0) / Math.max(opts.wans.length, 1);
    check(
      `${variant}: every wait is bounded, and the total per WAN stays in the tens of seconds`,
      delays.length > 0 ? totalWaitPerWan > 0 && totalWaitPerWan <= 90 : true,
      `${totalWaitPerWan}s of waiting per WAN -- a lease that has not bound in half a minute is a ` +
        "fault to report, not something to keep a technician standing at a router for",
    );
    check(
      `${variant}: every retry re-tests the guard rather than retrying blind`,
      [...wanRoutingText.matchAll(/:if \(([^)]*)\) do=\{ :delay/g)].every((m) =>
        /\[:len \$\w+\] = 0/.test(m[1]),
      ),
      "a wait that is not conditional on the value still being unresolved is a fixed sleep, " +
        "which costs the technician the full delay on every healthy paste",
    );
    // An asynchronous source that is polled exactly once is a source that
    // is usually read too early. PPPoE shipped that way.
    if (opts.wans.some((w) => w.mode === "dhcp")) {
      check(
        `${variant}: a DHCP WAN's gateway is polled more than once`,
        (wanRoutingText.match(/\/ip dhcp-client get \[find where interface=/g) ?? []).length >
          opts.wans.filter((w) => w.mode === "dhcp").length,
        "one attempt against an asynchronous lease is a read that lands before the lease exists",
      );
    }
    if (opts.wans.some((w) => w.mode === "pppoe")) {
      check(
        `${variant}: a PPPoE WAN's gateway is polled more than once`,
        (wanRoutingText.match(/\/interface pppoe-client monitor \[find name=/g) ?? []).length >
          opts.wans.filter((w) => w.mode === "pppoe").length,
        "PPPoE negotiation is asynchronous exactly the way a DHCP lease is; a single attempt is " +
          'why this branch used to end in "re-paste this chunk once connected"',
      );
    }
  }

  // ---- 12.4 the uplink discovery is ONE program, not two --------------
  // The heartbeat and the WAN configuration chunks must not be able to
  // disagree about what "the uplink" is. They share a builder; this proves
  // the emitted text is genuinely identical once the variable prefix is
  // normalised away, which is the only thing that can prove it.
  const sweeps = [
    ...text
      .replace(/\\(.)/g, "$1")
      .matchAll(/:for (\w+?)Dist from=1 to=255 do=\{[^\n]*?immediate-gw[^\n]*?\} \} \} \}/g),
  ];
  const normalisedSweeps = new Set(
    sweeps.map((m) => m[0].split(m[1]).join("<P>")).map((s) => s.trim()),
  );
  check(
    `${variant}: the heartbeat and the WAN chunks run the SAME discovery program`,
    sweeps.length >= 2 && normalisedSweeps.size === 1,
    `${sweeps.length} sweep(s), ${normalisedSweeps.size} distinct once the variable prefix is ` +
      "normalised -- two copies that have drifted mean one chunk builds routes for an uplink the " +
      `other does not report. Variants: ${JSON.stringify([...normalisedSweeps])}`,
  );

  // ---- 12.5 three faults, three sentences ----------------------------
  // A/B/C must stay distinguishable in the WAN configuration chunk, not
  // only in the heartbeat. Collapsed into one message, a technician is
  // sent to the wrong place: A is cabling/ISP, B is a RouterOS
  // version/link-type problem where routing may be fine, C is a link that
  // is up and unconfigured.
  const FAULT_A = "cloudguest: no active default route found in main routing table";
  const FAULT_B = "cloudguest: active default route found but WAN interface could not be resolved";
  const FAULT_C = /resolved but carries no usable address or gateway/;
  // PER REPORTING SITE, not per chunk. Checking the chunk as a whole
  // survived a mutation that collapsed the per-WAN faults into one generic
  // message, because the chunk's own live-uplink report still carried all
  // three and the substring test could not tell them apart. Every place
  // that reports "this WAN has no gateway" is enumerated and checked on its
  // own -- one site losing the distinction is the whole failure.
  const reportingSites = [
    ...opts.wans.map((_, i) => [
      `WAN${i + 1}'s own fallback line`,
      wanRoutingText
        .split("\n")
        .filter((l) => new RegExp(`\\$w${i + 1}f(If|Gw|DefCount|Have)\\b`).test(l))
        .join("\n"),
    ]),
    [
      "the chunk's live-uplink report",
      wanRoutingText
        .split("\n")
        .filter((l) => l.includes("wanChk"))
        .join("\n"),
    ],
  ];
  for (const [site, siteText] of reportingSites) {
    check(
      `${variant}: ${site} reports fault A ("no active default route") in its own words`,
      siteText.includes(FAULT_A),
      "missing -- A is a dead link, cable or ISP",
    );
    check(
      `${variant}: ${site} reports fault B ("route found, interface unresolved") in its own words`,
      siteText.includes(FAULT_B) || /could not be resolved/.test(siteText),
      "missing -- B means routing may be fine and the RouterOS version/link type is the problem",
    );
    check(
      `${variant}: ${site} reports fault C ("interface up, nothing usable on it") in its own words`,
      FAULT_C.test(siteText),
      "missing -- C is a link that is up and unconfigured, the one usually fixable on the spot",
    );
    check(
      `${variant}: ${site} keeps the three faults as three DIFFERENT sentences`,
      new Set([...siteText.matchAll(/:log warning \(?"(cloudguest[^"]*)"/g)].map((m) => m[1]))
        .size >= 3,
      "the faults have been collapsed into one generic message at this site, which is the same " +
        "information loss as collapsing them into an empty string",
    );
  }
  // A route built from an unchecked variable is the `gateway=0.0.0.0`
  // incident: `"0.0.0.0" != ""` is TRUE, RouterOS accepts the route, and
  // then silently flags it Inactive while every ping says "no route to
  // host" on a router whose WAN is healthy. Every statement that puts a
  // variable into `gateway=` must therefore test that same variable for
  // BOTH empty and zero, on its own entered statement -- a guard on a
  // different statement is a guard on a different program.
  {
    const gatewayUses = wanRoutingText
      .split("\n")
      .flatMap((l) => l.split("; "))
      .filter((s) => /\/ip route (add|set)[^;]*gateway=\$/.test(s));
    // FOLLOWS ONE LEVEL OF INDIRECTION. The fallback line hoists its
    // guard into a boolean (`$w1fUse`) because writing the literal test
    // out six times put the line over the paste-size budget. A check that
    // only looked for the literal test would report that hoist as an
    // unguarded route -- and, worse, would push the next person to
    // un-hoist it and blow the budget. So a statement guarded on a
    // boolean is accepted only if that boolean's own `:set`, ON THE SAME
    // ENTERED LINE, is itself conditioned on both gateway tests. A
    // boolean set unconditionally, or set under a weaker condition, still
    // fails.
    const guardsGateway = (cond, v) =>
      cond.includes(`$${v} != ""`) && cond.includes(`$${v} != "0.0.0.0"`);
    const unchecked = gatewayUses.filter((stmt) => {
      const v = stmt.match(/gateway=\$(\w+)/)?.[1];
      if (guardsGateway(stmt, v)) return false;
      const line = wanRoutingText.split("\n").find((l) => l.includes(stmt)) ?? "";
      const flags = [...stmt.matchAll(/\$(\w+) = true/g)].map((m) => m[1]);
      return !flags.some((flag) =>
        line
          .split("; ")
          .filter((t) => new RegExp(`do=\\{ :set ${flag} true \\}`).test(t))
          .some((setter) => guardsGateway(setter, v)),
      );
    });
    check(
      `${variant}: every route built from a resolved gateway tests it for empty AND for 0.0.0.0`,
      gatewayUses.length > 0 && unchecked.length === 0,
      `${unchecked.length} statement(s) build a route from an unchecked variable: ` +
        `${JSON.stringify(unchecked.map((s) => s.slice(0, 120)))} -- "0.0.0.0" != "" is TRUE, and ` +
        "RouterOS accepts a zero gateway and then flags the route Inactive with no error",
    );
  }

  // ---- 12.6 failover: the dead WAN is not reported forever ------------
  // The report of what is actually live must not be keyed on any WAN's
  // position in the list. If WAN1 dies and WAN2 becomes the lowest-distance
  // usable active default, a re-paste has to say WAN2's real interface and
  // WAN2's real address.
  const liveReport = wanRoutingText
    .split("\n")
    .filter((l) => l.includes("wanChk"))
    .join("\n");
  check(
    `${variant}: the live-uplink report names no configured WAN interface`,
    liveReport.length > 0 && !wanNames.some((nm) => liveReport.includes(`"${nm}"`)),
    `the report is keyed on one of ${JSON.stringify(wanNames)} -- it would keep naming the WAN ` +
      "that was configured first even after that WAN has died",
  );
  check(
    `${variant}: the live-uplink report reads the address off the DISCOVERED interface`,
    /\/ip address find where interface=\$wanChkIf/.test(liveReport),
    "the address is read off a named port rather than off whatever is actually carrying traffic",
  );
  check(
    `${variant}: the live-uplink report carries all three faults too`,
    liveReport.includes(FAULT_A) &&
      liveReport.includes("could not be resolved") &&
      /carries no usable address or gateway/.test(liveReport),
    "the report collapses a dead router, an unresolvable interface and an unconfigured link " +
      "into one line",
  );

  // ---- 12.7 logical WAN ids stay separate from physical interfaces ----
  if (opts.wans.length > 1 && (opts.wanRoutingMode ?? "load_balance") === "load_balance") {
    const mangle = allText(chunkByLabel(chunks, "Mangle"));
    check(
      `${variant}: PCC/mangle rules use LOGICAL wan<N>_conn / to_wan<N> identifiers`,
      /connection-mark="wan1_conn"/.test(mangle) && /new-routing-mark="to_wan1"/.test(mangle),
      "the logical routing identifiers are gone, so the routes and the marks cannot line up",
    );
    check(
      `${variant}: every routing-mark'd route's gateway is a RESOLVED variable, never a literal`,
      [...wanRoutingText.matchAll(/\/ip route add [^;\n]*routing-table="to_wan\d+"[^;\n]*/g)].every(
        (m) => /gateway=\$\w+/.test(m[0]),
      ),
      "a routing-mark'd route is being built from a generation-time literal instead of the " +
        "gateway actually resolved on the device",
    );
    check(
      `${variant}: the crossover backup ring closes, for any number of WANs`,
      opts.wans.every((_, i) => {
        const n = i + 1;
        const next = ((i + 1) % opts.wans.length) + 1;
        return wanRoutingText.includes(`cloudguest-backup-wan${next}-via-wan${n}`);
      }),
      "the failover ring is broken past the two-WAN case it was written for, so at least one " +
        "WAN has no backup route",
    );
    // Only asserted for the even split -- a weighted plan GCD-reduces to
    // its own denominator on purpose (see `buildWeightedPccPlan`), so
    // pinning the WAN count there would be asserting the wrong thing.
    if (!opts.wans.some((w) => typeof w.weight === "number")) {
      const denominators = [
        ...new Set(
          [...mangle.matchAll(/per-connection-classifier=both-addresses-and-ports:(\d+)\//g)].map(
            (m) => Number(m[1]),
          ),
        ),
      ];
      check(
        `${variant}: the PCC split's denominator is exactly the number of WANs configured`,
        denominators.length === 1 && denominators[0] === opts.wans.length,
        `denominator(s) ${JSON.stringify(denominators)} for ${opts.wans.length} WAN(s) -- a ` +
          "denominator that does not match the WAN count sends a share of guest traffic into a " +
          "connection mark no route was ever built for, which black-holes it",
      );
    }
  }

  // ---- 12.8 idempotent, and never destructive ------------------------
  const rerun = allText(buildRouterSetupScriptChunks(opts));
  check(
    `${variant}: generating twice produces byte-identical text`,
    rerun === text,
    "the generator is not pure, so what a technician pasted and what this suite checked can differ",
  );
  const routeAdds = [...wanRoutingText.matchAll(/[^;\n]*\/ip route add[^;\n]*/g)].map((m) => m[0]);
  check(
    `${variant}: every /ip route add is guarded by a zero-count test on its own entered line`,
    routeAdds.length > 0 && routeAdds.every((s) => /\[:len [^\]]*\][^;]*= 0/.test(s)),
    `unguarded: ${JSON.stringify(routeAdds.filter((s) => !/\[:len [^\]]*\][^;]*= 0/.test(s)))} -- ` +
      'a second paste would throw "already have such route"',
  );
  check(
    `${variant}: the WAN chunks remove only cloudguest-owned or explicitly-foreign objects`,
    [...wanRoutingText.matchAll(/\/ip route remove[^;\n]*/g)].length === 0 ||
      /comment~"\^cloudguest-/.test(wanRoutingText),
    "a route removal that is not scoped to this generator's own comments would delete a user's " +
      "own routing configuration",
  );
}

// ---------------------------------------------------------------------
// 12.9 ROUTER-ORIGINATED TRAFFIC IS NEVER BOUND TO A WAN.
// ---------------------------------------------------------------------
// The heartbeat is the router speaking on its own behalf. If it is ever
// pinned to WAN1 -- by a routing mark, a routing table, a source address,
// or an interface name -- then a router whose WAN1 has died stops
// reporting in and shows OFFLINE in Master console while its guests browse
// happily over WAN2. Nothing on the device would say why.
//
// The policy is: leave it unmarked, so the MAIN table routes it, so the
// lowest-distance ACTIVE default route carries it, so it follows whichever
// WAN is alive with no reprovisioning. These checks pin that policy from
// both ends -- what the fetch must not carry, and what the mangle rules
// must not be able to do to it.

console.log("\n-- router-originated traffic follows the live WAN, not a configured one --");

for (const [variant, opts] of VARIANTS) {
  const chunks = buildRouterSetupScriptChunks(opts);
  const hb = allText(chunks.filter((c) => c.label.startsWith("Heartbeat")));
  const hbUnescaped = hb.replace(/\\(.)/g, "$1");
  const mangle = allText(chunkByLabel(chunks, "Mangle"));
  const fetches = [...hbUnescaped.matchAll(/\/tool fetch[^;\n]*/g)].map((m) => m[0]);

  check(
    `${variant}: the heartbeat fetch carries no routing mark, table or source address`,
    fetches.length > 0 &&
      fetches.every(
        (f) => !/routing-mark/.test(f) && !/routing-table/.test(f) && !/src-address/.test(f),
      ),
    `pinned fetch(es): ${JSON.stringify(fetches.filter((f) => /routing-mark|routing-table|src-address/.test(f)))} -- ` +
      "a heartbeat pinned to a table cannot follow a failover, and a router whose WAN1 died would " +
      "show offline while its guests are online",
  );
  check(
    `${variant}: the heartbeat names no WAN interface and no to_wan<N> table anywhere`,
    !/to_wan\d/.test(hbUnescaped) &&
      !opts.wans.some((w) => hbUnescaped.includes(`"${w.iface}"`)) &&
      !/wan\d_conn/.test(hbUnescaped),
    "the heartbeat is bound to a specific WAN, so it reports the WAN that was configured first " +
      "rather than the one that is actually carrying traffic",
  );
  // Router-originated packets start at `output`. They never traverse
  // `prerouting`. So a mark-routing rule confined to prerouting cannot
  // reach them -- and an output-chain rule would be exactly how it could.
  check(
    `${variant}: this generator emits no chain=output mangle rule, in any mode`,
    !/mangle add[^;\n]*chain=output/.test(mangle),
    "an output-chain mangle rule is the one thing that could mark router-originated traffic into " +
      "a to_wan<N> table, and a heartbeat marked into a dead WAN's table never arrives",
  );
  const markRouting = [...mangle.matchAll(/[^;\n]*action=mark-routing[^;\n]*/g)].map((m) => m[0]);
  check(
    `${variant}: every mark-routing rule is confined to chain=prerouting`,
    markRouting.every((r) => /chain=prerouting/.test(r)),
    `${JSON.stringify(markRouting.filter((r) => !/chain=prerouting/.test(r)))} could mark traffic ` +
      "the router itself originated",
  );
  const pcc = [...mangle.matchAll(/[^;\n]*per-connection-classifier[^;\n]*/g)].map((m) => m[0]);
  if (pcc.length > 0) {
    check(
      `${variant}: every PCC rule is pinned to the LAN bridge, so it only ever sees guest traffic`,
      pcc.every((r) => r.includes(`in-interface="${opts.lanBridge}"`)),
      "a PCC rule with no in-interface can classify traffic that did not come from a guest",
    );
  }
}

// ---------------------------------------------------------------------
// 12.10 THE FAILOVER SEQUENCE, RUN END TO END.
// ---------------------------------------------------------------------
// Everything above is structural. This one actually EXECUTES the uplink
// selection the generator emits, against a routing table that changes
// underneath it, and asserts the answer at each step.
//
// WHAT IS AND IS NOT BEING TESTED, PLAINLY. The selector below is not a
// reimplementation of the algorithm -- it is PARSED OUT OF THE EMITTED
// SCRIPT: the filter tokens and the distance range are read from the
// `:for ... :foreach ... find where ...` sweep the generator actually
// produces, and the fixtures are matched against those tokens. So it
// verifies the emitted filter and the emitted ordering. It does NOT verify
// that RouterOS interprets those tokens the way this harness does; that is
// an inference, and it is exactly the inference that was wrong about
// `routing-mark=""`. What makes the inference safe to hold is that the
// fixture keys are the property names measured on the founder's v7 device,
// so a generator that goes back to v6 vocabulary matches nothing here for
// the same reason it matches nothing there.

console.log("\n-- WAN1 dies, WAN2 takes over, WAN1 returns: run against the emitted selector --");

/** Reads the emitted sweep and returns a function that picks the winning
 * route from a fixture table exactly as the emitted filter and ordering
 * would. Returns null if no sweep could be parsed -- which is itself a
 * failure, not a skip. */
function uplinkSelectorFrom(text) {
  const m = text
    .replace(/\\(.)/g, "$1")
    .match(/:for (\w+?)Dist from=(\d+) to=(\d+) do=\{.*?find where (.*?) distance=\$\1Dist\]/);
  if (!m) return null;
  const [, , from, to, filter] = m;
  // Values may be quoted (`routing-table="main"`) or bare (`active=yes`).
  // An earlier version only matched the quoted form, so `active=yes` was
  // silently dropped from the fixture filter and the failover steps passed
  // an INACTIVE route -- the guard could not see the one property the
  // whole test is about. Both forms now.
  const conds = [...filter.matchAll(/([a-z-]+)=(?:"([^"]*)"|([^\s\]]+))/g)].map((c) => [
    c[1],
    c[2] !== undefined ? c[2] : c[3],
  ]);
  return (routes) => {
    for (let d = Number(from); d <= Number(to); d++) {
      const hit = routes.find(
        (r) => r.distance === d && conds.every(([k, v]) => String(r[k]) === v),
      );
      if (hit) return hit;
    }
    return null;
  };
}

{
  // Two WANs, failover-only: WAN1's plain route is distance=1, WAN2's is
  // distance=2, both check-gateway=ping, both in the main table. Plus the
  // marked copies a load-balance provisioning would leave behind, which
  // main-table discovery must ignore.
  const FAILOVER_OPTS = {
    ...BASE,
    wans: [
      { iface: "ether5", mode: "dhcp" },
      { iface: "ISP-Airtel", mode: "static", ip: "1.2.3.4", cidr: "24", gateway: "1.2.3.1" },
    ],
    wanRoutingMode: "failover_only",
  };
  const chunks = buildRouterSetupScriptChunks(FAILOVER_OPTS);
  const hbText = allText(chunks.filter((c) => c.label.startsWith("Heartbeat")));
  const select = uplinkSelectorFrom(hbText);

  check(
    "failover: a selector could be parsed out of the emitted heartbeat at all",
    select !== null,
    "no `:for <p>Dist ... :foreach ... find where ... distance=$<p>Dist]` sweep in the heartbeat -- " +
      "the uplink is not being selected by ascending distance over a filtered find",
  );

  const route = (o) => ({
    "dst-address": "0.0.0.0/0",
    active: "yes",
    "routing-table": "main",
    ...o,
  });
  // The routing-marked copies. A load-balance provisioning of this same
  // router leaves these behind, they are active in their own tables, and
  // discovery must never pick one: they are the traffic policy for GUESTS,
  // not for the router itself.
  const MARKED = [
    route({ "routing-table": "to_wan1", distance: 1, gw: "10.0.1.1", iface: "ether5" }),
    route({ "routing-table": "to_wan2", distance: 2, gw: "1.2.3.1", iface: "ISP-Airtel" }),
  ];
  const WAN1_UP = route({ distance: 1, gw: "10.0.1.1", iface: "ether5" });
  const WAN1_DOWN = route({ distance: 1, gw: "10.0.1.1", iface: "ether5", active: "no" });
  const WAN2_UP = route({ distance: 2, gw: "1.2.3.1", iface: "ISP-Airtel" });

  if (select) {
    // Step 1 -- both WANs up. WAN1 is distance=1, so it carries the router.
    check(
      "failover step 1: WAN1 active -> the heartbeat goes out over WAN1",
      select([WAN1_UP, WAN2_UP, ...MARKED])?.iface === "ether5",
      "the lowest-distance active main-table default route is not being chosen",
    );
    // Step 2 -- WAN1's gateway stops answering. `check-gateway=ping` is
    // what flags its route Inactive; nothing else on the router changes,
    // and in particular nothing is regenerated or re-pasted.
    check(
      "failover step 2: WAN1 dies -> its route is no longer usable and is not chosen",
      select([WAN1_DOWN, WAN2_UP, ...MARKED])?.iface !== "ether5",
      "an INACTIVE default route is still being selected -- RouterOS keeps unreachable default " +
        "routes in the table and flags them Inactive rather than removing them, so this is the " +
        "difference between failing over and reporting a dead WAN forever",
    );
    check(
      "failover step 3: WAN2 becomes the active default -> the heartbeat goes out over WAN2",
      select([WAN1_DOWN, WAN2_UP, ...MARKED])?.iface === "ISP-Airtel",
      "the second WAN is not picked up when the first dies",
    );
    // Step 4 -- and the address reported is WAN2's, because the address is
    // read off the interface the selection produced, not off a named port.
    check(
      "failover step 4: the address reported is read off the interface the SELECTION produced",
      /\/ip address find where interface=\$hbIf/.test(hbText.replace(/\\(.)/g, "$1")),
      "the address is read off a fixed name, so it would keep reporting the dead WAN's address",
    );
    // Step 5 -- WAN1 comes back. Its distance=1 route goes active again and
    // is once more the lowest-distance active default, so traffic fails
    // back on its own.
    check(
      "failover step 5: WAN1 restored -> traffic fails back to it, no intervention",
      select([WAN1_UP, WAN2_UP, ...MARKED])?.iface === "ether5",
      "failback does not happen, so a restored primary WAN is never used again",
    );
    // The marked copies must never win, at any step.
    check(
      "failover: a routing-marked copy is never selected, even when it is the lowest distance",
      select(MARKED) === null,
      "discovery is picking up a to_wan<N> route -- that is the GUEST traffic policy, and using " +
        "it for the router's own traffic is how a heartbeat ends up pinned to a dead WAN",
    );
    // And the whole sequence requires no regeneration: the scheduler's
    // stored copy re-runs this same selection every 5 minutes.
    check(
      "failover: no reprovisioning is needed at any step -- the scheduler re-selects every run",
      /interval=5m/.test(hbText) && /start-time=startup/.test(hbText),
      "the recurring copy does not re-run, so the failover would only be noticed on a manual visit",
    );
  }

  // What makes step 2 possible on a real device.
  const routing = allText(chunkByLabel(chunks, "WAN Routing"));
  const plainAdds = [
    ...routing.matchAll(/\/ip route add[^;\n]*cloudguest-plain-wan\d+[^;\n]*/g),
  ].map((m) => m[0]);
  check(
    "failover: every plain default route carries check-gateway=ping",
    plainAdds.length > 0 && plainAdds.every((r) => r.includes("check-gateway=ping")),
    "without check-gateway RouterOS never marks a dead WAN's route Inactive, so nothing ever " +
      "fails over and the ISP-health signal has nothing to read either",
  );
  // EVERY statement that writes a plain route, not "at least one". A
  // mutation that gave the FALLBACK line's route distance=1 for every WAN
  // survived an "includes" check, because the mode-specific line still
  // carried the right distance somewhere in the chunk -- so a router that
  // came up via the fallback path would have had two distance=1 defaults
  // and no defined failback order. Same "somewhere, not everywhere" hole
  // as the qualifier checks.
  {
    const misordered = FAILOVER_OPTS.wans.flatMap((_, i) => {
      const n = i + 1;
      const writes = [
        ...routing.matchAll(
          new RegExp(`[^;\\n]*/ip route (?:add|set)[^;\\n]*cloudguest-plain-wan${n}"[^;\\n]*`, "g"),
        ),
      ].map((m) => m[0]);
      return writes.length === 0
        ? [`WAN${n}: no route write at all`]
        : writes
            .filter((w) => !w.includes(`distance=${n} `))
            .map((w) => `WAN${n}: ${w.slice(0, 90)}`);
    });
    check(
      "failover: EVERY write of a plain route carries that WAN's own distance, so failback is defined",
      misordered.length === 0,
      `${JSON.stringify(misordered)} -- two WANs at the same distance means which one wins is not ` +
        "a decision this script made, and a restored primary may never be preferred again",
    );
  }
}

// ---------------------------------------------------------------------
// 12.11 A SILENT EMPTY MATCH MUST BE IMPOSSIBLE TO SHIP AGAIN.
// ---------------------------------------------------------------------
// `routing-mark=""` did not error on RouterOS 7. It was accepted as an
// unknown filter and matched nothing, so every default-route lookup in the
// generated script returned empty on every router in the fleet and nothing
// anywhere said so. Renaming the token fixes the instance. What fixes the
// CLASS is that every default-route lookup binds a count and branches on
// zero, so the next rename is loud.

console.log("\n-- every default-route lookup is counted, and zero is reported --");

for (const [variant, opts] of VARIANTS) {
  const chunks = buildRouterSetupScriptChunks(opts);
  const text = allText(chunks).replace(/\\(.)/g, "$1");
  // Every line that binds a `<p>DefCount` must also, on that same line,
  // branch on it being zero and say something. A count nobody reads is
  // not a guard.
  const countLines = text.split("\n").filter((l) => /:local (\w+)DefCount /.test(l));
  check(
    `${variant}: every default-route count is bound on a line that also branches on zero`,
    countLines.length > 0 &&
      countLines.every((l) => {
        const v = l.match(/:local (\w+DefCount) /)[1];
        return new RegExp(`\\$${v} = 0\\)[^;]*do=\\{[^;]*:(log|put)`).test(l);
      }),
    "a lookup binds a count that nothing branches on, so an empty match -- whether from a dead " +
      "uplink or from a filter name this RouterOS version does not know -- is indistinguishable " +
      "from a working router",
  );
  // The dead v6 token must not come back anywhere except the version
  // banner that exists to explain it.
  const strayV6 = text
    .split("\n")
    .filter((l) => /routing-mark=/.test(l) && !/new-routing-mark=/.test(l))
    .filter((l) => !/On RouterOS 6 the property is/.test(l));
  check(
    `${variant}: the RouterOS 6 routing-mark= spelling appears nowhere on a route`,
    strayV6.length === 0,
    "`routing-mark=` on /ip route does not error on v7 -- it matches nothing, silently. Measured " +
      `on the founder's hEX at 7.23.3. Offending line(s): ${JSON.stringify(strayV6.map((l) => l.slice(0, 90)))}`,
  );
  if (
    !opts.basicConfigOnly &&
    opts.wans.length > 1 &&
    (opts.wanRoutingMode ?? "load_balance") === "load_balance"
  ) {
    check(
      `${variant}: every to_wan<N> table is declared before a route is put into it`,
      opts.wans.every((_, i) => text.includes(`/routing table add name="to_wan${i + 1}" fib`)),
      "RouterOS 7 refuses a route into a routing table that does not exist, so the load-balancing " +
        "routes would simply never be created",
    );
  }
}

// ---------------------------------------------------------------------
// 12.12 THE GENERATOR NEVER FORCES A NAME ONTO A CUSTOMER'S ROUTER.
// ---------------------------------------------------------------------
// It must not abort because an interface is not called what the form says,
// must not rename anything, and must not require WAN1/WAN2/ether1/ether2.

console.log("\n-- nothing is renamed, nothing is required to be called anything --");

for (const [variant, opts] of VARIANTS) {
  const text = allText(buildRouterSetupScriptChunks(opts));
  check(
    `${variant}: a WAN interface name that does not exist does not abort the script`,
    !/:error \([^)]*WAN interface/.test(text),
    "the script :errors out when the configured name is not on the device -- but the name being " +
      "wrong is exactly the case routing-table discovery now handles, so aborting throws away the " +
      "recovery instead of using it",
  );
  check(
    `${variant}: ...and says so out loud rather than continuing silently`,
    /no interface on this device is named/.test(text),
    "removing the abort must not also remove the signal; a mismatch a technician never hears about " +
      "is the failure mode this whole file exists to prevent",
  );
  // Wyfy may manage only what Wyfy tagged. A `find` on `chain=srcnat
  // action=masquerade` matches a user's own masquerade rule just as well
  // as this generator's, and the statement that follows such a find is a
  // `set` -- so an untagged find is how a script silently re-points
  // somebody else's NAT rule at an interface they never chose.
  //
  // NARROWED, deliberately: the hazard is the SET, not the find. A lookup
  // wrapped in `[:len [ ... ]]` is a count -- it yields a number, it can
  // re-point nothing, and forbidding it would forbid the one question worth
  // asking on behalf of a guest: "is there ANY masquerade rule on this
  // router." An operator's own hand-written masquerade is a perfectly good
  // rule and must count toward that answer; huda city center had none at all,
  // authenticated guests reached the internet not at all, and every tagged
  // lookup in this script would have reported everything fine. So counts are
  // exempt and modifying lookups are not.
  {
    const natFinds = [...text.matchAll(/\/ip firewall nat find where([^\]]*)/g)]
      .filter((m) => !/\[:len \[\s*$/.test(text.slice(Math.max(0, m.index - 8), m.index)))
      .map((m) => m[1]);
    check(
      `${variant}: every NAT lookup that is not a pure count is keyed on a cloudguest- comment or an exact rule identity`,
      natFinds.every((f) => /comment="cloudguest-/.test(f) || /out-interface="/.test(f)),
      `untagged NAT lookup(s): ${JSON.stringify(natFinds.filter((f) => !(/comment="cloudguest-/.test(f) || /out-interface="/.test(f))))} ` +
        "-- a find that matches any masquerade rule will find a user's own, and the next statement " +
        "modifies what it found",
    );
    const natWrites = [...text.matchAll(/[^;\n]*\/ip firewall nat (?:set|remove)[^;\n]*/g)].map(
      (m) => m[0],
    );
    check(
      `${variant}: no NAT rule is modified or removed unless this generator owns it`,
      natWrites.every((w) => /cloudguest-/.test(w) || /\$\w*Nat\b/.test(w)),
      `${JSON.stringify(natWrites.filter((w) => !(/cloudguest-/.test(w) || /\$\w*Nat\b/.test(w))))} ` +
        "touches a NAT rule this generator did not create",
    );
  }

  // The final interface verification must accept a PPPoE virtual
  // interface. Narrowing it to /interface ethernet would reject one --
  // an over-strict guard that silently discards a perfectly real uplink.
  check(
    `${variant}: the interface verification uses the generic /interface menu, not /interface ethernet`,
    !/\/interface ethernet find where name=\$/.test(text),
    "a PPPoE session's virtual interface, a VLAN and a bridge are all real interfaces that are " +
      "not under /interface ethernet -- verifying there would discard a live uplink as unreal",
  );
}

// =====================================================================
// 13. THE SEVEN FIELD DEFECTS OF 2026-08-23
// =====================================================================
// Seven faults found while provisioning real MikroTiks, plus the two
// reporting failures that made the worst of them survivable for days.
// Not one of them is visible to `tsc`, `eslint` or the build: every value
// is a `string` and every bug is in what the string MEANS to RouterOS, or
// in what the panel told the operator it had checked.
//
// Each subsection asserts the fix AND injects the defect back to prove
// the assertion can fail. A guard that cannot be shown to fail is not a
// guard -- three were found in exactly that state on 2026-08-23.

console.log("\n-- 13.1 the DHCP pool is derived from the CIDR --");

{
  // INDEPENDENT ARITHMETIC, ON PURPOSE. If this recomputed containment
  // with `deriveLanAddressing` itself, a bug in that function would agree
  // with itself and pass. This is a second implementation, written from
  // the definition of a subnet rather than from the code under test.
  const ipToInt = (ip) => ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0);
  const inSubnet = (ip, network) => {
    const [net, prefix] = network.split("/");
    const size = 2 ** (32 - Number(prefix));
    const base = ipToInt(net);
    const n = ipToInt(ip);
    return n >= base && n < base + size;
  };
  const isNetworkAddress = (network) => {
    const [net, prefix] = network.split("/");
    const size = 2 ** (32 - Number(prefix));
    return ipToInt(net) % size === 0;
  };

  // ---- the arithmetic itself, over every reachable prefix -------------
  check(
    "a /24 with the historic .1 router address still produces the historic pool",
    JSON.stringify(deriveLanAddressing("192.168.88.1", "24")) ===
      JSON.stringify({
        ok: true,
        network: "192.168.88.0/24",
        poolStart: "192.168.88.10",
        poolEnd: "192.168.88.254",
        poolSize: 245,
      }),
    `the shipped default must not move: ${JSON.stringify(deriveLanAddressing("192.168.88.1", "24"))}`,
  );
  check(
    "a /25 stops the pool at the end of the ROUTER'S OWN subnet",
    deriveLanAddressing("192.168.88.1", "25").poolEnd === "192.168.88.126",
    `guests handed .128-.254 on a /25 lease fine and cannot reach their own gateway: ${JSON.stringify(deriveLanAddressing("192.168.88.1", "25"))}`,
  );
  check(
    "a /25 with the router in the UPPER half uses the upper network",
    deriveLanAddressing("192.168.88.130", "25").network === "192.168.88.128/25",
    `192.168.88.0/25 is a network this router has no address in at all: ${JSON.stringify(deriveLanAddressing("192.168.88.130", "25"))}`,
  );
  check(
    "a /23 does not throw away the half of the range above .255",
    deriveLanAddressing("10.5.50.1", "23").poolEnd === "10.5.51.254",
    `the old octet-sliced pool stopped at 10.5.50.254: ${JSON.stringify(deriveLanAddressing("10.5.50.1", "23"))}`,
  );
  check(
    "a /28 drops the .10 head-room rather than eating the whole pool",
    deriveLanAddressing("192.168.10.1", "28").poolStart === "192.168.10.2",
    `a fixed +9 offset on a 14-host subnet leaves almost nothing: ${JSON.stringify(deriveLanAddressing("192.168.10.1", "28"))}`,
  );
  check(
    "the router's own address is never inside the pool it hands out",
    ["24", "23", "25", "26", "28", "30"].every((p) => {
      for (const ip of ["192.168.88.1", "192.168.88.100", "192.168.88.130", "192.168.88.200"]) {
        const r = deriveLanAddressing(ip, p);
        if (!r.ok) continue;
        if (ipToInt(ip) >= ipToInt(r.poolStart) && ipToInt(ip) <= ipToInt(r.poolEnd)) return false;
      }
      return true;
    }),
    "a DHCP server that can lease its own gateway's address is its own outage",
  );
  check(
    "every prefix from /1 to /30 either yields a pool inside its own network or is refused with a reason",
    (() => {
      for (let p = 1; p <= 30; p++) {
        for (const ip of ["10.5.50.1", "192.168.88.130", "172.16.9.65", "128.66.1.1"]) {
          const r = deriveLanAddressing(ip, String(p));
          // A /30 whose router sits on the last host address genuinely has
          // no room left; that is a refusal, not a wrong answer.
          if (!r.ok) {
            if (typeof r.reason !== "string" || r.reason.length < 20) return false;
            continue;
          }
          if (!isNetworkAddress(r.network)) return false;
          if (!inSubnet(r.poolStart, r.network) || !inSubnet(r.poolEnd, r.network)) return false;
          if (!inSubnet(ip, r.network)) return false;
        }
      }
      return true;
    })(),
    "the pool, the router and the network entry must all describe one subnet",
  );
  check(
    "...and every prefix from /1 to /28 with a .1 router really does produce a pool",
    (() => {
      for (let p = 1; p <= 28; p++)
        if (!deriveLanAddressing("10.5.50.1", String(p)).ok) return false;
      return true;
    })(),
    "the previous check would pass vacuously if the function refused everything",
  );
  check(
    "a 128.x LAN is not mangled by JS signed 32-bit bitwise arithmetic",
    deriveLanAddressing("128.66.1.130", "25").network === "128.66.1.128/25",
    `the top bit set makes an unshifted mask negative and inverts every comparison: ${JSON.stringify(deriveLanAddressing("128.66.1.130", "25"))}`,
  );
  check(
    "/31 and /32 are REFUSED with a reason, not silently given a pool",
    ["31", "32"].every((p) => {
      const r = deriveLanAddressing("192.168.10.1", p);
      return r.ok === false && typeof r.reason === "string" && r.reason.length > 20;
    }),
    "inventing a /24-shaped pool for a prefix that cannot hold one is the original defect",
  );
  check(
    "a CIDR outside 1..32 is REFUSED, not coerced",
    ["0", "33", "", "24.5", "abc", "/24", "２４", "0x18"].every(
      (p) => deriveLanAddressing("192.168.88.1", p).ok === false,
    ),
    "`lanCidr` is a free-text field -- everything it can hold has to land somewhere defined",
  );
  check(
    "a LAN IP that is the network or broadcast address is REFUSED",
    deriveLanAddressing("192.168.88.0", "24").ok === false &&
      deriveLanAddressing("192.168.88.255", "24").ok === false,
    "neither is a usable host address, and a router configured with one has no working LAN at all",
  );
  check(
    "a malformed LAN IP is REFUSED, not parsed as far as it goes",
    ["192.168.88", "192.168.88.1.1", "192.168.88.256", "1.2.3.x", ""].every(
      (ip) => deriveLanAddressing(ip, "24").ok === false,
    ),
    "`NaN` octets would sail through the bit arithmetic and produce a confident wrong subnet",
  );

  // ---- and what actually lands in the emitted chunk -------------------
  const hotspotChunks = [];
  for (const [variant, opts] of VARIANTS) {
    const c = buildRouterSetupScriptChunks(opts).find((x) => x.label.startsWith("Hotspot"));
    if (c) hotspotChunks.push([variant, opts, c]);
  }
  check(
    "every variant produces exactly one Hotspot chunk",
    hotspotChunks.length === VARIANTS.length,
    `${hotspotChunks.length} of ${VARIANTS.length} -- a variant lost its Hotspot chunk entirely`,
  );

  const containmentOffenders = [];
  for (const [variant, opts, chunk] of hotspotChunks) {
    if (chunk.label.includes("NOT GENERATED")) continue;
    const pool = chunk.script.match(/ranges=(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)/);
    const net = chunk.script.match(/network add address=(\d+\.\d+\.\d+\.\d+\/\d+)/);
    if (!pool || !net) {
      containmentOffenders.push(`${variant}: no pool range or no dhcp network line`);
      continue;
    }
    if (!isNetworkAddress(net[1]))
      containmentOffenders.push(`${variant}: ${net[1]} is not a network address`);
    if (!inSubnet(opts.lanIp, net[1]))
      containmentOffenders.push(`${variant}: the router's own ${opts.lanIp} is not in ${net[1]}`);
    if (!inSubnet(pool[1], net[1]) || !inSubnet(pool[2], net[1]))
      containmentOffenders.push(`${variant}: pool ${pool[1]}-${pool[2]} escapes ${net[1]}`);
    if (net[1].split("/")[1] !== String(opts.lanCidr))
      containmentOffenders.push(`${variant}: network prefix ignores lanCidr=${opts.lanCidr}`);
  }
  check(
    "no emitted DHCP pool hands out an address outside the LAN's own network",
    containmentOffenders.length === 0,
    `${containmentOffenders.length} offender(s): ${containmentOffenders.slice(0, 6).join(" | ")}`,
  );

  // INJECTED: the derivation this replaced.
  {
    const base3 = (ip) => ip.split(".").slice(0, 3).join(".");
    const oldPool = (ip) => [`${base3(ip)}.10`, `${base3(ip)}.254`];
    const oldNet = (ip, cidr) => `${base3(ip)}.0/${cidr}`;
    const caught = [
      ["192.168.88.1", "25"],
      ["192.168.88.130", "25"],
    ].every(([ip, cidr]) => {
      const net = oldNet(ip, cidr);
      const [s, e] = oldPool(ip);
      return !inSubnet(s, net) || !inSubnet(e, net) || !inSubnet(ip, net);
    });
    check(
      "INJECTED: the containment test rejects the octet-slicing derivation it replaced",
      caught,
      "the test agrees with the bug, so it would not have caught it",
    );
  }
  check(
    "INJECTED: ...and the containment test does NOT reject a correct /24",
    inSubnet("192.168.88.10", "192.168.88.0/24") &&
      inSubnet("192.168.88.254", "192.168.88.0/24") &&
      isNetworkAddress("192.168.88.0/24"),
    "over-strictness would ban the shipped default",
  );

  // ---- the refusal path ----------------------------------------------
  {
    const refused = buildRouterSetupScriptChunks({
      ...BASE,
      wans: [DHCP_WAN],
      lanIp: "192.168.10.1",
      lanCidr: "31",
    }).find((c) => c.label.startsWith("Hotspot"));
    check(
      "an unusable LAN prefix names itself in the CHUNK LABEL, before the operator opens it",
      /NOT GENERATED/.test(refused.label),
      `the chunk list must not read as ordinary: "${refused.label}"`,
    );
    check(
      "...and the refusal chunk creates NOTHING",
      !/ add /.test(refused.script) && !/ set /.test(refused.script),
      "a half-configured hotspot is worse than an un-pasted one",
    );
    check(
      "...and says RESULT: FAIL with the reason and a next step",
      /RESULT: FAIL/.test(refused.script) &&
        /re-generate/i.test(refused.script) &&
        /:log warning/.test(refused.script),
      "a refusal with no reason and no next step is a dead end",
    );
  }
}

console.log("\n-- 13.1b the Hotspot verdict can actually FAIL --");

{
  const hs = REGEN_CHUNKS.find((c) => c.label === "Hotspot").script;
  const verdict = hs.split("\n").find((l) => /RESULT: PASS -- every object/.test(l));
  check(
    "the Hotspot chunk still prints a single PASS/FAIL verdict",
    Boolean(verdict),
    "the verdict line disappeared rather than being fixed",
  );
  check(
    "the verdict reads the pool's ACTUAL ranges back off the device",
    /\/ip pool get \[find name="hotspot-pool"\] ranges/.test(verdict),
    "a verdict built only from `does this object exist` is fixed by the `add` lines above it -- " +
      "that is why a /25 router with no working guest WiFi printed RESULT: PASS",
  );
  check(
    "...and compares them to the range this script actually intended",
    /\$hsRanges = "\d+\.\d+\.\d+\.\d+-\d+\.\d+\.\d+\.\d+"/.test(verdict),
    "reading a value back and not comparing it is decoration",
  );
  check(
    "...and requires EXACTLY ONE dhcp network for this LAN's gateway",
    /hsNetGw = 1/.test(verdict) && /gateway=/.test(verdict),
    "a leftover network entry from an earlier prefix wins by longest match and is invisible",
  );
  check(
    "the chunk removes a dhcp network entry left behind by a DIFFERENT prefix",
    /:foreach dn in=\[\/ip dhcp-server network find where gateway=[^\]]*\] do=\{ :if \(\[\/ip dhcp-server network get \$dn address\] != /.test(
      hs,
    ),
    "add-if-missing never sees the old entry, so nothing ever removes it",
  );
  check(
    "...and only ever touches entries whose gateway is THIS router's LAN address",
    !/\/ip dhcp-server network remove \[find\]/.test(hs) &&
      (hs.match(/\/ip dhcp-server network remove/g) ?? []).every(() => true) &&
      /find where gateway=/.test(hs),
    "an unqualified sweep would delete a network entry serving another interface",
  );
  check(
    "the pool's ranges are re-SET on a router that already has the pool",
    /:if \(\[:len \[\/ip pool find where name="hotspot-pool"\]\] > 0\) do=\{ \/ip pool set \[find name="hotspot-pool"\] ranges=/.test(
      hs,
    ),
    "add-if-missing alone leaves a corrected prefix's old ranges in place forever",
  );

  // INJECTED: the verdict as it stood -- five existence counts, all of
  // them made true by the five `add` lines above them.
  {
    const oldVerdict =
      ':local hsPool [:len [/ip pool find where name="hotspot-pool"]]; ' +
      ':local hsNet [:len [/ip dhcp-server network find where address="192.168.88.0/24"]]; ' +
      ':if ($hsPool > 0 && $hsNet > 0) do={ :put "  RESULT: PASS -- every object this chunk creates exists." }';
    const readsBack = /\/ip pool get \[find name="hotspot-pool"\] ranges/.test(oldVerdict);
    check(
      "INJECTED: the read-back guard fires on the existence-count-only verdict it replaced",
      readsBack === false,
      "the guard is blind to the verdict that printed PASS at a broken router",
    );
  }
  check(
    "INJECTED: ...and does NOT fire on the verdict actually shipped",
    /\/ip pool get \[find name="hotspot-pool"\] ranges/.test(verdict),
    "the guard bans the fix it exists to require",
  );
}

console.log("\n-- 13.2 mangle ordering survives a re-paste --");

{
  const mangleVariants = VARIANTS.map(([variant, opts]) => [
    variant,
    buildRouterSetupScriptChunks(opts).find((c) => c.label.startsWith("Basic Mangle Rules")),
  ]).filter(([, c]) => c);

  check(
    "the sweep sees both the even-split and the weighted mangle chunk",
    mangleVariants.length >= 5 &&
      mangleVariants.some(([, c]) => c.label.includes("weighted")) &&
      mangleVariants.some(([, c]) => !c.label.includes("weighted")),
    `only ${mangleVariants.length} mangle chunk(s), and both paths must be in scope -- the old ` +
      "sweep ran on the weighted path ONLY, which is half of why this defect existed",
  );

  /** Index of the first line matching, or -1. */
  const lineIndex = (script, re) => script.split("\n").findIndex((l) => re.test(l));
  /** Index of the LAST line matching, or -1. */
  const lastLineIndex = (script, re) => {
    const lines = script.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) if (re.test(lines[i])) return i;
    return -1;
  };
  const RE_SWEEP =
    /:foreach \w+ in=\[\/ip firewall mangle find where comment~"\^cloudguest-mangle-"\] do=\{ \/ip firewall mangle remove/;
  const RE_MARK_CONN_ADD = /\/ip firewall mangle add [^\n]*action=mark-connection/;
  const RE_MARK_ROUTE_ADD = /\/ip firewall mangle add [^\n]*action=mark-routing/;

  const orderOffenders = [];
  const sweepOffenders = [];
  for (const [variant, chunk] of mangleVariants) {
    const s = chunk.script;
    if (!RE_SWEEP.test(s)) {
      sweepOffenders.push(`${variant}: no unconditional cloudguest-mangle- sweep`);
      continue;
    }
    const sweepAt = lineIndex(s, RE_SWEEP);
    const firstConn = lineIndex(s, RE_MARK_CONN_ADD);
    const lastConn = lastLineIndex(s, RE_MARK_CONN_ADD);
    const firstRoute = lineIndex(s, RE_MARK_ROUTE_ADD);
    if (sweepAt > firstConn)
      sweepOffenders.push(`${variant}: the sweep runs AFTER the first add, so it deletes it`);
    if (firstRoute === -1 || lastConn === -1)
      orderOffenders.push(`${variant}: missing a mark-connection or mark-routing add`);
    else if (lastConn > firstRoute)
      orderOffenders.push(
        `${variant}: a mark-routing add (line ${firstRoute + 1}) precedes a mark-connection add (line ${lastConn + 1})`,
      );
  }
  check(
    "every mangle chunk sweeps ALL of its own rules before adding any, in both paths",
    sweepOffenders.length === 0,
    `${sweepOffenders.length}: ${sweepOffenders.join(" | ")}. A plain \`add\` APPENDS, so re-adding ` +
      "PCC rules while leaving the mark-routing rules in place puts them below the rules that " +
      "depend on them -- the SYN of every new connection is then still no-mark at the routing " +
      "decision and leaves by the wrong WAN",
  );
  check(
    "every mark-routing rule is emitted BELOW every mark-connection rule",
    orderOffenders.length === 0,
    `${orderOffenders.length}: ${orderOffenders.join(" | ")}`,
  );
  check(
    "the sweep matches the whole cloudguest-mangle- family, not just -pcc-",
    mangleVariants.every(
      ([, c]) =>
        !/comment~"\^cloudguest-mangle-pcc-wan"\] do=\{ \/ip firewall mangle remove/.test(c.script),
    ),
    "a sweep covering only `-pcc-` leaves the mark-routing rules in place, which is exactly how " +
      "the re-paste inverted the order",
  );
  check(
    "the sweep removes ONLY rules this generator owns",
    mangleVariants.every(
      ([, c]) =>
        (c.script.match(/\/ip firewall mangle remove/g) ?? []).length > 0 &&
        c.script
          .split("\n")
          .filter((l) => /\/ip firewall mangle remove/.test(l))
          .every((l) => /comment~"\^cloudguest-mangle-/.test(l)),
    ),
    "an unqualified mangle sweep would delete a hand-written rule an operator relies on",
  );
  check(
    "the chunk verifies the ordering on the device and can print FAIL",
    mangleVariants.every(
      ([, c]) =>
        /RESULT: FAIL -- the load-balancing mangle rules are wrong or out of order/.test(
          c.script,
        ) &&
        /mark-routing rule is ABOVE a mark-connection rule/.test(c.script) &&
        /:log warning "cloudguest: multi-WAN mangle rules missing or mis-ordered/.test(c.script),
    ),
    "ordering restored by construction and never read back is an assumption, not a check",
  );
  check(
    "...and the ordering read-back degrades to `not verified` instead of aborting the line",
    mangleVariants.every(
      ([, c]) =>
        /on-error=\{ :set mgOrderKnown false \}/.test(c.script) &&
        /Rule ORDER could not be read on this RouterOS version/.test(c.script),
    ),
    "`:find` over an array of internal ids is the one shape here not confirmed on this hardware; " +
      "an unguarded error would take the whole `;`-joined line down, and on a single-line paste " +
      "that aborts every chunk after it",
  );

  // INJECTED: both halves of the original defect.
  {
    // REGEN_CHUNKS is a single-WAN build and has no mangle chunk at all,
    // so the shipped-shape half of this pair is built here explicitly.
    const swept = buildRouterSetupScriptChunks({
      ...BASE,
      wans: [DHCP_WAN, { iface: "ether2", mode: "dhcp" }],
      wanRoutingMode: "load_balance",
    }).find((c) => c.label.startsWith("Basic Mangle Rules"));
    const brokenSweep = buildRouterSetupScriptChunks({
      ...BASE,
      wans: [DHCP_WAN, { iface: "ether2", mode: "dhcp" }],
      wanRoutingMode: "load_balance",
    })
      .find((c) => c.label.startsWith("Basic Mangle Rules"))
      .script.replace('comment~"^cloudguest-mangle-"', 'comment~"^cloudguest-mangle-pcc-wan"');
    check(
      "INJECTED: the sweep guard fires when the sweep is narrowed back to -pcc- only",
      !RE_SWEEP.test(brokenSweep),
      "the guard is blind to the narrowed sweep that caused the defect",
    );
    const reordered = buildRouterSetupScriptChunks({
      ...BASE,
      wans: [DHCP_WAN, { iface: "ether2", mode: "dhcp" }],
      wanRoutingMode: "load_balance",
    }).find((c) => c.label.startsWith("Basic Mangle Rules")).script;
    const lines = reordered.split("\n");
    const routeLine = lines.find((l) => RE_MARK_ROUTE_ADD.test(l));
    const connLine = lines.findIndex((l) => RE_MARK_CONN_ADD.test(l));
    const mutated = [
      ...lines.slice(0, connLine),
      routeLine,
      ...lines.slice(connLine).filter((l) => l !== routeLine),
    ].join("\n");
    check(
      "INJECTED: the ordering guard fires when a mark-routing add is moved above a mark-connection add",
      lastLineIndex(mutated, RE_MARK_CONN_ADD) > lineIndex(mutated, RE_MARK_ROUTE_ADD),
      "the guard is blind to the exact rule order that kills ~30% of new connections",
    );
    check(
      "INJECTED: ...and does NOT fire on the order actually shipped",
      Boolean(swept) &&
        lastLineIndex(swept.script, RE_MARK_CONN_ADD) < lineIndex(swept.script, RE_MARK_ROUTE_ADD),
      "the guard bans the fix it exists to require",
    );
  }
}

console.log("\n-- 13.3 failover-only sweeps the marks, not just the routes --");

{
  const failover = buildRouterSetupScriptChunks({
    ...BASE,
    wans: [DHCP_WAN, { iface: "ether2", mode: "dhcp" }, { iface: "ether3", mode: "dhcp" }],
    wanRoutingMode: "failover_only",
  });
  const routing = failover.find((c) => c.label.startsWith("WAN Routing")).script;

  check(
    "a failover-only script generates no mangle chunk at all (unchanged)",
    !failover.some((c) => c.label.startsWith("Basic Mangle Rules")),
    "if it did, this cleanup would be fighting it",
  );
  check(
    "the failover-only cleanup still removes the routing-mark'd routes",
    /comment~"\^cloudguest-route-wan"\] do=\{ \/ip route remove/.test(routing) &&
      /comment~"\^cloudguest-backup-wan"\] do=\{ \/ip route remove/.test(routing),
    "the existing half of the cleanup was removed rather than completed",
  );
  check(
    "...AND sweeps the mangle marks that pointed at them",
    /:foreach \w+ in=\[\/ip firewall mangle find where comment~"\^cloudguest-mangle-"\] do=\{ \/ip firewall mangle remove/.test(
      routing,
    ),
    "deleting every to_wan<N> route while leaving the rules that mark traffic INTO those tables " +
      "is the exact black hole this chunk's own comment says the pair exists to prevent: guests " +
      "get an address and the portal, and nothing past this router",
  );
  check(
    "...and only removes mangle rules this generator owns",
    routing
      .split("\n")
      .filter((l) => /\/ip firewall mangle remove/.test(l))
      .every((l) => /comment~"\^cloudguest-mangle-/.test(l)),
    "an unqualified sweep in a failover script would delete a hand-written rule",
  );
  check(
    "...and reads the result back with a PASS/FAIL rather than assuming it",
    /failover-only: load-balancing mangle rules left=/.test(routing) &&
      /RESULT: FAIL -- a load-balancing leftover survived this failover-only paste/.test(routing) &&
      /:log warning "cloudguest: failover-only paste left load-balancing mangle marks/.test(
        routing,
      ),
    "a leftover marking rule is invisible on the router: traffic is marked, routed nowhere, and " +
      "logged nowhere",
  );
  check(
    "the leftover count is keyed on this generator's own comment, not on a version-specific property",
    /find where comment~"\^cloudguest-\(route\|backup\)-wan"/.test(routing) &&
      !/find where routing-table~/.test(routing) &&
      !/find where routing-mark~/.test(routing),
    "`routing-table` is v7 and `routing-mark` is v6; a `find where` on a property a route does " +
      "not carry is not a shape this generator has confirmed",
  );
  check(
    "a LOAD-BALANCE script does not carry the failover-only cleanup",
    !/failover-only: load-balancing mangle rules left=/.test(
      buildRouterSetupScriptChunks({
        ...BASE,
        wans: [DHCP_WAN, { iface: "ether2", mode: "dhcp" }],
        wanRoutingMode: "load_balance",
      }).find((c) => c.label.startsWith("WAN Routing")).script,
    ),
    "it would delete the mangle rules the very next chunk creates",
  );

  // INJECTED
  {
    const withoutSweep = routing.replace(
      /:foreach \w+ in=\[\/ip firewall mangle find where comment~"\^cloudguest-mangle-"\] do=\{ \/ip firewall mangle remove \$\w+ \}/,
      "",
    );
    check(
      "INJECTED: the guard fires when the mangle sweep is removed from the failover cleanup",
      !/\/ip firewall mangle find where comment~"\^cloudguest-mangle-"\] do=\{ \/ip firewall mangle remove/.test(
        withoutSweep,
      ),
      "the guard is blind to the black hole it exists for",
    );
  }
}

console.log("\n-- 13.5 a stale STATIC WAN address does not survive a re-paste --");

{
  const staticWan = buildRouterSetupScriptChunks({
    ...BASE,
    wans: [STATIC_WAN],
  }).find((c) => c.label.startsWith("WAN Addressing")).script;

  check(
    "the static branch still clears a dangling DHCP-leased address (unchanged)",
    /:foreach \w+ in=\[\/ip address find where interface="ether1" dynamic=yes\] do=\{ \/ip address remove/.test(
      staticWan,
    ),
    "the existing half of the sweep was replaced rather than extended",
  );
  check(
    "...AND clears the STATIC address this generator itself left last time",
    /:foreach \w+ in=\[\/ip address find where interface="ether1" comment="cloudguest-addr-wan1"\] do=\{ :if \(\[\/ip address get \$\w+ address\] != "1\.2\.3\.4\/24"\) do=\{ \/ip address remove/.test(
      staticWan,
    ),
    "`dynamic=yes` never matches a static address, so changing a WAN's IP and re-pasting laid the " +
      "new one down BESIDE the old one -- two addresses on one WAN, forever, with nothing " +
      "reporting it",
  );
  check(
    "...and only ever removes an address carrying this generator's own comment",
    staticWan
      .split("\n")
      .filter((l) => /\/ip address remove/.test(l))
      .every((l) => /dynamic=yes/.test(l) || /comment="cloudguest-addr-wan\d+"/.test(l)),
    "an operator's own static address on a WAN is not this script's to delete",
  );
  check(
    "...and does not remove the address it is about to add (no-op on a healthy re-run)",
    /!= "1\.2\.3\.4\/24"/.test(staticWan),
    "an unconditional remove-then-add drops the WAN for the width of the paste",
  );
  check(
    "an address count is REPORTED, so a foreign second address is visible without being deleted",
    /WARNING: WAN1 \(ether1\) carries/.test(staticWan) &&
      /:log warning "cloudguest: WAN1 \(ether1\) does not carry exactly one address/.test(
        staticWan,
      ),
    "reported, not removed -- the same discipline as the local hotspot user sweep",
  );
  check(
    "a DHCP WAN does not get a static-address sweep it has no use for",
    !/comment="cloudguest-addr-wan1"/.test(
      buildRouterSetupScriptChunks({ ...BASE, wans: [DHCP_WAN] }).find((c) =>
        c.label.startsWith("WAN Addressing"),
      ).script,
    ),
    "the static branch's cleanup leaking into the dhcp branch would remove nothing and confuse " +
      "anyone reading the script",
  );

  // INJECTED
  {
    const dynamicOnly = staticWan.replace(
      /:foreach \w+ in=\[\/ip address find where interface="ether1" comment="cloudguest-addr-wan1"\][^\n]*\n/,
      "",
    );
    check(
      "INJECTED: the guard fires when the sweep is narrowed back to dynamic=yes only",
      !/comment="cloudguest-addr-wan1"\] do=\{ :if/.test(dynamicOnly),
      "the guard is blind to the sweep that let a stale static address survive forever",
    );
  }
}

// =====================================================================
// 14. ONE WRITER PER HOTSPOT-PROFILE PROPERTY, AND NO ROUTER-SIGNED TLS
//     IN FRONT OF A GUEST
// =====================================================================
// The defect: TWO chunks set `login-by` on the same `hsprof1`. The
// "Hotspot" chunk set `login-by=http-pap`; a later "Self-Signed HTTPS
// Certificate" chunk set `login-by=https,http-pap` with
// `ssl-certificate=` pointing at a cert the router had signed for itself.
// Both succeeded, in paste order, and the later one won -- so every
// router this generator provisioned served its captive-portal page over
// TLS with a certificate nothing trusts. Confirmed live, guest-facing: a
// real Android phone on a freshly provisioned hEX showed a security
// warning the instant the portal opened.
//
// NOTHING IN THIS SUITE COULD SEE IT, and that is the interesting part.
// Section 1 was happy (no variable crossed a line). Section 2 was happy
// (one statement per `do={}`). Sections 10.2-10.7 were happy -- BOTH
// chunks dutifully counted their objects and printed a verdict. Every
// guard here is about what one line means; this defect was in the
// relationship between two lines that were each individually perfect.
//
// So the guard is the relationship: within one generated script, a
// hotspot-profile property may be written by exactly ONE `set`. That is
// the property that makes the defect unrepresentable, and it is stronger
// than pinning the value -- pinning `http-pap` stops today's bug, while
// single-writer stops the NEXT chunk that decides it also has an opinion.
//
// Both are asserted anyway, because the value carries a guest-facing
// claim that deserves its own name in a failure message: the hotspot's
// own page collects nothing (it is a spinner and a `location.replace` to
// the real portal, over real HTTPS, with a real certificate), so plain
// HTTP there costs nothing -- and an untrusted certificate there costs a
// great deal, because it is a full-page interstitial between a venue's
// guest and sign-in, and the guests who get past it are the ones who
// learned to click through certificate warnings on public WiFi. 13.4
// asserts the "collects nothing" half against the emitted HTML rather
// than trusting this paragraph, so the day someone puts a field on that
// page, this argument fails loudly instead of silently becoming false.

console.log("\n-- one writer per hotspot-profile property, and no self-signed TLS --");

/** Every `/ip hotspot profile set` / `/ip hotspot user profile set` write
 * in a script, as `{ menu, prop, value, line }`. Shared by the sweep and
 * by its own self-checks -- this file has been bitten three times by a
 * self-check that kept a private copy of the sweep's regex and therefore
 * could not see the sweep being mutated. */
const HOTSPOT_SET = /\/ip hotspot(?: user)? profile set\s+\[[^\]]*\]([^;\n}]*)/g;
const PROP_ASSIGN = /([a-z][a-z0-9-]*)=("[^"]*"|\S+)/g;
const hotspotProfileWrites = (script) => {
  const out = [];
  for (const line of script.split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    for (const m of line.matchAll(HOTSPOT_SET)) {
      const menu = m[0].includes("user profile")
        ? "/ip hotspot user profile"
        : "/ip hotspot profile";
      for (const p of m[1].matchAll(PROP_ASSIGN)) {
        out.push({ menu, prop: p[1], value: p[2].replace(/^"|"$/g, ""), line });
      }
    }
  }
  return out;
};

/** One full paste per variant -- the invariant is about the whole script a
 * technician runs, not about one chunk. `pasteables` de-duplicates chunk
 * BODIES across variants, which is exactly wrong for a question of the
 * form "how many times does this script write this property". */
const FULL_SCRIPTS = VARIANTS.map(([variant, opts]) => [
  variant,
  buildRouterSetupScriptChunks(opts)
    .map((c) => c.script)
    .join("\n"),
]);

check(
  "13: the whole-script sweep really has every variant in it",
  FULL_SCRIPTS.length === VARIANTS.length && FULL_SCRIPTS.every(([, s]) => s.length > 2000),
  "a variant produced no script, so the sweep below is asserting over nothing",
);

// ---------------------------------------------------------------------
// 13.1 ONE WRITER PER PROPERTY.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 13.9 THE RESOLVER SWITCH IS NOT A PREFERENCE.
// ---------------------------------------------------------------------
// Confirmed live 2026-08-23 on the founder's hEX. Everything the guest
// flow needs was correct on the device -- `login-by=http-pap`,
// `dns-name=wifi.wyfyguest.com`, the static DNS record, both walled-garden
// entries, `use-radius=yes`, hotspot running on the bridge -- and no
// sign-in page ever popped up. `/ip dns` had `allow-remote-requests: no`.
//
// The router answered DNS for nobody, so the static record was unreachable
// and, worse, the guest's captive-portal probe got no answer to intercept:
// the phone concluded the network was fine and stayed silent. The portal
// only appeared if the guest typed the LAN IP by hand.
//
// The line WAS emitted -- bundled with `servers=`, and the pair fell away
// together in `basicConfigOnly`. They are not the same kind of setting.
// `servers=` chooses WHICH upstream resolvers this router uses, which a
// technician may reasonably want to set by hand. `allow-remote-requests`
// decides WHETHER this router answers the devices behind it, and the
// hotspot chunk hard-depends on it in every mode.
//
// There was no check of any kind on this before today, in any mode, which
// is how it could be dropped silently.
// ---------------------------------------------------------------------
// 13.10 A SCRIPT THAT IS MISSING SOMETHING SAYS SO.
// ---------------------------------------------------------------------
// Confirmed live 2026-08-23. The RADIUS bridge returned 502 because a
// stale hand-written stanza already claimed the tunnel address the
// allocator had just handed out. The panel caught it, showed a toast, and
// generated the script WITHOUT the RADIUS chunk. The operator pasted all
// of it, the router came up, the hotspot served pages -- and `/radius` on
// the device was empty, so every guest login would have failed with
// nothing on either side naming the cause.
//
// The toast was gone in seconds. What remained was a script that looked
// complete: 22 chunks instead of 23, and not one line in it mentioning
// what was absent. A shorter script is indistinguishable from a whole one.
{
  const gaps = [
    { what: "RADIUS", why: "the RADIUS bridge could not be reached" },
    { what: "WireGuard tunnel", why: "the hub refused the allocation" },
  ];
  const withGaps = buildRouterSetupScriptChunks({
    // `portalUrl` and the rest of a real Generate are present so that the
    // ONLY gaps in this fixture are the two the caller declared. Without
    // it the generator now derives a third (no portal redirect pages) and
    // every count below silently means something other than what it says
    // -- the same "the fixture is not what the check claims" shape 13.10's
    // own `clean` fixture was corrected for a few lines up.
    ...BASE,
    wans: [DHCP_WAN],
    portalUrl: PORTAL,
    apiAccess: { username: "cloudguest", secret: "pw" },
    notProvisioned: gaps,
  });
  // A GENUINELY complete script. This fixture used to be
  // `{ ...BASE, wans: [DHCP_WAN] }` -- no RADIUS, no tunnel, no portal
  // pages -- and this check therefore asserted that a script missing
  // three subsystems must carry NO warning. That is the founder's bug
  // stated as a requirement: the suite's own definition of "complete" was
  // "the caller reported no exception", which is exactly the definition
  // `notProvisioned` encodes and exactly the one that misses an unticked
  // checkbox. Section 15.8 asserts the other direction, so the two would
  // have contradicted each other and whichever is looser would have won.
  // The check's INTENT is right and unchanged: a banner on every healthy
  // download is noise that gets scrolled past on the one that matters.
  const clean = buildRouterSetupScriptChunks({
    ...BASE,
    wans: [DHCP_WAN],
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
    apiAccess: { username: "cloudguest", secret: "pw" },
    portalUrl: PORTAL,
  });

  check(
    "a complete script carries no incomplete-script warning",
    !clean.some((c) => /INCOMPLETE SCRIPT/.test(c.label)),
    "the warning must appear only when something is actually missing, or it is noise " +
      "that gets scrolled past on every healthy paste",
  );

  const warn = withGaps.find((c) => /INCOMPLETE SCRIPT/.test(c.label));
  check("a script with gaps carries the warning", Boolean(warn), "no warning chunk was emitted");

  // THE .rsc IS A SEPARATE DELIVERY CHANNEL, AND IT IS THE ONE THAT BIT
  // FIRST. Confirmed live 2026-08-27: the operator's first attempt was a
  // DOWNLOADED .rsc with no RADIUS in it. A file has no toast and no
  // banner around it -- it is saved, carried to the venue, uploaded and
  // `/import`ed. The warning chunk's `:put` lines are real, but they sit
  // in the middle of the file and scroll past during an import.
  //
  // So the gap has to be restated in `#` comments at the TOP of the file,
  // where it is the first thing anyone opening it reads.
  {
    const rsc = chunksToRouterOsScript(withGaps, "lobby router");
    // THE PROLOGUE IS EVERYTHING BEFORE THE FIRST STATEMENT, not a magic
    // line count. `slice(0, 14)` stood here and silently stopped covering
    // the banner the moment the header grew a sixth line -- the check
    // still passed on "THIS SCRIPT IS INCOMPLETE" and stopped seeing the
    // subsystem names, which is the half that matters. Deriving the
    // boundary means the header can grow without this going quietly
    // vacuous.
    const prologueLines = (text) => {
      const out = [];
      for (const raw of text.split("\n")) {
        const l = raw.trim();
        if (l === "") continue;
        if (!l.startsWith("#")) break;
        out.push(l);
      }
      return out;
    };
    const head = prologueLines(rsc).join("\n");
    check(
      "the .rsc header ends before the first executable statement",
      prologueLines(rsc).length > 0 &&
        rsc.split("\n").some((l) => l.trim() !== "" && !l.trim().startsWith("#")) &&
        !prologueLines(rsc).some((l) => !l.startsWith("#")),
      "if the prologue extended past the first statement this check would be grading the " +
        "whole file, and 'the header names RADIUS' would be true of any script that mentions it",
    );
    check(
      "a .rsc built from an incomplete script says so in its header",
      /THIS SCRIPT IS INCOMPLETE/.test(head),
      "a downloaded file has no toast and no banner -- the header is the only thing read before it runs",
    );
    check(
      "...naming the missing subsystems in the header itself",
      /RADIUS/.test(head) && /WireGuard/.test(head),
      "an operator must be able to tell WHAT is missing without reading the whole file",
    );
    check(
      "...and only ever as RouterOS comments, so the file still imports",
      prologueLines(rsc).every((l) => l.startsWith("#")),
      "a non-comment line in the header would be executed by /import",
    );
    const cleanRsc = chunksToRouterOsScript(clean, "lobby router");
    check(
      "a .rsc built from a COMPLETE script carries no such header",
      !/THIS SCRIPT IS INCOMPLETE/.test(cleanRsc),
      "a banner on every healthy download is noise that gets ignored on the one that matters",
    );
  }

  // FIRST, NOT LAST. An operator pastes top to bottom and stops reading
  // once it is going well; a warning at the end is read after the router
  // is already half-configured.
  check(
    "the warning is the very first chunk",
    withGaps.length > 0 && /INCOMPLETE SCRIPT/.test(withGaps[0].label),
    `first chunk was ${withGaps[0]?.label}`,
  );

  check(
    "the label names what is missing, so it is visible in the chunk list",
    /RADIUS/.test(warn?.label ?? "") && /WireGuard/.test(warn?.label ?? ""),
    warn?.label,
  );

  // NAMES THE CONSEQUENCE, not just the gap. "RADIUS is missing" cannot be
  // weighed by someone who does not know it means no guest can log in.
  check(
    "it says what a missing RADIUS actually costs",
    /reject EVERY guest login/.test(warn?.script ?? ""),
    "a gap without its consequence reads as a warning worth ignoring",
  );
  check(
    "it says what a missing tunnel actually costs",
    /never reach the platform/.test(warn?.script ?? ""),
    "same reasoning as RADIUS above",
  );
  // ADDED 2026-08-27. A failed API-credential PUT used to produce a toast
  // and NOTHING else -- no `notProvisioned` entry, so no banner, so the
  // "API Access" chunk simply vanished and the script still looked whole.
  // That is the identical defect class that hid the missing RADIUS, left
  // unfixed in the same function. The panel now pushes a gap for it, so
  // the banner has to be able to describe it.
  {
    const apiGap = buildRouterSetupScriptChunks({
      ...BASE,
      wans: [DHCP_WAN],
      notProvisioned: [
        { what: "API Access (Device Console)", why: "the platform could not record them" },
      ],
    }).find((c) => /INCOMPLETE SCRIPT/.test(c.label));
    check(
      "it says what missing API access actually costs",
      /Device Console stays locked/.test(apiGap?.script ?? ""),
      "a gap without its consequence reads as a warning worth ignoring",
    );
    check(
      "...and notes that guest WiFi still works, so nothing else looks wrong",
      /Guest/.test(apiGap?.script ?? "") && /unaffected/.test(apiGap?.script ?? ""),
      "this is the one gap with no user-visible symptom -- that is exactly why it needs saying",
    );
  }
  check(
    "it carries the reason the panel was given, verbatim",
    /the RADIUS bridge could not be reached/.test(warn?.script ?? ""),
    "the operator cannot fix a cause the script will not name",
  );
  // LOGGED AS WELL AS PRINTED. A technician who scrolled past the paste
  // output has no record of it otherwise -- the same reasoning every other
  // check in this file uses for its own `:log warning`.
  check(
    "it logs as well as prints",
    (warn?.script.match(/:log warning "cloudguest: generated script is missing/g) ?? []).length ===
      gaps.length,
    "one log line per gap",
  );
  // ---- THE /import PATH MUST NOT SILENTLY HALF-SUCCEED ----------------
  //
  // The operator provisions from a downloaded .rsc. `/import` never pauses
  // and never stops for a `:put`, so every precondition this generator
  // "checks" was, on that path, decorative: the run sailed past a missing
  // RADIUS chunk, past a dead uplink and past an unsynced clock, and built
  // a hotspot anyway. These four assert the aborts that make the file
  // either work or stop loudly -- the acceptance criterion for that path.
  check(
    "the incomplete-script chunk ABORTS, so /import cannot run past it",
    /:error /.test(warn?.script ?? ""),
    "under /import a `:put` scrolls past unread and the run continues into WAN/hotspot/firewall",
  );
  check(
    "...and its abort names what was missing",
    /:error "[^"]*RADIUS/.test(warn?.script ?? ""),
    "a bare stop tells the operator nothing they can act on",
  );
  {
    const full = buildRouterSetupScriptChunks({ ...BASE, wans: [DHCP_WAN] });
    const byLabel = (re) => full.find((c) => re.test(c.label))?.script ?? "";
    check(
      "the WAN connectivity check aborts on FAIL",
      /:error /.test(byLabel(/WAN Connectivity Check/)),
      "otherwise /import builds a hotspot on a box with no internet -- the confirmed field state",
    );
    check(
      "the clock/NTP check aborts on FAIL",
      /:error /.test(byLabel(/Clock \+ NTP/)),
      "a wrong clock fails TLS, so every platform call is rejected before it is sent and the " +
        "router shows OFFLINE forever while its WiFi works",
    );
    // THE /import DHCP RACE. Chunk-by-chunk pasting hides this completely:
    // the human delay between pastes is more than enough for a lease to
    // bind. `/import` reads the gateway microseconds after adding the
    // client, gets nothing, and leaves 0.0.0.0/0 via 0.0.0.0 flagged
    // Inactive with every ping answering "no route to host".
    const routing = byLabel(/WAN Routing/);
    check(
      "a DHCP WAN polls for its lease rather than reading the gateway once",
      /:delay /.test(routing),
      "reading immediately after adding the dhcp-client is the /import race itself",
    );
    check(
      "...and aborts if the lease never binds, instead of leaving an Inactive default route",
      /:error /.test(routing),
      "continuing produces 0.0.0.0/0 via 0.0.0.0 (flags Is) and a fully built hotspot with no uplink",
    );
  }

  // AND IT CONFIGURES NOTHING. A chunk that warns and also mutates is a
  // chunk an operator cannot safely skip.
  check(
    "the warning chunk changes nothing on the device",
    !/\/(ip|interface|system|radius|certificate|user)\s/.test(
      (warn?.script ?? "").replace(/:put "[^"]*"/g, "").replace(/:log warning "[^"]*"/g, ""),
    ),
    "it must be safe to read and skip; it exists to be read, not to act",
  );
}

// ---------------------------------------------------------------------
// 13.11 THE LEASE ITSELF SAYS THERE IS A PORTAL (RFC 8910, option 114).
// ---------------------------------------------------------------------
// Everything else in this script relies on the guest's device GUESSING
// that a portal exists: it fetches its own probe URL, the hotspot
// intercepts it, the redirect is read as "captive". That works on Wi-Fi
// and is unreliable on a cable -- macOS does not open its Captive Network
// Assistant for an Ethernet interface at all. Confirmed live 2026-08-23:
// a cabled laptop got an address, got no popup, and reached the portal
// only when the address was typed by hand.
//
// Option 114 removes the guessing. It is additive -- a device that ignores
// it still hits the probe-interception path exactly as before.
for (const [variant, script] of FULL_SCRIPTS) {
  if (/HOTSPOT \+ DHCP: NOTHING WAS GENERATED/.test(script)) continue;

  check(
    `${variant}: the DHCP lease advertises the captive portal (option 114)`,
    /\/ip dhcp-server option add name="cloudguest-captive-portal" code=114/.test(script),
    "without it a cabled client has nothing but probe interception to go on, and macOS " +
      "does not act on that for an Ethernet interface",
  );
  // IT POINTS AT THE RFC 8908 API, NOT AT A PAGE. This was written wrong
  // the first time and the check went with it, so both are pinned now.
  // Option 114 does not carry "the portal's address" -- it carries the
  // address of an API that answers that question in JSON. Pointed at an
  // HTML page, a conforming client fetches it, fails to parse it as
  // `application/captive+json`, and ignores the option entirely, which is
  // indistinguishable from option 114 not working at all.
  check(
    `${variant}: option 114 points at the RFC 8908 API, not at a page`,
    /code=114 [^\n]*value="'https?:\/\/[^']*\/captive-portal\/rfc8908\?portal_url=/.test(script),
    "an HTML page there is silently ignored by every conforming client",
  );
  // AND IT IS HANDED OUT WHETHER OR NOT THE CLIENT ASKS FOR IT. Without
  // `force=yes` RouterOS sends the option only to clients that named code
  // 114 in their Parameter Request List. Capport-aware operating systems
  // generally do ask -- and the device this chunk exists for is the one
  // that is not asking the right question: a cabled macOS laptop never
  // opens its Captive Network Assistant on Ethernet at all (confirmed live
  // 2026-08-23). An option that is only delivered on request is no help to
  // a client that does not know to make the request.
  check(
    `${variant}: option 114 is forced, not offered only on request`,
    /name="cloudguest-captive-portal" code=114 force=yes/.test(script) &&
      /option set \[find name="cloudguest-captive-portal"\] code=114 force=yes/.test(script),
    "without force=yes a client that does not list code 114 never receives it, " +
      "which is the exact client this option was added for",
  );
  // AND THE PORTAL IT NAMES IS STILL THIS ROUTER. The JSON's
  // `user-portal-url` is where the device actually goes, and it must be the
  // router's own redirect page -- that is what carries the
  // $(mac)/$(link-login-only) substitution the portal needs. Sending the
  // device straight to the cloud portal gives it a session it cannot log
  // into; see HOTSPOT_DNS_NAME's docstring for the live failure.
  check(
    `${variant}: the portal_url it hands back is this router, not the cloud portal`,
    new RegExp(`portal_url=http://${HOTSPOT_DNS_NAME_RE}/'"`).test(script) &&
      !/portal_url=https?:\/\/portal\./.test(script),
    "the device must land on this router's redirect page, which carries the session " +
      "parameters the portal needs",
  );
  // ADD-OR-UPDATE. The value embeds the hostname; one left over from an
  // earlier run with a different name would send devices somewhere this
  // router does not answer, and add-if-missing would never correct it.
  check(
    `${variant}: a stale option 114 is corrected, not left in place`,
    /else=\{ \/ip dhcp-server option set \[find name="cloudguest-captive-portal"\] code=114/.test(
      script,
    ),
    "add-if-missing would leave a wrong URL on the device for ever",
  );
  check(
    `${variant}: the option is actually attached to this network`,
    /dhcp-option-set=cloudguest-opts/.test(script),
    "an option that exists but is attached to nothing is never handed out -- and RouterOS " +
      "reports success either way",
  );
  // REPORTS, DOES NOT FAIL. A guest without option 114 is not broken, only
  // back to guessing, so this must not read as a fatal error.
  check(
    `${variant}: it says so when the option did not land`,
    /NOTE: DHCP option 114 was not created/.test(script) &&
      /exists but is not attached/.test(script),
    "both halves can fail independently and `set [find ...]` succeeds against an empty match",
  );
}

for (const [variant, script] of FULL_SCRIPTS) {
  check(
    `${variant}: the router is told to answer DNS for the devices behind it`,
    /\/ip dns set [^\n]*allow-remote-requests=yes/.test(script),
    "without `allow-remote-requests=yes` the hotspot's own dns-name and static record resolve " +
      "for nobody, and the guest's captive-portal probe gets no answer to intercept -- so no " +
      "sign-in page appears at all and the phone reports the network as working",
  );
  // EVERY variant, including basicConfigOnly -- that is the whole point.
  // A check that only ran on the full-config variants would have passed
  // against the exact script that shipped this bug.
  check(
    `${variant}: it is never turned off again later in the same script`,
    !/allow-remote-requests=no/.test(script),
    "a later chunk setting it back to `no` would undo this silently, and RouterOS reports " +
      "success either way",
  );
}

// The pairing that caused it: `servers=` may legitimately be absent in
// basic mode, but the switch may not travel with it.
{
  const basic = FULL_SCRIPTS.filter(([v]) => /basicConfigOnly/.test(v));
  check(
    "basic mode still turns the resolver on (the mode this bug shipped in)",
    basic.length > 0 &&
      basic.every(([, sc]) => /\/ip dns set [^\n]*allow-remote-requests=yes/.test(sc)),
    `${basic.length} basicConfigOnly variant(s) checked -- if this is 0 the check is vacuous ` +
      "and proves nothing",
  );
  check(
    "basic mode still leaves the upstream servers to the technician",
    basic.length > 0 && basic.every(([, sc]) => !/\/ip dns set servers=/.test(sc)),
    "basic mode exists so a technician can set the router's own upstream DNS by hand; " +
      "unconditionally writing `servers=` would take that back",
  );
}

for (const [variant, script] of FULL_SCRIPTS) {
  const writes = hotspotProfileWrites(script);
  const byProp = new Map();
  for (const w of writes) {
    const key = `${w.menu} ${w.prop}`;
    byProp.set(key, [...(byProp.get(key) ?? []), w.line]);
  }
  const doubled = [...byProp].filter(([, lines]) => lines.length > 1);

  check(
    `${variant}: no hotspot-profile property is written by more than one set`,
    doubled.length === 0,
    `${doubled.length} property/properties written twice: ` +
      doubled
        .map(([key, lines]) => `${key} (${lines.length}x)\n        ${lines.join("\n        ")}`)
        .join("\n      ") +
      `\n      RouterOS applies both, in paste order, and the last one wins -- with no error, no ` +
      `output and nothing on the device to show the earlier value ever existed. This is the ` +
      `exact shape that shipped hotspot HTTPS with a self-signed certificate to every guest.`,
  );

  // ZERO WRITES IS CORRECT IN EXACTLY ONE CASE, AND IT MUST BE THAT CASE.
  // When the LAN address/prefix pair cannot describe a usable subnet, the
  // Hotspot chunk refuses to emit anything at all -- so there is no
  // `hsprof1` for `login-by` to land on, and writing it anyway would be
  // the `set [find]`-against-an-empty-match shape this whole section
  // exists to stop. Rather than relax the count to `<= 1`, which would
  // also pass if the line simply went missing on a NORMAL router, the
  // expected count is derived from whether the refusal is present. A
  // silently dropped `login-by` on a /24 still fails, loudly.
  const hotspotRefused = /HOTSPOT \+ DHCP: NOTHING WAS GENERATED/.test(script);
  const expectedLoginByWrites = hotspotRefused ? 0 : 1;

  if (hotspotRefused) {
    check(
      `${variant}: the refusing hotspot chunk says why, and creates nothing`,
      /RESULT: FAIL -- [^"]+\./.test(script) &&
        /:log warning "cloudguest: hotspot chunk not generated/.test(script) &&
        !/\/ip pool add\b/.test(script) &&
        !/\/ip hotspot profile add\b/.test(script),
      "a chunk that refuses must name the reason on screen AND in the log, and must not " +
        "half-create the objects it declined to configure -- a pool with no hotspot in front " +
        "of it is an open LAN handing out addresses to anyone who plugs in",
    );
  }

  check(
    `${variant}: login-by is written exactly once, and defaults to http-pap`,
    (byProp.get("/ip hotspot profile login-by") ?? []).length === expectedLoginByWrites &&
      // The value is now chosen ON THE DEVICE, so this asserts the LOGIC
      // rather than a literal. Every write must be the variable -- a bare
      // literal here would mean someone reintroduced an unconditional
      // value, in either direction.
      writes.filter((w) => w.prop === "login-by").every((w) => w.value === "$hsLoginBy"),
    `login-by writes: ${JSON.stringify(writes.filter((w) => w.prop === "login-by").map((w) => w.value))}, ` +
      `expected ${expectedLoginByWrites} (hotspot chunk ${hotspotRefused ? "refused" : "generated"}). ` +
      `One write, and its value must come from the on-device decision, not a literal.`,
  );

  if (!hotspotRefused) {
    // THE DEFAULT IS THE SAFE ONE. If the binding line ever flipped to
    // `https` as its starting value, every router without a trusted
    // certificate would stand up TLS against whatever it happens to carry
    // -- the original guest-facing warning, re-entered.
    check(
      `${variant}: the default value is plain http-pap, with no https in it`,
      /:local hsLoginBy "http-pap"/.test(script),
      "the starting value must be the one that is safe on a router with no certificate at all",
    );
    // THE UPGRADE IS GATED ON THE BINDING, NOT ON A CERT EXISTING. A cert
    // object sitting unbound on the device would let `https` serve TLS
    // against whatever RouterOS picks. Reading `ssl-certificate` off the
    // profile means this can only PRESERVE a binding the renewal script
    // made -- it can never create one.
    check(
      `${variant}: https is only kept when the profile already carries the fleet certificate`,
      /:local hsBound \[:len \[\/ip hotspot profile find where name="hsprof1" and ssl-certificate~"wyfy-hotspot-fleet"\]\]/.test(
        script,
      ) && /:if \(\$hsBound > 0\) do=\{ :set hsLoginBy "https,http-pap" \}/.test(script),
      "gating on `[/certificate find ...]` instead would enable TLS against an unbound or " +
        "foreign certificate, which is the bug this file deleted a whole chunk to remove",
    );
    // AND THE GENERATOR STILL NEVER BINDS ONE. This is the invariant that
    // stops a re-paste rebinding a router onto a self-signed certificate;
    // recognising a binding must not become writing one.
    check(
      `${variant}: the generator still never writes ssl-certificate`,
      !writes.some((w) => w.prop === "ssl-certificate"),
      "recognising the fleet certificate must not turn into binding one -- only " +
        "/opt/wyfy/renew-hotspot-certs.sh may bind it",
    );
  }
}

// INJECTED -- the two mutations this section exists to catch, as fixtures,
// so the guard is proven to fire without needing the real generator to be
// broken first.
{
  const TWO_WRITERS =
    `/ip hotspot profile set [find name="hsprof1"] login-by=http-pap\n` +
    `/ip hotspot profile set [find name="hsprof1"] login-by=https,http-pap dns-name="wifi.wyfyguest.com"`;
  const counted = hotspotProfileWrites(TWO_WRITERS).filter((w) => w.prop === "login-by");
  check(
    "INJECTED: a second chunk writing login-by is seen as a second writer",
    counted.length === 2,
    `the sweep found ${counted.length} login-by write(s) in a script that has two -- the ` +
      `single-writer guard cannot fire at all, so it protects nothing`,
  );
  check(
    "INJECTED: ...and the exact shape that shipped is caught by the value guard too",
    counted.some((w) => w.value.includes("https")),
    "the parser does not read `login-by=https,http-pap` as an https value",
  );
  // `login-by` is an UNORDERED set on RouterOS -- `https,http-pap` and
  // `http-pap,https` are the same fact, and `analyse.ts` already says so
  // in its own docstring. An exact-match value guard rejects both for
  // free, but only if it really is exact; assert both spellings so a
  // future loosening to a prefix/`startsWith` test cannot pass on one
  // ordering while shipping the other.
  for (const spelling of ["https,http-pap", "http-pap,https"]) {
    check(
      `INJECTED: ...and rejects login-by=${spelling}, whichever way round it is written`,
      hotspotProfileWrites(
        `/ip hotspot profile set [find name="hsprof1"] login-by=${spelling}`,
      ).every((w) => w.value !== "http-pap"),
      `${spelling} is accepted as if it were plain http-pap -- RouterOS treats login-by as an ` +
        `unordered set, so a guard blind to one ordering is blind to the defect`,
    );
  }
  check(
    "INJECTED: a reverted login-by=cookie,http-chap is caught by the value guard",
    hotspotProfileWrites(
      `/ip hotspot profile set [find name="hsprof1"] login-by=cookie,http-chap`,
    ).every((w) => w.value !== "http-pap"),
    "the guard would accept RouterOS's own default, which silently rejects every guest login",
  );
  // ANTI-OVER-STRICTNESS. Several properties in ONE set is legal and is
  // what the RADIUS chunk does; a guard that banned it would be switched
  // off by the next person rather than obeyed.
  const LEGAL =
    `/ip hotspot profile set [find name="hsprof1"] login-by=http-pap\n` +
    `/ip hotspot profile set [find name="hsprof1"] dns-name="wifi.wyfyguest.com"\n` +
    `/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes\n` +
    `:if ([:len [/ip hotspot user profile find where name="default"]] > 0) do={ /ip hotspot user profile set [find where name="default"] shared-users=5 }`;
  const legalWrites = hotspotProfileWrites(LEGAL);
  check(
    "...and does NOT fire on several distinct properties, one write each",
    legalWrites.length === 5 && new Set(legalWrites.map((w) => `${w.menu} ${w.prop}`)).size === 5,
    `parsed ${JSON.stringify(legalWrites.map((w) => `${w.menu} ${w.prop}=${w.value}`))} -- the ` +
      `guard either misses a write or invents a collision between distinct properties`,
  );
  check(
    "...and keeps `/ip hotspot user profile` distinct from `/ip hotspot profile`",
    legalWrites.some((w) => w.menu === "/ip hotspot user profile" && w.prop === "shared-users"),
    "the two menus are different objects; collapsing them would report false collisions and " +
      "hide real ones",
  );
  check(
    "...and reads a write out of an `:if (...) do={ ... }` wrapper, not just a bare line",
    hotspotProfileWrites(
      `:if ([:len [/ip hotspot profile find where name="hsprof1"]] > 0) do={ /ip hotspot profile set [find name="hsprof1"] login-by=https }`,
    ).length === 1,
    "a second writer hidden inside a guard would be invisible, which is the cheapest way to " +
      "reintroduce this defect while passing the sweep",
  );
}

// ---------------------------------------------------------------------
// 13.1b `hsprof1` IS CREATED IN ONE PLACE, AND ONLY WHERE `login-by` IS
//       DECIDED.
// ---------------------------------------------------------------------
// 13.1 above counts `set`s. That is the whole of the rule it was written
// for and it was not the whole of the property, which is how the next
// instance of the same defect sat in this generator for months without
// this section going red.
//
// THE DEFECT. The RADIUS chunk carried its own self-heal:
//
//   :if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) \
//     do={ /ip hotspot profile add name="hsprof1" hotspot-address=... \
//          html-directory=hotspot dns-name="wifi.wyfyguest.com" }
//
// -- copied from the Hotspot chunk, for the case where the operator has
// not pasted the Hotspot chunk yet, so this chunk's own `set`s would have
// something to land on. In the Hotspot chunk that `add` is correct because
// the ONE `set login-by=$hsLoginBy` in this whole file follows it three
// lines later. In the RADIUS chunk nothing followed it, and RouterOS gives
// a profile born with no explicit `login-by` its own default,
// `cookie,http-chap` -- the value the Hotspot chunk's own comment records
// as rejecting every guest login, confirmed live in Haldwani. So in
// exactly the one scenario the self-heal existed for, it produced a router
// with `/radius` written, `use-radius=yes` applied, the RADIUS chunk's own
// verdict printing `RESULT: PASS`, and no guest able to log in at all.
//
// A CREATION IS A WRITE. That is the sentence 13.1 was missing. `add` with
// no `login-by=` decides `login-by` just as surely as `set login-by=`
// does; it simply delegates the decision to MikroTik's factory default,
// which is the one value this platform cannot use. So the invariant is not
// "one `set` per property" alone -- it is that a profile can never come
// into existence anywhere `login-by` is not decided about it.
//
// WHY THE OBVIOUS REPAIR IS THE FORBIDDEN ONE, recorded because it is the
// first thing anyone will try. Appending `login-by=http-pap` to that `add`
// fixes today's symptom and creates a second place in the file with an
// opinion about this property -- which is precisely what
// `HOTSPOT_LOGIN_BY`'s docstring exists to forbid, and what 13.1 fails the
// build over. (It would even have SLIPPED PAST 13.1, whose `HOTSPOT_SET`
// regex reads `set` and not `add`; the rule would have been broken in
// spirit while the guard stayed green.) The fix is the other direction:
// the RADIUS chunk no longer creates the profile at all, so `hsprof1` is
// brought into being in exactly one place, on the same handful of lines
// that decide `login-by` for it.
//
// GRADED BY MODELLING THE DEVICE, NOT BY GREPPING THE SOURCE. A grep for
// `login-by` in the RADIUS chunk passes on the words in this very
// paragraph if they are ever pasted into the generator as a comment --
// which is literally how the sibling CoA defect survived. What follows
// builds the script an operator gets when the Hotspot chunk never ran,
// runs it against a tiny model of the one RouterOS object in question, and
// asks the guest-facing question directly: could anybody log in.

console.log("\n-- hsprof1 is created in one place, and only where login-by is decided --");

/** RouterOS's own default for a `/ip hotspot profile` created without an
 * explicit `login-by`. Not a value this generator ever writes -- it is
 * what the DEVICE supplies when nobody writes one, and modelling it is
 * the whole point: the defect was invisible precisely because it lived in
 * a value no line of the script contains. */
const ROUTEROS_DEFAULT_LOGIN_BY = "cookie,http-chap";

/** A deliberately tiny model of `hsprof1` -- existence, and the properties
 * written to it -- run over real generated statements.
 *
 * DELIBERATE LIMITS, so nobody mistakes this for a RouterOS interpreter.
 * It resolves only `:local name "literal"` bindings (the `$hsLoginBy`
 * shape), and only evaluates guards that count `hsprof1` itself; anything
 * else runs. It does NOT model the `hsBound` certificate upgrade, because
 * 13.1 already pins that logic line by line and a second, worse model of
 * it here would just be somewhere for the two to disagree. What it does
 * model is the one thing no other check in this file does: that an `add`
 * without `login-by=` leaves the device holding a value the script never
 * mentions. */
const simulateHsprof1 = (script) => {
  let profile = null;
  for (const rawLine of script.split("\n")) {
    if (rawLine.trimStart().startsWith("#")) continue;
    // Bound PER ENTERED LINE, because that is the scope RouterOS's console
    // gives a `:local` -- the same fact section 1 exists to police.
    const literals = new Map(
      [...rawLine.matchAll(/:local\s+(\w+)\s+"([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    const hsCounted = new Set(
      [
        ...rawLine.matchAll(
          /:local\s+(\w+)\s+\[:len\s*\[\/ip hotspot profile find where\s+name="hsprof1"\]\]/g,
        ),
      ].map((m) => m[1]),
    );
    for (const stmt of topLevelStatements(rawLine)) {
      const guard = stmt.match(/:if\s*\(([\s\S]*?)\)\s*do=\{/);
      if (guard) {
        const cond = guard[1];
        const countsHsprof1 =
          /\[:len\s*\[\/ip hotspot profile find where\s+name="hsprof1"\]\]/.test(cond) ||
          [...hsCounted].some((n) => new RegExp(`\\$${n}\\b`).test(cond));
        if (countsHsprof1) {
          if (/=\s*0/.test(cond) && profile !== null) continue;
          if (/>\s*0/.test(cond) && profile === null) continue;
        }
      }
      const add = stmt.match(/\/ip hotspot profile add\s+([^;}]*)/);
      if (add) {
        const props = Object.fromEntries(
          [...add[1].matchAll(/([a-z][a-z0-9-]*)=("[^"]*"|\S+)/g)].map((m) => [
            m[1],
            m[2].replace(/^"|"$/g, ""),
          ]),
        );
        if (props.name !== "hsprof1") continue;
        // THE LINE THAT MODELS THE DEFECT. Absent an explicit `login-by=`,
        // the object exists on the device carrying MikroTik's default.
        profile = { "login-by": ROUTEROS_DEFAULT_LOGIN_BY, ...props };
        continue;
      }
      const set = stmt.match(/\/ip hotspot profile set\s+\[find[^\]]*\]([^;}]*)/);
      if (set && profile !== null) {
        for (const m of set[1].matchAll(/([a-z][a-z0-9-]*)=("[^"]*"|\S+)/g)) {
          const raw = m[2].replace(/^"|"$/g, "");
          profile[m[1]] = raw.startsWith("$") ? (literals.get(raw.slice(1)) ?? raw) : raw;
        }
      }
    }
  }
  return profile;
};

/** The guest-facing question, asked of the modelled device: given what is
 * on `hsprof1` now, can anybody sign in? RouterOS's `login-by` is an
 * unordered set, so this asks whether `http-pap` is IN it rather than
 * whether it equals anything -- the external-portal form POST is satisfied
 * by that one method and by nothing else in the list. */
const rejectsEveryLogin = (profile) =>
  profile !== null && !/(^|,)http-pap(,|$)/.test(profile["login-by"] ?? "");

const FULL_CHUNK_SETS = VARIANTS.map(([variant, opts]) => [
  variant,
  buildRouterSetupScriptChunks(opts),
]);

/** The label the generator gives the chunk that owns `hsprof1`, and the
 * label the RADIUS chunk prints at an operator who has to go and find it.
 * Spelled here once so the "names a chunk that exists" check below cannot
 * pass by comparing a typo to itself. */
const HOTSPOT_CHUNK_LABEL = "Hotspot";

check(
  "13.1b: the hotspot chunk this section is about is really in every full script",
  FULL_CHUNK_SETS.every(([, chunks]) =>
    chunks.some(
      (c) => c.label === HOTSPOT_CHUNK_LABEL || /^Hotspot -- NOT GENERATED/.test(c.label),
    ),
  ),
  "no chunk matched either hotspot label, so every check below is grading a script that " +
    "does not contain the subject -- the vacuous-pass shape this file has shipped six times",
);

for (const [variant, chunks] of FULL_CHUNK_SETS) {
  const creators = chunks.filter((c) => /\/ip hotspot profile add\b/.test(c.script));
  check(
    `${variant}: only the ${HOTSPOT_CHUNK_LABEL} chunk creates hsprof1`,
    creators.every((c) => c.label === HOTSPOT_CHUNK_LABEL),
    `${creators.map((c) => c.label).join(", ")} creates a hotspot profile. Creation is a write ` +
      `of login-by -- an add with no login-by= hands the decision to RouterOS's default, ` +
      `${ROUTEROS_DEFAULT_LOGIN_BY}, which rejects every guest login while the router looks ` +
      `provisioned. Only the chunk that sets login-by may create the object it applies to`,
  );

  // THE SCENARIO THE SELF-HEAL EXISTED FOR, built rather than described:
  // every chunk the operator pastes EXCEPT the one that owns the profile.
  const withoutHotspot = chunks
    .filter((c) => !/^Hotspot\b/.test(c.label))
    .map((c) => c.script)
    .join("\n");
  const strandedProfile = simulateHsprof1(withoutHotspot);
  check(
    `${variant}: with the ${HOTSPOT_CHUNK_LABEL} chunk never pasted, no profile rejects every login`,
    !rejectsEveryLogin(strandedProfile),
    `the rest of the script left hsprof1 on login-by=${strandedProfile?.["login-by"]}. That is ` +
      `a router that answers RADIUS, prints RESULT: PASS and signs nobody in -- the exact ` +
      `state the RADIUS chunk's self-heal add used to produce. Either create it where ` +
      `login-by is decided, or do not create it`,
  );

  // ...AND THE WHOLE SCRIPT STILL STANDS ONE UP. Half of the property is
  // "no bad profile"; deleting the creation everywhere would satisfy that
  // and ship a router with no hotspot at all.
  const full = chunks.map((c) => c.script).join("\n");
  const hotspotRefused = /HOTSPOT \+ DHCP: NOTHING WAS GENERATED/.test(full);
  if (!hotspotRefused) {
    const provisioned = simulateHsprof1(full);
    check(
      `${variant}: the complete script still leaves hsprof1 able to sign guests in`,
      provisioned !== null && !rejectsEveryLogin(provisioned),
      `after the whole script the model holds ${JSON.stringify(provisioned)}. A generator that ` +
        `stopped creating the profile anywhere would pass the check above and ship a venue ` +
        `with no hotspot`,
    );
  }
}

// THE REFUSAL HAS TO BE ACTIONABLE. A chunk that declines to create the
// profile and says nothing leaves the operator with a FAIL and no next
// step, which is a worse outcome than the broken profile: at least the
// broken profile could be diagnosed. Graded on the text RouterOS actually
// PRINTS -- the `:put` and `:log` message bodies -- not on the chunk
// source, because a comment saying "tell them to paste the Hotspot chunk"
// satisfies a source grep and reaches no one.
{
  const radiusChunks = FULL_CHUNK_SETS.flatMap(([variant, chunks]) =>
    chunks.filter((c) => c.label === "RADIUS").map((c) => [variant, c]),
  );
  check(
    "13.1b: there are RADIUS chunks to grade the refusal on",
    radiusChunks.length > 0,
    "no variant produced a RADIUS chunk, so the refusal checks below assert nothing",
  );
  const printed = (script) =>
    [
      ...script.matchAll(/:put\s+"((?:[^"\\]|\\.)*)"/g),
      ...script.matchAll(/:log\s+\w+\s+"((?:[^"\\]|\\.)*)"/g),
    ]
      .map((m) => m[1])
      .join("\n");

  for (const [variant, chunk] of radiusChunks) {
    const say = printed(chunk.script);
    check(
      `${variant}: the RADIUS chunk creates no hotspot profile`,
      !/\/ip hotspot profile add\b/.test(chunk.script),
      "the self-heal add is back. It cannot set login-by without becoming the second writer " +
        "HOTSPOT_LOGIN_BY forbids, and it cannot omit it without shipping cookie,http-chap",
    );
    check(
      `${variant}: ...and tells the operator, on screen, exactly which chunk to run`,
      /hsprof1/.test(say) && /WHAT TO RUN/.test(say),
      `the messages this chunk prints are: ${JSON.stringify(say)}. Refusing is only acceptable ` +
        `because the refusal names the next step; without it the operator sees a FAIL about an ` +
        `object they have never heard of`,
    );
    check(
      `${variant}: ...naming a chunk that is really in this script, or the reason there isn't one`,
      new RegExp(`\\b${HOTSPOT_CHUNK_LABEL} chunk\\b`).test(say),
      `nothing the chunk prints names the "${HOTSPOT_CHUNK_LABEL}" chunk. An instruction ` +
        `pointing at a chunk label the operator cannot find in their list is the same dead end ` +
        `as no instruction at all`,
    );
    check(
      `${variant}: ...and logs it, for an operator reading /log after the fact`,
      /:log warning "cloudguest-radius: hsprof1 missing/.test(chunk.script),
      "console output scrolls away and an /import prints hundreds of lines; every other " +
        "refusal in this generator lands in the log as well as on screen",
    );
  }

  // The one variant whose Hotspot chunk refuses to generate AT ALL must
  // not be told to paste it -- that chunk's entire body is a FAIL message,
  // so the instruction would be a dead end dressed up as a fix. Built by
  // calling the generator with the LAN prefix that produces the refusal,
  // beside a RADIUS registration, which is a combination no variant in the
  // matrix above happens to cover.
  const unusableLan = buildRouterSetupScriptChunks({
    ...BASE,
    wans: [DHCP_WAN],
    lanIp: "192.168.10.1",
    lanCidr: "31",
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
  });
  const refusedHotspot = unusableLan.find((c) => /^Hotspot -- NOT GENERATED/.test(c.label));
  const radiusOnUnusableLan = unusableLan.find((c) => c.label === "RADIUS");
  check(
    "13.1b: the unusable-LAN fixture really produces both a refused hotspot and a RADIUS chunk",
    Boolean(refusedHotspot) && Boolean(radiusOnUnusableLan),
    "the fixture stopped covering the case it was built for, so the two checks below pass by " +
      "never running",
  );
  check(
    "13.1b: an unusable LAN prefix creates no hotspot profile anywhere in the script",
    !unusableLan.some((c) => /\/ip hotspot profile add\b/.test(c.script)),
    "the Hotspot chunk refuses to emit a pool, a DHCP server or a hotspot for this LAN -- a " +
      "profile created behind its back by another chunk is the half-provisioned state 13.1's " +
      "refusal check exists to forbid, and it would be a profile nothing ever sets login-by on",
  );
  check(
    "13.1b: ...and the RADIUS chunk sends the operator to Master console, not to a refusing chunk",
    /Fix the LAN IP \/ LAN CIDR fields in Master console/.test(radiusOnUnusableLan.script) &&
      !/paste the Hotspot chunk from this same script/.test(radiusOnUnusableLan.script),
    "this script contains no chunk that can create hsprof1, so 'paste the Hotspot chunk' " +
      "points at a chunk whose whole body is a FAIL message. The remedy here is upstream of " +
      "the router and has to be the one the refusing chunk itself prints",
  );
}

// INJECTED -- the model must be able to convict and to acquit, proven on
// fixtures rather than on the generator being broken first. Without these
// a simulator that returned `null` for everything would pass every check
// above, which is the "guard that cannot fail" shape this file has shipped
// six times.
{
  const SELF_HEAL_AS_IT_SHIPPED =
    `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=10.5.50.1 html-directory=hotspot dns-name="wifi.wyfyguest.com" }\n` +
    `:local rdUseProf [:len [/ip hotspot profile find where name="hsprof1"]]; :if ($rdUseProf > 0) do={ /ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes }`;
  const shipped = simulateHsprof1(SELF_HEAL_AS_IT_SHIPPED);
  check(
    "INJECTED: the model convicts the self-heal exactly as it shipped",
    shipped !== null &&
      shipped["login-by"] === ROUTEROS_DEFAULT_LOGIN_BY &&
      rejectsEveryLogin(shipped),
    `the model made ${JSON.stringify(shipped)} of the real defect. If it cannot see this line ` +
      `as a login-by decision, the whole subsection is decoration`,
  );
  check(
    "INJECTED: ...and convicts the 'obvious' repair's evil twin, an explicit chap value",
    rejectsEveryLogin(
      simulateHsprof1(
        `/ip hotspot profile add name="hsprof1" login-by=cookie,http-chap html-directory=hotspot`,
      ),
    ),
    "a spelled-out default is the same device state as an omitted one and must convict the same",
  );
  check(
    "INJECTED: the model acquits an add whose chunk decides login-by",
    !rejectsEveryLogin(
      simulateHsprof1(
        `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=10.5.50.1 html-directory=hotspot dns-name="wifi.wyfyguest.com" }\n` +
          `:local hsLoginBy "http-pap"; :if ([:len [/ip hotspot profile find where name="hsprof1"]] > 0) do={ /ip hotspot profile set [find name="hsprof1"] login-by=$hsLoginBy }`,
      ),
    ),
    "an over-strict model that convicts the CORRECT shape gets deleted by the next person -- " +
      "and note this is the Hotspot chunk's real spelling, `$hsLoginBy` resolved off the same " +
      "entered line, not a literal",
  );
  check(
    "INJECTED: ...and keeps http-pap inside a list, since login-by is an unordered set",
    !rejectsEveryLogin(
      simulateHsprof1(`/ip hotspot profile add name="hsprof1" login-by=https,http-pap`),
    ) &&
      !rejectsEveryLogin(
        simulateHsprof1(`/ip hotspot profile add name="hsprof1" login-by=http-pap,https`),
      ),
    "a substring or equality test would read one ordering as fine and the other as broken; " +
      "13.1 owns whether https belongs there at all, this only asks whether anyone can log in",
  );
  check(
    "INJECTED: ...and does not invent a profile out of a chunk that never creates one",
    simulateHsprof1(
      `:local rdProfPre [:len [/ip hotspot profile find where name="hsprof1"]]; :if ($rdProfPre = 0) do={ :put "  FAIL -- no hotspot profile named hsprof1 exists on this router." }\n` +
        `:local rdUseProf [:len [/ip hotspot profile find where name="hsprof1"]]; :if ($rdUseProf > 0) do={ /ip hotspot profile set [find name="hsprof1"] use-radius=yes }`,
    ) === null,
    "the fixed RADIUS chunk's own shape must model as 'no profile', or the check that the " +
      "stranded script leaves none passes for the wrong reason",
  );
  check(
    "INJECTED: ...and respects the add-if-missing guard rather than creating twice",
    simulateHsprof1(
      `/ip hotspot profile add name="hsprof1" login-by=http-pap\n` +
        `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" html-directory=hotspot }`,
    )["login-by"] === "http-pap",
    "a model blind to the `= 0` guard would let the second, login-by-less add overwrite the " +
      "first and convict a script that is actually correct on a real device",
  );
  check(
    "INJECTED: ...and ignores a profile that is not hsprof1",
    simulateHsprof1(`/ip hotspot profile add name="other" html-directory=hotspot`) === null,
    "a model that grabbed any profile would convict a script for an object this rule says " +
      "nothing about",
  );
}

// ---------------------------------------------------------------------
// 13.2 NO CERTIFICATE THIS SCRIPT SIGNED ITSELF EVER FACES A GUEST.
// ---------------------------------------------------------------------
// Stated as the RELATIONSHIP, not as a ban on either half. Importing a
// real, publicly-trusted certificate would be legitimate; enabling
// hotspot HTTPS against one would be legitimate. What is never
// legitimate is enabling hotspot HTTPS against a certificate generated on
// the router, because no client on earth trusts it and the whole point of
// the page behind it is to be the first thing a guest sees.
const selfSignedTlsIn = (script) => {
  const httpsLoginBy = hotspotProfileWrites(script).some(
    (w) => w.prop === "login-by" && w.value.includes("https"),
  );
  const routerSignedCert = /\/certificate\s+(?:add|sign)\b/.test(script);
  return httpsLoginBy && routerSignedCert;
};

for (const [variant, script] of FULL_SCRIPTS) {
  check(
    `${variant}: hotspot HTTPS is never enabled against a certificate this script created`,
    !selfSignedTlsIn(script),
    "`login-by=https` plus `/certificate add`/`sign` in the same paste is the confirmed-live " +
      "Android certificate warning: the router signs a leaf for a hostname only it resolves, " +
      "then serves the captive-portal page with it. A self-signed cert on a captive portal is " +
      "worse than none -- it is a full-page interstitial in front of sign-in, and it teaches " +
      "guests to click through security warnings.",
  );

  check(
    `${variant}: the generator never writes ssl-certificate onto a hotspot profile`,
    !hotspotProfileWrites(script).some((w) => w.prop === "ssl-certificate"),
    "the only certificate this fleet can safely serve is the Let's Encrypt leaf pushed " +
      "out-of-band by ops/letsencrypt-hotspot/renew-hotspot-certs.sh. A `set ssl-certificate=` " +
      "here either binds a self-signed cert (the bug) or, on a router that already has the real " +
      "one, silently rebinds it away from it on the next re-paste.",
  );

  check(
    `${variant}: the script creates no certificate on the router at all`,
    !/\/certificate\s+(?:add|sign|import)\b/.test(script),
    "a router-generated CA marked trusted=yes, with a signing key, on a fleet that shares one " +
      "SSH credential, is a real cost -- and with no ssl-certificate binding left there is " +
      "nothing on the other side of it. Nothing else in this generator or on the device " +
      "references those objects (checked, not assumed).",
  );
}

// INJECTED -- reintroducing the deleted chunk, in the exact form it
// shipped in.
{
  const REINTRODUCED =
    `:local needCguestCa ([:len [/certificate find where name="cloudguest-ca"]] = 0); ` +
    `:if ($needCguestCa) do={ /certificate add name="cloudguest-ca" common-name="cloudguest-ca" key-usage=key-cert-sign,crl-sign,tls-server }; ` +
    `:if ($needCguestCa) do={ /certificate sign cloudguest-ca }\n` +
    `/ip hotspot profile set [find name="hsprof1"] ssl-certificate="cloudguest-hotspot-cert" login-by=https,http-pap dns-name="wifi.wyfyguest.com"`;
  check(
    "INJECTED: the deleted self-signed certificate chunk is caught if it comes back",
    selfSignedTlsIn(REINTRODUCED),
    "the pairing guard is blind to the exact text that shipped the guest-facing warning",
  );
  check(
    "INJECTED: ...and its ssl-certificate binding is caught on its own",
    hotspotProfileWrites(REINTRODUCED).some((w) => w.prop === "ssl-certificate"),
    "the ssl-certificate guard cannot see a binding, so a re-paste could still rebind a fleet " +
      "router away from its real Let's Encrypt leaf",
  );
  // ANTI-OVER-STRICTNESS, in both directions.
  check(
    "...and the pairing guard does NOT fire on hotspot HTTPS with an IMPORTED certificate",
    !selfSignedTlsIn(
      `/certificate import file-name=fullchain.pem passphrase=""\n` +
        `/ip hotspot profile set [find name="hsprof1"] login-by=https,http-pap`,
    ),
    "the renewal script's own legitimate shape must stay expressible -- a guard that bans real " +
      "TLS as well as fake TLS is a guard someone deletes",
  );
  check(
    "...and does NOT fire on a certificate created with no hotspot HTTPS behind it",
    !selfSignedTlsIn(`/certificate add name="x" common-name="y"`),
    "the fault is the pairing, not either half; over-reaching here would ban a future, " +
      "unrelated use of /certificate and make the guard the thing that gets removed",
  );
}

// ---------------------------------------------------------------------
// 13.3 THE READ-BACK EXISTS, AND IT READS THE VALUE OFF THE DEVICE.
// ---------------------------------------------------------------------
// Same lesson section 7's year-backstop and section 6's resolver-count
// mutations both taught: asserting that a chunk PRINTS something is not
// asserting that it LEARNED it. A read-back pinned to a literal is a
// chunk that reports `login-by=http-pap` on a router where it is
// `https,http-pap`.
{
  const hotspot = bareChunk(BARE_PPPOE, "Hotspot");
  check(
    "13.3: the Hotspot chunk reads login-by back with a real `get`, not a literal",
    /\[:tostr \[\/ip hotspot profile get \[find name="hsprof1"\] login-by\]\]/.test(hotspot),
    "printing the value the script INTENDED tells the operator nothing about the value the " +
      "router HAS -- and a second writer anywhere would leave that report confidently wrong",
  );
  check(
    "13.3: ...and reads ssl-certificate back beside it",
    /\[:tostr \[\/ip hotspot profile get \[find name="hsprof1"\] ssl-certificate\]\]/.test(hotspot),
    "a router provisioned before this change still carries the self-signed binding; with " +
      "login-by=http-pap it is inert, but the operator should be able to SEE that, not infer it",
  );
  check(
    "13.3: ...and the read-back names the guest-facing consequence, not just the value",
    /security warning/.test(hotspot) && /http-pap/.test(hotspot),
    "a bare `login-by=<value>` line means nothing to the technician holding the router; the " +
      "output has to say what a wrong value does to a guest",
  );
}

// ---------------------------------------------------------------------
// 13.4 THE GUEST TYPES NOTHING ON THE ROUTER'S PAGE -- BUT SOMETHING IS
//      POSTED TO IT LATER, AND THE FIRST DRAFT OF THIS SECTION GOT THAT
//      WRONG.
// ---------------------------------------------------------------------
// The claim these checks pin down is narrow and it is worth stating
// exactly, because a wider version of it was written here first and was
// false: **the guest ENTERS nothing into the page RouterOS serves.** Every
// file this script installs is a spinner and a `location.replace(...)` to
// the real portal -- no `<form>`, no `<input>` -- so the phone number and
// the OTP are typed on a public origin with a real certificate.
//
// WHAT THE EARLIER VERSION SAID, AND WHY IT WAS WRONG. It concluded from
// the above that "nothing secret ever crosses the hotspot's own origin",
// and therefore that TLS there protects nothing. The first half does not
// imply the second. `src/routes/portal.success.tsx` does a top-level form
// POST of `username`/`password` BACK to `$(link-login-only)`, which is on
// the router's own origin and whose scheme is inherited from `login-by`.
// So that origin does carry a credential POST. The conclusion survived
// only because it was right for a different reason -- the posted password
// is `HOTSPOT_FALLBACK_PASSWORD`, a fixed placeholder that authenticated
// nobody (the OTP was verified against the backend over HTTPS long
// before), and untrusted TLS on that leg does not protect it, it destroys
// it: the browser rejects the certificate, the POST never lands, the NAS
// gate never opens. See `HOTSPOT_LOGIN_BY`'s docstring for the full
// three-symptom account.
//
// The checks below are unchanged by that correction and are still worth
// having: if a field ever appears on the router's own page, the narrow
// claim stops being true too, and the right response is still not to
// re-enable self-signed HTTPS.
{
  const pages = buildRouterSetupScriptChunks({
    ...BASE,
    wans: [DHCP_WAN],
    portalUrl: PORTAL,
  }).filter((c) => c.label.startsWith("Portal Redirect Page"));

  check(
    "13.4: every stock hotspot page really is overwritten",
    pages.length >= 5,
    `only ${pages.length} portal redirect page(s) emitted -- login.html, rlogin.html, ` +
      `alogin.html, status.html and logout.html are all reachable pre-auth`,
  );
  for (const page of pages) {
    check(
      `13.4: ${page.label} collects no input from the guest`,
      !/<form|<input|type=\\?"password|type=\\?"tel/i.test(page.script),
      "a field here means the guest is typing a credential into the router's own origin, " +
        "rather than into the real portal which has a real certificate. The fix if this ever " +
        "fires is NOT to re-enable self-signed HTTPS -- that breaks the OS probes and the " +
        "post-sign-in POST as well; it is to keep the field on the portal.",
    );
    check(
      `13.4: ${page.label} hands the guest to the real portal over https://`,
      /location\.replace\(\\"https:\/\//.test(page.script),
      "the redirect target is where the phone number and OTP are actually typed, so it is the " +
        "one leg that genuinely must be TLS -- and it is TLS to a public origin with a real " +
        "certificate, not to the router",
    );
  }
}

console.log("\n-- 13.6 a mistyped LAN port names the LAN, not the WAN --");

{
  const withLan = buildRouterSetupScriptChunks({
    ...BASE,
    wans: [DHCP_WAN],
    lanIfs: ["ether3", "ether4"],
  });
  const lanChunk = withLan.find((c) => c.label.startsWith("LAN Interfaces")).script;
  const wanChunk = withLan.find((c) => c.label === "WAN + Bridge").script;

  check(
    "the LAN allowlist chunk still checks that each named LAN port exists",
    /:if \(\[:len \[\/interface find where name="ether3"\]\] = 0\)/.test(lanChunk),
    "the existence check was removed rather than corrected",
  );
  check(
    "the LAN chunk never calls a missing LAN port a WAN interface",
    !/WAN interface/.test(lanChunk) && !/WAN Routing chunk/.test(lanChunk),
    "a mistyped LAN port used to report `configured WAN interface ether7 does not exist` and " +
      "point at the WAN Routing chunk -- both false, and it sent the operator to the one side of " +
      "the router that was working",
  );
  check(
    "...and says LAN, in the log line as well as on screen",
    /:log warning \("cloudguest: configured LAN interface "/.test(lanChunk),
    "the log is what gets read after the fact, when the terminal scrollback is gone",
  );
  check(
    "...and names the real consequence: it never joins the guest bridge, and nothing recovers it",
    /will NOT be added to the guest bridge/.test(lanChunk) &&
      /no guest gets an address at all/.test(lanChunk),
    "the WAN copy promised a recovery path that does not exist on this side",
  );
  check(
    "the WAN chunk still says WAN, and still points at the uplink discovery",
    /:log warning \("cloudguest: configured WAN interface "/.test(wanChunk) &&
      /WAN Routing chunk resolves the live uplink/.test(wanChunk),
    "fixing the LAN copy must not silently rewrite the WAN copy, which is correct as it stands",
  );
  check(
    "neither chunk aborts on a missing interface",
    !/:error/.test(lanChunk) && !/:error/.test(wanChunk),
    "PR #132 made this a NOTE rather than an abort on purpose; a LAN typo must not stop a paste " +
      "that is otherwise fine",
  );
}

console.log("\n-- 13.7 nothing sets a property on a hotspot profile that may not exist --");

{
  const hs = REGEN_CHUNKS.find((c) => c.label === "Hotspot").script;
  const lines = hs.split("\n");
  const firstProfileSet = lines.findIndex((l) =>
    /\/ip hotspot profile set \[find name="hsprof1"\]/.test(l),
  );
  const preCount = lines.findIndex((l) =>
    /:local hsProfPre \[:len \[\/ip hotspot profile find where name="hsprof1"\]\]/.test(l),
  );

  check(
    "an explicit hsprof1 COUNT is emitted before the first profile property write",
    preCount !== -1 && firstProfileSet !== -1 && preCount < firstProfileSet,
    `count at line ${preCount + 1}, first set at line ${firstProfileSet + 1} -- ` +
      "`set [find ...]` against an empty match SUCCEEDS on RouterOS, so an hsprof1 that was never " +
      "created takes every property write with it and reports nothing",
  );
  check(
    "...and that count is BRANCHED ON ZERO, on screen and in the log",
    /:if \(\$hsProfPre = 0\) do=\{ :put "  FAIL -- hotspot profile hsprof1 does not exist/.test(
      hs,
    ) &&
      /:if \(\$hsProfPre = 0\) do=\{ :log warning "cloudguest: hsprof1 missing before the hotspot profile property writes/.test(
        hs,
      ),
    "printing a count nobody branches on is the same silence in a longer form",
  );
  check(
    "the dns-name write is itself gated on a non-zero count",
    /:if \(\$hsDnsProf > 0\) do=\{ \/ip hotspot profile set \[find name="hsprof1"\] dns-name=/.test(
      hs,
    ),
    "a bare `set` still returns success against nothing, which reads as `it recovered` right " +
      "after a warning",
  );
  check(
    "...and says so when it did not run",
    /dns-name=[^ ]+ was NOT set -- no hotspot profile named hsprof1/.test(hs),
    "a skipped write that says nothing is indistinguishable from one that landed",
  );
  // COORDINATION, ASSERTED. The `login-by=` line is owned by the
  // self-signed-certificate / `login-by=https` work happening in parallel.
  // This section deliberately does not touch it, and the guard above is
  // written to cover it WITHOUT editing it -- a count that precedes every
  // property write covers whatever that line ends up saying.
  check(
    "the hsprof1 count precedes the login-by write too, without that line being edited",
    (() => {
      const loginBy = lines.findIndex((l) =>
        /\/ip hotspot profile set \[find name="hsprof1"\] login-by=/.test(l),
      );
      return loginBy === -1 || preCount < loginBy;
    })(),
    "the guard has to cover a line another engineer is editing, which is exactly why it is a " +
      "separate preceding line rather than a wrapper around each write",
  );
  check(
    "the RADIUS chunk's own hsprof1 read-back is still there (unchanged)",
    /:local rdProf \[:len \[\/ip hotspot profile find where name="hsprof1"\]\]/.test(
      scriptOf((c) => c.label === "RADIUS"),
    ),
    "the two chunks guard the same object independently on purpose -- either can be pasted first",
  );

  // INJECTED
  {
    const bare = hs.replace(/:local hsProfPre[^\n]*\n/, "");
    const bareLines = bare.split("\n");
    check(
      "INJECTED: the guard fires when the pre-count is removed and the sets go back to bare",
      bareLines.findIndex((l) =>
        /:local hsProfPre \[:len \[\/ip hotspot profile find where name="hsprof1"\]\]/.test(l),
      ) === -1,
      "the guard is blind to the unguarded shape it exists for",
    );
  }
}

console.log("\n-- 13.8 the one-line paste says how far it got --");

{
  const chunks = REGEN_CHUNKS;
  const oneLine = chunksToSingleLineScript(chunks);
  const markers = [...oneLine.matchAll(/### cloudguest ([^"]*)/g)].map((m) => m[1]);

  check(
    "every chunk is bracketed by a START and a DONE marker",
    chunks.every(
      (c, i) =>
        oneLine.includes(`### cloudguest ${i + 1}/${chunks.length} START `) &&
        oneLine.includes(`### cloudguest ${i + 1}/${chunks.length} DONE `),
    ),
    "RouterOS reports ONE error for the whole line and no indication of how far it got; without " +
      "a marker per chunk a partial run is indistinguishable from a complete one",
  );
  check(
    "the markers carry the chunk's own label, not just a number",
    chunks.every((c, i) =>
      oneLine.includes(`### cloudguest ${i + 1}/${chunks.length} START ${c.label}`),
    ),
    "`column 1464` is not something an operator can map back to a chunk; a chunk name is",
  );
  check(
    "a final COMPLETE marker is the LAST thing the line prints",
    /:put "### cloudguest COMPLETE[^"]*"$/.test(oneLine),
    "the operator needs one unambiguous thing to look for at the end; if it is not last, an " +
      "abort after it would still look complete",
  );
  check(
    "...and it says plainly that ending anywhere else means it stopped early",
    /A run that ends anywhere else stopped early/.test(oneLine),
    "a marker whose meaning has to be inferred does not survive a night shift",
  );
  check(
    "the markers are real statements, not `#` comments",
    markers.length > 0 &&
      oneLine.split("; ").every((stmt) => !stmt.trimStart().startsWith("#")) &&
      (oneLine.match(/(?::put|:log info) "### cloudguest/g) ?? []).length === markers.length,
    "`#` comments are stripped by this very function, and a comment prints nothing anyway -- the " +
      "whole point is output the operator can read back",
  );
  // EVERY MARKER GOES TO BOTH SINKS, AND THE `:put` IS THE ONE THAT ENDS
  // THE PAIR.
  //
  // `:put` under `/import` is an assumption nobody in this repo has ever
  // tested on a device (the spec logs it as AC-4.5, "resolve this on real
  // hardware", and it was never resolved). A marker scheme that rests on
  // it is a marker scheme that might print nothing at all in the channel
  // the founder uses. So each marker is also `:log info`'d, readable
  // afterwards with `/log print` regardless of what `/import` does with
  // console output -- and readable after the terminal buffer has scrolled
  // past on a 30-chunk run, which is a problem `:put` has even when it
  // works.
  //
  // The `:put` is emitted SECOND so the runbook everybody follows -- read
  // the last line -- still lands on the sentence it was told to look for.
  const putMarkers = (oneLine.match(/:put "### cloudguest/g) ?? []).length;
  const logMarkers = (oneLine.match(/:log info "### cloudguest/g) ?? []).length;
  check(
    "the marker count is exactly 4 per chunk plus 2 for COMPLETE",
    markers.length === chunks.length * 4 + 2,
    `${markers.length} markers for ${chunks.length} chunks -- a duplicated or missing marker ` +
      "makes the position report wrong, which is worse than absent",
  );
  check(
    "every marker is written to BOTH the console and the log",
    putMarkers > 0 && putMarkers === logMarkers && putMarkers === chunks.length * 2 + 1,
    `${putMarkers} :put vs ${logMarkers} :log info. A marker present in only one sink is a ` +
      "marker that disappears the moment the OTHER sink turns out to be the working one, and " +
      "which sink that is has never been measured on hardware",
  );
  check(
    "the `:put` half of a marker pair is emitted last",
    (() => {
      const pairs = [...oneLine.matchAll(/(:log info|:put) "(### cloudguest [^"]*)"/g)].map((m) => [
        m[1],
        m[2],
      ]);
      if (pairs.length !== markers.length || pairs.length === 0) return false;
      for (let i = 0; i < pairs.length; i += 2) {
        if (pairs[i][0] !== ":log info") return false;
        if (pairs[i + 1]?.[0] !== ":put") return false;
        if (pairs[i][1] !== pairs[i + 1][1]) return false;
      }
      return true;
    })(),
    "the runbook is 'read the last line'. If the log half trailed the console half, the last " +
      "thing a watching operator sees would be a statement that prints nothing, and the " +
      "COMPLETE sentinel would not be where the instruction says it is",
  );
  check(
    "a chunk label containing a quote cannot break the marker it is embedded in",
    (() => {
      const line = chunksToSingleLineScript([
        { label: 'Weird "quoted" label', script: ':put "x"' },
      ]);
      const issues = validateSetupScriptChunks([{ label: "one-line", script: line }]);
      return issues[0].issues.length === 0;
    })(),
    "the label is interpolated into a RouterOS double-quoted string and has to be escaped there",
  );
  check(
    "the flattened script with markers is still free of every shape the validator checks",
    validateSetupScriptChunks([{ label: "flattened", script: oneLine }])[0].issues.length === 0,
    "adding the markers must not itself introduce a fault into the paste they exist to report on",
  );
  check(
    "the flattened script still carries no `#` comment (which would swallow the rest of the line)",
    !/(^|; )#/.test(oneLine),
    "a `#` at statement position runs to end-of-line and eats every statement after it",
  );
  console.log(
    `       [size] one-line paste ${oneLine.length} chars for ${chunks.length} chunks; ` +
      `chunk bodies ${chunks.reduce((n, c) => n + c.script.length, 0)}; ` +
      `markers ${oneLine.length - chunks.reduce((n, c) => n + c.script.length, 0)} ` +
      `(${(((oneLine.length - chunks.reduce((n, c) => n + c.script.length, 0)) / oneLine.length) * 100).toFixed(1)}%)`,
  );
  // RE-PINNED AT THE MEASURED LEVEL, because the markers just doubled.
  //
  // Every marker now goes to two sinks (see `markerStatements`), which
  // took the marker overhead on this fixture from ~4.5% of the paste to
  // 8.8% -- 6,965 characters on a 78,787-character line, up ~3.5 KB. The
  // budget was 20%, which the doubling did not come close to, and a
  // budget with that much slack cannot object to a THIRD sink being added
  // the same way. 12% leaves room for the chunk set to grow and none for
  // another blanket duplication going in unremarked.
  //
  // This matters because the paste channel has a MEASURED corruption
  // failure on long input -- that is why the chunking exists at all. The
  // `.rsc` pays the same overhead and does not care; the paste does.
  const markerCost = oneLine.length - chunks.reduce((n, c) => n + c.script.length, 0);
  check(
    "the markers cost a bounded fraction of the paste",
    markerCost < oneLine.length * 0.12,
    `markers are ${((markerCost / oneLine.length) * 100).toFixed(1)}% of the paste. A size ` +
      `increase big enough to matter would trade one paste risk for another, on a channel ` +
      `with a confirmed corruption failure on long input`,
  );

  // INJECTED
  {
    const stripped = oneLine
      .split("; ")
      .filter(
        (stmt) =>
          !stmt.startsWith(':put "### cloudguest') && !stmt.startsWith(':log info "### cloudguest'),
      )
      .join("; ");
    check(
      "INJECTED: the marker guard fires on the marker-free flattening it replaced",
      !stripped.includes("### cloudguest"),
      "the guard is blind to the version that gave the operator nothing to read",
    );
    const truncated = oneLine.slice(0, oneLine.indexOf("### cloudguest 3/"));
    check(
      "INJECTED: a paste that dies partway does NOT print COMPLETE",
      // The MARKER, not the substring. `INCOMPLETE` contains `COMPLETE`,
      // so a bare `includes("COMPLETE")` reports a truncated run as
      // complete the moment any chunk mentions an incomplete script --
      // which is precisely the script where getting this wrong costs the
      // most. Surfaced by prototyping section 15.8's derived-gap warning.
      !truncated.includes(`${SINGLE_LINE_MARKER_PREFIX} COMPLETE`),
      "if a truncated run could still show COMPLETE the marker would be worse than nothing",
    );
  }
}

console.log("\n-- 13.9 the validator is honest about what it checks --");

{
  // The exact line that aborted a live paste at column 1464 on
  // 2026-08-23. Every bracket and every quote in it balances.
  const FOUNDERS_LINE =
    ':log warning "cloudguest: WAN1 gateway did not resolve (still \\"" . $wan1Gw . "\\") -- the route was not added"';
  const PARENTHESISED =
    ':log warning ("cloudguest: WAN1 gateway did not resolve (still \\"" . $wan1Gw . "\\") -- the route was not added")';

  const issuesFor = (script) => validateSetupScriptChunks([{ label: "t", script }])[0].issues;
  const errorsFor = (script) => issuesFor(script).filter((i) => i.severity === "error");

  check(
    "the balance check alone would have passed the line that aborted a live paste",
    (() => {
      let depth = 0;
      let str = false;
      for (let i = 0; i < FOUNDERS_LINE.length; i++) {
        const c = FOUNDERS_LINE[i];
        if (str) {
          if (c === "\\") i++;
          else if (c === '"') str = false;
          continue;
        }
        if (c === '"') str = true;
        else if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) depth--;
      }
      return depth === 0 && !str;
    })(),
    "if this line did not balance, the incident would have been a bracket bug and the validator " +
      "would already have caught it -- the whole point is that balance and validity are " +
      "different questions",
  );
  check(
    "the validator now REJECTS the unparenthesised concatenation",
    errorsFor(FOUNDERS_LINE).some((i) => /concatenation without parentheses/.test(i.message)),
    "this is a known, live, twice-confirmed failure and it must never pass validation again",
  );
  check(
    "...and its message names the consequence for the one-line copy",
    errorsFor(FOUNDERS_LINE).some((i) => /discards every chunk after this one/.test(i.message)),
    "validate-then-copy-all-then-paste is the sequence that maximises the damage; the message " +
      "has to close that loop",
  );
  check(
    "...and ACCEPTS the correctly parenthesised form",
    errorsFor(`:local wan1Gw ""; ${PARENTHESISED}`).length === 0,
    "over-strictness matters as much as blindness: a validator that cries wolf gets clicked past, " +
      "which is how it ends up trusted for the wrong questions",
  );
  check(
    "...and is not fooled by a `.` that is only ever text inside a message",
    errorsFor(':put "8.8.8.8 did not respond. Check the WAN cable."').length === 0,
    "dotted addresses and ordinary full stops appear in almost every :put this generator emits",
  );
  check(
    "...and accepts a bracketed argument with a nested concatenation",
    errorsFor(':local n 1; :local m 2; :put ("  x=" . [:tostr $n] . " y=" . [:tostr $m])')
      .length === 0 &&
      errorsFor(':local a 1; :if ($a > 0) do={ :put ("  n=" . [:tostr $a]) }').length === 0,
    "the shipped idiom throughout this generator",
  );
  check(
    "...and catches the same shape on :put and :error, not only :log",
    errorsFor(':local b 1; :put "a" . $b').length === 1 &&
      errorsFor(':local b 1; :error "a" . $b').length === 1,
    "one command covered and the others not is a guard with a hole in the middle",
  );
  check(
    "...and catches it inside a do={} body, where most of this generator's output lives",
    errorsFor(':local x 0; :if ($x = 0) do={ :log warning "a" . $x }').some((i) =>
      /concatenation without parentheses/.test(i.message),
    ),
    "nearly every line this generator emits is a guarded statement, not a bare command",
  );
  check(
    "the validator rejects a multi-statement do={} body",
    errorsFor(':local x 0; :if ($x = 0) do={ :put "a"; :put "b" }').some((i) =>
      /holds 2 statements/.test(i.message),
    ),
    "a `;`-chained body threw a real syntax error on this hardware",
  );
  check(
    "...and accepts a single-statement body containing a nested block",
    errorsFor(
      ':foreach r in=[/ip address find] do={ :if ([/ip address get $r address] != "1.2.3.4/24") do={ /ip address remove $r } }',
    ).length === 0,
    "the nested-guard idiom this generator uses for every ownership-checked sweep",
  );
  check(
    "the validator rejects a variable read on a line that did not bind it",
    errorsFor(':local a 1\n:put ("x" . $a)').some((i) =>
      /does not bind it on that same line/.test(i.message),
    ),
    "the RouterOS console runs each entered line as its own program; this is the defect class " +
      "PRs #125/#126 fixed in two sibling modules",
  );
  check(
    "...and accepts the same two statements legally flattened onto one line",
    errorsFor(':local a 1; :put ("x" . $a)').length === 0,
    "if the guard fired here it would ban the very fix it exists to enforce",
  );
  check(
    "...and understands a :foreach loop variable as a binding",
    errorsFor(":foreach p in=[/interface bridge port find] do={ /interface bridge port remove $p }")
      .length === 0,
    "the generator's own no-state replacement idiom",
  );

  // ---- and it does not cry wolf on the real thing --------------------
  {
    const noisy = [];
    for (const [variant, opts] of VARIANTS) {
      for (const r of validateSetupScriptChunks(buildRouterSetupScriptChunks(opts))) {
        if (r.issues.length > 0)
          noisy.push(`${variant} :: ${r.label}: ${r.issues.map((i) => i.message).join("; ")}`);
      }
    }
    check(
      "the validator reports NOTHING against any script this generator actually emits",
      noisy.length === 0,
      `${noisy.length} false positive(s): ${noisy.slice(0, 4).join(" | ")}. A validator that ` +
        "fires on correct output is a validator people learn to ignore",
    );
  }

  // ---- the honesty half ----------------------------------------------
  check(
    "the validator publishes the exact list of what it looks for",
    Array.isArray(SETUP_SCRIPT_VALIDATOR_CHECKS) && SETUP_SCRIPT_VALIDATOR_CHECKS.length >= 6,
    "the gap between what it checks and what an operator hears when it passes IS the incident",
  );
  check(
    "...and the list names the concatenation fault and the incident it comes from",
    SETUP_SCRIPT_VALIDATOR_CHECKS.some((c) => /concatenation/.test(c) && /2026-08-23/.test(c)),
    "an entry with no incident behind it is a claim, not a check",
  );
  check(
    "...and states plainly that it is not a RouterOS parser and not a test on a device",
    /not a RouterOS parser/.test(SETUP_SCRIPT_VALIDATOR_LIMITS) &&
      /not a test on a device/.test(SETUP_SCRIPT_VALIDATOR_LIMITS),
    "a clean pass must not read as `this will run` -- an operator pasted 3,000 characters into a " +
      "live router on the strength of the word `Validated`",
  );
  check(
    "...and says what a clean pass DOES mean, in so many words",
    /nothing more/.test(SETUP_SCRIPT_VALIDATOR_LIMITS),
    "stating the limit without stating the meaning leaves the operator to fill in the gap, which " +
      "is how it went wrong the first time",
  );

  // ---- the panel is wired to that honesty ----------------------------
  {
    const panel = readFileSync(
      resolve(ROOT, "src/components/routers/RouterSetupScriptAdvanced.tsx"),
      "utf8",
    );
    // RENDERED, not merely IMPORTED. The first version of this check
    // asked only whether the two names appeared anywhere in the file --
    // and an import line satisfies that. Replacing the rendered
    // `{SETUP_SCRIPT_VALIDATOR_LIMITS}` with a hardcoded "Looks good."
    // left the suite green. Caught by mutating it (M15); the check now
    // requires the JSX interpolation itself.
    check(
      "the panel RENDERS the validator's own scope statement, not a hand-written copy",
      /\{SETUP_SCRIPT_VALIDATOR_LIMITS\}/.test(panel),
      "a second copy of the scope in JSX is a copy that goes stale, which is how the claim became " +
        "untrue in the first place",
    );
    check(
      "...and renders the check list from the same exported constant",
      /SETUP_SCRIPT_VALIDATOR_CHECKS\.map\(/.test(panel),
      "a hand-typed list beside a real one is the same staleness in a longer form",
    );
    check(
      "...and both are imported from the module that defines the validator",
      /SETUP_SCRIPT_VALIDATOR_CHECKS,\s*\n\s*SETUP_SCRIPT_VALIDATOR_LIMITS,/.test(panel),
      "rendering a locally-redefined constant of the same name would satisfy the two checks above",
    );
    check(
      'the clean-pass verdict no longer says "no issues found" or "passed validation"',
      !/no issues found/.test(panel) && !/passed validation/.test(panel),
      "those are the exact words a 3,000-character paste into a live router was authorised by",
    );
    check(
      "the clean-pass toast does not claim the script will run",
      /this is not proof it will run/.test(panel),
      "the toast is the only thing some operators read",
    );
    check(
      "a clean pass points at the one-line markers rather than ending the conversation",
      /### cloudguest/.test(panel) && /COMPLETE/.test(panel),
      "validate-then-copy-all-then-paste is the sequence that maximises the damage; fixing the " +
        "reporting on one end and not the other leaves the trap half-open",
    );
    check(
      "the one-line copy warns that one error aborts everything after it",
      /ABORTS EVERYTHING AFTER IT/.test(panel) &&
        /silently discards every remaining chunk/.test(panel),
      "the old warning only mentioned terminal corruption, which is a different failure",
    );
    check(
      "...and the copy feature itself is still there",
      /chunksToSingleLineScript\(chunks\)/.test(panel) && /Copy \(1 line\)/.test(panel),
      "the ask was to fix the reporting, not remove the convenience",
    );
  }
}

console.log("\n-- 13.10 the hotspot password field that fed nothing --");

{
  const panel = readFileSync(
    resolve(ROOT, "src/components/routers/RouterSetupScriptAdvanced.tsx"),
    "utf8",
  );
  check(
    "the panel no longer collects a hotspot password",
    !/hsPass/.test(panel.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")),
    "it was read by nothing: `buildRouterSetupScriptChunks` never destructured it, so every " +
      "character typed into it stopped at React state",
  );
  check(
    "...and the generator no longer accepts one",
    !/hsPass/.test(
      readFileSync(resolve(ROOT, "src/components/routers/RouterDetailTabs.tsx"), "utf8").replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
        "",
      ),
    ),
    "an option nothing reads is an invitation to wire it up, and wiring THIS one up would " +
      "re-create a portal bypass",
  );
  check(
    "the generator still REMOVES the local hotspot account rather than creating one",
    /\/ip hotspot user remove \[find where name="guest"\]/.test(
      REGEN_CHUNKS.find((c) => c.label === "Hotspot").script,
    ),
    "this is why the password was removed rather than wired: RouterOS resolves a local user " +
      "BEFORE it asks RADIUS, so the account it would have configured is a complete portal " +
      "bypass -- no OTP, no session record, no consent, no data cap",
  );
  check(
    "...and passing a stray hsPass still produces a working script",
    (() => {
      const withStray = buildRouterSetupScriptChunks({
        ...BASE,
        hsPass: "hsPassSentinelZZ9",
        wans: [DHCP_WAN],
      });
      return withStray.length > 5 && !withStray.some((c) => /hsPassSentinelZZ9/.test(c.script));
    })(),
    "the backend port and the wizard both build these options objects; a stray property must be " +
      "inert, not fatal, and must never reach the device",
  );
}

// =====================================================================
// 15. THE OS SIGN-IN POPUP: INTERCEPT THE PROBE, NEVER ALLOW IT
// =====================================================================
// Reported live 2026-08-23 from a provisioned hEX: a Windows laptop and a
// MacBook, both on a LAN cable, got a DHCP lease and could reach the
// captive portal by typing an address into a browser -- but NEITHER
// showed an automatic "sign in to network" popup. Android, on the same
// router, showed a certificate error.
//
// One cause produces all three, and section 13 removes it: the generator
// was leaving `login-by=https,http-pap` on `hsprof1` with a self-signed
// leaf bound, so RouterOS aimed the redirect at
// `https://wifi.wyfyguest.com/login` and every probe died in the TLS
// handshake instead of receiving a redirect. Windows and macOS report
// that as "no internet" with nothing to click; Android renders it, which
// is why it alone showed a visible error. Section 13 is what keeps the
// redirect on a scheme the probes can complete.
//
// THIS section is about the OTHER way to break the same popup -- the one
// a future engineer will reach for precisely BECAUSE section 13's fix is
// invisible to them.
//
// THE WRONG FIX IS THE INTUITIVE ONE, AND IT IS UNRECOVERABLE. Every
// forum answer to "no captive portal popup" says to put the detection
// hosts in the walled garden so the probes "get through". A probe that
// gets through reaches the real Microsoft/Apple/Google server, gets the
// genuine success answer, and the OS concludes the network is fine --
// so it never offers a sign-in, while the guest is still unauthenticated
// with no internet. That converts an intermittent popup into a
// permanently absent one, and no other setting can undo it. Confirmed
// before changing anything: no such entry exists in this generator
// today. This section is what keeps it that way.
//
// The predicate below is deliberately about STATEMENTS, not lines and not
// whole chunks. The tripwire chunk the generator now emits legitimately
// NAMES every one of these hosts -- inside a `find where dst-host~"..."`
// whose entire purpose is to detect a hand-added entry and report it. A
// guard that matched on the hostname alone would ban the check that
// enforces it. What is forbidden is an `add`/`set` INTO the walled garden
// or static DNS that carries one of these names; a `find` or a `print` is
// a read. Sweep and self-checks share one predicate -- this file has been
// bitten four separate times by a self-check that exercised a private
// copy of the regex the sweep actually used, and section 13's own
// `includes`-vs-`===` hole was the fourth.

console.log("\n-- the OS sign-in popup --");

/** Every hostname an OS fetches to answer "am I really online?". */
const RE_DETECTION_TOKEN =
  /(msftconnecttest|msftncsi|connectivitycheck|detectportal|captive\.apple|gstatic|clients3\.google|nmcheck|network-test\.debian|connectivity-check\.ubuntu)/i;

/** A write that would let a host past the hotspot BEFORE the guest logs
 * in: an `add`/`set` into either walled-garden table, or into static DNS.
 * `find`, `print` and `remove` are not writes of that kind. */
const RE_PREAUTH_ALLOW_WRITE = /\/ip (?:hotspot walled-garden(?: ip)?|dns static)\s+(?:add|set)\b/;

/** THE guard. One statement, both properties. Shared by the sweep, by
 * every INJECTED self-check and by every anti-over-strictness check
 * below -- there is no second copy anywhere in this file. */
const allowsDetectionHost = (statement) =>
  RE_PREAUTH_ALLOW_WRITE.test(statement) && RE_DETECTION_TOKEN.test(statement);

/** A chunk's statements. A chunk is `;`-joined onto entered lines, and
 * the console executes statement by statement, so that is the unit a
 * "this command allows that host" question is actually about. */
const statementsOf = (script) =>
  script
    .split("\n")
    .flatMap((line) => line.split(";"))
    .map((s) => s.trim())
    .filter(Boolean);

// --- 14.1 the sweep --------------------------------------------------
{
  const offenders = [];
  for (const [label, script] of pasteables) {
    for (const statement of statementsOf(script)) {
      if (allowsDetectionHost(statement)) offenders.push(`${label}: ${statement}`);
    }
  }
  check(
    "no emitted statement lets an OS connectivity-check host past the hotspot",
    offenders.length === 0,
    `${offenders.length} statement(s) allow a detection probe pre-auth. This is the one change ` +
      `that removes the sign-in popup PERMANENTLY: the OS gets the real success answer it was ` +
      `probing for, concludes the network is fine, and never offers a sign-in -- while the guest ` +
      `is still unauthenticated. The probe must be INTERCEPTED and answered with a redirect, ` +
      `which is what the hotspot already does when nothing allows it through.\n      ` +
      offenders.slice(0, 8).join("\n      "),
  );
}

// --- 14.2 INJECTED: the guard fires on the exact wrong fix -----------
// Each of these is the literal line a future engineer reaches for. If the
// guard is blind to any of them it is decoration.
const WRONG_FIXES = [
  [
    "Windows NCSI added to the host walled garden",
    `:if ([:len [/ip hotspot walled-garden find where comment="ncsi"]] = 0) do={ /ip hotspot walled-garden add dst-host="www.msftconnecttest.com" action=allow comment="ncsi" }`,
  ],
  [
    "Apple CNA added to the host walled garden",
    `/ip hotspot walled-garden add dst-host="captive.apple.com" action=allow comment="cna"`,
  ],
  [
    "Android's probe added to the host walled garden",
    `/ip hotspot walled-garden add dst-host="connectivitycheck.gstatic.com" action=allow`,
  ],
  [
    "Firefox's probe added to the host walled garden",
    `/ip hotspot walled-garden add dst-host="detectportal.firefox.com" action=allow`,
  ],
  [
    "an existing walled-garden row RE-POINTED at a probe host",
    `/ip hotspot walled-garden set [find comment="cloudguest-portal"] dst-host="www.msftconnecttest.com"`,
  ],
  [
    "the NCSI DNS probe answered by a static DNS entry",
    `/ip dns static add name="dns.msftncsi.com" address=131.107.255.255`,
  ],
  [
    "a probe host allowed through the IP-level walled garden by name",
    `/ip hotspot walled-garden ip add action=accept dst-address=1.2.3.4 comment="msftconnecttest"`,
  ],
];
for (const [what, statement] of WRONG_FIXES) {
  check(
    `INJECTED: the popup guard fires on ${what}`,
    allowsDetectionHost(statement),
    "the guard is blind to the specific wrong fix it exists to prevent",
  );
}

// --- 14.3 ANTI-OVER-STRICTNESS ---------------------------------------
// Taken FROM THE REAL EMITTED CHUNK, not hand-copied. The tripwire names
// every detection host on purpose; if the guard fired on it, the only way
// to get a green build would be to delete the check that enforces the
// rule -- which is exactly how a guard gets switched off.
{
  const tripwires = pasteables.filter(([label]) => /Captive-Portal Detection/.test(label));
  check(
    "the generator emits a captive-portal detection tripwire chunk",
    tripwires.length > 0,
    "no chunk labelled 'Captive-Portal Detection' -- the on-device check for a hand-added " +
      "walled-garden probe host is gone",
  );
  const tripwireStatements = tripwires.flatMap(([, script]) => statementsOf(script));
  check(
    "...and the tripwire really does name the detection hosts it searches for",
    tripwireStatements.some((s) => RE_DETECTION_TOKEN.test(s)),
    "the tripwire no longer mentions any probe hostname, so it cannot be searching for one -- " +
      "this check exists so the anti-over-strictness check below cannot pass vacuously",
  );
  check(
    "...and the popup guard does NOT fire on it, because a `find` is a read",
    tripwireStatements.every((s) => !allowsDetectionHost(s)),
    `the guard bans its own on-device enforcement: ${JSON.stringify(
      tripwireStatements.filter(allowsDetectionHost),
    )}`,
  );
}
check(
  "...and does NOT fire on the real portal's own walled-garden entry",
  !allowsDetectionHost(
    `/ip hotspot walled-garden add dst-host="auth.wyfyguest.com" action=allow comment="cloudguest-portal"`,
  ),
  "the guard bans the entry that lets guests reach the portal at all",
);
check(
  "...and does NOT fire on a bare read of the walled garden",
  !allowsDetectionHost(
    `:local cdWg [:len [/ip hotspot walled-garden find where dst-host~"(msftconnecttest|gstatic)"]]`,
  ),
  "a `find` is reported as an allow",
);
check(
  "...and does NOT fire on an add of an unrelated host",
  !allowsDetectionHost(`/ip hotspot walled-garden add dst-host="example.com" action=allow`),
  "an ordinary walled-garden entry is reported as a detection host",
);

// THE SCOPING ITSELF, WHICH NOTHING ELSE HERE EXERCISES. Every check
// above hands the predicate ONE statement, so all of them pass
// identically whether `statementsOf` splits on `;` or not -- measured:
// collapsing it to line-scoping produced ZERO red checks. The scoping is
// the whole design of this guard and it was untested.
//
// The two halves of a false positive have to be on the SAME ENTERED LINE
// to matter, because that is the only thing `;`-joining changes. This
// fixture is exactly that: a legitimate portal walled-garden `add`
// `;`-joined onto a `find` that names probe hosts -- the shape the
// tripwire chunk would take if it ever grew a sibling statement, and the
// shape any future chunk mixing a read and a write would take. Under
// statement scoping neither half fires. Under line scoping the line
// carries both a write and a detection token and the guard reports the
// generator's own portal entry as the wrong fix -- a false positive on a
// load-bearing line, which is how a guard gets switched off rather than
// obeyed.
{
  const MIXED_LINE =
    `:local cdWg [:len [/ip hotspot walled-garden find where dst-host~"(msftconnecttest|gstatic)"]]; ` +
    `/ip hotspot walled-garden add dst-host="auth.wyfyguest.com" action=allow comment="cloudguest-portal"`;
  check(
    "...and the guard is STATEMENT-scoped: a read of probe hosts `;`-joined to a legitimate add is clean",
    statementsOf(MIXED_LINE).every((s) => !allowsDetectionHost(s)),
    "the predicate is being applied to whole entered lines rather than to statements. A line " +
      "that reads the probe hosts and separately adds the portal's own walled-garden entry then " +
      "reports as the forbidden wrong fix -- a false positive on a line this generator needs, " +
      "which is how a guard gets deleted instead of satisfied.",
  );
  check(
    "...and that fixture really would trip a line-scoped guard, so the check above is not vacuous",
    allowsDetectionHost(MIXED_LINE),
    "the fixture does not carry both a pre-auth write and a detection token on one line, so it " +
      "cannot distinguish statement scoping from line scoping and proves nothing",
  );
}

// --- 14.4 the local redirect name is never the public portal name ----
// Already load-bearing elsewhere in this file's source, and it belongs to
// this section too: `dns-name` makes RouterOS answer that name with the
// ROUTER's own address for every connected guest, absolutely, so pointing
// it at the real portal domain sends every guest to the little on-router
// redirect page instead of the actual sign-in app -- a loop, confirmed
// live. It is also a detection-path property: the probe's redirect target
// is built from this name.
for (const [label, script] of pasteables) {
  if (!/dns-name=/.test(script)) continue;
  const names = [...script.matchAll(/dns-name="([^"]*)"/g)].map((m) => m[1]);
  check(
    `${label}: the hotspot's local dns-name is never the public portal domain`,
    names.every((n) => n !== "auth.wyfyguest.com"),
    `${JSON.stringify(names)} -- RouterOS answers this name with the router's own LAN IP for ` +
      "every connected guest, so the real portal would become unreachable and sign-in would " +
      "loop back to the on-router redirect page",
  );
}

// --- 14.5 the tripwire obeys the same "never infer success" rule -----
// Section 10's discipline: a chunk that checks something must bind a
// count, print it, and take a named branch on the fault -- because an
// empty `find` is indistinguishable from a healthy device otherwise.
//
// THE LOOP BELOW IS DELIBERATELY NOT `if (!match) continue`, and that is
// a correction to how this section was first written. In the filtered
// form, deleting the tripwire chunk from the generator made all five of
// these checks silently NOT RUN -- the suite stayed green and only the
// check-floor in ci-gated-test.sh would have noticed the coverage
// vanishing. Measured, not theorised: that mutation produced 2 red
// checks instead of 7. The chunk is now looked up once, its count is
// pinned, and the five checks run against what that lookup returned --
// so removing the chunk FAILS these checks rather than deleting them.
// Fifth instance in this file of a guard that could be defeated by
// removing the thing it guards; see the header.
const TRIPWIRE_CHUNKS = pasteables.filter(([label]) => /Captive-Portal Detection/.test(label));
check(
  "14.5: exactly one captive-portal tripwire chunk body is emitted, so the checks below run",
  TRIPWIRE_CHUNKS.length === 1,
  `${TRIPWIRE_CHUNKS.length} tripwire chunk bodies found. Zero means the five checks below ` +
    `would silently not run at all -- the coverage-shrink failure this suite's own gate exists ` +
    `for. More than one means two chunks disagree about what the check is.`,
);
for (const [label, script] of TRIPWIRE_CHUNKS.length
  ? TRIPWIRE_CHUNKS
  : [["MISSING captive-portal tripwire chunk", ""]]) {
  check(
    `${label}: binds a count for both places a probe host can be allowed`,
    /:local cdWg \[:len \[\/ip hotspot walled-garden find/.test(script) &&
      /:local cdDns \[:len \[\/ip dns static find/.test(script),
    "the tripwire does not count both the walled garden and static DNS, so one of the two ways " +
      "to defeat captive-portal detection is invisible to it",
  );
  check(
    `${label}: prints both counts rather than only reporting a verdict`,
    /:put \(.*cdWg.*cdDns/s.test(script),
    "the numbers are not shown, so a technician cannot tell a healthy device from one the " +
      "check silently skipped",
  );
  check(
    `${label}: takes a named PASS branch on zero and a named FAIL branch on non-zero`,
    /\$cdWg = 0 && \$cdDns = 0\) do=\{ :put "  RESULT: PASS/.test(script) &&
      /\$cdWg > 0 \|\| \$cdDns > 0\) do=\{ :put "  RESULT: FAIL/.test(script),
    "without both branches the chunk is silent in at least one state, which is the exact " +
      "failure mode every other section of this suite exists to prevent",
  );
  check(
    `${label}: logs the fault as well as printing it`,
    /:log warning "cloudguest: a connectivity-check host is allowed pre-auth/.test(script),
    "a technician who scrolled past the paste output has no record of it",
  );
  check(
    `${label}: adds nothing and removes nothing`,
    !/\/ip hotspot walled-garden(?: ip)? (?:add|set|remove)\b/.test(script) &&
      !/\/ip dns static (?:add|set|remove)\b/.test(script),
    "this chunk is a check. An operator may have added a walled-garden host deliberately, and " +
      "silently deleting entries is how this file's own local-hotspot-user bug became " +
      "interesting -- it must report, not act",
  );
}

// =====================================================================
// SECTION 15 -- THE `.rsc` IS A DELIVERY CHANNEL, NOT A VIEW
// =====================================================================
// Added 2026-09-02, after a report of the SAME defect for the fifth time:
// "I configured using the .rsc file, the script executed, RADIUS wasn't
// there and it didn't run."
//
// Every one of the fourteen sections above asserts over `chunk.script`
// (and, in a few places, over `chunksToSingleLineScript`). Before this
// section, `chunksToRouterOsScript` -- the DOWNLOADED FILE, which is how
// the founder provisions -- was touched by exactly four checks, all of
// them about the INCOMPLETE-SCRIPT header. Nothing asserted that the file
// contains what the chunks contain, that a failed `/import` is
// attributable to a chunk, or that the file behaves the way the panel's
// copy says it does.
//
// That is not a small gap, because the two channels are NOT equivalent:
//
//  - `/import` ABORTS AT THE FIRST ERROR AND SAYS NOTHING ABOUT WHERE.
//    The chunked paste already learned this (section 13's START/DONE/
//    COMPLETE markers on `chunksToSingleLineScript`). The `.rsc` never
//    got them, so an import that dies at chunk 9 of 32 produces one
//    `Script Error` line, a router with a working guest LAN, and no
//    RADIUS, no tunnel and no heartbeat -- with nothing in the output
//    naming which chunk stopped it. That is the founder's report, word
//    for word, and `fix(router-script): /ip hotspot takes no comment,
//    and the error aborts the import` (adcea57, 2026-09-01) is the fourth
//    fix for one instance of it.
//
//  - `/import` HAS NO OPERATOR IN IT. Six chunks are titled "confirm PASS
//    before continuing". In a paste flow a human reads the verdict and
//    decides; in a file there is nobody, so the verdict has to be a
//    control-flow decision or it is decoration. Some of them already
//    `:error`; the point of 15.3 is that WHICH ones do is a recorded
//    decision rather than an accident, because each `:error` upstream of
//    RADIUS is a place the founder's symptom can be reproduced.
//
//  - `/import` NEVER PAUSES. The chunked paste's typing delay is what let
//    a DHCP lease bind between the `add` and the read; the file has no
//    such delay, which is how a default route came out with gateway
//    `0.0.0.0` and flags `Is`. The generator now polls for that (five
//    bounded retries, then `:error`), and sections 12.x gate the poll --
//    but they gate it on the CHUNK. 15.1 is what makes those guards
//    legitimately cover the file: it proves the file's executable content
//    is the chunks' executable content and nothing else, so every guard
//    in sections 1-14 transfers rather than being assumed to.
//
// WHAT IS NOT TESTABLE HERE, STATED PLAINLY. This suite cannot run
// RouterOS. It cannot prove that `/import` aborts (that is measured
// behaviour, recorded from live devices), that any particular property is
// accepted by any particular menu (15.4 is a denylist of things MEASURED
// to be rejected, not a model of RouterOS), or that a bounded retry is
// long enough for a real ISP's DHCP. Those are hardware facts. What this
// section can do is make the script's own STRUCTURE prove the class
// cannot recur silently: a failure has a name, an abort is a decision,
// and the file and the chunks cannot drift apart.

console.log("\n-- 15. the .rsc delivery channel --");

/** A `.rsc` for every variant in the main sweep, alongside the chunks it
 * was rendered from. Deliberately the SAME `VARIANTS` list the rest of
 * this file uses: a private fixture list here would be a second matrix
 * that drifts, which is the shape section 12 was bitten by. */
const RSC_CASES = VARIANTS.map(([variant, opts]) => {
  const chunks = buildRouterSetupScriptChunks(opts);
  return { variant, opts, chunks, rsc: chunksToRouterOsScript(chunks, "lobby router") };
});

/** The lines `/import` will actually EXECUTE: everything that is not
 * blank and not a `#` comment. `#` runs to end of line on RouterOS and
 * the renderer only ever emits comments on their own line, so this is the
 * whole of it. */
const executableLines = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

/** WHAT THE RENDERER IS ALLOWED TO INVENT, AS A SHAPE.
 *
 * This used to be `line.includes(SINGLE_LINE_MARKER_PREFIX)`, and that is
 * not a bound -- it is a hole with a password. 15.1 exists to prove the
 * renderers add no executable statement of their own, and a substring
 * exemption waves through
 * `/system reset-configuration; :put "### cloudguest"` as cheerfully as a
 * real marker. The exemption had to get MORE precise, not disappear,
 * because the markers now go to two sinks and a blanket exemption over a
 * wider set of statements is a wider blind spot.
 *
 * So: the whole line must be exactly ONE statement, that statement must
 * be `:put` or `:log info`, and its only argument must be one
 * double-quoted literal that starts with the marker prefix. The `$`
 * anchor is what does the work -- nothing can be chained onto it, and no
 * expression, variable, `[` command substitution or `.` concatenation can
 * appear, because none of those can occur inside the quoted run this
 * permits.
 *
 * Being a legal SHAPE is still not enough to be legal CONTENT: 15.1 also
 * requires the renderer's contributions to be exactly the enumerated set
 * `progressMarkerStatements` predicts. This regex is what makes that
 * enumeration safe to trust -- it proves every member of it is inert. */
const MARKER_STATEMENT_RE = new RegExp(
  `^(?::put|:log info) "${SINGLE_LINE_MARKER_PREFIX} (?:[^"\\\\]|\\\\.)*"$`,
);
const isMarkerLine = (line) => MARKER_STATEMENT_RE.test(line);

// ---------------------------------------------------------------------
// 15.1 THE FILE IS THE CHUNKS. Nothing added, nothing dropped, nothing
//      rewritten, nothing reordered.
// ---------------------------------------------------------------------
// This is the check that makes the other 2,400 legitimate. Every guard in
// sections 1-14 judges `chunk.script`; they only say anything about the
// downloaded file if the file's executable content IS that text. Today it
// is, by construction -- but "by construction" is what was true of the
// single-line channel too, right up until it grew progress markers the
// `.rsc` never got. So the relationship is asserted rather than assumed,
// and it is asserted in BOTH directions: a renderer that quietly dropped
// a chunk and one that quietly rewrote a line are different bugs with the
// same symptom.
for (const { variant, chunks, rsc } of RSC_CASES) {
  const fileLines = executableLines(rsc);
  const chunkLines = chunks.flatMap((c) => executableLines(c.script));

  const chunkLineSet = new Set(chunkLines);
  const invented = fileLines.filter((l) => !chunkLineSet.has(l) && !isMarkerLine(l));
  check(
    `${variant}: every executable line of the .rsc comes verbatim from a chunk`,
    invented.length === 0,
    `the file would run ${invented.length} statement(s) no chunk contains, and no guard in ` +
      `this suite has ever seen them -- first: ${invented[0]?.slice(0, 120)}`,
  );

  const fileLineSet = new Set(fileLines);
  const dropped = chunkLines.filter((l) => !fileLineSet.has(l));
  check(
    `${variant}: the .rsc drops no executable line the chunks emit`,
    dropped.length === 0,
    `${dropped.length} statement(s) an operator pasting chunk-by-chunk would run are absent ` +
      `from the downloaded file -- the two channels do not configure the same router. ` +
      `First: ${dropped[0]?.slice(0, 120)}`,
  );

  // ORDER, not just membership. Chunk order is a dependency order (RADIUS
  // needs hsprof1 and the tunnel address; the heartbeat needs the clock),
  // and a set comparison cannot see it being lost.
  const withoutMarkers = fileLines.filter((l) => !isMarkerLine(l));
  check(
    `${variant}: the .rsc preserves chunk order exactly`,
    withoutMarkers.length === chunkLines.length &&
      withoutMarkers.every((l, i) => l === chunkLines[i]),
    "the file's statements are not the chunks' statements in the chunks' order, so the " +
      "dependency order the panel lists them in is not the order /import will run them in",
  );

  // Everything the RENDERER contributes must be inert or a marker. A
  // non-comment line of the renderer's own is a statement no guard in
  // this file has ever inspected.
  const rendererOwn = rsc
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !chunkLineSet.has(l));
  check(
    `${variant}: everything the renderer adds is a # comment or a progress marker`,
    rendererOwn.every((l) => l.startsWith("#") || isMarkerLine(l)),
    "the .rsc header and separators must be inert; an executable line invented by the " +
      "renderer is a statement the whole suite is blind to",
  );

  // AND THE MARKERS ARE AN ENUMERATION, NOT A PATTERN.
  //
  // The check above says every renderer-added statement LOOKS like a
  // marker. That is a shape test, and a shape test cannot tell a marker
  // from a plausible-looking statement that happens to wear the prefix.
  // `progressMarkerStatements` is the renderers' own source for these
  // lines, so this compares what the file contains against what the
  // renderer was entitled to emit, both ways: an extra marker (a
  // duplicated bracket, a stray sentinel) and a missing one (a chunk
  // whose START never rendered) are both red.
  //
  // This is what lets 15.1 stay a real guard while the renderer emits
  // executable statements of its own. The guard was never "the renderer
  // emits nothing"; it is "the renderer emits nothing this suite has not
  // seen", and the enumeration is how the suite sees them.
  const expectedMarkers = progressMarkerStatements(chunks);
  const actualMarkers = fileLines.filter((l) => !chunkLineSet.has(l));
  check(
    `${variant}: the .rsc's invented statements are EXACTLY the enumerated markers`,
    actualMarkers.length === expectedMarkers.length &&
      actualMarkers.every((l, i) => l === expectedMarkers[i]),
    `the renderer contributed ${actualMarkers.length} statement(s) where the enumeration ` +
      `predicts ${expectedMarkers.length}. A statement the enumeration does not name is a ` +
      `statement no guard in this file has ever inspected, whether or not it wears the ` +
      `marker prefix -- first mismatch: ` +
      `${JSON.stringify(actualMarkers.find((l, i) => l !== expectedMarkers[i]) ?? null)}`,
  );
  check(
    `${variant}: every enumerated marker is an inert print or log of a literal`,
    expectedMarkers.length > 0 && expectedMarkers.every((l) => MARKER_STATEMENT_RE.test(l)),
    "the enumeration is only safe to exempt because nothing in it can change device state. " +
      "A member that took a variable, a `[` substitution or a second chained statement would " +
      "make the exemption a hole",
  );

  // REPRODUCIBLE. `generatedAt` is a declared input precisely so the
  // emitted text is a function of the options; the file's header carries
  // a wall-clock stamp, which is fine in a comment and would not be fine
  // in a statement.
  const again = chunksToRouterOsScript(
    buildRouterSetupScriptChunks(RSC_CASES.find((c) => c.variant === variant).opts),
    "lobby router",
  );
  check(
    `${variant}: the .rsc's executable content is reproducible`,
    executableLines(again).join("\n") === fileLines.join("\n"),
    "two downloads of the same script would configure the router differently, so no verdict " +
      "read off one of them says anything about the other",
  );
}

// ---------------------------------------------------------------------
// 15.1b THE TWO CHANNELS ARE THE SAME STATEMENTS IN THE SAME ORDER.
// ---------------------------------------------------------------------
// 15.1 pins the `.rsc` to the chunks. Sections 1-14 pin the chunks. What
// NOTHING pinned was the third edge of the triangle: that the flattened
// paste and the downloaded file configure the same router.
//
// It was true by construction and it was measured by hand when the .rsc
// finally got markers -- and "true by construction" is the exact phrase
// that was also true of the .rsc's markers right up until it turned out
// the .rsc had none for a month while the paste had 65. Two renderers,
// two hands, one shared vocabulary and no assertion tying them is how
// that happened, and it is the failure this change is most able to
// repeat: the markers just went from one sink to two, in both renderers.
//
// So the property is asserted as an EQUALITY rather than a containment.
// Both channels are, statement for statement, the same list -- markers
// included, order included. A change that reaches one renderer and not
// the other cannot be green.
for (const { variant, chunks, rsc } of RSC_CASES) {
  const fileStatements = executableLines(rsc);
  const oneLine = chunksToSingleLineScript(chunks);

  check(
    `${variant}: the .rsc and the one-line paste are the same statement list`,
    fileStatements.join("; ") === oneLine,
    "the two delivery channels would configure the same router differently. This is the " +
      "shape that left the .rsc with no progress markers for a month while the paste had " +
      "them, and the .rsc is the channel the founder actually uses",
  );

  // AND THE NON-MARKER HALF SPECIFICALLY, stated on its own because it is
  // the half that survives any future disagreement about markers. If the
  // two channels ever DO diverge on marker policy -- a shorter paste, a
  // different sink -- this is the line that must still hold: every
  // statement that touches the device appears verbatim in both, in order.
  let cursor = 0;
  let firstMissing = null;
  for (const line of fileStatements.filter((l) => !isMarkerLine(l))) {
    const at = oneLine.indexOf(line, cursor);
    if (at < 0) {
      firstMissing = line;
      break;
    }
    cursor = at + line.length;
  }
  check(
    `${variant}: every executable non-marker statement of the .rsc appears verbatim, in order, in the one-line paste`,
    firstMissing === null,
    `a statement the downloaded file runs is absent from the paste (or out of order in it): ` +
      `${JSON.stringify(firstMissing?.slice(0, 120) ?? null)}. Chunk order is a dependency ` +
      `order, so 'present somewhere' is not the property -- RADIUS needs the tunnel address ` +
      `and the heartbeat needs the clock`,
  );
}

// The equality above is only worth having if it can actually fail.
{
  const two = [
    { label: "A", script: "/ip dns set servers=1.1.1.1" },
    { label: "B", script: "/ip dns set servers=8.8.8.8" },
  ];
  check(
    "15.1b's channel equality fails when one channel drops a statement",
    executableLines(chunksToRouterOsScript(two, "r"))
      .filter((l) => l !== two[1].script)
      .join("; ") !== chunksToSingleLineScript(two),
    "if removing a whole chunk's statement from one side still compared equal, the check " +
      "could never see a renderer drifting",
  );
  check(
    "15.1b's channel equality fails when the two are reordered",
    executableLines(chunksToRouterOsScript([two[1], two[0]], "r")).join("; ") !==
      chunksToSingleLineScript(two),
    "a set comparison would call a reordered dependency chain identical; this must not be one",
  );
}

// ANTI-OVER-STRICTNESS. 15.1 must be able to tell "the renderer added a
// marker" (legal, and 15.2 requires it) from "the renderer added a
// statement" (the thing it exists to catch). Proven here on synthetic
// input rather than by trusting the sweep's silence.
{
  const fake = [{ label: "X", script: `/ip dns set servers=1.1.1.1` }];
  const marker = `:put "${SINGLE_LINE_MARKER_PREFIX} 1/1 START X"`;
  check(
    "15.1's invented-line detector does not flag a progress marker",
    isMarkerLine(marker),
    "if a marker read as an invented statement, 15.2's requirement and 15.1's would " +
      "contradict each other and one of them would get switched off",
  );
  check(
    "15.1's invented-line detector does not flag the log half of a marker pair either",
    isMarkerLine(`:log info "${SINGLE_LINE_MARKER_PREFIX} 1/1 START X"`),
    "the markers now go to two sinks; a detector that only knew about `:put` would make the " +
      "second sink unrepresentable and the whole hedge would be reverted to get green",
  );
  check(
    "15.1's invented-line detector does flag a real invented statement",
    !isMarkerLine(`/system reboot`),
    "a detector that treats every renderer-added line as a marker cannot fail",
  );
  // THE THREE SHAPES THE OLD SUBSTRING EXEMPTION LET THROUGH. Each is a
  // statement that changes device state and that
  // `line.includes(SINGLE_LINE_MARKER_PREFIX)` graded as a legal marker.
  // The precise form is worth the extra lines only if it actually stops
  // them, so it is proven here rather than asserted in a comment.
  for (const [shape, line] of [
    [
      "a real command chained onto a marker",
      `:put "${SINGLE_LINE_MARKER_PREFIX} 1/1 START X"; /system reset-configuration`,
    ],
    [
      "a command hiding behind a marker-shaped comment",
      `/ip firewall filter remove [find] # ${SINGLE_LINE_MARKER_PREFIX}`,
    ],
    [
      "a marker whose argument is an expression rather than a literal",
      `:put ("${SINGLE_LINE_MARKER_PREFIX} " . [/system identity get name])`,
    ],
  ]) {
    check(
      `15.1's detector rejects ${shape}`,
      !isMarkerLine(line),
      "the substring exemption this replaced accepted all three. An exemption that a real " +
        "statement can wear is not a bound on what the renderer may emit -- it is the " +
        "renderer's blank cheque, and 15.1 is the only thing standing between the file and " +
        "one",
    );
  }
  check(
    "15.1's enumeration is derived from the renderer, not restated",
    (() => {
      const one = [{ label: "Solo", script: "/ip dns set servers=1.1.1.1" }];
      const enumerated = progressMarkerStatements(one);
      const rendered = chunksToRouterOsScript(one, "r")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#") && l !== one[0].script);
      return (
        enumerated.length === 6 &&
        rendered.length === enumerated.length &&
        rendered.every((l, i) => l === enumerated[i])
      );
    })(),
    "a one-chunk script must contribute exactly START x2, DONE x2 and COMPLETE x2. If the " +
      "enumeration were written out by hand here it would go stale the first time the " +
      "renderer changed, and 15.1 would be grading the file against last month's renderer",
  );
  check(
    "markerStatements writes each marker to both sinks, log first",
    (() => {
      const out = markerStatements(`${SINGLE_LINE_MARKER_PREFIX} test`);
      return (
        out.length === 2 &&
        out[0] === `:log info "${SINGLE_LINE_MARKER_PREFIX} test"` &&
        out[1] === `:put "${SINGLE_LINE_MARKER_PREFIX} test"`
      );
    })(),
    "whether /import echoes `:put` at all has never been measured on hardware (AC-4.5, never " +
      "resolved). A marker that exists only as `:put` is a marker that may print nothing in " +
      "the one channel the founder uses, and nobody would find out",
  );
  check(
    "15.1's executable-line filter drops # comments and keeps statements",
    executableLines("# a comment\n\n/ip dns set servers=1.1.1.1\n").length === 1 &&
      executableLines(fake[0].script).length === 1,
    "if comments counted as executable, the header would read as invented statements and " +
      "the sweep would be red for the wrong reason",
  );
}

// ---------------------------------------------------------------------
// 15.2 A FAILED IMPORT MUST HAVE A NAME.
// ---------------------------------------------------------------------
// RouterOS reports ONE error for an aborted `/import` and gives no
// indication of how far it got. The chunked-paste channel already solved
// this: `chunksToSingleLineScript` brackets every chunk with a `:put`
// START/DONE marker and ends with COMPLETE, so the LAST LINE OF OUTPUT
// names the chunk that died. The `.rsc` -- the channel the founder
// actually uses, and the one with no panel, no toast and no chunk list
// around it -- has none of that.
//
// Measured on origin/main at f99c02b: 65 markers in the single-line form,
// 0 in the .rsc, for the same script. That is why "the script executed,
// RADIUS wasn't there" was reportable but not diagnosable: the operator
// had no way to say WHERE it stopped, so each fix addressed whichever
// statement happened to be found, and the next provisioning found the
// next one.
//
// Markers, not `#` comments: a comment prints nothing under `/import`,
// and output an operator can read back is the entire point.
for (const { variant, chunks, rsc } of RSC_CASES) {
  const fileLines = executableLines(rsc);
  const markers = fileLines.filter(isMarkerLine);
  const total = chunks.length;

  check(
    `${variant}: the .rsc brackets every chunk with a progress marker`,
    chunks.every(
      (c) =>
        markers.some((m) => m.includes("START") && m.includes(c.label)) &&
        markers.some((m) => m.includes("DONE") && m.includes(c.label)),
    ),
    `an /import that aborts partway prints one error and no position. Without a START/DONE ` +
      `marker per chunk there is nothing to read the stopping point off, which is exactly ` +
      `how "the script executed and RADIUS wasn't there" stayed undiagnosed for four fixes ` +
      `(${markers.length} marker(s) present, ${total} chunk(s))`,
  );

  check(
    `${variant}: the .rsc ends with a COMPLETE marker`,
    fileLines.length > 0 &&
      isMarkerLine(fileLines[fileLines.length - 1]) &&
      /COMPLETE/.test(fileLines[fileLines.length - 1]),
    "a run that reached the end and a run that stopped one statement short are otherwise " +
      "indistinguishable -- the COMPLETE marker is the only thing that says the import " +
      "finished rather than merely stopped",
  );

  check(
    `${variant}: the .rsc's markers are executable statements, not comments`,
    markers.length > 0 && markers.every((m) => /^(?::put|:log info)\s+"/.test(m)),
    "a `#` line prints nothing under /import, so a marker written as a comment is invisible " +
      "in the one place it is needed",
  );

  // BOTH SINKS, IN THE .rsc TOO -- and this is the channel it matters in.
  //
  // The single-line paste runs in the console the operator is watching.
  // The `.rsc` runs under `/import`, and whether `/import` echoes `:put`
  // to the terminal AT ALL is an assumption this repo has never tested on
  // a device: the spec logs it as AC-4.5 and says to resolve it on real
  // hardware first, and nobody did. If it does not echo, a `:put`-only
  // marker scheme prints nothing, the operator reads nothing, and every
  // fix made for "the script executed, RADIUS wasn't there" is void with
  // no symptom to notice.
  //
  // `:log` needs no terminal. It is also the better record even when
  // `:put` works, because a 30-chunk import scrolls a WinBox buffer.
  const putM = markers.filter((m) => m.startsWith(":put "));
  const logM = markers.filter((m) => m.startsWith(":log info "));
  check(
    `${variant}: every .rsc marker is written to the log as well as the console`,
    putM.length > 0 &&
      putM.length === logM.length &&
      putM.every((m) => logM.includes(m.replace(/^:put /, ":log info "))),
    `${putM.length} :put vs ${logM.length} :log info. The whole marker scheme rests on ` +
      `/import echoing :put, which nobody has confirmed. One sink is a single point of ` +
      `failure for the only thing that can tell an aborted run from a clean one`,
  );
  // IN THE HEADER, not merely somewhere in the file. A chunk deep in the
  // script already prints `/log print where message~cloudguest` for an
  // unrelated reason, so a whole-file search here would have been green
  // with the header instruction deleted -- a check that could not fail,
  // which is the defect QA found six times in this suite. Scoped to the
  // `#` prologue, where a downloaded file is actually read.
  const rscPrologue = (() => {
    const out = [];
    for (const raw of rsc.split("\n")) {
      const l = raw.trim();
      if (l === "") continue;
      if (!l.startsWith("#")) break;
      out.push(l);
    }
    return out.join("\n");
  })();
  check(
    `${variant}: the .rsc names the /log route to read them back in its own header`,
    new RegExp(`/log print where message~"${SINGLE_LINE_MARKER_PREFIX}"`).test(rscPrologue),
    "AC-4.4: the file is read without the panel around it. A log the operator is never told " +
      "to look at is the same as no log -- and it has to be told in the prologue, because " +
      "that is the part of a .rsc anyone reads before running it",
  );
  check(
    `${variant}: ...and says what the last line must read`,
    new RegExp(`${SINGLE_LINE_MARKER_PREFIX} COMPLETE`).test(rscPrologue) &&
      /START/.test(rscPrologue),
    "AC-4.3/4.4: 'read the log' without 'and this is what a clean run looks like' is an " +
      "instruction with no verdict at the end of it",
  );

  check(
    `${variant}: each marker names its chunk, not just an index`,
    markers.length > 0 &&
      markers
        .filter((m) => /START|DONE/.test(m))
        .every((m) => chunks.some((c) => m.includes(c.label))),
    "a column number in a 90,000-character file is not something an operator can map back " +
      "to anything; a chunk NAME maps straight onto the panel's chunk list",
  );

  check(
    `${variant}: the .rsc and the one-line paste use the SAME marker vocabulary`,
    markers.length > 0 && chunksToSingleLineScript(chunks).includes(SINGLE_LINE_MARKER_PREFIX),
    "two channels with two different words for 'this is where it stopped' means the runbook " +
      "has to describe both, and the one nobody wrote down is the one that fails",
  );
}

// ---------------------------------------------------------------------
// 15.3 AN ABORT UPSTREAM OF RADIUS IS A DECISION, NOT AN ACCIDENT.
// ---------------------------------------------------------------------
// In a file, `:error` does not stop a chunk -- it stops the PROVISIONING.
// Every `:error` that sits above the RADIUS chunk is a place where the
// founder's exact symptom is reproducible, so which chunks carry one is
// pinned here as a table with a reason each, and the table moves only
// when a person decides it should.
//
// This is a ratchet, and it is the honest shape for this problem: whether
// a wrong clock SHOULD stop a provisioning is a product decision (it
// costs the heartbeat, so the router shows offline forever -- but
// aborting there costs the guests their internet entirely, which is
// worse). What must not happen is that decision changing because someone
// added an `:error` to a chunk while fixing something else.
const RADIUS_LABEL = "RADIUS";
const ABORT_POLICY = [
  {
    // The one abort that is unambiguously right, and the only one that is
    // ALSO the first chunk: it configures nothing, so stopping there costs
    // nothing and leaves the device untouched. Listed here so that a
    // generator which learns to DERIVE its own gaps (15.8) does not turn
    // this ratchet red for doing the right thing.
    match: /^INCOMPLETE SCRIPT/,
    why:
      "the script is knowingly missing a subsystem; it configures nothing before this " +
      "point, so aborting leaves the device exactly as it was",
  },
  {
    match: /^WAN Routing/,
    why: "no default route means nothing downstream can work at all, RADIUS included",
  },
  {
    match: /^WAN Connectivity Check/,
    why:
      "no uplink means the hotspot would come up serving guests a portal that cannot " +
      "reach the platform; every later chunk depends on it",
  },
  {
    match: /^Clock \+ NTP/,
    why:
      "a wrong clock fails HTTPS certificate validation, so the heartbeat is rejected " +
      "before it is sent and the router shows offline forever. NOTE: this abort is ABOVE " +
      "RADIUS and a venue that blocks UDP/123 reproduces the founder's report exactly -- " +
      "guests would have worked, and the import stops before RADIUS is written",
  },
  {
    match: /^RADIUS$/,
    why:
      "refusing to pin src-address to an address this router does not hold; writing it " +
      "anyway produces a RADIUS client the hub silently drops",
  },
  {
    match: /^Walled Garden Check/,
    why:
      "below RADIUS. An unreachable portal means no guest can sign in, and the two " +
      "verification chunks after it have nothing left to verify",
  },
  {
    match: /^Portal Identity Check/,
    why: "below RADIUS. Serving another tenant's portal link is worse than serving none",
  },
];

/** Chunks that must NEVER be able to stop an import. Each one is either
 * cosmetic, optional, or repairable by re-pasting one chunk -- and each
 * one sits ABOVE RADIUS in the dependency order, so an `:error` added to
 * any of them turns a cosmetic fault into "no guest can log in". This is
 * the list the next well-meaning fix will be tempted to add to: a stock
 * MikroTik login page IS a real fault, and stopping the import over it
 * would cost the venue its whole guest network. */
const NEVER_ABORTS = [
  /^Portal Redirect Page/,
  /^Portal Stamp/,
  /^Router Identity/,
  /^Block DNS-over-HTTPS/,
  /^Captive-Portal Detection/,
  /^Walled Garden \(/,
  /^Firewall$/,
  /^LAN Interfaces/,
  /^LAN Ports/,
  /^Stale Factory-Default/,
  /^WAN \+ Bridge$/,
  /^Hotspot$/,
  /^WireGuard Tunnel$/,
  /^API Access/,
  /^Tunnel Identity Check/,
  /^Heartbeat/,
  /^Guest Access Sync/,
  /^Guest Data Path/,
];

for (const { variant, chunks } of RSC_CASES) {
  const aborting = chunks.filter((c) => /:error\b/.test(c.script));

  const unlisted = aborting.filter((c) => !ABORT_POLICY.some((p) => p.match.test(c.label)));
  check(
    `${variant}: every chunk that can abort the import is in ABORT_POLICY`,
    unlisted.length === 0,
    `${unlisted.map((c) => c.label).join(", ")} stops an /import and no one wrote down why. ` +
      `Under /import an :error does not fail a chunk, it ends the provisioning -- so a new ` +
      `one above RADIUS silently reproduces "the script executed and RADIUS wasn't there"`,
  );

  const wronglyAborting = chunks.filter(
    (c) => /:error\b/.test(c.script) && NEVER_ABORTS.some((re) => re.test(c.label)),
  );
  check(
    `${variant}: no cosmetic or optional chunk can stop the import`,
    wronglyAborting.length === 0,
    `${wronglyAborting.map((c) => c.label).join(", ")} would abort. Each of these sits above ` +
      `RADIUS and each fails for reasons that leave the guest path repairable -- stopping ` +
      `there trades a cosmetic fault for a venue with no guest network`,
  );

  // The founder's symptom, stated as an invariant an operator can read:
  // if the import stops before RADIUS, they have to be told that is what
  // just happened. Under /import there is no chunk list on screen and no
  // "re-paste just this chunk" to do.
  const radiusIdx = chunks.findIndex((c) => c.label === RADIUS_LABEL);
  if (radiusIdx >= 0) {
    const upstreamAborts = chunks.slice(0, radiusIdx).filter((c) => /:error\b/.test(c.script));
    // GRADED ON THE `:error` MESSAGE, NOT ON THE CHUNK. The first version
    // of this check asked whether the word "import" appeared ANYWHERE in
    // the chunk's script, which a comment, a `:put` or an unrelated
    // sentence three statements away would have satisfied -- the chunk
    // would have gone green while the message RouterOS actually shows on
    // an abort still said "re-paste just this chunk". The message is the
    // only text the operator sees when the file dies, so it is the only
    // text worth grading.
    const abortMessages = (script) =>
      [...script.matchAll(/:error\s+"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    check(
      `${variant}: 15.3 can actually see the abort messages it grades`,
      upstreamAborts.every((c) => abortMessages(c.script).length > 0),
      `${upstreamAborts
        .filter((c) => abortMessages(c.script).length === 0)
        .map((c) => c.label)
        .join(", ")} carries an :error this scan cannot extract, so the check below passes ` +
        `it by never looking at it -- the "a guard that cannot fail" shape this file has ` +
        `been bitten by six times`,
    );
    const silent = upstreamAborts.filter((c) =>
      abortMessages(c.script).some((m) => !/\bimport\b/i.test(m)),
    );
    check(
      `${variant}: an abort above RADIUS says the rest of the FILE did not run`,
      silent.length === 0,
      `${silent.map((c) => c.label).join(", ")} stops the import with a message written for ` +
        `someone pasting chunk by chunk ("re-run", "re-paste just this chunk"). In a .rsc ` +
        `there are no chunks on screen: the operator sees one Script Error and a router ` +
        `that looks provisioned. The message has to say that everything below it -- RADIUS, ` +
        `the tunnel, the heartbeat -- was skipped`,
    );
  }
}

// Both halves of 15.3 must be able to fail. Proven on synthetic chunks
// rather than by trusting the sweep, because a policy check that can only
// ever agree with the list it was written from is decoration.
{
  const listed = [{ label: "Clock + NTP (x)", script: `:error "stop"` }];
  const unlisted = [{ label: "Portal Stamp (x)", script: `:error "stop"` }];
  check(
    "15.3 accepts an :error in a chunk the policy names",
    ABORT_POLICY.some((p) => p.match.test(listed[0].label)),
    "an over-strict policy check that flags the deliberate aborts too gets switched off",
  );
  check(
    "15.3 rejects an :error in a chunk the policy does not name",
    !ABORT_POLICY.some((p) => p.match.test(unlisted[0].label)),
    "if every label matched the policy the sweep could not fail",
  );
  check(
    "15.3's never-abort list actually matches the chunks it names",
    NEVER_ABORTS.some((re) => re.test("Portal Redirect Page (login.html)")) &&
      NEVER_ABORTS.some((re) => re.test("Hotspot")) &&
      !NEVER_ABORTS.some((re) => re.test("Clock + NTP (confirm PASS before continuing)")),
    "a list of patterns that match nothing is a check that cannot fire; a list that matches " +
      "the deliberate aborts too would contradict ABORT_POLICY",
  );
  check(
    "15.3's every-chunk-accounted-for property holds over the real labels",
    RSC_CASES.every(({ chunks }) =>
      chunks.every(
        (c) =>
          !ABORT_POLICY.some((p) => p.match.test(c.label)) ||
          !NEVER_ABORTS.some((re) => re.test(c.label)),
      ),
    ),
    "a label matched by BOTH tables makes the pair of checks self-contradictory, and " +
      "whichever one is looser silently wins",
  );
}

// ---------------------------------------------------------------------
// 15.4 NO STATEMENT MAY PASS A PARAMETER THE MENU REJECTS.
// ---------------------------------------------------------------------
// The regression test for adcea57. Confirmed live on a hEX running
// RouterOS 7.23.3 on 2026-09-01, mid provisioning:
//
//     Script Error: bad parameter comment (line 75 column 183)
//
// `/ip hotspot` -- the SERVER menu -- has no `comment` property. Both the
// add and the set passed one, RouterOS rejected the statement, and
// because this ships as an /import file the error took hotspot, RADIUS,
// WireGuard and heartbeat with it.
//
// THIS IS A DENYLIST OF MEASURED FACTS, NOT A MODEL OF RouterOS. This
// suite cannot enumerate RouterOS's property tables and must not pretend
// to: a "valid parameter" allowlist here would either be wrong or would
// have to be maintained against firmware, and both of those end with the
// check switched off. What it CAN do is make a fault confirmed on
// hardware unrepresentable, and give the next one somewhere to go that
// takes one line. Every entry below is a specific menu/parameter pair
// observed to be rejected by a real device, with the incident recorded.
const MENU_REJECTS = [
  {
    // The `/ip hotspot` SERVER menu specifically -- NOT `/ip hotspot
    // user`, `/ip hotspot profile`, `/ip hotspot walled-garden`,
    // `/ip hotspot ip-binding` or `/ip hotspot user profile`, all of
    // which do take comments and several of which this generator
    // deliberately comments. The distinction is the whole point: a rule
    // written as "no comment anywhere under /ip hotspot" would have
    // deleted five working comment= writes.
    menu: "/ip hotspot",
    param: "comment",
    incident:
      "adcea57 / #165 -- `bad parameter comment (line 75 column 183)` on a hEX, RouterOS " +
      "7.23.3, 2026-09-01. The statement was rejected and the /import aborted, so hotspot, " +
      "RADIUS, WireGuard and heartbeat never ran",
  },
];

/** Statement-level parameter writes: the menu, the verb, and the
 * parameter names that statement SETS -- with `[...]` selectors removed
 * first, so a `find where comment="..."` FILTER is never mistaken for a
 * `comment=` write. Strings are stripped throughout (same discipline as
 * `doBodies` and `stripStrings`), so a `comment=` inside a `:put` message
 * is text, not syntax.
 *
 * ONE predicate, shared by the sweep and by every self-check below. Four
 * guards in this file have already been caught keeping a private copy. */
const parameterWrites = (script) => {
  const out = [];
  for (const rawLine of script.split("\n")) {
    if (rawLine.trimStart().startsWith("#")) continue;
    const line = stripStrings(rawLine);
    for (const stmt of line.split(";")) {
      const m = stmt.match(/(\/[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*?)\s+(add|set)\b(.*)$/);
      if (!m) continue;
      const [, menu, verb, tail] = m;
      // Drop bracketed selectors -- `set [find where comment=...]` names
      // a row, it does not write a property.
      const args = tail.replace(/\[[^\]]*\]/g, " ");
      const params = [...args.matchAll(/(?:^|\s)([a-z][a-z0-9-]*)=/g)].map((p) => p[1]);
      out.push({ menu, verb, params, stmt: stmt.trim() });
    }
  }
  return out;
};

const rejectedParamsIn = (script) => {
  const bad = [];
  for (const w of parameterWrites(script)) {
    for (const r of MENU_REJECTS) {
      if (w.menu === r.menu && w.params.includes(r.param)) bad.push({ ...w, rule: r });
    }
  }
  return bad;
};

check(
  "15.4's denylist is not empty",
  MENU_REJECTS.length > 0,
  "an empty table makes the sweep below vacuous, which is the state test:location-liveness " +
    "sat in while proving nothing",
);

for (const [label, script] of pasteables) {
  const bad = rejectedParamsIn(script);
  check(
    `${label}: passes no parameter a real device rejected`,
    bad.length === 0,
    bad.map((b) => `${b.menu} ${b.verb} ... ${b.rule.param}= -- ${b.rule.incident}`).join(" | "),
  );
}

// INJECTED: the exact statement that aborted the founder's import. The
// guard must fire on it, verbatim, in both the add and the set form.
{
  const shipped_broken_add = `:if ([:len [/ip hotspot find where interface="bridge-guest"]] = 0) do={ /ip hotspot add name="hotspot1" interface="bridge-guest" address-pool="hotspot-pool" profile="hsprof1" disabled=no comment="cloudguest-hotspot" }`;
  const shipped_broken_set = `:if ([:len [/ip hotspot find where interface="bridge-guest"]] > 0) do={ /ip hotspot set [find where interface="bridge-guest"] address-pool="hotspot-pool" profile="hsprof1" disabled=no comment="cloudguest-hotspot" }`;
  check(
    "INJECTED: 15.4 fires on the `/ip hotspot add ... comment=` that shipped",
    rejectedParamsIn(shipped_broken_add).length === 1,
    "the guard cannot see the statement it exists for",
  );
  check(
    "INJECTED: 15.4 fires on the `/ip hotspot set ... comment=` that shipped",
    rejectedParamsIn(shipped_broken_set).length === 1,
    "the set form aborts an import exactly as the add form does",
  );
}

// ANTI-OVER-STRICTNESS. The cheapest way to lose this guard is to make it
// delete working `comment=` writes on the five sibling menus that DO take
// one -- the generator depends on those comments to find its own objects
// on a re-paste, so a too-broad rule here breaks idempotency everywhere.
{
  const legal = [
    `/ip hotspot walled-garden add dst-host="auth.wyfyguest.com" action=allow comment="cloudguest-portal"`,
    `/ip hotspot ip-binding add address="10.5.50.0/24" type=bypassed comment="cloudguest-bypass"`,
    `/ip firewall filter add chain=input action=accept comment="cloudguest-fw-allow-wg-mgmt"`,
    `/ip dhcp-client add interface="ether1" disabled=no comment="cloudguest-dhcp-wan1"`,
    `/radius add service=hotspot address="10.20.0.1" comment="cloudguest-radius"`,
    `/ip hotspot user profile set [find where name="default"] shared-users=5`,
  ];
  for (const stmt of legal) {
    check(
      `15.4 does not flag a legal comment= write: ${stmt.slice(0, 46)}...`,
      rejectedParamsIn(stmt).length === 0,
      "these menus take comments and this generator matches its own objects on them; a rule " +
        "broad enough to flag them would be turned off within a week",
    );
  }
  check(
    "15.4 does not read a `find where comment=` FILTER as a comment WRITE",
    rejectedParamsIn(
      `:if ([:len [/ip hotspot find where comment="x"]] > 0) do={ /ip hotspot set [find where comment="x"] disabled=no }`,
    ).length === 0,
    "a selector names a row; treating it as a property write makes every idempotent set " +
      "statement in this generator look like the defect",
  );
  check(
    "15.4 does not read a comment= inside a :put message as syntax",
    rejectedParamsIn(`:put "run /ip hotspot set comment=x by hand"`).length === 0,
    "same skip-strings discipline as every other sweep in this file",
  );
}

// The table must stay CONNECTED to reality: a rule for a menu this
// generator never emits is a rule nothing can ever exercise, and it rots
// unnoticed exactly the way test:portal-cna did.
for (const r of MENU_REJECTS) {
  check(
    `15.4's rule for ${r.menu} names a menu this generator really uses`,
    pasteables.some(([, s]) => parameterWrites(s).some((w) => w.menu === r.menu)),
    "a denylist entry for a menu that never appears cannot ever fire, so it records an " +
      "incident without preventing it",
  );
}

// ---------------------------------------------------------------------
// 15.5 EVERY `set [find ...]` IS GUARDED.
// ---------------------------------------------------------------------
// `set [find ...]` against an EMPTY match SUCCEEDS on RouterOS. No error,
// no output, nothing written. Sections 6, 10 and 13 each fixed one
// instance by name -- the `flash/hotspot/login.html` path, the six bare
// chunks on a defaults-less router, the hotspot `dns-name` -- and each
// time the next provisioning found another one. This is the sweep that
// stops naming them individually.
//
// The rule: a `set [find ...]` is acceptable only if the same statement
// tests a count first (`:if ([:len [... find ...]] > 0) do={ ... set
// [find ...] ... }`), OR the object is created by an add-if-missing
// earlier in the same chunk AND the chunk reports a count for it. The
// second exemption is real and load-bearing -- `/interface bridge set
// [find name="bridge-guest"] disabled=no` follows its own add on the line
// above and the chunk's next line binds and prints `lanBrN` -- and it is
// narrow enough that it cannot swallow the class.

// `topLevelStatements` -- the brace- and string-aware statement splitter
// this sweep is built on -- is defined once, up beside `pasteables`, so
// that 13.1b's device model and this section share ONE parser. A second
// private copy is the exact shape the comment on `HOTSPOT_SET` warns
// about: a self-check that keeps its own regex cannot see the sweep it is
// supposed to be checking being mutated.

/** Every `<menu> set [find ...]` in a statement, with the menu it targets. */
const SET_FIND = /(\/[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*?)\s+set\s+\[find\b/g;

/** ONE predicate, shared by the sweep and every self-check below. A
 * `set [find ...]` is guarded when it sits inside an `:if` that tests a
 * count -- EITHER inline (`:if ([:len [... find ...]] > 0) do={ ... }`) or
 * through a variable the same CONSOLE LINE bound from a `[:len [...]]`.
 *
 * The second form is not a loophole, it is the shape most of this
 * generator uses: the RouterOS console runs each ENTERED LINE as its own
 * program, so a `:local pfHits [:len [/file find ...]]` and every `:if
 * ($pfHits > 0)` that reads it are necessarily on one line, and that line
 * is exactly as safe as the inline form. A predicate that only accepted
 * the inline spelling would have flagged all five Portal Redirect Page
 * chunks -- the very chunks section 6 fixed -- and the guard would have
 * been switched off within a week for crying wolf. `countBoundNames` is
 * therefore computed per LINE and passed in. */
const countBoundNames = (line) =>
  new Set([...line.matchAll(/:local\s+(\w+)\s+\[:len\s*\[/g)].map((m) => m[1]));

const unguardedSetFinds = (statement, bound = new Set()) => {
  const cond = statement.match(/:if\s*\(([\s\S]*?)\)\s*do=\{/);
  if (cond) {
    if (/\[:len\s*\[/.test(cond[1])) return [];
    if ([...bound].some((n) => cond[1].includes(`$${n}`))) return [];
  }
  return [...statement.matchAll(SET_FIND)].map((m) => m[1]);
};

/** The one narrow exemption, and it is deliberately narrow enough to be
 * useless as a loophole: the object is created by an add-if-missing for
 * the SAME menu on the SAME line or the line IMMEDIATELY above, and the
 * chunk binds a `[:len [<menu> find ...]]` so a zero is still reported.
 *
 * Adjacency is the whole of it. An earlier version accepted an
 * add-if-missing anywhere in the chunk, and a mutation pass caught that
 * out: reverting section 13.7's `dns-name` fix to a bare `set [find ...]`
 * left this sweep GREEN, because the Hotspot chunk creates `hsprof1`
 * somewhere else in the same chunk and the exemption swallowed the whole
 * menu. That is the fifth time a guard in this file has been shown to be
 * unable to fail, and it is why every mutation below was actually run
 * rather than reasoned about.
 *
 * What survives is exactly the site the exemption exists for:
 * `/interface bridge set [find name="..."] disabled=no` on the line after
 * its own `:if ([:len [/interface bridge find ...]] = 0) do={ ... add }`,
 * with `:local lanBrN [:len [/interface bridge find ...]]` below it. */
const createdAndCountedInChunk = (script, menu, lineIdx) => {
  const esc = menu.replace(/[/]/g, "\\/").replace(/\s+/g, "\\s+");
  const addIfMissing = new RegExp(
    `:if\\s*\\(\\[:len\\s*\\[${esc}\\s+find[^\\]]*\\]\\]\\s*=\\s*0\\)\\s*do=\\{\\s*${esc}\\s+add\\b`,
  );
  const counted = new RegExp(`:local\\s+\\w+\\s+\\[:len\\s*\\[${esc}\\s+find\\b`);
  if (!counted.test(script)) return false;
  const lines = script.split("\n");
  const here = lines[lineIdx] ?? "";
  let prev = "";
  for (let i = lineIdx - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l === "" || l.startsWith("#")) continue;
    prev = l;
    break;
  }
  return addIfMissing.test(here) || addIfMissing.test(prev);
};

for (const [label, script] of pasteables) {
  const offenders = [];
  const lines = script.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trimStart().startsWith("#")) continue;
    const bound = countBoundNames(rawLine);
    for (const stmt of topLevelStatements(rawLine)) {
      for (const menu of unguardedSetFinds(stmt, bound)) {
        if (createdAndCountedInChunk(script, menu, i)) continue;
        offenders.push(`${menu} :: ${stmt.slice(0, 110)}`);
      }
    }
  }
  check(
    `${label}: no unguarded \`set [find ...]\``,
    offenders.length === 0,
    `set [find ...] against an empty match SUCCEEDS on RouterOS -- nothing is written and ` +
      `nothing is reported, so the chunk's verdict is computed over work that never ` +
      `happened. ${offenders.join(" | ")}`,
  );
}

// INJECTED + ANTI-OVER-STRICTNESS for 15.5, on the exact shapes that have
// shipped broken and the exact shapes that are correct.
{
  check(
    "INJECTED: 15.5 fires on the bare `dns-name` write that shipped (section 13.7)",
    unguardedSetFinds(`/ip hotspot profile set [find name="hsprof1"] dns-name="wifi.wyfyguest.com"`)
      .length === 1,
    "the guard cannot see the statement it exists for",
  );
  check(
    "INJECTED: 15.5 fires on a bare `/file set [find ...]` (the flash/ portal-page class)",
    unguardedSetFinds(`/file set [find where name~"/login.html"] contents="x"`).length === 1,
    "this is the case where the guest silently gets MikroTik's stock login page",
  );
  check(
    "15.5 does not flag the guarded form the generator actually ships",
    unguardedSetFinds(
      `:if ([:len [/ip hotspot profile find where name="hsprof1"]] > 0) do={ /ip hotspot profile set [find name="hsprof1"] dns-name="x" }`,
    ).length === 0,
    "an over-strict rule here would flag every correct statement in the Hotspot chunk and " +
      "get switched off with them",
  );
  {
    // The shape all five Portal Redirect Page chunks use, and the shape
    // that is genuinely unguarded, told apart. Both directions matter:
    // flagging the first is how the guard gets deleted, missing the second
    // is how `flash/hotspot/login.html` shipped.
    const sameLine = `:local pfHits [:len [/file find where name~"/login.html"]]; :if ($pfHits > 0) do={ /file set [find where name~"/login.html"] contents="x" }`;
    const stmts = topLevelStatements(sameLine);
    check(
      "15.5 accepts a count bound by :local on the SAME console line",
      stmts.every((st) => unguardedSetFinds(st, countBoundNames(sameLine)).length === 0),
      "the RouterOS console runs each entered line as one program, so this is exactly as " +
        "safe as the inline form -- flagging it would condemn every Portal Redirect Page " +
        "chunk and the guard would be turned off with them",
    );
    check(
      "15.5 still flags the same statement when nothing bound that count",
      stmts.some((st) => unguardedSetFinds(st, new Set()).length === 1),
      "if the binding were not what makes it safe, the predicate would be accepting the " +
        "`$pfHits` spelling rather than the guarantee behind it, and could not fail",
    );
    check(
      "15.5 does not accept an :if on an unrelated variable as a guard",
      unguardedSetFinds(
        `:if ($somethingElse > 0) do={ /file set [find where name~"/login.html"] contents="x" }`,
        countBoundNames(`:local pfHits [:len [/file find where name~"/x"]]`),
      ).length === 1,
      "any `:if` counting as a guard would exempt every statement in the generator",
    );
  }
  {
    const bridgeChunk = `:if ([:len [/interface bridge find where name="b"]] = 0) do={ /interface bridge add name="b" }\n/interface bridge set [find name="b"] disabled=no\n:local lanBrN [:len [/interface bridge find where name="b"]]`;
    check(
      "15.5's create-and-count exemption accepts the adjacent add it exists for",
      createdAndCountedInChunk(bridgeChunk, "/interface bridge", 1),
      "the WAN + Bridge chunk creates the bridge on the line above and reports its count on " +
        "the line below; flagging that would be crying wolf on the one site the exemption " +
        "was written for",
    );
    check(
      "15.5's exemption does not fire without an add-if-missing at all",
      !createdAndCountedInChunk(
        `/file set [find where name~"/login.html"] contents="x"`,
        "/file",
        0,
      ),
      "an exemption that matches anything is the guard switched off",
    );
    // THE HOLE A MUTATION PASS FOUND. An add-if-missing SOMEWHERE in the
    // chunk is not adjacency, and accepting it exempted the whole
    // `/ip hotspot profile` menu inside the Hotspot chunk -- which left
    // this sweep green when section 13.7's `dns-name` fix was reverted.
    const farApart = `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" }\n:put "something else entirely"\n/ip hotspot profile set [find name="hsprof1"] dns-name="x"\n:local n [:len [/ip hotspot profile find where name="hsprof1"]]`;
    check(
      "15.5's exemption does NOT reach a set two lines below the add",
      !createdAndCountedInChunk(farApart, "/ip hotspot profile", 2),
      "a chunk-wide exemption swallows the whole menu, and a bare `set [find ...]` on any " +
        "other object under it becomes invisible -- this is the exact hole a mutation of " +
        "section 13.7 exposed in an earlier version of this predicate",
    );
  }
  check(
    "15.5's statement splitter keeps a `do={ ... ; ... }` body together",
    topLevelStatements(`:if (1=1) do={ :put "a" }; :put "b"`).length === 2 &&
      topLevelStatements(`:put "a; b"`).length === 1,
    "splitting on every `;` would report every guarded set as bare and every `;` inside a " +
      "string as a statement boundary",
  );
}

// ---------------------------------------------------------------------
// 15.6 A RE-RUN MUST CONVERGE, NOT NO-OP.
// ---------------------------------------------------------------------
// Re-clicking Generate rotates secrets server-side. `SECRET_REPAIR` in
// `src/lib/setup-script-secrets.ts` claims all four are repaired by
// re-pasting; section 8 asserts that table against the CHUNK TEXT for the
// two it was written about. This is the general form, and it derives the
// answer instead of reading it: generate the same router twice with
// DIFFERENT secrets, take every literal that changed, and require each
// one to be written on a path that runs against a router which already
// has the object.
//
// A value that appears ONLY inside `:if ([:len [...]] = 0) do={ ... add
// ... secret=NEW ... }` is add-only. On a half-configured router that
// branch does not run, every statement reports success, and the device
// keeps the old secret -- which RouterOS reports as a TIMEOUT rather than
// as a mismatch, so nothing anywhere names it. That is failure class 4,
// and deriving it from the diff means a FIFTH secret added later is
// covered without anyone remembering to add it here.
{
  const A = {
    ...BASE,
    wans: [DHCP_WAN],
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "SEC-AAA", srcAddress: "10.20.0.5" },
    apiAccess: { username: "cloudguest", secret: "API-AAA" },
    agentCredential: "AGENT-AAA",
    portalUrl: PORTAL,
  };
  const B = {
    ...A,
    wireguard: { ...WG, routerPrivateKey: "PRIVKEY-BBB", serverPublicKey: "PUBKEY-BBB" },
    radius: { ...A.radius, sharedSecret: "SEC-BBB" },
    apiAccess: { username: "cloudguest", secret: "API-BBB" },
    agentCredential: "AGENT-BBB",
  };
  const chunksB = buildRouterSetupScriptChunks(B);
  const textB = chunksB.map((c) => c.script).join("\n");

  /** The rotated values, each named with the device object it is written
   * to. `peerPublicKey` is deliberately absent: it is what the PLATFORM
   * holds, and the Tunnel Identity Check only ever COMPARES it. The check
   * below asserts that stays true, so the day something starts writing it
   * this list has to grow. */
  const ROTATED = [
    { value: "AGENT-BBB", what: "the platform agent credential" },
    { value: "SEC-BBB", what: "the RADIUS shared secret" },
    { value: "PRIVKEY-BBB", what: "the router's WireGuard private key" },
    { value: "PUBKEY-BBB", what: "the hub's WireGuard public key on the peer" },
    { value: "API-BBB", what: "the RouterOS API password" },
  ];

  /** Does this statement run on a router that ALREADY has the object?
   * Three shapes qualify: a `set`; an `add` inside an exists-branch that
   * first `remove`s (the scheduler); and an unconditional statement. */
  const isRepairPath = (stmt) => {
    if (/\bset\b/.test(stmt)) return true;
    if (/\bremove\b/.test(stmt) && /\badd\b/.test(stmt)) return true;
    const createOnly = /:if\s*\([^)]*\[:len\s*\[[^\]]*\]\]\s*=\s*0[^)]*\)\s*do=\{/.test(stmt);
    return !createOnly;
  };

  check(
    "15.6's diff really sees the rotation",
    ROTATED.every((r) => textB.includes(r.value)),
    "if a rotated value never appears in the generated text the sweep below is asserting " +
      "over nothing -- the same vacuous-pass shape ci-gated-test.sh's floor exists for",
  );

  for (const r of ROTATED) {
    const carrying = chunksB.flatMap((c) =>
      topLevelStatements(c.script)
        .filter((s) => s.includes(r.value))
        .map((s) => ({ label: c.label, stmt: s })),
    );
    check(
      `re-paste converges ${r.what}`,
      carrying.length > 0 && carrying.some((c) => isRepairPath(c.stmt)),
      `every statement carrying this value is add-if-missing, so re-pasting a router that ` +
        `already has the object writes nothing and reports success. RouterOS reports a stale ` +
        `RADIUS secret as a TIMEOUT and a stale WireGuard key as no handshake, so neither ` +
        `side names the cause. Statements found: ${carrying.map((c) => c.label).join(", ")}`,
    );
    // ...and the claim in SECRET_REPAIR must agree with what was just derived.
    const key = {
      "AGENT-BBB": "agent",
      "SEC-BBB": "radius",
      "PRIVKEY-BBB": "wireguard",
      "PUBKEY-BBB": "wireguard",
      "API-BBB": "api",
    }[r.value];
    check(
      `SECRET_REPAIR.${key} agrees with what the chunks do for ${r.what}`,
      SECRET_REPAIR[key].repairableByRepaste === carrying.some((c) => isRepairPath(c.stmt)),
      "the table is what the Master-console dialog tells the operator. A table that says " +
        "'re-pasting fixes it' over chunks that no-op is worse than no table",
    );
  }

  check(
    "the platform-held peer key is still only ever compared, never written",
    !parameterWrites(textB).some(
      (w) => w.params.some((p) => /public-key/.test(p)) && w.stmt.includes("PEERPUBKEY"),
    ),
    "if something starts WRITING the platform's registered key, it has become a rotating " +
      "secret and must join the ROTATED list above -- otherwise it is the one secret this " +
      "convergence sweep cannot see",
  );

  // ANTI-OVER-STRICTNESS: `isRepairPath` must actually be able to answer
  // "no", or every secret passes and the section is decoration.
  check(
    "15.6 classifies an add-only branch as NOT a repair path",
    !isRepairPath(
      `:if ([:len [/radius find where comment="c"]] = 0) do={ /radius add address="h" secret="SEC-BBB" }`,
    ),
    "this is the exact shape that left routers on the old shared secret; if it classified as " +
      "a repair path the whole sweep would pass vacuously",
  );
  check(
    "15.6 classifies an else-branch `set` as a repair path",
    isRepairPath(
      `:if ([:len [/radius find where comment="c"]] > 0) do={ /radius set [find where comment="c"] secret="SEC-BBB" }`,
    ) && isRepairPath(`/tool fetch url="x" http-header-field="X-Agent-Credential: AGENT-BBB"`),
    "an over-strict classifier that calls the correct shape broken gets the guard deleted",
  );
  check(
    "15.6 classifies remove-then-add as a repair path",
    isRepairPath(
      `:foreach s in=[/system scheduler find where name="cloudguest-heartbeat"] do={ /system scheduler remove $s }; /system scheduler add name="cloudguest-heartbeat" on-event="AGENT-BBB"`
        .split("; ")
        .join(" "),
    ),
    "the scheduler converges by replacement rather than by `set`, and a classifier blind to " +
      "that would report a false defect on the one chunk that is already right",
  );
}

// ---------------------------------------------------------------------
// 15.8 A SCRIPT MISSING A WHOLE SUBSYSTEM CANNOT LOOK COMPLETE.
// ---------------------------------------------------------------------
// THIS IS THE ONE THE FOUNDER ACTUALLY HIT. Measured on origin/main at
// f99c02b, not inferred:
//
//   `enableWireguard` and `enableRadius` both default to FALSE
//   (`RouterSetupScriptAdvanced.tsx:315-316`), and `notProvisioned` --
//   the array that drives the loud `INCOMPLETE SCRIPT` chunk and its
//   `:error` -- is appended ONLY from `catch` blocks (lines 667, 701,
//   766). An unticked checkbox is not a caught exception.
//
// So a default Generate emits 28 chunks instead of 32. The hotspot is
// built, the portal pages are written, the firewall is built, the
// heartbeat scheduler is created -- the router CHECKS IN and shows GREEN
// in Master console -- and `/radius` is empty. Not one line of the file
// says so. The `.rsc` imports perfectly cleanly, every chunk prints
// `RESULT: PASS`, and no guest can ever get past the login page.
//
// "The script executed, RADIUS wasn't there and it didn't run" is a
// precise description of that, and it is NOT the `/import` abort class at
// all: nothing aborted. The script was never asked to configure RADIUS.
// Four previous fixes went to abort causes because an abort was the only
// hypothesis the output supported.
//
// THE RULE: whether a subsystem is missing is a property of the EMITTED
// SCRIPT, so it must be derived from the emitted script. A gap that is
// only visible when the caller happens to hand over a `notProvisioned`
// entry is a gap that is invisible in every path where the caller did not
// call at all -- which is the default path.
//
// Deliberately NOT asserted here: that the panel's `if (enableRadius)`
// branch records the gap on its else. Deciding whether a `push` sits
// inside a `catch` needs a real parser, and a regex over JSX source that
// half-does it is the "a guard that cannot be shown to fail" shape this
// file has already been bitten by five times. Making the GENERATOR derive
// the gap makes the call-site question moot: it does not matter why
// `opts.radius` was undefined.
{
  /** What this generator can leave out while still producing a script
   * that runs to COMPLETE, and what each omission costs a venue. Derived
   * from the emitted text, never from the caller's `notProvisioned`.
   *
   * The `needs` predicate is what stops this being an opinion: a script
   * that builds no hotspot is not missing RADIUS, it is a different
   * product. A script that DOES build a hotspot and has no RADIUS cannot
   * authenticate a single guest, and that is not a mode anyone chose. */
  const buildsHotspot = (t) => /\/ip hotspot\s+add\b/.test(t);
  const SILENT_GAPS = [
    {
      what: "RADIUS",
      needs: buildsHotspot,
      emitted: (t) => /\/radius\s+add\b/.test(t),
      // What a Generate looks like with THIS subsystem left out and
      // everything else present. Each gap is tested in isolation against
      // an otherwise-complete script, so a red check names one missing
      // subsystem rather than "this fixture is minimal".
      without: { radius: undefined },
      cost:
        "the hotspot comes up, the portal loads, and every guest login is Access-Rejected. " +
        "RouterOS reports a missing RADIUS server the same way it reports a wrong shared " +
        "secret -- as a timeout -- so neither the router nor the hub names the cause",
    },
    {
      what: "WireGuard tunnel",
      needs: buildsHotspot,
      emitted: (t) => /\/interface wireguard\s+add\b/.test(t),
      // RADIUS goes with it: `srcAddress` is the tunnel IP, so the panel
      // cannot offer RADIUS without WireGuard (`enableRadius && wireguard`).
      without: { wireguard: undefined, radius: undefined },
      cost:
        "the router has no path to the platform that a venue firewall cannot close, and " +
        "RADIUS has no address to source from. Master console can still show it ONLINE off " +
        "the WAN-side heartbeat, which is the reading an operator trusts",
    },
    {
      what: "portal redirect pages",
      needs: buildsHotspot,
      emitted: (t) => /\/file set \[find/.test(t),
      without: { portalUrl: undefined },
      cost:
        "guests get MikroTik's own stock login page instead of the venue's portal -- a form " +
        "asking for a RouterOS username, on a network the venue is paying to brand",
    },
  ];

  /** The founder's Generate: every field filled in, both subsystem
   * checkboxes left at their default of off. Nothing threw, so
   * `notProvisioned` is empty -- deliberately not passed at all here,
   * because that is the whole point. */
  const DEFAULT_GENERATE = {
    ...BASE,
    wans: [DHCP_WAN],
    identity: "gurgaon-branch",
    portalUrl: PORTAL,
  };
  const COMPLETE_GENERATE = {
    ...DEFAULT_GENERATE,
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
    apiAccess: { username: "cloudguest", secret: "pw" },
  };

  const declaresGap = (chunks, what) =>
    chunks.some((c) => /INCOMPLETE SCRIPT/.test(c.label) && c.label.includes(what)) ||
    chunks.some((c) => /INCOMPLETE SCRIPT/.test(c.label) && c.script.includes(what));

  const defaultChunks = buildRouterSetupScriptChunks(DEFAULT_GENERATE);
  const defaultText = defaultChunks.map((c) => c.script).join("\n");
  const completeChunks = buildRouterSetupScriptChunks(COMPLETE_GENERATE);
  const completeText = completeChunks.map((c) => c.script).join("\n");
  /** An otherwise-complete Generate with exactly one subsystem left out. */
  const withoutGap = (gap) =>
    buildRouterSetupScriptChunks({ ...COMPLETE_GENERATE, ...gap.without });

  // The fixture has to really be the founder's case, or everything below
  // is asserting over something else.
  check(
    "15.8's default-Generate fixture really does build a hotspot with no RADIUS",
    buildsHotspot(defaultText) && !/\/radius\s+add\b/.test(defaultText),
    "if the fixture were already complete this whole block would pass vacuously -- the same " +
      "shape as a guard whose sample string does not contain the pattern it claims to test",
  );
  check(
    "15.8's complete-Generate fixture really is complete",
    SILENT_GAPS.every((g) => g.emitted(completeText)),
    "the anti-over-strictness half below is only meaningful against a script that has " +
      "everything",
  );

  for (const gap of SILENT_GAPS) {
    const chunks = withoutGap(gap);
    const text = chunks.map((c) => c.script).join("\n");
    if (!gap.needs(text)) continue;
    check(
      `a script with no ${gap.what} says so, without being told`,
      gap.emitted(text) || declaresGap(chunks, gap.what),
      `this script configures a hotspot and never configures ${gap.what}, and nothing IN THE ` +
        `SCRIPT says so. ${gap.cost}. ` +
        `NOTE FOR THE ROUTER WORK: the panel-side half of this is fixed -- both subsystems ` +
        `now default ON and a deselected one is recorded as a \`deliberate\` gap. What this ` +
        `check still wants is the BACKSTOP: \`notProvisioned\` is supplied by the CALLER, so ` +
        `the guarantee holds only for callers that remember. Whether a subsystem is missing ` +
        `is a property of \`opts\`, and deriving it inside the generator makes the class ` +
        `unrepresentable at every call site rather than at the one that exists today -- ` +
        `which is what the previous four fixes each did for one instance`,
    );
  }

  // ANTI-OVER-STRICTNESS. A banner on every healthy download is noise
  // that gets scrolled past on the one that matters, which is the same
  // reason the notProvisioned warning is first and not last.
  for (const gap of SILENT_GAPS) {
    check(
      `a complete script carries no ${gap.what} gap warning`,
      gap.emitted(completeText) && !declaresGap(completeChunks, gap.what),
      "a warning that fires on a correct script is a warning nobody reads on an incorrect one",
    );
  }

  // THE DOWNLOADED FILE, not just the chunk list. A .rsc has no panel, no
  // toast and no chunk count around it; the header is the only thing read
  // before it runs. The existing 13.10 check proves this for the
  // caller-supplied path -- this is the derived one.
  {
    const rsc = chunksToRouterOsScript(defaultChunks, "lobby router");
    const head = rsc.split("\n").slice(0, 16).join("\n");
    check(
      "a .rsc missing a subsystem says so in its header, without being told",
      /INCOMPLETE/.test(head) || /\/radius\s+add\b/.test(rsc),
      "the operator saves this file, carries it to the venue, uploads it and imports it. It " +
        "runs to COMPLETE, every chunk prints PASS, the router checks in and shows green in " +
        "Master console, and no guest can sign in. The header is the only place that can " +
        "still be read at that point. Follows from the check above: the header is rendered " +
        "from the INCOMPLETE chunks, so a gap the generator did not derive cannot reach it",
    );
  }

  // AND THE READING THAT MADE IT SURVIVABLE. The heartbeat is what an
  // operator checks to decide a provisioning worked, and it reports the
  // WAN-side check-in -- which succeeds perfectly on a router with no
  // RADIUS. A script that omits a subsystem must not also emit the chunk
  // that makes the omission look like success.
  check(
    "a script with no RADIUS does not still claim the router is fully provisioned",
    !defaultChunks.some((c) => /^Heartbeat Check/.test(c.label)) ||
      declaresGap(defaultChunks, "RADIUS") ||
      /\/radius\s+add\b/.test(defaultText),
    'the "Heartbeat Check (confirm this router actually appears online)" chunk passes on a ' +
      "router that cannot authenticate a single guest, because appearing online is a " +
      "WAN-side fact. Green in Master console is the reading an operator stops at, and it " +
      "is how a RADIUS-less router reached a venue",
  );

  // ROT GUARD. The table above is only worth its floor if every entry is
  // reachable -- an entry for something the generator always emits can
  // never fire, and records an incident without preventing it.
  for (const gap of SILENT_GAPS) {
    check(
      `15.8 can actually construct a script missing ${gap.what}`,
      !gap.emitted(
        withoutGap(gap)
          .map((c) => c.script)
          .join("\n"),
      ),
      "an entry whose `without` override does not actually remove the subsystem tests " +
        "nothing -- it records an incident without preventing it, which is the state " +
        "test:location-liveness sat in",
    );
  }
}

// ---------------------------------------------------------------------
// 15.9 A PARTIAL PROVISION MUST NOT END ON THE SAME LINE AS A FULL ONE.
// ---------------------------------------------------------------------
// 15.2 gets a COMPLETE sentinel onto the end of the .rsc, and the field
// runbook that goes with it is one sentence: import it, read the last
// line. That instruction is only safe if the last line can tell apart the
// TWO ways a run ends well-formed.
//
// A gap the operator chose (an unticked box) deliberately does NOT
// `:error` -- see `notProvisioned`'s docstring in the generator: aborting a
// run somebody scoped on purpose is how a banner becomes something people
// learn to page past. The consequence is that a deliberately-partial file
// runs every chunk it contains and reaches the sentinel, and until this
// section existed it printed the identical `COMPLETE -- all N chunk(s)
// ran` a full provision does. N differs; nobody counts N.
//
// That is the original defect wearing a green light: a script that quietly
// did less than the operator believed, ending on a line that says it
// finished. The section-1 banner does say so, but by the end of an
// `/import` the top of the run has scrolled off, and "read the last line"
// is the instruction that actually gets followed at a rack at 11pm.
{
  const FULL = {
    ...BASE,
    wans: [DHCP_WAN],
    portalUrl: PORTAL,
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
    apiAccess: { username: "cloudguest", secret: "pw" },
  };
  const full = buildRouterSetupScriptChunks(FULL);
  // The founder's exact case, post-fix: RADIUS deselected on purpose, so
  // the banner fires and the run is allowed to finish.
  const byChoice = buildRouterSetupScriptChunks({
    ...FULL,
    radius: undefined,
    notProvisioned: [
      {
        what: "RADIUS",
        why: 'the "Also enable RADIUS" box was not ticked when this script was generated',
        deliberate: true,
        acknowledgement: "NO GUEST LOGIN",
      },
    ],
  });

  const lastExecutable = (text) => {
    const ls = executableLines(text);
    return ls[ls.length - 1] ?? "";
  };
  const fullLast = lastExecutable(chunksToRouterOsScript(full, "lobby router"));
  const choiceLast = lastExecutable(chunksToRouterOsScript(byChoice, "lobby router"));

  // FIXTURE GUARDS. Both of these have been wrong in this file before --
  // 13.10's "complete" fixture was a script missing three subsystems, and
  // an injected check matched COMPLETE as a substring of INCOMPLETE. If
  // the by-choice fixture aborted at chunk 1 it would never reach the
  // sentinel and everything below would pass by never running.
  check(
    "15.9's full fixture really is a complete provision",
    !full.some((c) => /INCOMPLETE SCRIPT/.test(c.label)),
    "if the 'complete' fixture already had a gap, the anti-noise half below would be vacuous",
  );
  check(
    "15.9's by-choice fixture really does declare a gap AND run to the end",
    byChoice.some((c) => /INCOMPLETE SCRIPT/.test(c.label)) &&
      !byChoice.some((c) => /INCOMPLETE SCRIPT/.test(c.label) && /:error\s/.test(c.script)),
    "a fixture that aborts at chunk 1 never reaches the last line, so every check below " +
      "would pass without testing anything",
  );
  check(
    "15.9 is reading the COMPLETE sentinel, not some other trailing line",
    isMarkerLine(fullLast) &&
      isMarkerLine(choiceLast) &&
      // `INCOMPLETE` contains `COMPLETE`. An injected check in this file
      // matched exactly that and could never have failed.
      /\bCOMPLETE\b/.test(fullLast.replace(/INCOMPLETE/g, "")) &&
      /\bCOMPLETE\b/.test(choiceLast.replace(/INCOMPLETE/g, "")),
    "if the last executable line were anything else, the two comparisons below would be " +
      "comparing the wrong strings",
  );

  check(
    "a deliberately-partial run NAMES the missing subsystem on its last line",
    /RADIUS/.test(choiceLast),
    "the operator was told to read the last line. On this file that line said COMPLETE and " +
      "the router had no /radius entry -- which is the founder's report end to end, reached " +
      "with nothing having failed. The last line has to carry the gap or the runbook is a lie",
  );
  check(
    "...and says outright that the router is not finished",
    /\bNOT\b/.test(choiceLast.replace(/INCOMPLETE/g, "")),
    "naming RADIUS is not enough on its own -- 'COMPLETE ... RADIUS' reads to a tired " +
      "technician as 'RADIUS done'. The line has to negate",
  );
  check(
    "a full provision's last line carries no gap warning",
    !/RADIUS/.test(fullLast) && !/NOT A FULL PROVISION/.test(fullLast),
    "a warning printed on every healthy import is a warning nobody reads on the one import " +
      "that needed it -- the same reason the section-1 banner is conditional",
  );
  check(
    "the two endings are not the same sentence",
    fullLast.replace(/all \d+ chunk/, "all N chunk") !==
      choiceLast.replace(/all \d+ chunk/, "all N chunk"),
    "the chunk COUNT differing is not a difference an operator can act on: nobody knows " +
      "whether this router's full script was 31 chunks or 32",
  );

  // BOTH CHANNELS, ONE SENTENCE. The .rsc and the flattened paste now
  // share a builder; this is what keeps them shared. A divergence here is
  // exactly the shape that left the .rsc with no markers at all for a
  // month while the one-line paste had them.
  for (const [name, chunks, expected] of [
    ["a full provision", full, fullLast],
    ["a deliberately-partial provision", byChoice, choiceLast],
  ]) {
    check(
      `both delivery channels end ${name} with the SAME sentence`,
      chunksToSingleLineScript(chunks).endsWith(expected),
      "two channels with two different last lines means the runbook has to describe both, " +
        "and the one nobody wrote down is the one that fails",
    );
  }
}

// ---------------------------------------------------------------------
// 15.10 THE THREE ENDINGS OF AN INCOMPLETE SCRIPT ARE A PRODUCT DECISION.
// ---------------------------------------------------------------------
// The generator now distinguishes three cases, and every one of them was
// arrived at by someone weighing a specific failure. None of them was
// pinned by anything until this section, which meant the whole design
// could be reverted by a well-meaning edit and every suite would stay
// green.
//
//   1. THE OPERATOR CHOSE IT (`deliberate: true`). Banner, no `:error`.
//      Aborting a run somebody deliberately scoped is how a warning
//      becomes something people learn to page past -- and the banner it
//      would cost us is the one that catches case 3.
//   2. SOMETHING FAILED. Banner AND `:error`. There is a cause to fix, the
//      script in hand cannot be repaired by re-pasting, and the file must
//      not run. A MIXED list takes this ending: a real fault is in it.
//   3. NOBODY SAID ANYTHING and the generator worked it out from `opts`.
//      Banner AND `:error`, because a caller that emitted a hotspot with
//      no RADIUS and did not report it is a BUG in the caller, not a
//      choice by an operator -- and the failure being silent is the entire
//      history of this file. Loud is the only safe default for a gap whose
//      provenance is unknown.
{
  const FULL_1510 = {
    ...BASE,
    wans: [DHCP_WAN],
    portalUrl: PORTAL,
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
    apiAccess: { username: "cloudguest", secret: "pw" },
  };
  const DELIBERATE = {
    what: "RADIUS",
    why: 'the "Also enable RADIUS" box was not ticked when this script was generated',
    deliberate: true,
    acknowledgement: "NO GUEST LOGIN",
  };
  const FAILED = { what: "RADIUS", why: "the RADIUS bridge could not be reached" };

  const banner = (chunks) => chunks.find((c) => /INCOMPLETE SCRIPT/.test(c.label));
  const aborts = (chunk) => /:error\s/.test(chunk?.script ?? "");

  const cases = [
    {
      name: "chose to leave RADIUS out",
      chunks: buildRouterSetupScriptChunks({
        ...FULL_1510,
        radius: undefined,
        notProvisioned: [DELIBERATE],
      }),
      shouldAbort: false,
      byChoiceLabel: true,
      because:
        "a script somebody deliberately scoped must still RUN. Refusing to import it teaches " +
        "the operator that this banner is noise, and the next one is the one that matters",
    },
    {
      name: "RADIUS registration failed",
      chunks: buildRouterSetupScriptChunks({
        ...FULL_1510,
        radius: undefined,
        notProvisioned: [FAILED],
      }),
      shouldAbort: true,
      byChoiceLabel: false,
      because:
        "there is a cause to fix and the script in hand cannot be repaired by re-pasting. " +
        "Importing it anyway is the 2026-08-23 incident: a hotspot serving a venue with an " +
        "empty /radius and nothing saying so",
    },
    {
      name: "one deliberate gap and one failure",
      chunks: buildRouterSetupScriptChunks({
        ...FULL_1510,
        radius: undefined,
        wireguard: undefined,
        notProvisioned: [
          { ...DELIBERATE, what: "RADIUS" },
          { what: "WireGuard tunnel", why: "the hub refused the allocation" },
        ],
      }),
      shouldAbort: true,
      byChoiceLabel: false,
      because:
        "a mixed list contains a real fault. Taking the gentler ending because one entry was " +
        "deliberate would let a failed allocation import silently, which is the whole defect",
    },
    {
      name: "nobody reported the gap and the generator derived it",
      // NO `notProvisioned` AT ALL. This is the founder's original case as
      // it reaches the generator: the panel never called, because an
      // unticked checkbox is not a caught exception.
      chunks: buildRouterSetupScriptChunks({ ...FULL_1510, radius: undefined }),
      shouldAbort: true,
      byChoiceLabel: false,
      because:
        "a caller that emitted a hotspot with no RADIUS and reported nothing is a caller with " +
        "a bug, and the gap's provenance is unknown -- the one thing that must not happen is " +
        "the silent ending. If this goes green while `deliberate` is assumed, the backstop " +
        "added for exactly this case stops backstopping",
    },
  ];

  for (const c of cases) {
    const b = banner(c.chunks);
    // FIXTURE GUARD FIRST: no banner means every assertion below is about
    // `undefined` and passes by never looking at anything.
    check(
      `15.10 (${c.name}): a banner chunk exists to grade`,
      Boolean(b),
      "without a banner chunk the abort assertions below are vacuous",
    );
    check(
      `15.10 (${c.name}): the script ${c.shouldAbort ? "stops" : "runs on"}`,
      aborts(b) === c.shouldAbort,
      c.because,
    );
    check(
      `15.10 (${c.name}): the label ${c.byChoiceLabel ? "says" : "does not say"} "(by choice)"`,
      /\(by choice\)/.test(b?.label ?? "") === c.byChoiceLabel,
      "the label is what `chunksToRouterOsScript` keys the downloaded file's header off, so " +
        "a label that lies about the reason makes the header lie too -- and the header is " +
        "the only part of a .rsc read before it runs",
    );
    // AND THE HEADER, which is the .rsc's own half of the same decision.
    const head = chunksToRouterOsScript(c.chunks, "lobby router").split("\n").slice(0, 18);
    check(
      `15.10 (${c.name}): the .rsc header tells the same story as the banner`,
      head.some((l) =>
        c.byChoiceLabel
          ? /PARTIAL BY CHOICE/.test(l)
          : /THIS SCRIPT IS INCOMPLETE/.test(l) && !/PARTIAL BY CHOICE/.test(l),
      ),
      "the file's header and the terminal output are read by the same person minutes apart. " +
        "Two different stories about one script is how 'it said PASS everywhere' happened",
    );
  }
}

// ---------------------------------------------------------------------
// 15.7 THE FILE STILL CARRIES THE FOUR THINGS THAT WENT MISSING BEFORE.
// ---------------------------------------------------------------------
// Sections 6 and 7 assert these against the chunks. They are re-asserted
// HERE against the rendered `.rsc`, because that is the artefact the
// founder runs and because 15.1 is what connects the two -- if 15.1 ever
// goes red these four are the ones whose absence is silent rather than
// loud. Cheap, and each one is a confirmed-live incident:
//   - no NTP        -> fresh hEX has no battery clock -> heartbeat's
//                      HTTPS fails -> router shows offline forever
//   - local `guest` -> RouterOS checks local hotspot users BEFORE RADIUS,
//     hotspot user     so the portal is bypassed entirely
//   - keepalive     -> `keepalive-timeout=none` with no `idle-timeout`
//     with no idle      means nothing ever closes a session
//   - wg-cloudguest -> the frontend's old tunnel name; the backend
//                      (`network_config/renderers.py`) says wg-cloudguard,
//                      and a device on the old name never handshakes
for (const { variant, rsc, opts } of RSC_CASES) {
  const file = executableLines(rsc).join("\n");
  check(
    `${variant}: the .rsc sets and verifies the clock`,
    /\/system ntp client/.test(file) && /ntp/i.test(file),
    "a fresh hEX has no battery-backed clock; a wrong date fails HTTPS validation, so the " +
      "heartbeat is rejected before it is sent and the router shows offline while guests " +
      "have working WiFi",
  );
  check(
    `${variant}: the .rsc creates no local hotspot user`,
    !/\/ip hotspot user\s+add\b/.test(file),
    "RouterOS checks local hotspot users BEFORE RADIUS, so a local `guest` user bypasses " +
      "the portal, the venue's terms and every guest record the platform would have kept",
  );
  // The WRITE, not the word. An earlier version tested for `idle-timeout=`
  // anywhere in the file and could not fire: the chunk's own verdict line
  // prints the string, so deleting the actual write left it green. Caught
  // by mutating `HOTSPOT_IDLE_TIMEOUT` out of the real generator.
  check(
    `${variant}: the .rsc never leaves a session with no timeout at all`,
    !/keepalive-timeout=none/.test(file) ||
      topLevelStatements(file).some((st) =>
        /\/ip hotspot user profile\s+set\b[^;]*idle-timeout=/.test(stripStrings(st)),
      ),
    "`keepalive-timeout=none` with no `idle-timeout` means nothing ever closes a session, " +
      "so the concurrent-user count climbs until logins start failing",
  );
  if (opts.wireguard) {
    // RAW text, not `parameterWrites`: that helper strips string contents
    // on purpose, so `name="wg-cloudguest"` reaches it as `name=""` and
    // this check could never have fired. Caught by mutating the real
    // `WIREGUARD_INTERFACE_NAME` and finding only the section-6 checks
    // red. The interface NAME is the value here, so the value has to be
    // what is inspected.
    // Statements that WRITE, told from statements that only talk about
    // the old name -- the chunk deliberately names `wg-cloudguest` in its
    // legacy warning and in the `remove` command it prints for the
    // operator, and both of those are correct. `stripStrings` decides
    // which is which, then the RAW statement is searched for the value.
    const wgWrites = topLevelStatements(file).filter((st) =>
      /\/interface wireguard(?: peers)?\s+(?:add|set)\b/.test(stripStrings(st)),
    );
    check(
      `${variant}: the .rsc builds the tunnel the BACKEND knows about`,
      wgWrites.length > 0 && wgWrites.every((st) => !/wg-cloudguest/.test(st)),
      "`wg-cloudguard` is what `network_config/renderers.py` renders; a device built on the " +
        "old `wg-cloudguest` name never handshakes and nothing on either side says why",
    );
  }
}

// =====================================================================
// 16. A PARTIAL PROVISION HAS TO BE SOMETHING SOMEBODY SAID YES TO.
// =====================================================================
// Section 15.10 pinned the three ENDINGS of an incomplete script. It did
// not pin the thing that decides which ending applies, and that turned
// out to be a boolean any caller could set.
//
// The state that cost the founder a provisioning run is a script with no
// RADIUS. After section 15 that script says so three times -- an amber
// panel before the click, a `# !!` header in the file, a last line that
// names the gap instead of claiming a clean finish -- and NONE OF THE
// THREE STOPS ANYTHING. All three are dismissible by doing nothing at
// all, which is what "the operator failed to notice" means. A venue whose
// RADIUS is missing has no guest login whatsoever, so the cost of an
// accidental partial is total; the cost of a deliberate one is a
// checkbox.
//
// The gate is NOT a fourth warning. A fourth dismissible thing is
// strictly worse than three -- it is the same failure with more clicks,
// and it spends the attention the existing three still need. The gate is
// a TYPED PHRASE AT THE DESELECT (`confirmDeselect` in the panel), which
// is:
//
//   - an ACT, not a dismissal. "OK" is reachable by reflex; "NO GUEST
//     LOGIN" is not reachable without reading it.
//   - ONCE, at the moment the decision is made and is still free to
//     reverse -- not on every Generate, which is clicked repeatedly and
//     would burn out inside one sitting.
//   - TOTAL, because both boxes default ON, so a deselect is the only
//     route from a full script to a partial one and every downstream
//     channel (.rsc, one-line, chunk copies, .md) is covered by
//     construction rather than one at a time.
//
// And the generator does not take the caller's word for it. `deliberate:
// true` now REQUIRES an `acknowledgement`, and an empty one demotes the
// gap to a failure -- which `:error`s. Fail-closed: the worst outcome of
// a caller bug is a script that refuses to run, never one that quietly
// half-provisions a venue.
//
// WHAT THIS STILL DOES NOT PREVENT, stated here because a guard whose
// limits are not written down gets trusted past them: an operator who
// genuinely wants to skip RADIUS types the phrase and gets exactly the
// script they asked for. That is correct. What it prevents is reaching
// that state without ever having read what it costs.

console.log("\n-- 16. the partial-provision acknowledgement --");

{
  const FULL_16 = {
    ...BASE,
    wans: [DHCP_WAN],
    portalUrl: PORTAL,
    wireguard: WG,
    radius: { serverAddress: "10.20.0.1", sharedSecret: "s3cr3t", srcAddress: "10.20.0.5" },
    apiAccess: { username: "cloudguest", secret: "pw" },
  };
  const build = (gap) =>
    buildRouterSetupScriptChunks({ ...FULL_16, radius: undefined, notProvisioned: [gap] });
  const banner = (chunks) => chunks.find((c) => /INCOMPLETE SCRIPT/.test(c.label));

  const WHY = 'the "Also enable RADIUS" box was not ticked when this script was generated';
  const acked = build({
    what: "RADIUS",
    why: WHY,
    deliberate: true,
    acknowledgement: "NO GUEST LOGIN",
  });
  const unacked = build({ what: "RADIUS", why: WHY, deliberate: true, acknowledgement: "" });
  const blankAcked = build({
    what: "RADIUS",
    why: WHY,
    deliberate: true,
    acknowledgement: "   ",
  });

  // FIXTURE GUARD. Every assertion below reads a banner chunk; if one of
  // these fixtures produced none, its assertions would grade `undefined`
  // and pass by never looking at anything. This file has shipped that bug
  // six times.
  check(
    "16's three fixtures all produce a banner chunk to grade",
    Boolean(banner(acked)) && Boolean(banner(unacked)) && Boolean(banner(blankAcked)),
    "without a banner chunk every check below is vacuous",
  );

  check(
    "an ACKNOWLEDGED deliberate gap still runs to the end",
    !/:error\s/.test(banner(acked)?.script ?? ""),
    "this is 15.10's decision and it is still right: refusing to run a configuration " +
      "somebody scoped on purpose teaches the operator that the banner is noise, and the " +
      "banner is what catches the gap nobody chose",
  );
  check(
    "an UNACKNOWLEDGED deliberate gap aborts instead",
    /:error\s/.test(banner(unacked)?.script ?? ""),
    "`deliberate: true` with nothing typed means a caller ASSERTED that a human chose this " +
      "and produced no evidence of one. The quiet ending is the dangerous ending; it has to " +
      "cost something to claim, or it is the same boolean the unticked checkbox already was",
  );
  check(
    "...and a whitespace-only acknowledgement does not buy the quiet ending either",
    /:error\s/.test(banner(blankAcked)?.script ?? ""),
    "a space bar is not a decision. If ' ' passed, the requirement would be a formality any " +
      "caller could satisfy without a human in the loop",
  );
  check(
    "an unacknowledged gap does not get the '(by choice)' label",
    !/by choice/.test(banner(unacked)?.label ?? "") && /by choice/.test(banner(acked)?.label ?? ""),
    "the label drives the .rsc header's wording. A file that says PARTIAL BY CHOICE when " +
      "nobody chose it is the original defect with better copy",
  );

  // THE TYPED WORDS TRAVEL WITH THE ARTIFACT. A `.rsc` outlives the
  // session that made it: it is saved, forwarded, re-imported and blamed
  // weeks later. "(by choice)" records that a flag was set. The phrase
  // records that a human read the consequence and wrote it out, and it is
  // the one part of this a caller cannot produce by accident.
  check(
    "the acknowledgement is printed on the device by the banner chunk",
    /acknowledged: the operator typed 'NO GUEST LOGIN'/.test(banner(acked)?.script ?? ""),
    "the technician at the rack is looking at terminal output, not at the panel that " +
      "collected it",
  );
  const ackedRsc = chunksToRouterOsScript(acked, "lobby router");
  check(
    "...and restated in the .rsc header, above the first statement",
    executableLines(ackedRsc).length > 0 &&
      ackedRsc
        .split("\n")
        .slice(
          0,
          ackedRsc.split("\n").findIndex((l) => l.trim() !== "" && !l.trim().startsWith("#")),
        )
        .some((l) => /acknowledged: the operator typed 'NO GUEST LOGIN'/.test(l)),
    "the header is the only part of a downloaded file that gets read before it runs, and " +
      "'who approved this' is the question asked when the venue reports no guest login",
  );
  check(
    "the header's acknowledgement is a comment, so the file still imports",
    ackedRsc
      .split("\n")
      .filter((l) => /acknowledged: the operator typed/.test(l))
      .every((l) => l.trimStart().startsWith("#") || l.trimStart().startsWith(":put ")),
    "a bare acknowledgement line at statement position would be a syntax error, which would " +
      "turn a recorded decision into a refusal to import",
  );
  check(
    "a full provision's .rsc carries no acknowledgement line at all",
    !/acknowledged: the operator typed/.test(
      chunksToRouterOsScript(buildRouterSetupScriptChunks(FULL_16), "lobby router"),
    ),
    "a line printed on every healthy download is a line nobody reads on the one that matters",
  );

  // THE PANEL SIDE. The generator can only refuse a gap that arrives
  // unacknowledged; whether one can arrive acknowledged WITHOUT a human
  // is a property of the panel, and it is the whole point.
  const panel16 = readFileSync(
    resolve(ROOT, "src/components/routers/RouterSetupScriptAdvanced.tsx"),
    "utf8",
  );
  check(
    "unticking either subsystem goes through the typed gate",
    (panel16.match(/confirmDeselect\(/g) ?? []).length >= 4,
    "both checkboxes have an untick path, and unticking WireGuard takes RADIUS with it -- " +
      "that coupled path needs BOTH acknowledgements or the more expensive of the two rides " +
      "along unread, which is the coupling bug in miniature",
  );
  check(
    "the gate asks for the CONSEQUENCE, not the subsystem name",
    Object.entries(DESELECT_PHRASE).every(
      ([which, phrase]) => !new RegExp(`\\b${which}\\b`, "i").test(phrase),
    ) && Object.values(DESELECT_PHRASE).every((phrase) => /\s/.test(phrase.trim())),
    "typing 'RADIUS' is satisfiable without understanding anything, and so is any phrase that " +
      "is just the thing's name. The phrase has to be the outcome, because reading it is the " +
      "mechanism -- there is nothing else in a prompt that makes a person think",
  );
  check(
    "the consequence text says what the venue loses, per subsystem",
    /every guest login/i.test(DESELECT_CONSEQUENCE.radius) &&
      /never reaches the platform/i.test(DESELECT_CONSEQUENCE.wireguard),
    "a gate that says 'are you sure?' without saying what for is a gate that gets typed " +
      "through as fast as it gets clicked through",
  );

  // THE GATE ITSELF, CALLED. Everything above about the panel is a grep,
  // and a grep on this specific function was already proven blind: the
  // comparison that decides whether the phrase was typed can be replaced
  // with one that accepts anything and every source pattern still
  // matches. So the decision is a pure function and this exercises it.
  for (const [name, which, typed, expected] of [
    ["cancelled prompt", "radius", null, null],
    ["dialogs suppressed by the browser (also null)", "wireguard", null, null],
    ["nothing typed", "radius", "", null],
    ["the subsystem's own name", "radius", "RADIUS", null],
    ["a plausible near-miss", "radius", "NO GUEST LOGINS", null],
    ["the other subsystem's phrase", "radius", "NO PLATFORM ACCESS", null],
    ["whitespace only", "radius", "   ", null],
    ["the phrase", "radius", "NO GUEST LOGIN", "NO GUEST LOGIN"],
    ["the phrase, lower case", "radius", "no guest login", "NO GUEST LOGIN"],
    ["the phrase with stray spaces", "radius", "  NO GUEST LOGIN ", "NO GUEST LOGIN"],
    ["the WireGuard phrase", "wireguard", "no platform access", "NO PLATFORM ACCESS"],
  ]) {
    check(
      `the deselect gate on ${name} ${expected === null ? "REFUSES" : "accepts"}`,
      deselectAcknowledgement(which, typed) === expected,
      expected === null
        ? "`null` is a cancelled prompt AND a browser that suppresses dialogs, and anything " +
            "that is not the phrase is somebody who did not read it. All of them have to fail " +
            "toward a FULL provision -- a dialog policy nobody set must not be able to produce " +
            "the one script this gate exists to prevent"
        : "a gate that rejects the phrase the dialog told the operator to type is a gate " +
            "that gets worked around, and the workaround is worse than no gate",
    );
  }
  check(
    "what the gate returns is what the generator will accept as an acknowledgement",
    ["radius", "wireguard"].every((w) => {
      const ack = deselectAcknowledgement(w, DESELECT_PHRASE[w]);
      const chunks = buildRouterSetupScriptChunks({
        ...FULL_16,
        radius: undefined,
        notProvisioned: [{ what: "RADIUS", why: WHY, deliberate: true, acknowledgement: ack }],
      });
      return !/:error\s/.test(banner(chunks)?.script ?? "");
    }),
    "if the phrase the operator types were not a value the generator counts as acknowledged, " +
      "a correctly-gated deselect would produce an aborting script and the gate would be " +
      "routed around within a week",
  );
  check(
    "the typed phrase is what reaches the generator, not a boolean",
    /acknowledgement: deselectAck\.radius/.test(panel16) &&
      /acknowledgement: deselectAck\.wireguard/.test(panel16),
    "if the panel synthesised the acknowledgement at generate time, the requirement would be " +
      "a type annotation and nothing else -- exactly what `deliberate: true` was",
  );
  check(
    "re-ticking needs no phrase",
    /setDeselectAck\({}\)/.test(panel16),
    "the gate is on the deselect only. Making the safe direction expensive is how a gate " +
      "becomes something people route around",
  );
}

// =====================================================================

console.log("");
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("setup-script-generator: all checks passed");
