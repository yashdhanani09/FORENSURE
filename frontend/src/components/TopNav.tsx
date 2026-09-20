import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  DatabaseZap, LayoutDashboard, HardDrive, FileSearch,
  ShieldAlert, RotateCcw, MonitorSmartphone, Sparkles,
  ShieldCheck, Download, RefreshCw, BookOpen, X,
  Cpu, Menu, ChevronDown
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
      <header className="sticky top-0 z-40 w-full select-none shadow-[0_4px_24px_rgba(0,0,0,0.25)] overflow-x-hidden">
        {/* Top accent line with animated gradient (Cyber blue brand) */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#2F81F7] to-transparent animate-glow-line" />

        {/* ── ROW 1: PRIMARY NAVIGATION BAR ── */}
        <div className="bg-canvas/95 backdrop-blur-xl border-b border-border-subtle overflow-hidden">
          <div className="flex h-16 lg:h-17 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">

            {/* ── Logo ── */}
            <Link
              to="/"
              className="flex items-center gap-3 shrink-0 group mr-2"
            >
              <div className="relative h-10 w-10 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/25 to-recovery/10 flex items-center justify-center text-brand shadow-glow group-hover:shadow-glow-strong transition-shadow shrink-0">
                <DatabaseZap className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand border-2 border-canvas animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand border-2 border-canvas" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm lg:text-base font-black tracking-[0.22em] text-text-primary leading-tight">
                  FORENSURE
                </div>
                <div className="text-[9px] lg:text-[10px] font-extrabold tracking-[0.18em] text-brand font-mono mt-0.5">
                  VERIFY · SANITIZE · RECOVER
                </div>
              </div>
            </Link>

            {/* ── Divider ── */}
            <div className="hidden lg:block h-7 w-px bg-border-subtle shrink-0" />

            {/* ── Desktop Nav Links (Zero Scroll, Perfectly Fitted) ── */}
            <nav
              ref={navRef}
              className="relative hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2 flex-1 min-w-0"
              aria-label="Main navigation"
            >
              {/* Animated sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-gradient-to-r from-brand to-recovery rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(47,129,247,0.6)]"
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
                    `relative group flex items-center gap-1.5 xl:gap-2 px-2.5 py-1.5 xl:px-3.5 xl:py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                      isActive
                        ? "bg-gradient-to-r from-brand/25 via-brand/15 to-transparent text-text-primary border border-brand/50 shadow-glow font-bold"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60 border border-transparent"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-brand" : "text-text-secondary group-hover:text-text-primary"}`} />
                      <span>{label}</span>
                      <span className={`hidden xl:inline-block text-[9px] font-extrabold font-mono px-1.5 py-0.5 rounded transition-colors ${
                        isActive
                          ? "bg-brand/20 text-brand border border-brand/40"
                          : "bg-surface-elevated text-text-secondary group-hover:text-text-primary"
                      }`}>
                        {tag}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* ── Right: Mobile Menu Trigger ── */}
            <div className="flex items-center gap-2.5 ml-auto shrink-0 lg:hidden">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 rounded-xl border border-border-subtle bg-surface text-text-secondary hover:text-text-primary transition"
                aria-label="Toggle navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Mobile Nav Dropdown ── */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-border-subtle bg-canvas/95 px-4 py-3 space-y-1 animate-slide-down">
              {visibleItems.map(({ label, to, icon: Icon, tag }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-brand/15 text-brand border border-brand/30 font-bold"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/50 border border-transparent"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-surface-elevated text-text-secondary">{tag}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* ── ROW 2: PERMANENT SYSTEM STATUS & BRIDGE CONTROL BAR ── */}
        <div className="bg-surface/90 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 lg:px-8 py-2 min-h-[44px] flex flex-wrap items-center justify-between gap-3 shadow-sm overflow-hidden">
          {/* Left: Engine Telemetry Info */}
          <div className="flex items-center gap-3 text-xs font-mono text-text-secondary min-w-0 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <Cpu className="h-4 w-4 text-brand animate-pulse" />
              <span className="text-brand font-black tracking-wider uppercase">SYS TELEMETRY:</span>
            </div>
            <span className="truncate text-xs text-text-secondary">
              {demoMode
                ? "Simulated physical hardware sandbox · live sector carving, NIST sanitization, and evidence verification active"
                : status.connected
                ? "Physical bridge online · raw MFT sector scanning · MTP detection active · port 8000"
                : "Bridge offline · connect FORENSURE-Bridge.exe as Administrator or use Demo Mode to explore full capabilities"}
            </span>
            <span className="hidden 2xl:inline text-[11px] px-2 py-0.5 rounded-md bg-surface-elevated border border-border-subtle text-text-secondary shrink-0">
              NIST SP 800-88
            </span>
          </div>

          {/* Right: Status, Admin, Demo, Bridge Info, Recheck Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">

            {/* 1. Status Pill */}
            {demoMode ? (
              <span 
                title="Full physical hardware simulation active. Test file carving, NIST sanitization, and disk analysis with zero hardware prerequisites."
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold shadow-sm cursor-help"
              >
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
                Status: Demo Sandbox (Fully Active)
              </span>
            ) : status.connected ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Status: Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold shadow-sm">
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                Status: Standby
              </span>
            )}

            {/* 2. Admin Badge */}
            {status.connected && !demoMode && (
              isAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin Access
                </span>
              ) : (
                <Link
                  to="/agent-guide"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition shadow-sm"
                  title="Admin required for raw disk access"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Admin Required
                </Link>
              )
            )}

            {/* 3. Demo Button */}
            {demoMode ? (
              <button
                onClick={() => handleToggleDemo(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface border border-border-subtle text-text-primary text-xs font-bold transition shadow-sm"
              >
                Exit Demo
              </button>
            ) : (
              <button
                onClick={() => handleToggleDemo(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-xs font-bold transition shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> Demo Mode
              </button>
            )}

            {/* 4. Bridge Info / Download Button */}
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand hover:bg-blue-600 text-white text-xs font-bold transition shadow-glow"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{status.connected ? "Bridge Info" : "Download Bridge"}</span>
            </button>

            {/* 5. Recheck Connection Button */}
            <button
              onClick={handleRecheck}
              disabled={checking}
              title="Recheck hardware bridge connection"
              className="p-1.5 sm:p-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border-subtle text-text-secondary hover:text-text-primary transition shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin text-brand" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Bridge Info / Download Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-2xl text-text-primary animate-scale-in">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-text-secondary hover:text-text-primary transition p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-brand/10 border border-brand/30 text-brand">
                <MonitorSmartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">FORENSURE Hardware Bridge</h3>
                <p className="text-xs text-text-secondary">Physical Storage Probing, Raw Sector Carving & Recovery</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-text-secondary">
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 space-y-2 font-mono">
                <div className="flex items-center justify-between text-text-secondary">
                  <span>Status:</span>
                  <span className={status.connected ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-amber-700 dark:text-amber-400 font-bold"}>
                    {status.connected ? "● ACTIVE & CONNECTED" : "○ NOT RUNNING"}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Privilege:</span>
                  <span className={isAdmin ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-amber-700 dark:text-amber-400 font-bold"}>
                    {isAdmin ? "● ADMINISTRATOR (FULL RAW ACCESS)" : "○ STANDARD USER"}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Port:</span>
                  <span className="text-text-primary">http://127.0.0.1:8000</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Platform:</span>
                  <span className="text-text-primary">Windows 10 / 11 (64-bit)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px]">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Option 1 (Recommended — Auto-Admin):</span>
                <p className="text-text-secondary mt-1">Right-click <code className="text-emerald-700 dark:text-emerald-300 bg-surface-elevated px-1 rounded border border-border-subtle">SETUP-AUTO-ADMIN.bat</code> → <em>"Run as administrator"</em> once.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface border border-border-subtle text-[11px]">
                <span className="font-bold text-brand">Option 2 (Interactive):</span>
                <p className="text-text-secondary mt-1">Double-click <code className="text-brand bg-surface-elevated px-1 rounded border border-border-subtle">START-BRIDGE.bat</code> or <code className="text-brand bg-surface-elevated px-1 rounded border border-border-subtle">RUN-AS-ADMIN.bat</code>.</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-border-subtle">
              <button
                onClick={() => { handleToggleDemo(true); setShowModal(false); }}
                className="px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> Demo Mode
              </button>
              <div className="flex items-center gap-2">
                <Link
                  to="/agent-guide"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-brand/30 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Setup Guide
                </Link>
                <a
                  href="https://github.com/yashdhanani09/FORENSURE/raw/main/frontend/public/FORENSURE-Bridge-Windows.zip"
                  download="FORENSURE-Bridge-Windows.zip"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-brand hover:bg-blue-600 text-white font-bold text-xs transition shadow-glow"
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
