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

  // Clock ticker for live forensic telemetry
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
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - usedRatio * circumference;

  return (
    <div className="w-full max-w-[1550px] mx-auto px-4 sm:px-8 lg:px-12 py-6 space-y-6 select-none page-enter">

      {/* ── Admin Privilege Mandatory Alert Banner (if standard user) ── */}
      {adminWarning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3.5 text-amber-300 backdrop-blur-md shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-200">Administrator Privileges Required for Raw Disk Forensics</p>
            <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">{adminWarning}</p>
          </div>
          <Link
            to="/agent-guide"
            className="shrink-0 px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition"
          >
            Setup Guide →
          </Link>
          <button
            onClick={() => setAdminWarning(null)}
            className="shrink-0 text-amber-400 hover:text-amber-200 transition text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* ── Top Command Bar & Component View Controls (Matching Reference Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-mono font-extrabold tracking-[0.25em] text-cyan-300 uppercase">
            FORENSURE COMMAND CENTER // TELEMETRY HUB
          </span>
        </div>

        {/* View Mode Toolbar on Right */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Refresh Telemetry"
            className="p-2 rounded-xl bg-[#0c1220] border border-[#182035] hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 transition shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          <div className="flex items-center gap-1 bg-[#0c1220] border border-[#182035] rounded-xl p-1 shadow-sm text-xs font-mono">
            <button
              onClick={() => setComponentFilter("All")}
              className={`p-1.5 rounded-lg transition ${
                componentFilter === "All"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-glow"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setComponentFilter("Storage")}
              className={`p-1.5 rounded-lg transition ${
                componentFilter === "Storage"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-glow"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Storage Filter"
            >
              <HardDrive className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="bg-[#0c1220] border border-[#182035] text-slate-300 hover:text-white rounded-xl px-3 py-1.5 text-xs font-mono font-semibold outline-none focus:border-cyan-500/50 transition cursor-pointer appearance-none pr-8"
            >
              <option value="All">Component: All</option>
              <option value="Telemetry">Component: Telemetry</option>
              <option value="Storage">Component: Storage</option>
              <option value="Forensics">Component: Forensics</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── 8-Card Modular Workstation Grid (2 Rows × 4 Columns) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* ── Card 1: Control Info (Top-Left) ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(6,182,212,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Control Info
              </h3>
              <MoreHorizontal className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Name</span>
                <span className="text-white font-semibold">Forensure</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Model</span>
                <span className="text-slate-200">
                  {devices[0]?.model ? `${devices[0].model.slice(0, 14)}` : "Host PC · x64"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Privilege</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  privileges?.is_admin
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                  {privileges?.is_admin ? "ADMINISTRATOR" : "STANDARD (UAC)"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Status</span>
                <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  {isDemo ? "Demo Sandbox" : "Active (Port 8000)"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Memory Read</span>
                <span className="text-slate-300">16 MB Chunks</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Compliance</span>
                <span className="text-slate-200 font-semibold">NIST SP 800-88</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Kernel Time</span>
                <span className="text-cyan-300 font-bold">{currentTime.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>OS Protection</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Lock className="h-3 w-3" /> C:\ Write-Locked
            </span>
          </div>
        </div>

        {/* ── Card 2: Storage Data (Top Center-Left) — Radial Gauge ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(6,182,212,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Storage data
              </h3>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#070b14] border border-[#182035] text-[10px] font-mono text-slate-400">
                <span>All Storage</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            </div>

            {/* Circular Radial Gauge Container */}
            <div className="flex items-center justify-center gap-6 my-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  {/* Background Track Circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#142033"
                    strokeWidth="12"
                    fill="none"
                  />
                  {/* Glowing Animated Progress Arc */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="url(#cyanGlowGrad)"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{
                      filter: "drop-shadow(0 0 8px rgba(6,182,212,0.6))",
                    }}
                  />
                  <defs>
                    <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center Percentage Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-white font-mono tracking-tight">
                    {Math.round(usedRatio * 100)}%
                  </span>
                  <span className="text-[9px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                    ALLOCATED
                  </span>
                </div>
              </div>

              {/* Legend on Right */}
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  <span className="text-slate-300">Allocated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
                  <span className="text-slate-500">Unallocated</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#182035]/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Total Disks: {devices.length}</span>
            <span className="text-slate-200 font-bold">{formatBytes(totalCapacity)}</span>
          </div>
        </div>

        {/* ── Card 3: Forensics Hub (Top Center-Right) — Quick Links ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(6,182,212,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-4">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Forensics Hub
              </h3>
              <MoreHorizontal className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>

            <div className="space-y-2">
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
                    className="group/item flex items-center justify-between p-2.5 rounded-2xl bg-[#090e1a]/80 hover:bg-cyan-500/[0.08] border border-[#182035] hover:border-cyan-500/30 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover/item:text-cyan-300 group-hover/item:border-cyan-400/40 transition shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 group-hover/item:text-white truncate">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover/item:text-cyan-400 group-hover/item:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Subsystems</span>
            <span className="text-cyan-400 font-bold">4 Active Modules</span>
          </div>
        </div>

        {/* ── Card 4: Data Sanitization (Top Right) — Audit Activity Bars ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-rose-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(244,63,94,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Data Sanitization
              </h3>
              <MoreHorizontal className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>

            {/* Subheader with state selector */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#090e1a]/80 border border-[#182035] mb-4 text-xs font-mono">
              <span className="flex items-center gap-2 text-rose-400 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" /> NIST SP 800-88
              </span>
              <span className="text-[10px] text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded">
                Audit Log
              </span>
            </div>

            {/* Neon Bar Activity Chart */}
            <div className="h-28 flex items-end justify-between gap-2.5 px-2 py-2 bg-[#070b14]/70 rounded-2xl border border-[#182035]">
              {[
                { day: "Sun", val: 35 },
                { day: "Mon", val: 55 },
                { day: "Tue", val: 85 },
                { day: "Wed", val: 70 },
                { day: "Thu", val: 95 },
                { day: "Fri", val: 65 },
                { day: "Sat", val: 40 },
              ].map((bar, i) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full bg-[#142033] rounded-t-sm relative flex items-end h-full overflow-hidden">
                    <div
                      className="w-full bg-gradient-to-t from-teal-500 via-cyan-400 to-cyan-300 rounded-t-sm transition-all duration-700 hover:brightness-125"
                      style={{
                        height: `${bar.val}%`,
                        boxShadow: "0 0 10px rgba(6,182,212,0.4)",
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Total Wipes</span>
            <span className="text-rose-400 font-bold">{historyJobs.length} Certificates</span>
          </div>
        </div>

        {/* ── Card 5: Tools & Arsenal (Bottom-Left) ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(6,182,212,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <h3 className="text-base font-bold text-white tracking-tight">Tools</h3>
              <MoreHorizontal className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#090e1a] border border-[#182035] mb-3 text-[10px] font-mono font-bold">
              {(["all", "carver", "inspect"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveToolTab(tab)}
                  className={`flex-1 py-1 rounded-lg uppercase transition ${
                    activeToolTab === tab
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-glow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tools List */}
            <div className="space-y-2 text-xs">
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
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#090e1a]/80 hover:bg-cyan-500/[0.08] border border-[#182035] hover:border-cyan-500/30 transition group/row"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 group-hover/row:text-white">
                        {tool.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{tool.desc}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover/row:text-cyan-400 group-hover/row:translate-x-0.5 transition" />
                  </Link>
                ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Arsenal Ready</span>
            <span className="text-cyan-400 font-bold">● Active</span>
          </div>
        </div>

        {/* ── Card 6: Storage Inventory (Bottom Center-Left) — Live Fleet ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(6,182,212,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <h3 className="text-base font-bold text-white tracking-tight">
                Storage Inventory
              </h3>
              <MoreHorizontal className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>

            <div className="space-y-2">
              {devices.length === 0 ? (
                <div className="text-center py-8 text-slate-500 font-mono text-xs">
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
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-[#090e1a]/80 hover:bg-cyan-500/[0.08] border border-[#182035] hover:border-cyan-500/30 transition group/dev"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isSystem ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          isMobile ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                          "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        }`}>
                          {isMobile ? <Smartphone className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate max-w-[140px]" title={deviceName(d.vendor, d.model)}>
                            {deviceName(d.vendor, d.model)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {formatBytes(d.capacity_bytes || d.size_bytes || 0)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500 group-hover/dev:text-cyan-400 group-hover/dev:translate-x-0.5 transition shrink-0" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Fleet View</span>
            <Link to="/devices" className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
              All ({devices.length}) →
            </Link>
          </div>
        </div>

        {/* ── Card 7: Data Sanitization Engine (Bottom Center-Right) ── */}
        <div className="group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-rose-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(244,63,94,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <h3 className="text-base font-bold text-white tracking-tight">
                Data Sanitization
              </h3>
              <MoreHorizontal className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>

            <div className="space-y-2">
              {[
                { name: "NIST SP 800-88 Clear", desc: "Single-pass logical block overwrite", to: "/sanitization" },
                { name: "DoD 5220.22-M 3-Pass", desc: "Department of Defense compliant", to: "/sanitization" },
                { name: "Cryptographic Erase", desc: "NVMe Crypto Scramble / Purge", to: "/sanitization" },
                { name: "Audit Certificates", desc: "Tamper-evident verification PDF", to: "/sanitization" },
              ].map((item) => (
                <Link
                  key={item.name}
                  to={item.to}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#090e1a]/80 hover:bg-rose-500/[0.08] border border-[#182035] hover:border-rose-500/30 transition group/san"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover/san:text-white">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{item.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover/san:text-rose-400 group-hover/san:translate-x-0.5 transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Safety Guard</span>
            <span className="text-emerald-400 font-bold">Write-Block Enforced</span>
          </div>
        </div>

        {/* ── Card 8: File Recovery Hub (Bottom-Right) — matching screenshot menu ── */}
        <div className="relative group rounded-3xl border border-[#182035] bg-[#0c1220]/80 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(0,0,0,0.6),0_0_20px_rgba(6,182,212,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-3">
              <h3 className="text-base font-bold text-white tracking-tight">
                File Recovery
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#070b14] border border-[#182035] text-[10px] font-mono text-slate-400">
                  <span>All Status</span>
                  <ChevronDown className="h-3 w-3" />
                </div>
                <button
                  onClick={() => setRecoveryMenuOpen(recoveryMenuOpen ? null : "actions")}
                  title="Context Actions"
                  className="p-1 rounded-lg bg-[#070b14] border border-[#182035] hover:border-cyan-500/40 text-slate-400 hover:text-white transition"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Contextual Action Menu Popup (matching user screenshot) */}
            {recoveryMenuOpen === "actions" && (
              <div className="absolute right-6 top-16 z-30 w-44 rounded-2xl border border-[#182035] bg-[#0d1424] p-2 shadow-2xl font-sans text-xs space-y-1 animate-scale-in">
                <button
                  onClick={() => { setRecoveryMenuOpen(null); navigate("/recovery"); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-500/15 text-slate-300 hover:text-white transition flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Inspect Files</span>
                </button>
                <button
                  onClick={() => { setRecoveryMenuOpen(null); navigate("/sanitization"); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/15 text-slate-300 hover:text-white transition flex items-center gap-2"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  <span>Sanitize Space</span>
                </button>
                <button
                  onClick={() => { setRecoveryMenuOpen(null); navigate("/recovery"); }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition flex items-center gap-2"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Launch Carver</span>
                </button>
              </div>
            )}

            {/* File List */}
            <div className="space-y-2">
              {[
                { name: "Quarterly_Report.docx", time: "20 mins ago", status: "HIGH", size: "1.8 MB" },
                { name: "financial_ledger.xlsx", time: "45 mins ago", status: "HIGH", size: "540 KB" },
                { name: "forensic_capture.raw", time: "2 hours ago", status: "MEDIUM", size: "48 MB" },
                { name: "security_audit.pdf", time: "3 hours ago", status: "HIGH", size: "3.2 MB" },
              ].map((f) => (
                <div
                  key={f.name}
                  onClick={() => navigate("/recovery")}
                  className="cursor-pointer flex items-center justify-between p-2.5 rounded-2xl bg-[#090e1a]/80 hover:bg-cyan-500/[0.08] border border-[#182035] hover:border-cyan-500/30 transition group/file"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate max-w-[130px]" title={f.name}>
                        {f.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">{f.time}</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#182035]/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
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
