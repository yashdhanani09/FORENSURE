import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  DatabaseZap, LayoutDashboard, HardDrive, FileSearch,
  ShieldAlert, RotateCcw, MonitorSmartphone, Sparkles,
  ShieldCheck, Download, RefreshCw, BookOpen, X,
  Cpu, Menu, ChevronDown,
} from "lucide-react";
import { agentConnection, type AgentStatus } from "../services/agentConnection";
import { recoveryApi } from "../services/recoveryApi";

const NAV_ITEMS = [
  { label: "Hardware Guide", to: "/agent-guide", icon: MonitorSmartphone, tag: "Setup" },
  { label: "Dashboard",       to: "/dashboard",   icon: LayoutDashboard,   tag: "Overview" },
  { label: "Storage",         to: "/devices",     icon: HardDrive,         tag: "Live" },
  { label: "Forensics Hub",   to: "/forensics",   icon: FileSearch,        tag: "Cases" },
  { label: "Sanitization",    to: "/sanitization",icon: ShieldAlert,       tag: "Wipe" },
  { label: "File Recovery",   to: "/recovery",    icon: RotateCcw,         tag: "NTFS" },
];

export function TopNav() {
  const location = useLocation();
  const [status, setStatus] = useState<AgentStatus>(agentConnection.getStatus());
  const [demoMode, setDemoMode] = useState(agentConnection.isDemoMode());
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLDivElement>(null);
  const activeNavRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const unsub = agentConnection.subscribe((s) => {
      setStatus(s);
      setDemoMode(s.demoMode);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (status.connected && !demoMode) {
      recoveryApi.getPrivileges()
        .then(p => setIsAdmin(p.is_admin))
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(null);
    }
  }, [status.connected, demoMode]);

  // Animate the sliding active indicator under nav items
  useEffect(() => {
    const updateIndicator = () => {
      const el = activeNavRef.current;
      const container = navRef.current;
      if (el && container) {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setIndicatorStyle({
          left: rect.left - containerRect.left,
          width: rect.width,
        });
      }
    };

    const timer = setTimeout(updateIndicator, 50);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [location.pathname]);

  const handleRecheck = async () => {
    setChecking(true);
    await agentConnection.checkConnection();
    setChecking(false);
  };

  const handleToggleDemo = (enable: boolean) => {
    agentConnection.setDemoMode(enable);
    window.location.reload();
  };

  const visibleItems = demoMode
    ? NAV_ITEMS.filter(i => i.to !== "/agent-guide")
    : NAV_ITEMS;

  return (
    <>
      {/* ── Main Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 w-full select-none">
        {/* Top accent line with animated gradient */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent animate-glow-line" />

        {/* Frosted glass bar */}
        <div className="bg-[#070b14]/90 backdrop-blur-xl border-b border-[#182035] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="flex h-14 items-center gap-4 px-4 lg:px-6">

            {/* ── Logo ── */}
            <Link
              to="/"
              className="flex items-center gap-2.5 shrink-0 group mr-2"
            >
              <div className="relative h-8 w-8 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/25 to-teal-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.25)] group-hover:shadow-[0_0_24px_rgba(6,182,212,0.45)] transition-shadow">
                <DatabaseZap className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400 border border-[#070b14] animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400 border border-[#070b14]" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[11px] font-black tracking-[0.22em] text-white leading-none">
                  FORENSURE
                </div>
                <div className="text-[7.5px] font-bold tracking-[0.16em] text-cyan-400/80 font-mono mt-0.5">
                  VERIFY · SANITIZE · RECOVER
                </div>
              </div>
            </Link>

            {/* ── Divider ── */}
            <div className="hidden lg:block h-6 w-px bg-[#182035] shrink-0" />

            {/* ── Desktop Nav Links ── */}
            <nav
              ref={navRef}
              className="relative hidden lg:flex items-center gap-0.5 flex-1"
              aria-label="Main navigation"
            >
              {/* Animated sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
              />

              {visibleItems.map(({ label, to, icon: Icon, tag }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  ref={node => {
                    const isActive = location.pathname === to || location.pathname.startsWith(to + "/");
                    if (isActive && node) activeNavRef.current = node;
                  }}
                  className={({ isActive }) =>
                    `relative group flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/25 via-cyan-500/20 to-teal-500/15 text-cyan-200 border border-cyan-400/50 shadow-[0_0_22px_rgba(6,182,212,0.4)]"
                        : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                      <span>{label}</span>
                      <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded transition-colors ${
                        isActive
                          ? "bg-cyan-400/25 text-cyan-100 border border-cyan-400/40"
                          : "bg-white/[0.03] text-slate-600 group-hover:text-slate-500"
                      }`}>
                        {tag}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* ── Right Controls ── */}
            <div className="flex items-center gap-2 ml-auto shrink-0">

              {/* Bridge / Mode Status Badge matching reference image */}
              {demoMode ? (
                <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-semibold shadow-[0_0_12px_rgba(168,85,247,0.2)]">
                  <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                  Status: Demo Sandbox
                </span>
              ) : status.connected ? (
                <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-semibold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Status: Connected
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[11px] font-semibold shadow-[0_0_12px_rgba(244,63,94,0.2)]">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Status: Standby
                </span>
              )}

              {/* Admin Badge */}
              {status.connected && !demoMode && (
                isAdmin ? (
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold">
                    <ShieldCheck className="h-3 w-3" /> Admin
                  </span>
                ) : (
                  <Link
                    to="/agent-guide"
                    className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-semibold transition"
                    title="Admin required for raw disk access"
                  >
                    <ShieldAlert className="h-3 w-3 text-amber-400" /> Admin Required
                  </Link>
                )
              )}

              {/* Demo / Physical Toggle */}
              {demoMode ? (
                <button
                  onClick={() => handleToggleDemo(false)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-[#182035] text-slate-300 hover:text-white text-[10px] font-semibold transition"
                >
                  Exit Demo
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleToggleDemo(true)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-[10px] font-semibold transition"
                  >
                    <Sparkles className="h-3 w-3" /> Demo
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[10px] font-bold transition shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  >
                    <Download className="h-3 w-3" />
                    <span className="hidden md:inline">{status.connected ? "Bridge" : "Download"}</span>
                  </button>
                  <button
                    onClick={handleRecheck}
                    disabled={checking}
                    title="Recheck bridge connection"
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-[#182035] text-slate-400 hover:text-slate-200 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin text-cyan-400" : ""}`} />
                  </button>
                </>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-1.5 rounded-lg border border-[#182035] bg-slate-800/60 text-slate-400 hover:text-white transition"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Mobile Nav Dropdown ── */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-[#182035] bg-[#070b14]/95 px-4 py-3 space-y-1 animate-slide-down">
              {visibleItems.map(({ label, to, icon: Icon, tag }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-500">{tag}</span>
                </NavLink>
              ))}

              {/* Mobile status row */}
              <div className="flex items-center justify-between px-3 pt-2 border-t border-[#182035] mt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  {demoMode ? (
                    <span className="text-purple-300 flex items-center gap-1"><Sparkles className="h-3 w-3" /> DEMO MODE</span>
                  ) : status.connected ? (
                    <span className="text-emerald-400 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE HARDWARE</span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> BRIDGE OFFLINE</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">FORENSURE v2.4</span>
              </div>
            </div>
          )}

          {/* ── Sub-status bar (connection detail line) ── */}
          <div className="hidden md:flex items-center gap-3 px-6 py-1 border-t border-[#182035]/60 bg-[#060a12]/50 text-[10px] font-mono text-slate-500">
            <span className="text-slate-600">SYS:</span>
            <span>
              {demoMode
                ? "Simulated forensic sandbox · carving, wiping, and evidence verification active"
                : status.connected
                ? "Physical bridge online · raw MFT sector scanning · MTP detection active · port 8000"
                : "Bridge offline · connect FORENSURE-Bridge.exe as Administrator to enable hardware probing"}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              FORENSURE v2.4 · NIST SP 800-88
            </span>
          </div>
        </div>
      </header>

      {/* ── Bridge Info / Download Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-2xl border border-[#182035] bg-[#0d1424] p-6 shadow-2xl text-slate-200 animate-scale-in">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <MonitorSmartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">FORENSURE Hardware Bridge</h3>
                <p className="text-xs text-slate-400">Physical Storage Probing, Raw Sector Carving & Recovery</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="rounded-xl border border-[#182035] bg-[#090e1a] p-4 space-y-2 font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Status:</span>
                  <span className={status.connected ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {status.connected ? "● ACTIVE & CONNECTED" : "○ NOT RUNNING"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Privilege:</span>
                  <span className={isAdmin ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {isAdmin ? "● ADMINISTRATOR (FULL RAW ACCESS)" : "○ STANDARD USER"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Port:</span>
                  <span className="text-slate-200">http://127.0.0.1:8000</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Platform:</span>
                  <span className="text-slate-200">Windows 10 / 11 (64-bit)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px]">
                <span className="font-bold text-emerald-400">Option 1 (Recommended — Auto-Admin):</span>
                <p className="text-slate-400 mt-1">Right-click <code className="text-emerald-300 bg-black/40 px-1 rounded">SETUP-AUTO-ADMIN.bat</code> → <em>"Run as administrator"</em> once.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-[#182035] text-[11px]">
                <span className="font-bold text-cyan-400">Option 2 (Interactive):</span>
                <p className="text-slate-400 mt-1">Double-click <code className="text-cyan-300 bg-black/40 px-1 rounded">START-BRIDGE.bat</code> or <code className="text-cyan-300 bg-black/40 px-1 rounded">RUN-AS-ADMIN.bat</code>.</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-[#182035]">
              <button
                onClick={() => { handleToggleDemo(true); setShowModal(false); }}
                className="px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> Demo Mode
              </button>
              <div className="flex items-center gap-2">
                <Link
                  to="/agent-guide"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Setup Guide
                </Link>
                <a
                  href="https://github.com/yashdhanani09/FORENSURE/raw/main/frontend/public/FORENSURE-Bridge-Windows.zip"
                  download="FORENSURE-Bridge-Windows.zip"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-[0_0_14px_rgba(6,182,212,0.4)]"
                >
                  <Download className="h-4 w-4" /> Download Agent (.zip)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
