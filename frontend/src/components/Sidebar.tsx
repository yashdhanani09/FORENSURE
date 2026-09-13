import React, { useState, useEffect } from "react";
import { 
  DatabaseZap, FileSearch, LayoutDashboard, 
  ShieldAlert, HardDrive, RotateCcw, ShieldCheck, 
  Cpu, Activity, MonitorSmartphone, Sparkles
} from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { agentConnection } from "../services/agentConnection";

const activeItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, tag: "Overview" },
  { label: "Hardware Guide", to: "/agent-guide", icon: MonitorSmartphone, tag: "Setup" },
  { label: "Storage Inventory", to: "/devices", icon: HardDrive, tag: "Live" },
  { label: "Forensics Hub", to: "/forensics", icon: FileSearch, tag: "Cases" },
  { label: "Data Sanitization", to: "/sanitization", icon: ShieldAlert, tag: "Wipe" },
  { label: "File Recovery", to: "/recovery", icon: RotateCcw, tag: "NTFS" },
];

export function Sidebar() {
  const [demoMode, setDemoMode] = useState(agentConnection.isDemoMode());

  useEffect(() => {
    const unsub = agentConnection.subscribe((s) => {
      setDemoMode(s.demoMode);
    });
    return unsub;
  }, []);

  const visibleItems = demoMode 
    ? activeItems.filter((item) => item.to !== "/agent-guide")
    : activeItems;
  return (
    <aside className="hidden min-h-screen w-72 flex-col border-r border-[#1e2c40] bg-[#0b0f19] p-5 lg:flex select-none">
      {/* Brand Header — Links to Landing Portal */}
      <Link to="/" className="mb-8 flex items-center gap-3 px-2 hover:opacity-90 transition group">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-teal-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)] group-hover:border-cyan-400 transition-colors">
          <DatabaseZap className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold tracking-[0.2em] text-white">FORENSURE</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <p className="mt-0.5 text-[8.5px] font-bold tracking-[0.14em] text-cyan-400/90 font-mono">
            VERIFY. SANITIZE. RECOVER.
          </p>
        </div>
      </Link>

      {/* Navigation */}
      <nav aria-label="Application navigation" className="space-y-1.5">
        <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">
          WORKSPACE MODULES
        </p>
        {visibleItems.map(({ label, to, icon: Icon, tag }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-semibold transition-all duration-200 ${
              isActive 
                ? "bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent"
            }`}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                )}
                <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span className="flex-1">{label}</span>
                <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md transition-colors ${
                  isActive 
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" 
                    : "bg-white/[0.03] text-slate-500 group-hover:text-slate-400"
                }`}>
                  {tag}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Telemetry Footer — Switches between Demo Mode and Live Hardware */}
      <div className="mt-auto space-y-3 pt-6 border-t border-[#1e2c40]/80">
        {demoMode ? (
          <div className="rounded-xl border border-purple-500/30 bg-[#120f26]/80 p-4 shadow-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-purple-300 font-mono">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" /> DEMO SANDBOX
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
              </span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Storage Set:</span>
                <span className="text-purple-300 font-semibold">Simulated</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Validation:</span>
                <span className="text-cyan-400 font-semibold">Active (Carver)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>NIST Standard:</span>
                <span className="text-slate-200 font-semibold">SP 800-88</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1e2c40] bg-[#0e1626]/80 p-4 shadow-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-cyan-400 font-mono">
                <ShieldCheck className="h-3.5 w-3.5" /> HARDWARE TELEMETRY
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Hardware Probe:</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>MTP / WPD:</span>
                <span className="text-cyan-400 font-semibold">Online</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>NIST Standard:</span>
                <span className="text-slate-200 font-semibold">SP 800-88</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-2 text-[10px] text-slate-500 font-mono">
          <span>FORENSURE v2.4</span>
          <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Core OK</span>
        </div>
      </div>
    </aside>
  );
}

