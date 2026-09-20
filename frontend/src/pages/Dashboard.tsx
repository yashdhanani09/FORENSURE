import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deviceApi, sanitizationApi } from "../services/api";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Button } from "../components/ui/button";
import { HoverRevealCard } from "../components/HoverRevealCard";
import { 
  Shield, HardDrive, FileSearch, RotateCcw, 
  ShieldAlert, Activity, CheckCircle2, AlertTriangle, 
  Download, ArrowRight, Smartphone, DatabaseZap, RefreshCw
} from "lucide-react";

export function Dashboard() {
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminWarning, setAdminWarning] = useState<string | null>(null);
  const navigate = useNavigate();

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
        // Graceful fallback if history is not available
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

  const totalCapacity = devices.reduce((acc, d) => acc + (d.capacity_bytes || d.size_bytes || 0), 0);
  const safeDevices = devices.filter(d => !d.system_disk);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 select-none page-enter">

      {/* ── Admin Privilege Warning Banner ── */}
      {adminWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-200">Administrator privileges required</p>
            <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">{adminWarning}</p>
          </div>
          <button
            onClick={() => setAdminWarning(null)}
            className="shrink-0 text-amber-400 hover:text-amber-200 transition text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Top Welcome & Telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2c40] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase mb-1">
            <Activity className="h-3.5 w-3.5 animate-pulse" /> COMMAND & TELEMETRY CENTER
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Digital Forensics & Storage Security
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Enterprise hardware probe, read-only acquisition, deleted file carving, and NIST-compliant sanitization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} loading={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-mono font-semibold shadow-glow">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            ENGINE ONLINE
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase">Detected Storage</span>
            <HardDrive className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{devices.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total Capacity: {formatBytes(totalCapacity)}</p>
        </div>

        <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase truncate">Detected Storage</span>
            <HardDrive className="h-4 w-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-2xl font-black text-white font-mono truncate">{devices.length}</div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">Total Capacity: {formatBytes(totalCapacity)}</p>
        </div>

        <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase truncate">Safe Targets</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono truncate">{safeDevices.length}</div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">Cleared for Forensics & Erase</p>
        </div>

        <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase truncate">OS Protection</span>
            <Shield className="h-4 w-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono truncate">ACTIVE</div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">System drive (C:) write-locked</p>
        </div>

        <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase truncate">Sanitization Audit</span>
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          </div>
          <div className="text-2xl font-black text-white font-mono truncate">{historyJobs.length}</div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">Certificates on file</p>
        </div>
      </div>

      {/* ── Quick Launchpad ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ paddingTop: "1rem" }}>
        {/* Card 01 — Forensic File Recovery (cyan) */}
        <HoverRevealCard
          cardNumber="01"
          title="Forensic File Recovery"
          subtitle="Scan and restore deleted records from NTFS $RECYCLE.BIN and raw clusters with SHA-256 integrity verification."
          panelGradient="linear-gradient(135deg, #0ea5e9 0%, #0284c7 60%, #075985 100%)"
          iridGradient="linear-gradient(135deg, #06b6d4, #0ea5e9, #a78bfa, #38bdf8, #0ea5e9, #06b6d4)"
          notchPath="M0,0 H280 V120 H50 Q0,120 0,75 Z"
          accentColor="#0ea5e9"
          onClick={() => navigate('/recovery')}
          objectAsset={
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="18" fill="url(#rg1)" opacity="0.9"/>
              <defs>
                <radialGradient id="rg1" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#bae6fd"/>
                  <stop offset="100%" stopColor="#0284c7"/>
                </radialGradient>
              </defs>
              <path d="M14 28 Q22 10 30 28" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="22" cy="28" r="3.5" fill="#fff" opacity="0.9"/>
              <path d="M18 22 L22 18 L26 22" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          }
        />

        {/* Card 02 — Data Sanitization (rose) */}
        <HoverRevealCard
          cardNumber="02"
          title="Data Sanitization"
          subtitle="Cryptographic wiping to NIST SP 800-88 Clear and DoD 5220.22-M with tamper-evident PDF certificates."
          panelGradient="linear-gradient(135deg, #f43f5e 0%, #be185d 60%, #9d174d 100%)"
          iridGradient="linear-gradient(135deg, #fb7185, #f43f5e, #c084fc, #fb7185, #f9a8d4, #f43f5e)"
          notchPath="M0,0 H280 V120 H50 Q0,120 0,75 Z"
          accentColor="#f43f5e"
          onClick={() => navigate('/sanitization')}
          objectAsset={
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="18" fill="url(#rg2)" opacity="0.9"/>
              <defs>
                <radialGradient id="rg2" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fda4af"/>
                  <stop offset="100%" stopColor="#be185d"/>
                </radialGradient>
              </defs>
              <path d="M22 12 L24.5 19 H32 L26 23.5 L28.5 30.5 L22 26 L15.5 30.5 L18 23.5 L12 19 H19.5 Z" fill="#fff" opacity="0.92"/>
            </svg>
          }
        />

        {/* Card 03 — Forensic Case Hub (indigo) */}
        <HoverRevealCard
          cardNumber="03"
          title="Forensic Case Hub"
          subtitle="Create forensic cases, acquire read-only bitstream disk images, and maintain legal chain-of-custody."
          panelGradient="linear-gradient(135deg, #6366f1 0%, #4338ca 60%, #312e81 100%)"
          iridGradient="linear-gradient(135deg, #818cf8, #6366f1, #38bdf8, #a78bfa, #6366f1, #818cf8)"
          notchPath="M0,0 H280 V120 H50 Q0,120 0,75 Z"
          accentColor="#6366f1"
          onClick={() => navigate('/forensics')}
          objectAsset={
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="18" fill="url(#rg3)" opacity="0.9"/>
              <defs>
                <radialGradient id="rg3" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#c7d2fe"/>
                  <stop offset="100%" stopColor="#4338ca"/>
                </radialGradient>
              </defs>
              <rect x="13" y="15" width="18" height="14" rx="2" fill="#fff" opacity="0.15" stroke="#fff" strokeWidth="1.8"/>
              <path d="M17 20 H27 M17 24 H23" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="28" cy="27" r="4.5" fill="#fff" opacity="0.9"/>
              <path d="M27 27 L28 28.2 L30 26" stroke="#4338ca" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        />
      </div>

      {/* Connected Devices Fleet */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-cyan-400" /> Discovered Storage Fleet
            </h2>
            <p className="text-xs text-slate-400">
              Live hardware probe detecting internal SSDs, non-system volumes, USB thumb drives, and mobile devices.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/devices')}>
            View Full Inventory
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1e2c40] bg-[#0f172a]/50 p-12 text-center">
            <HardDrive className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-semibold">No storage devices detected.</p>
            <p className="text-xs text-slate-500 mt-1">Plug in a USB drive or mobile phone in MTP mode.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {devices.map((dev) => {
              const isSystem = dev.system_disk;
              const isMobile = dev.device_type === "MOBILE_DEVICE";

              return (
                <div 
                  key={dev.id}
                  className={`rounded-2xl border bg-[#0f172a]/90 backdrop-blur-sm p-6 shadow-xl flex flex-col justify-between transition-all duration-200 overflow-hidden ${
                    isSystem 
                      ? "border-rose-500/30 bg-gradient-to-b from-[#0f172a] to-rose-950/10" 
                      : isMobile 
                      ? "border-purple-500/30 bg-gradient-to-b from-[#0f172a] to-purple-950/10"
                      : "border-[#1e2c40] hover:border-cyan-500/40"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isSystem ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          isMobile ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                          "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        }`}>
                          {isMobile ? <Smartphone className="h-5 w-5" /> : <HardDrive className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-white truncate" title={`${dev.vendor ? `${dev.vendor} ` : ""}${dev.model || ""}`}>
                            {dev.vendor ? `${dev.vendor} ` : ""}{dev.model}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate" title={dev.device_path}>{dev.device_path}</p>
                        </div>
                      </div>

                      <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap ${
                        isSystem 
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                          : isMobile 
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}>
                        {isSystem ? "SYSTEM OS" : (dev.device_type === "MOBILE_DEVICE" ? "MOBILE" : dev.device_type === "DATA_VOLUME" ? "VOLUME" : "STORAGE")}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-slate-400 border-t border-[#1e2c40]/80 pt-3 mb-5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="shrink-0 text-slate-400">Capacity:</span>
                        <span className="text-slate-200 font-bold truncate text-right">
                          {formatBytes(dev.capacity_bytes || dev.size_bytes || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="shrink-0 text-slate-400">Mount Point:</span>
                        <span className="text-slate-200 truncate max-w-[150px] text-right" title={dev.mount_point || "Not mounted"}>{dev.mount_point || "Not mounted"}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="shrink-0 text-slate-400">Bus Interface:</span>
                        <span className="text-cyan-400 uppercase truncate text-right">{dev.transport || dev.device_type || "Internal"}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isSystem ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-center text-xs font-bold flex items-center justify-center gap-2">
                        <Shield className="h-4 w-4" /> PROTECTED SYSTEM BOOT DISK
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => navigate('/sanitization')}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" /> Sanitize
                        </Button>
                        <Button 
                          variant="forensic" 
                          size="sm"
                          onClick={() => navigate('/forensics')}
                        >
                          <FileSearch className="h-3.5 w-3.5" /> Forensics
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Sanitization & Evidence Log */}
      {historyJobs.length > 0 && (
        <div className="space-y-4 border-t border-[#1e2c40] pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <DatabaseZap className="h-5 w-5 text-emerald-400" /> Recent Forensic & Sanitization Certifications
              </h2>
              <p className="text-xs text-slate-400">Cryptographically verifiable evidence of permanent data destruction.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/sanitization')}>
              Full Audit History
            </Button>
          </div>

          <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Certificate / Job ID</th>
                  <th className="p-4">Target</th>
                  <th className="p-4">Standard</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2c40]/60">
                {historyJobs.slice(0, 5).map((job) => (
                  <tr key={job.job_id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 font-bold text-white">{job.job_id}</td>
                    <td className="p-4 text-slate-300 max-w-[200px] truncate" title={job.target_file_path}>
                      {job.target_file_path || "FULL DEVICE"}
                    </td>
                    <td className="p-4 text-cyan-400 uppercase">{job.pattern || job.method}</td>
                    <td className="p-4 text-slate-400 font-sans">
                      {job.completed_at ? formatDate(job.completed_at) : "—"}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4 font-sans">
                      <a
                        href={sanitizationApi.getCertificateUrl(job.job_id)}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold transition border border-cyan-500/30"
                      >
                        <Download className="h-3 w-3" /> PDF Cert
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
