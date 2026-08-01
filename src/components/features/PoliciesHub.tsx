import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Users, UserCog, Smartphone, Ban, CheckCircle, Layers } from "lucide-react";
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
// "Usage Limits" caps bandwidth/session/data per Business Unit, "Guest
// Access" is per-guest allow/block/PIN control, "Access Tiers" is the
// bandwidth/limit package guests get mapped into -- deliberately not
// "Guest Groups" (a real, different feature already has that name in the
// sidebar, ManageTeamsPage.tsx's staff/shared-account teams).
const POLICIES_TABS = [
  { id: "location", label: "Usage Limits", icon: Shield },
  { id: "user", label: "Guest Access", icon: Users },
  { id: "group", label: "Access Tiers", icon: Layers },
];

const USER_SUB_TABS = [
  { id: "block", label: "Blocked Guests", icon: Ban },
  { id: "whitelist", label: "Always Allowed", icon: CheckCircle },
  { id: "smartid", label: "Sign-in Methods", icon: Smartphone },
];

export default function PoliciesHub({ locationId }: { locationId?: string } = {}) {
  const [tab, setTab] = useState("location");
  const [userTab, setUserTab] = useState("block");

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

      {/* Main policy tabs -- segmented pill control matching the established
       * pattern (e.g. Users page's status tabs), replacing the old raw
       * slate-ring boxed-tab look. Active tab now carries the brand accent
       * instead of a flat neutral fill, so it reads as selected at a
       * glance, matching the sub-tab treatment below it. */}
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-[400px] w-full gap-1 rounded-lg border bg-muted/50 p-0.5 sm:w-auto">
          {POLICIES_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-[#4f46e5]/10 text-[#4f46e5] shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Policies sub-tabs -- Blocked Guests and Always Allowed are
       * opposite ends of the same guest-access decision (deny vs. skip the
       * portal entirely), but until now both tabs carried the identical
       * indigo "active" treatment as Sign-in Methods, so nothing in the UI
       * signaled that relationship. Recolored to the rose/emerald pair
       * GuestBadges.tsx and OperationsFeatures.tsx already use everywhere
       * else for exactly these two states ("blocklist"/"whitelist",
       * "blocked"), and carried through to the status pills in the tables
       * below and the header illustration above -- one consistent color
       * story instead of three unrelated pieces. Sign-in Methods isn't a
       * restrict/permit list, so it keeps the neutral brand-indigo tab
       * styling used across the rest of this page. */}
      {tab === "user" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-rose-600 dark:text-rose-400">Blocked Guests</span> are refused a connection until unblocked.{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Always Allowed</span> guests skip the portal automatically.
          </p>
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-[300px] w-full gap-1 rounded-lg border bg-muted/50 p-0.5 sm:w-auto">
              {USER_SUB_TABS.map((t) => {
                const Icon = t.icon;
                const active = userTab === t.id;
                const activeClasses =
                  t.id === "block" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                  t.id === "whitelist" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                  "bg-[#4f46e5]/10 text-[#4f46e5]";
                return (
                  <button key={t.id} onClick={() => setUserTab(t.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? activeClasses : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <Icon className="h-4 w-4" />{t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === "location" && <LocationPolicies locationId={locationId} />}
      {tab === "user" && userTab === "block" && <BlockUsers locationId={locationId} />}
      {tab === "user" && userTab === "whitelist" && <WhiteList locationId={locationId} />}
      {tab === "user" && userTab === "smartid" && <SmartIdPage locationId={locationId} />}
      {tab === "group" && <CreateGroup locationId={locationId} />}
    </div>
  );
}
