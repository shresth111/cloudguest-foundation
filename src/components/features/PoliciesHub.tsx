import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Users, UserCog, Smartphone, Ban, CheckCircle, Layers } from "lucide-react";
import LocationPolicies from "./LocationPolicies";
import BlockUsers from "./BlockUsers";
import WhiteList from "./WhiteList";
import SmartIdPage from "./SmartIdPage";
import CreateGroup from "./CreateGroup";

/**
 * Small header-accent illustration: a shield watching over three small
 * nodes (location / user / group -- exactly this page's three tabs), same
 * filled-flat-shape character language as the other illustrations shipped
 * this session. Kept compact and inline with the header row rather than a
 * full hero band -- this page's real content (three dense policy-config
 * tabs) needs the vertical space, so personality lives in a small corner
 * accent instead. Purely decorative -- aria-hidden.
 */
function PolicyShieldIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const nodes = [
    { x: 16, y: 10, color: "#22d3ee" },
    { x: 66, y: 6, color: "#f0abfc" },
    { x: 66, y: 46, color: "#a78bfa" },
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 84 56" className="hidden h-14 w-auto shrink-0 sm:block" fill="none">
      {nodes.map((n, i) => (
        <motion.line
          key={i}
          x1="42" y1="28" x2={n.x} y2={n.y}
          stroke={n.color} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="1 4" strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="4" fill={n.color} opacity="0.85" />
      ))}
      <path d="M42 8c7 3 12 3 12 3v13c0 9-6 15-12 18-6-3-12-9-12-18V11s5 0 12-3z" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M36 27l4 4 8-8" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* User Policies sub-tabs */}
      {tab === "user" && (
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-[300px] w-full gap-1 rounded-lg border bg-muted/50 p-0.5 sm:w-auto">
            {USER_SUB_TABS.map((t) => {
              const Icon = t.icon;
              const active = userTab === t.id;
              return (
                <button key={t.id} onClick={() => setUserTab(t.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-[#4f46e5]/10 text-[#4f46e5]" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
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
