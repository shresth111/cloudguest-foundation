import { useState } from "react";
import { Shield, Users, UserCog, Smartphone, Ban, CheckCircle, Layers } from "lucide-react";
import LocationPolicies from "./LocationPolicies";
import BlockUsers from "./BlockUsers";
import WhiteList from "./WhiteList";
import SmartIdPage from "./SmartIdPage";
import CreateGroup from "./CreateGroup";

const POLICIES_TABS = [
  { id: "location", label: "Location Policies", icon: Shield },
  { id: "user", label: "User Policies", icon: Users },
  { id: "group", label: "Group Policies", icon: Layers },
];

const USER_SUB_TABS = [
  { id: "block", label: "Block Users", icon: Ban },
  { id: "whitelist", label: "Whitelist", icon: CheckCircle },
  { id: "smartid", label: "Smart ID", icon: Smartphone },
];

export default function PoliciesHub() {
  const [tab, setTab] = useState("location");
  const [userTab, setUserTab] = useState("block");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Policies</h1>
      <p className="text-sm text-slate-400 -mt-5">Configure network, user, and group policies for this location.</p>

      {/* Main policy tabs */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
        <div className="flex min-w-[400px]">
          {POLICIES_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined}
                className={`flex-1 flex items-center justify-center gap-2 border-r border-slate-200 px-4 py-3 text-sm font-medium transition-colors last:border-r-0 dark:border-slate-600 ${
                  active ? "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100" : "bg-slate-50 text-slate-500 hover:bg-white dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Policies sub-tabs */}
      {tab === "user" && (
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
          <div className="flex min-w-[300px]">
            {USER_SUB_TABS.map((t) => {
              const Icon = t.icon;
              const active = userTab === t.id;
              return (
                <button key={t.id} onClick={() => setUserTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 border-r border-slate-200 px-3 py-2 text-sm font-medium transition-colors last:border-r-0 dark:border-slate-600 ${
                    active ? "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {tab === "location" && <LocationPolicies />}
      {tab === "user" && userTab === "block" && <BlockUsers />}
      {tab === "user" && userTab === "whitelist" && <WhiteList />}
      {tab === "user" && userTab === "smartid" && <SmartIdPage />}
      {tab === "group" && <CreateGroup />}
    </div>
  );
}
