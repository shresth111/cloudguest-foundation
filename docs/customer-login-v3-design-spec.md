# Customer Login — v3 Design Spec

**Verdict up front:** this page does not need a rebuild. It needs one thing removed. The structural bones — dark hero / light form split, role picker, `HeroWifiIllustration`, `CountUp` stats, the credentials form — are sound and stay untouched. The one genuine, evidence-backed problem is the Aurora backdrop landed this morning in PR #74: it's internally inconsistent with this exact login flow's own forgot-password screen (which explicitly rejected this same visual motif, in writing, in the code), it reads as busy diagonal striping rather than an atmospheric glow when actually looked at live, and it's the specific effect the wider industry is now naming as a tell for template-generated UI. Revert the backdrop layer to the plain static-glow treatment the rest of this app's auth surfaces already use. That's the whole brief.

---

## 0. How this doc was produced, and a process finding that matters

Before touching design opinions: **local `main` was 16 commits behind `origin/main`** when this task started, missing PR #74 (Aurora), PR #73 (master-login forgot-password), and the entire captive-portal v3/v4/v5 line the brief asked me to check against. I reset local `main` to `origin/main` (verified the one local-only commit was a near-duplicate of an already-merged one, `git diff` showed a 13-line delta) before reading anything, so everything below is against the real current state, not a stale checkout.

Second, chasing down the two docs this brief told me to read surfaced a real, recurring problem in this repo, not a one-off:

- **`docs/design-v3-unified-system-spec.md` does not exist anywhere in this repository's history — on `main`, on any branch, ever.** It's cited by name in PR #74's own commit message ("Per `design-v3-unified-system-spec.md` Part 6...") as the rationale for treating this page as a narrow upgrade rather than a rebuild, but the file itself was never committed. I can't confirm or contradict what it says because it isn't there to read. Treat any future reference to it as unverifiable until someone actually writes and commits it.
- **`docs/captive-portal-v5-design-spec.md` and `docs/captive-portal-v4-design-spec.md` existed only on unmerged branches** (`docs/captive-portal-v5-design-spec` @ `b52c10e`, `docs/captive-portal-v4-design-spec` @ `56c5f98`), never on `main` — despite the PRs that *implement* each spec (`#81` for v4, `#88` for v5) being merged. This is exactly the "lost the captive-portal spec" failure mode this task's own brief warned me not to repeat. I've pulled both files into `main` alongside this doc (see the commit for this change) so they stop being orphaned. I read the v5 one in full; it's cited throughout §3 below.

This matters for how much weight to put on "per the v3 spec, Part 6" as a justification for anything on this page: that citation currently points at nothing. What *is* real and checkable is the git history and the live page, so that's what this doc is built on instead.

---

## 1. Real design history on this exact file (`src/routes/login.tsx`)

```
21a475c Customer login: swap hand-rolled backdrop glow for Aceternity Aurora Background (#74)   ← today, this is the thing in question
b073197 Rename 'Agent' to 'Staff' in the login page's role picker
2ab78b5 Polish customer dashboard chrome: sidebar, palette, hero height, card depth, metric context
2d32e05 Use the real original brand mark file again instead of a hand-recreated inline SVG
7d6561b Revert logo signal arcs to white, keep only the blink-dot green
fe2a664 Tint login page's logo signal arcs emerald, matching the online-status dot
4a9b45c Add blinking online-status dot to login logo
a3d486e Rebrand: rename ZIP WiFi to Wyfy Guest across user-visible text
cc171dc Auth pages redesign: dark identity + real Azure/AWS trust badges + AdvancedPage fix
242ecd2 Pin the login form panel to the light palette regardless of OS theme
ea6aa74 Match login page hero to the new dark indigo/violet visual identity
f8f7c94 Sign-in page: add motion polish to the existing layout
```

Two things worth being precise about, because the task brief's framing doesn't quite match what happened:

**There was no separate "v3 flattening pass" on this file.** The flattening/de-bloat work referenced in project history — "removed heavy gradients/glass-card/AmbientGlow, dropped unnecessary framer-motion, system-font stack" — happened on **other** surfaces today: `71b2414` ("Captive portal: v3 polish — flatten last gradient/glass remnants, drop redundant framer-motion", #77) and `58cbdee` ("Design v3: customer dashboard (Part 4) — Magic UI/Aceternity accents", #76). `src/routes/login.tsx` was not touched by either. So this page's only "v3 pass" is literally PR #74 — one decorative backdrop swap on top of the same dark-gradient, full-framer-motion hero that's been in place since `ea6aa74`/`cc171dc`. **This is the real gap**: master-login got a working forgot-password flow built for it today (#73), captive portal got three successive rebuilds today (v3/v4/v5, #77/#81/#88) each grounded in a founder complaint and a live audit — and this page got a backdrop swap. Not "needs a rebuild too" — but it is the one auth surface that's had zero structural attention today, only ornamental attention.

**PR #74's own commit message already frames this correctly**, and I'm not contradicting it: *"this login page ... was already a working, on-brand hero ... needing one narrow upgrade, not a rebuild."* I agree with that framing. I disagree with the specific upgrade it made — see §2.

---

## 2. What's actually wrong — checked live, not asserted

Screenshotted `https://app.wyfyguest.com/login` directly (2026-08-19).

### 2a. The Aurora backdrop is internally inconsistent with its own flow, in a way the code itself already flags as a mistake

`login.tsx`'s "Forgot password?" link doesn't navigate — it swaps `<ForgotPasswordPage>` (which renders `AuthLayout`, `src/components/auth/AuthLayout.tsx`) into the same hero/form split, in place, no URL change. I clicked it live. The backdrop **visibly changes** the instant you do:

| | Login form (`login.tsx`) | Forgot-password (`AuthLayout.tsx`) |
|---|---|---|
| Backdrop | Aceternity Aurora — animated `mix-blend-difference` sweep, diagonal `repeating-linear-gradient` stripes in cyan/violet/purple | Two static `blur-3xl` circles (fuchsia top-right, cyan bottom-left) + faint dot-grid |
| Why | PR #74, this morning | Unchanged since `cc171dc` |

`AuthLayout.tsx` line 16-18 carries this exact comment, written before today's PR #74:

> *"Same dark indigo/violet/fuchsia identity as login.tsx's hero and the customer dashboard's hero band — was previously a teal/cyan **"aurora" wash that didn't match the rest of the redesigned product**."*

That is a **documented, in-code rejection of an aurora-style backdrop on this exact adjacent surface**, written by this same codebase, and it's still true and still shipped on `AuthLayout`. PR #74 then put a (different, but same-genre) aurora effect back on `login.tsx` a comment away in the same login flow, without touching or reconciling that comment. The result, live: a visitor who clicks "Forgot password?" gets a visible backdrop **jump-cut** — same panel position, same copy tone, same "Wyfy Guest" wordmark, different decorative treatment for no experiential reason. That's not a matter of taste; it's the same component tree failing to agree with itself, mid-flow, and the fix for it is already spelled out in a comment a few keystrokes away.

`master-login.tsx` (today's #73 forgot-password work) independently corroborates this: it also uses the plain static-blob + `.aurora-grid`/`.aurora-blob-1`/`.aurora-blob-2` treatment (not the Aceternity sweep), same as `AuthLayout`. **Three of this app's four auth-adjacent hero panels — master-login, forgot-password, reset-password/verify-otp (all via `AuthLayout`) — use the plain static-glow treatment. Only `login.tsx`, as of this morning, uses the animated sweep.** PR #74 didn't bring this page in line with a more-refined product; it made it the odd one out.

### 2b. As implemented, it doesn't read as an aurora — it reads as stripes

Looked at the actual live render, not the code's intent: the `repeating-linear-gradient(100deg, ...)` base plus a `mix-blend-difference` sweep produces visible **diagonal banding** — closer to a barcode or an interference pattern than the soft, organic atmospheric drift "aurora" backgrounds are supposed to evoke. It's not a rendering bug; it's what this specific technique does at this specific opacity/blur tuning against this specific dark-purple base. The comment block in `login.tsx` (lines 274-292) describes it as "dialed down in opacity/blur to stay a backdrop rather than compete with the credentials form" — but the striping is still the dominant visual event on the page's left half, more noticeable than the illustration or the copy it's supposed to sit behind.

### 2c. This is now a named industry tell, not a private taste opinion

Searched for how this specific component is being talked about in 2026, since it's exactly the kind of external-validation check the recent captive-portal v5 spec modeled (real research, not vibes):

- A 2026 comparison of animated-component libraries ([PkgPulse, "react-bits vs Aceternity UI vs Magic UI 2026"](https://www.pkgpulse.com/guides/react-bits-animated-components-2026)) states plainly that heavy use of Aceternity's effects — **explicitly including a glowing swept-light background on a card** — has become recognizable enough that it reads as *"template-like,"* and that this recognizability is driving developers toward alternative libraries specifically to avoid it.

That's the same critique the v5 captive-portal spec leveled at this codebase's *own* prior over-decoration (glass cards, ambient glow, ["10 Best WiFi Splash Page Examples"](https://www.purple.ai/en-us/guides/the-10-best-wifi-splash-page-examples-and-what-makes-them-work) et al. cited there) — applied here to a different vendor, same underlying failure mode: reaching for a recognizable off-the-shelf effect instead of asking whether this specific page needs decoration at all.

### 2d. What's genuinely fine and shouldn't move

Checked against this specifically so I don't manufacture problems: the credentials form's token discipline is already consistent — `h-11` (44px) inputs/button sit exactly at the WCAG/Purple 44×44px floor the v5 portal spec cites, `rounded-xl` is used uniformly (no `rounded-3xl`/`rounded-2xl` mismatch the way the pre-v5 portal card had), the role-selector's `layoutId="role-active"` spring transition and the entrance stagger on the credentials column are restrained, not showy. The wide-viewport whitespace on the light panel is a pattern shared identically by `master-login.tsx` and `AuthLayout.tsx` (same `max-w-sm`/`max-w-md` centered column) — it's a deliberate, consistent choice across every auth surface in this app, not a `login.tsx`-specific defect, and it's directionally the same "smaller card, more real negative space" instinct the v5 captive-portal spec argues *for* (§3 there: a merged card "confined to genuinely negative (visually quiet) space" beats over-filling it). I'm not recommending touching layout density here — doing so would be an unscoped, platform-wide call this single-page brief has no business making unilaterally.

---

## 3. Where this leaves "should this get the v5 treatment"

Short answer: **the *backdrop* should inherit v5's actual lesson, not v5's tokens.** The lesson (confirmed by reading the recovered `docs/captive-portal-v5-design-spec.md` in full, §0-§2) isn't "add more polish" — it's the opposite: two of the three portal design rounds this year over-corrected by *adding* a structural element (a wash panel, in that case) before checking whether the simpler, already-proven treatment was right there in the same codebase. Round 2 there is the direct analogue of what happened here today: a documented-good pattern existed one file away (`GUEST_LEGIBILITY_CARD_CLASS`, there; `AuthLayout`'s static-blob backdrop, here) and got overridden by a fancier mechanism, which then had to be walked back. v5's actual throughline — *"the axis that was wrong was coverage/novelty, not restraint"* — is the argument for reverting `login.tsx`'s backdrop to match its siblings, not for porting v5's `--pg-*` token values onto a page whose component-level tokens (§2d) are already sound.

The token-level checks I ran (radius, input height, spacing) came back clean, so there's no hidden `--pg-*`-style debt here to pay down. This page's v3 gap is exactly one layer: the backdrop, and exactly one file: where it lives.

---

## 4. FE build brief

**Scope: one file's backdrop layer, plus its now-orphaned CSS. Nothing else in `login.tsx` changes.**

1. **`src/routes/login.tsx` (lines ~274–313)** — delete the Aceternity Aurora backdrop block (the `aria-hidden` wrapper carrying `--aurora`/`--dark-gradient` custom properties and the `.login-aurora after:animate-aurora` div) and its explanatory comment. Replace with the exact static treatment `AuthLayout.tsx` (lines 20-27) already uses:
   ```tsx
   <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-500/25 blur-3xl" />
   <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
   ```
   This is a straight revert to what shipped in `cc171dc`/`ea6aa74` and is still live today on `AuthLayout` and (via its own `.aurora-blob-*`/`.aurora-grid` classes) `master-login.tsx` — zero new risk, restores consistency across all four auth-adjacent hero panels in one move.

2. **Worth doing in the same pass, not a separate follow-up: extract this into one shared component** (e.g. `src/components/auth/AuthHeroBackdrop.tsx`) that `login.tsx`, `AuthLayout.tsx`, and `master-login.tsx` all call. Today there are three independent hand-authored copies of visually-the-same treatment (`login.tsx`'s inline divs pre-#74, `AuthLayout.tsx`'s inline divs, `master-login.tsx`'s `.aurora-blob-1`/`.aurora-blob-2`/`.aurora-grid` classes) — that's exactly the kind of drift that let PR #74 silently break consistency with a sibling file nobody re-checked. One shared component makes that class of mistake structurally harder to make a second time. If this feels like scope creep for one PR, it's still worth a follow-up ticket — flagging here so it isn't lost the way the design docs were.

3. **`src/styles.css`** — remove the now-unused `--animate-aurora` theme token (line 103), the `aurora` keyframe (line 477), and the `.login-aurora`/`.login-aurora::after` reduced-motion guard (lines 507-508 area). Confirmed via `grep -rl "animate-aurora|aurora-background|login-aurora" src/` that `login.tsx` is the *only* consumer of these three — safe to delete outright, not just orphan. Leave `.aurora-blob-1/2/3` and `.aurora-grid` alone; `master-login.tsx` and (indirectly) `AuthLayout.tsx`'s visual language still depend on that naming even though `AuthLayout.tsx` itself inlines the values rather than using the classes.

4. **`src/components/ui/aurora-background.tsx`** — the installed Aceternity primitive file itself. Leave it in the repo (harmless, unused dead code, zero runtime cost) rather than deleting in this pass — if a future page has a real reason to reach for it deliberately, no need to reinstall. Not worth a special cleanup commit on its own.

5. **Explicitly do not touch:** `HeroWifiIllustration`, `CountUp`, the role selector and its `layoutId` spring, the credentials form and its validation, the must-change-password dialog, the demo-request dialog, `ForgotPasswordPage`'s own internals beyond what §4.1 already covers, or any auth/login logic. This mirrors PR #74's own "untouched" list — I'm continuing that discipline, not reversing it wholesale.

**Net effect:** the login page's hero goes back to looking like the rest of this app's auth surfaces — because as of this morning, it's the one that doesn't.

---

## 5. Hand-off boundary

This is a Visual/backdrop-only call, same division of labor the captive-portal v3/v4/v5 docs modeled. If a UI/UX Engineer or the founder wants a genuine structural pass on this page later (new copy, a different stat set, a different illustration subject) that's a separate brief — nothing here should be read as blocking that. What this brief blocks is specifically: don't reach for another off-the-shelf decorative primitive on this page without first checking what its own sibling auth surfaces already do, because that check is what was skipped this morning.
