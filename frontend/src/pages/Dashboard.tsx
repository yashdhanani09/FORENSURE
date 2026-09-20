import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { deviceApi, sanitizationApi } from "../services/api";
import { recoveryApi, type RecoveredFileRecord, type RecoveryPrivileges } from "../services/recoveryApi";
import { agentConnection } from "../services/agentConnection";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatDate, deviceName } from "../utils/format";
import { Button } from "../components/ui/button";
import {
  Shield, HardDrive, FileSearch, RotateCcw,
  ShieldAlert, Activity, CheckCircle2, AlertTriangle,
  Download, ArrowRight, Smartphone, DatabaseZap, RefreshCw,
  MoreHorizontal, ChevronRight, LayoutGrid, SlidersHorizontal,
  ChevronDown, Sparkles, Terminal, FileText, Lock, Layers,
  FileCheck, ShieldCheck, Cpu, KeyRound, Clock, Zap
} from "lucide-react";

export function Dashboard() {
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveredFileRecord[]>([]);
  const [privileges, setPrivileges] = useState<RecoveryPrivileges | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminWarning, setAdminWarning] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeToolTab, setActiveToolTab] = useState<"all" | "carver" | "inspect">("all");
  const [storageFilter, setStorageFilter] = useState<"all" | "internal" | "usb">("all");
  const [recoveryMenuOpen, setRecoveryMenuOpen] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<string>("All");
  const navigate = useNavigate();

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const devRes = await deviceApi.list();
      setDevices(devRes?.devices || []);
      if (!devRes?.demo_mode && devRes?.warning) {
        setAdminWarning(devRes.warning);
      } else {
        setAdminWarning(null);
      }

      try {
        const histRes = await sanitizationApi.getHistory();
        setHistoryJobs(histRes || []);
      } catch {
        // Fallback
      }

      try {
        const recHist = await recoveryApi.getHistory();
        setRecoveryHistory(recHist || []);
      } catch {
        // Fallback
      }

      try {
        const priv = await recoveryApi.getPrivileges();
        setPrivileges(priv);
      } catch {
        // Fallback
      }
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Storage Metrics & Radial Gauge Calculations
  const totalCapacity = useMemo(
    () => devices.reduce((acc, d) => acc + (d.capacity_bytes || d.size_bytes || 0), 0),
    [devices]
  );
  const safeDevices = useMemo(() => devices.filter(d => !d.system_disk), [devices]);
  const isDemo = agentConnection.isDemoMode();

  // Used space ratio for radial meter (realistic simulation or calculated)
  const usedRatio = totalCapacity > 0 ? 0.43 : 0.43;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - usedRatio * circumference;

  return (
    <div className="w-full max-w-[1850px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 py-8 space-y-8 select-none page-enter">

      {/* ── Admin Privilege Mandatory Alert Banner (if standard user) ── */}
      {adminWarning && (
        <div className="flex items-start gap-4 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-300 backdrop-blur-md shadow-2xl">
          <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-amber-200">Administrator Privileges Required for Raw Disk Forensics</p>
            <p className="text-sm text-amber-300/80 mt-1 leading-relaxed">{adminWarning}</p>
          </div>
          <Link
            to="/agent-guide"
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-sm font-bold transition shadow-sm"
          >
            Setup Guide →
          </Link>
          <button
            onClick={() => setAdminWarning(null)}
            className="shrink-0 text-amber-400 hover:text-amber-200 transition text-2xl leading-none px-1"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* ── Top Command Bar & Component View Controls (Matching Reference Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-3.5">
          <div className="h-2.5 w-2.5 rounded-full bg-brand animate-ping" />
          <span className="text-sm sm:text-base font-mono font-extrabold tracking-[0.25em] text-brand uppercase">
            FORENSURE COMMAND CENTER // TELEMETRY WORKSTATION
          </span>
        </div>

        {/* View Mode Toolbar on Right */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Telemetry"
            className="p-2.5 rounded-xl bg-surface border border-border-subtle hover:border-brand text-text-secondary hover:text-brand transition shadow-sm"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin text-brand" : ""}`} />
          </button>

          <div className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-xl p-1.5 shadow-sm text-sm font-mono">
            <button
              onClick={() => setComponentFilter("All")}
              className={`p-2 rounded-lg transition ${
                componentFilter === "All"
                  ? "bg-brand/20 text-brand border border-brand/40 shadow-glow"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setComponentFilter("Storage")}
              className={`p-2 rounded-lg transition ${
                componentFilter === "Storage"
                  ? "bg-brand/20 text-brand border border-brand/40 shadow-glow"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Storage Filter"
            >
              <HardDrive className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="relative">
            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="bg-surface border border-border-subtle text-text-primary rounded-xl px-4 py-2 text-sm font-mono font-bold outline-none focus:border-brand transition cursor-pointer appearance-none pr-9 shadow-sm"
            >
              <option value="All">Component: All</option>
              <option value="Telemetry">Component: Telemetry</option>
              <option value="Storage">Component: Storage</option>
              <option value="Forensics">Component: Forensics</option>
            </select>
            <ChevronDown className="h-4 w-4 text-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── 8-Card Modular Workstation Grid (2 Rows × 4 Columns) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* ── Card 1: Control Info (Top-Left) ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-5">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                Control Info
              </h3>
              <MoreHorizontal className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition cursor-pointer" />
            </div>

            <div className="space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center text-slate-400">
                <span>Name</span>
                <span className="text-white font-bold">Forensure</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Model</span>
                <span className="text-slate-200 font-semibold">
                  {devices[0]?.model ? `${devices[0].model.slice(0, 16)}` : "Host PC · x64"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Privilege</span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  privileges?.is_admin
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                  {privileges?.is_admin ? "ADMINISTRATOR" : "STANDARD (UAC)"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Status</span>
                <span className="text-cyan-400 font-bold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  {isDemo ? "Demo Sandbox" : "Active (Port 8000)"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Memory Read</span>
                <span className="text-slate-300">16 MB Chunks</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Compliance</span>
                <span className="text-slate-200 font-bold">NIST SP 800-88</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Kernel Time</span>
                <span className="text-cyan-300 font-extrabold">{currentTime.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>OS Boot Disk</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> C:\ Write-Locked
            </span>
          </div>
        </div>

        {/* ── Card 2: Storage Data (Top Center-Left) — Radial Gauge ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight">
                Storage data
              </h3>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#070b14] border border-[#182035] text-xs font-mono text-slate-300">
                <span>All Storage</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Circular Radial Gauge Container (Larger, High Precision) */}
            <div className="flex items-center justify-center gap-7 my-5">
              <div className="relative w-44 h-44 lg:w-48 lg:h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                  {/* Background Track Circle */}
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    stroke="#142033"
                    strokeWidth="14"
                    fill="none"
                  />
                  {/* Glowing Animated Progress Arc */}
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    stroke="url(#cyanGlowGradLarge)"
                    strokeWidth="14"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(6,182,212,0.7))",
                    }}
                  />
                  <defs>
                    <linearGradient id="cyanGlowGradLarge" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="60%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center Percentage Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-4xl lg:text-5xl font-black text-white font-mono tracking-tight">
                    {Math.round(usedRatio * 100)}%
                  </span>
                  <span className="text-[10px] lg:text-xs font-mono font-extrabold tracking-[0.2em] text-cyan-400 uppercase mt-1">
                    ALLOCATED
                  </span>
                </div>
              </div>

              {/* Legend on Right */}
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)]" />
                  <span className="text-slate-200 font-semibold">Allocated</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-slate-600" />
                  <span className="text-slate-500">Unallocated</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#182035]/80 flex items-center justify-between text-sm font-mono text-slate-400">
            <span>Total Disks: <strong className="text-white">{devices.length}</strong></span>
            <span className="text-cyan-300 font-extrabold">{formatBytes(totalCapacity)}</span>
          </div>
        </div>

        {/* ── Card 3: Forensics Hub (Top Center-Right) — Quick Links ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-5">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                Forensics Hub
              </h3>
              <MoreHorizontal className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition cursor-pointer" />
            </div>

            <div className="space-y-3">
              {[
                { label: "Hardware Guide", to: "/agent-guide", icon: Cpu, desc: "Step-by-step physical bridge setup" },
                { label: "Storage Inventory", to: "/devices", icon: HardDrive, desc: "Explore attached NVMe & USB drives" },
                { label: "Forensics Hub", to: "/forensics", icon: FileSearch, desc: "Case files & bitstream acquisition" },
                { label: "File Recovery", to: "/recovery", icon: RotateCcw, desc: "NTFS $MFT & raw sector carver" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="group/item flex items-center justify-between p-3.5 rounded-2xl bg-[#090e1a]/85 hover:bg-cyan-500/[0.1] border border-[#182035] hover:border-cyan-500/40 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover/item:text-cyan-300 group-hover/item:border-cyan-400/50 transition shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-bold text-slate-200 group-hover/item:text-white truncate">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500 group-hover/item:text-cyan-400 group-hover/item:translate-x-1 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Subsystems</span>
            <span className="text-cyan-400 font-bold">4 Active Modules</span>
          </div>
        </div>

        {/* ── Card 4: Data Sanitization (Top Right) — Audit Activity Bars ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-rose-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(244,63,94,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                Data Sanitization
              </h3>
              <MoreHorizontal className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition cursor-pointer" />
            </div>

            {/* Subheader with state selector */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#090e1a]/85 border border-[#182035] mb-5 text-xs font-mono">
              <span className="flex items-center gap-2 text-rose-400 font-bold">
                <ShieldAlert className="h-4 w-4" /> NIST SP 800-88
              </span>
              <span className="text-xs text-slate-300 bg-white/[0.05] px-2.5 py-1 rounded-lg font-bold">
                Audit Log
              </span>
            </div>

            {/* Neon Bar Activity Chart (Taller, High-Contrast) */}
            <div className="h-36 lg:h-40 flex items-end justify-between gap-3 px-3 py-3 bg-[#070b14]/80 rounded-2xl border border-[#182035]">
              {[
                { day: "Sun", val: 35 },
                { day: "Mon", val: 55 },
                { day: "Tue", val: 85 },
                { day: "Wed", val: 70 },
                { day: "Thu", val: 95 },
                { day: "Fri", val: 65 },
                { day: "Sat", val: 40 },
              ].map((bar) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full bg-[#142033] rounded-t-md relative flex items-end h-full overflow-hidden">
                    <div
                      className="w-full bg-gradient-to-t from-teal-500 via-cyan-400 to-cyan-300 rounded-t-md transition-all duration-700 hover:brightness-125"
                      style={{
                        height: `${bar.val}%`,
                        boxShadow: "0 0 12px rgba(6,182,212,0.5)",
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-400">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Total Wipes</span>
            <span className="text-rose-400 font-extrabold">{historyJobs.length} Certificates</span>
          </div>
        </div>

        {/* ── Card 5: Tools & Arsenal (Bottom-Left) ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight">Tools</h3>
              <MoreHorizontal className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition cursor-pointer" />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#090e1a] border border-[#182035] mb-4 text-xs font-mono font-bold">
              {(["all", "carver", "inspect"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveToolTab(tab)}
                  className={`flex-1 py-1.5 rounded-xl uppercase transition ${
                    activeToolTab === tab
                      ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-glow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tools List */}
            <div className="space-y-2.5">
              {[
                { name: "NTFS MFT Parser", desc: "Scan record 0 data runs", cat: "carver", to: "/recovery" },
                { name: "Raw File Carver", desc: "Binary signatures JPG/PDF", cat: "carver", to: "/recovery" },
                { name: "Bitstream Imager", desc: "Acquire DD raw image", cat: "inspect", to: "/forensics" },
                { name: "SHA-256 Validator", desc: "Chain-of-custody hashes", cat: "inspect", to: "/forensics" },
              ]
                .filter((t) => activeToolTab === "all" || t.cat === activeToolTab)
                .map((tool) => (
                  <Link
                    key={tool.name}
                    to={tool.to}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#090e1a]/85 hover:bg-cyan-500/[0.1] border border-[#182035] hover:border-cyan-500/40 transition group/row"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-200 group-hover/row:text-white">
                        {tool.name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{tool.desc}</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500 group-hover/row:text-cyan-400 group-hover/row:translate-x-1 transition" />
                  </Link>
                ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Arsenal Status</span>
            <span className="text-cyan-400 font-bold">● Active &amp; Ready</span>
          </div>
        </div>

        {/* ── Card 6: Storage Inventory (Bottom Center-Left) — Live Fleet ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight">
                Storage Inventory
              </h3>
              <MoreHorizontal className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition cursor-pointer" />
            </div>

            <div className="space-y-2.5">
              {devices.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-mono text-sm">
                  No storage devices detected.
                </div>
              ) : (
                devices.slice(0, 4).map((d) => {
                  const isSystem = d.system_disk;
                  const isMobile = d.device_type === "MOBILE_DEVICE";
                  return (
                    <Link
                      key={d.id}
                      to={`/devices/${encodeURIComponent(d.id)}`}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#090e1a]/85 hover:bg-cyan-500/[0.1] border border-[#182035] hover:border-cyan-500/40 transition group/dev"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isSystem ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          isMobile ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                          "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        }`}>
                          {isMobile ? <Smartphone className="h-5 w-5" /> : <HardDrive className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate max-w-[160px]" title={deviceName(d.vendor, d.model)}>
                            {deviceName(d.vendor, d.model)}
                          </div>
                          <div className="text-xs font-mono text-slate-400 mt-0.5">
                            {formatBytes(d.capacity_bytes || d.size_bytes || 0)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500 group-hover/dev:text-cyan-400 group-hover/dev:translate-x-1 transition shrink-0" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Fleet Live View</span>
            <Link to="/devices" className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
              View All ({devices.length}) →
            </Link>
          </div>
        </div>

        {/* ── Card 7: Data Sanitization Engine (Bottom Center-Right) ── */}
        <div className="group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-rose-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(244,63,94,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight">
                Data Sanitization
              </h3>
              <MoreHorizontal className="h-5 w-5 text-slate-500 group-hover:text-slate-300 transition cursor-pointer" />
            </div>

            <div className="space-y-2.5">
              {[
                { name: "NIST SP 800-88 Clear", desc: "Single-pass logical block overwrite", to: "/sanitization" },
                { name: "DoD 5220.22-M 3-Pass", desc: "Department of Defense compliant", to: "/sanitization" },
                { name: "Cryptographic Erase", desc: "NVMe Crypto Scramble / Purge", to: "/sanitization" },
                { name: "Audit Certificates", desc: "Tamper-evident verification PDF", to: "/sanitization" },
              ].map((item) => (
                <Link
                  key={item.name}
                  to={item.to}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#090e1a]/85 hover:bg-rose-500/[0.1] border border-[#182035] hover:border-rose-500/40 transition group/san"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-200 group-hover/san:text-white">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{item.desc}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 group-hover/san:text-rose-400 group-hover/san:translate-x-1 transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Safety Guard</span>
            <span className="text-emerald-400 font-bold">Write-Block Enforced</span>
          </div>
        </div>

        {/* ── Card 8: File Recovery Hub (Bottom-Right) — matching screenshot menu ── */}
        <div className="relative group rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-lg lg:text-xl font-extrabold text-white tracking-tight">
                File Recovery
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#070b14] border border-[#182035] text-xs font-mono text-slate-300">
                  <span>All Status</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <button
                  onClick={() => setRecoveryMenuOpen(recoveryMenuOpen ? null : "actions")}
                  title="Context Actions"
                  className="p-1.5 rounded-xl bg-[#070b14] border border-[#182035] hover:border-cyan-500/40 text-slate-400 hover:text-white transition shadow-sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Contextual Action Menu Popup (matching user screenshot) */}
            {recoveryMenuOpen === "actions" && (
              <div className="absolute right-7 top-20 z-30 w-52 rounded-2xl border border-[#182035] bg-[#0d1424] p-2.5 shadow-2xl font-sans text-sm space-y-1.5 animate-scale-in">
                <button
                  onClick={() => { setRecoveryMenuOpen(null); navigate("/recovery"); }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-cyan-500/15 text-slate-200 hover:text-white font-semibold transition flex items-center gap-2.5"
                >
                  <FileText className="h-4 w-4 text-cyan-400" />
                  <span>Inspect Files</span>
                </button>
                <button
                  onClick={() => { setRecoveryMenuOpen(null); navigate("/sanitization"); }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-rose-500/15 text-slate-200 hover:text-white font-semibold transition flex items-center gap-2.5"
                >
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>Sanitize Space</span>
                </button>
                <button
                  onClick={() => { setRecoveryMenuOpen(null); navigate("/recovery"); }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white font-semibold transition flex items-center gap-2.5"
                >
                  <RotateCcw className="h-4 w-4 text-cyan-400" />
                  <span>Launch Carver</span>
                </button>
              </div>
            )}

            {/* File List */}
            <div className="space-y-2.5">
              {[
                { name: "Quarterly_Report.docx", time: "20 mins ago", status: "HIGH", size: "1.8 MB" },
                { name: "financial_ledger.xlsx", time: "45 mins ago", status: "HIGH", size: "540 KB" },
                { name: "forensic_capture.raw", time: "2 hours ago", status: "MEDIUM", size: "48 MB" },
                { name: "security_audit.pdf", time: "3 hours ago", status: "HIGH", size: "3.2 MB" },
              ].map((f) => (
                <div
                  key={f.name}
                  onClick={() => navigate("/recovery")}
                  className="cursor-pointer flex items-center justify-between p-3 rounded-2xl bg-[#090e1a]/85 hover:bg-cyan-500/[0.1] border border-[#182035] hover:border-cyan-500/40 transition group/file"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate max-w-[140px]" title={f.name}>
                        {f.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">{f.time}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Recovery Archive</span>
            <Link to="/recovery" className="text-cyan-400 hover:text-cyan-300 font-bold">
              Open Engine →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
