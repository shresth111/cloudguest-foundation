import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Smartphone, Ban, CheckCircle, Layers } from "lucide-react";
import LocationPolicies from "./LocationPolicies";
import BlockUsers from "./BlockUsers";
import WhiteList from "./WhiteList";
import SmartIdPage from "./SmartIdPage";
import CreateGroup from "./CreateGroup";

/**
 * Header-accent illustration for the "Access Rules" page. Replaces the old
 * three-nodes-into-a-shield diagram (which read as "three tabs", not as
 * what this feature actually does) with the literal concept a venue owner
 * cares about: one guest let through, one guest stopped, a shield
 * deciding between them. Same filled-flat-shape character language and
 * dark-violet/lavender palette as this session's other illustrations
 * (AlertsIllustration, BlockedAccessIllustration, etc.), but now borrows
 * the rose/emerald pair that GuestBadges.tsx and OperationsFeatures.tsx
 * already use for "blocklist"/"whitelist" everywhere else in this exact
 * feature, so the color coding here isn't invented -- it's the same one
 * carried through to the Guest Access sub-tabs and status pills below.
 * Kept compact and inline with the header row (not a full hero band) --
 * this page's real content (three dense policy-config tabs) needs the
 * vertical space. Purely decorative -- aria-hidden. Entrance fades and the
 * "stopped" badge's pulse both respect useReducedMotion.
 */
function PolicyShieldIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 84 56" className="hidden h-14 w-auto shrink-0 sm:block" fill="none">
      {/* center shield -- the same access-control glyph as the header icon */}
      <path d="M42 6c6 2.6 10.5 2.6 10.5 2.6v11.5c0 8-4.5 13-10.5 15.9-6-2.9-10.5-7.9-10.5-15.9V8.6S36 8.6 42 6z" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M37 19.5l3.5 3.5 7-7" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* left: guest let through, path leading in */}
      <motion.g
        initial={shouldReduceMotion ? false : { x: 4, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <circle cx="12" cy="27" r="4.2" fill="#241f4d" stroke="#10b981" strokeWidth="1.3" />
        <path d="M6 44c0-5 2.7-8.5 6-8.5s6 3.5 6 8.5" fill="#241f4d" stroke="#10b981" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="19.5" cy="38" r="5.5" fill="#10b981" fillOpacity="0.16" />
        <path d="M16.8 38l1.8 1.8 3.4-3.6" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <motion.path
        d="M23 29h7"
        stroke="#10b981" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 4"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      />

      {/* right: guest stopped short of the shield */}
      <motion.g
        initial={shouldReduceMotion ? false : { x: -4, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      >
        <circle cx="72" cy="27" r="4.2" fill="#241f4d" stroke="#fb7185" strokeWidth="1.3" />
        <path d="M66 44c0-5 2.7-8.5 6-8.5s6 3.5 6 8.5" fill="#241f4d" stroke="#fb7185" strokeWidth="1.3" strokeLinecap="round" />
        <motion.g
          animate={shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] }}
          transition={shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="62.5" cy="38" r="5.5" fill="#1e1b4b" stroke="#fb7185" strokeWidth="1.6" />
          <path d="M60.1 35.6l4.8 4.8M64.9 35.6l-4.8 4.8" stroke="#fb7185" strokeWidth="1.8" strokeLinecap="round" />
        </motion.g>
      </motion.g>
      <path d="M53 29h8" stroke="#fb7185" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 3" />
    </svg>
  );
}

// Renamed from generic/technical "Location Policies"/"User Policies"/
// "Group Policies" -- none of those said what they actually configure. Each
// new name matches what the tab does in the venue-owner's own words:
// "Guest WiFi Limits" caps bandwidth/session/data per Business Unit (kept in
// sync with LocationPolicies.tsx's own card titles after real-customer
// feedback that "Usage Limits" didn't read as clearly), the "Guest Access"
// trio is per-guest allow/block/sign-in control, "Access Tiers" is the
// bandwidth/limit package guests get mapped into -- deliberately not
// "Guest Groups" (a real, different feature already has that name in the
// sidebar, ManageTeamsPage.tsx's staff/shared-account teams).
//
// Flattened to one tab level after owner feedback that a "Guest Access"
// top-level tab containing its own Blocked Guests/Always Allowed/Sign-in
// Methods sub-tabs read as tabs nested inside tabs -- two visually
// near-identical pill bars stacked, so it was never obvious which level a
// click landed in. There's no real hierarchy being lost by flattening:
// each of these 5 destinations is already a fully self-contained page with
// its own icon-badge header (see BlockUsers.tsx/WhiteList.tsx/
// SmartIdPage.tsx/CreateGroup.tsx's own `<h1>`), so "Guest Access" was a
// navigation-only grouping, not a shared piece of content. That grouping
// is now carried by adjacency and by the same rose/blocked · emerald/
// allowed color coding the sub-tabs already used (see GuestBadges.tsx /
// OperationsFeatures.tsx), plus a static divider on either side of the
// trio -- a visual hint, not a second clickable layer.
const ACCESS_TABS = [
  { id: "location", label: "Guest WiFi Limits", icon: Shield, tone: "indigo" as const },
  { id: "block", label: "Blocked Guests", icon: Ban, tone: "rose" as const },
  { id: "whitelist", label: "Always Allowed", icon: CheckCircle, tone: "emerald" as const },
  { id: "smartid", label: "Sign-in Methods", icon: Smartphone, tone: "indigo" as const },
  { id: "group", label: "Access Tiers", icon: Layers, tone: "indigo" as const },
];

const TAB_ACTIVE_CLASSES: Record<(typeof ACCESS_TABS)[number]["tone"], string> = {
  indigo: "bg-[#4f46e5]/10 text-[#4f46e5] shadow-sm",
  rose: "bg-rose-500/10 text-rose-600 shadow-sm dark:text-rose-400",
  emerald: "bg-emerald-500/10 text-emerald-600 shadow-sm dark:text-emerald-400",
};

// Tabs right before/after this pair of ids get a static divider next to
// them -- the "Guest Access" trio (block/whitelist/smartid) reads as one
// visual group between "Guest WiFi Limits" and "Access Tiers" without
// needing its own tab level to say so.
const DIVIDER_BEFORE = new Set(["block", "group"]);

export default function PoliciesHub({ locationId }: { locationId?: string } = {}) {
  const [tab, setTab] = useState("location");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Shield className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Access Rules</h1>
            <p className="text-sm text-muted-foreground">Set usage limits, guest access, and access tiers for this location.</p>
          </div>
        </div>
        <PolicyShieldIllustration />
      </div>

      {/* One flat row, one click away from any of the 5 real sections --
       * no second tab level underneath it. `relative` wrapper + a
       * right-edge fade: at narrow widths this row is wider than the
       * viewport (min-w-[600px] so five tabs never get too cramped) and
       * silently clips "Access Tiers" at the screen edge with
       * `overflow-x-auto`'s scrollbar being the only -- easy to miss on
       * touch devices -- hint that there's more to swipe to. The fade is a
       * static visual affordance (no scroll-position tracking), so it
       * stays visible even once fully scrolled right; a small tradeoff for
       * not needing a scroll listener for what's otherwise an edge case at
       * the very narrowest widths. */}
      <div className="relative">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-[600px] w-full items-center gap-1 rounded-lg border bg-muted/50 p-0.5 sm:w-auto">
            {ACCESS_TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <div key={t.id} className="flex flex-1 items-center">
                  {DIVIDER_BEFORE.has(t.id) && <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />}
                  <button onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active ? TAB_ACTIVE_CLASSES[t.tone] : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <Icon className="h-4 w-4" />{t.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>

      {/* Content -- each of these already renders its own full header
       * (icon badge + title + description), so this shell adds nothing
       * more than the tab row above it. */}
      {tab === "location" && <LocationPolicies locationId={locationId} />}
      {tab === "block" && <BlockUsers locationId={locationId} />}
      {tab === "whitelist" && <WhiteList locationId={locationId} />}
      {tab === "smartid" && <SmartIdPage locationId={locationId} />}
      {tab === "group" && <CreateGroup locationId={locationId} />}
    </div>
  );
}
