import { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { LogOut, Bell, Search, Sun, Moon, Menu, X, ChevronLeft, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";

interface ShellProps { children: React.ReactNode; locationId?: string; feature?: string; }

const NAVS = [
  { id: "dashboard", label: "Dashboard" }, { id: "users", label: "Users" },
  { id: "analytics", label: "Analytics" }, { id: "reports", label: "Reports" },
  { id: "campaigns", label: "Campaigns" }, { id: "portal", label: "Portal" },
  { id: "vouchers", label: "Vouchers" }, { id: "policies", label: "Policies" },
  { id: "whitelist", label: "Whitelist" }, { id: "devices", label: "Devices" },
  { id: "teams", label: "Teams" }, { id: "agents", label: "Agents" },
  { id: "networking", label: "Networking" }, { id: "advanced", label: "Advanced" },
  { id: "audit", label: "Audit Logs" }, { id: "help", label: "Help" },
];

export function CustomerShell({ children, locationId, feature }: ShellProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { activeLocation } = useCustomerStore();
  const [sidebar, setSidebar] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const toggleTheme = () => setTheme((t) => {
    const n = t === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", n === "dark");
    return n;
  });

  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };

  const handleNav = (id: string) => {
    if (!locationId) return;
    navigate({ to: `/customer/${locationId}/${id}` });
    setMobile(false);
  };

  return (
    <div className="flex min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      {mobile && <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobile(false)} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#161b22] border-r border-[#30363d] transition-all duration-200 lg:static lg:z-auto",
        sidebar ? "w-60" : "w-0 lg:w-16 overflow-hidden",
        mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#30363d] shrink-0">
          <div className="flex h-8 w-8 items-center justify-center bg-[#ec3013] text-white text-xs font-bold">CG</div>
          {sidebar && <div><p className="text-sm font-semibold text-[#c9d1d9]">CloudGuest</p><p className="text-[10px] text-[#8b949e]">MikroTik WiFi</p></div>}
        </div>
        {locationId && (
          <div className="px-2 pt-2">
            <button onClick={() => navigate({ to: "/customer" })} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded">
              <ChevronLeft className="h-3.5 w-3.5" />{sidebar && <span>All locations</span>}
            </button>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {NAVS.map((item) => {
            const isActive = (feature || "dashboard") === item.id;
            return (<button key={item.id} onClick={() => handleNav(item.id)}
              className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-sm rounded transition-all w-full text-left",
                isActive ? "bg-[#ec3013]/10 text-[#ec3013] font-medium" : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]",
              )}>
              <span className="h-4 w-4 shrink-0 flex items-center justify-center"><span className={cn("h-2 w-2 rounded-full", isActive ? "bg-[#ec3013]" : "bg-[#30363d]")} /></span>
              {sidebar && <span className="truncate">{item.label}</span>}
            </button>);
          })}
        </nav>
        <div className="border-t border-[#30363d] p-2 hidden lg:block">
          <button onClick={() => setSidebar(!sidebar)} className="flex w-full items-center justify-center px-3 py-2 text-xs text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded">
            {sidebar ? "◄" : "►"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#30363d] bg-[#0d1117] px-4">
          <button className="lg:hidden text-[#8b949e]" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <p className="text-sm font-semibold truncate">{activeLocation?.name ?? "CloudGuest"}</p>
            {activeLocation && <span className="text-[10px] text-[#8b949e] hidden sm:inline">{activeLocation.city} · {activeLocation.isp}</span>}
          </div>
          <button className="flex h-8 w-8 items-center justify-center text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded"><Search className="h-4 w-4" /></button>
          <button className="flex h-8 w-8 items-center justify-center text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded relative">
            <Bell className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-3 w-3 bg-[#ec3013] text-[7px] font-bold text-white flex items-center justify-center rounded">3</span>
          </button>
          <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="flex h-7 w-7 items-center justify-center bg-[#ec3013] text-white text-[10px] font-bold rounded ml-1">AU</button>
            {menu && (<div className="absolute right-0 top-full mt-2 w-48 bg-[#161b22] border border-[#30363d] rounded shadow-xl z-50">
              <div className="px-3 py-2 border-b border-[#30363d]"><p className="text-xs font-medium text-[#c9d1d9]">Admin</p><p className="text-[10px] text-[#8b949e]">admin@example.com</p></div>
              <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#f85149] hover:bg-[#21262d]"><LogOut className="h-4 w-4" />Sign out</button>
            </div>)}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return <div className="space-y-4 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-[#21262d] border border-[#30363d] rounded" />)}</div>;
}
