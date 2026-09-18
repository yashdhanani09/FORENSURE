import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { agentConnection, type AgentStatus } from "../services/agentConnection";
import { 
  ShieldCheck, AlertTriangle, Download, RefreshCw, 
  CheckCircle2, Sparkles, MonitorSmartphone, X, ExternalLink,
  BookOpen, ShieldAlert
} from "lucide-react";
import { recoveryApi } from "../services/recoveryApi";

export function AgentStatusBar() {
  const [status, setStatus] = useState<AgentStatus>(agentConnection.getStatus());
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = agentConnection.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsub;
  }, []);

  const checkPrivileges = async () => {
    if (!status.connected) {
      setIsAdmin(null);
      return;
    }
    try {
      const p = await recoveryApi.getPrivileges();
      setIsAdmin(p.is_admin);
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    if (status.connected) {
      checkPrivileges();
    } else {
      setIsAdmin(null);
    }
  }, [status.connected]);

  const handleRecheck = async () => {
    setChecking(true);
    await agentConnection.checkConnection();
    await checkPrivileges();
    setChecking(false);
  };

  const handleToggleDemo = (enable: boolean) => {
    agentConnection.setDemoMode(enable);
    window.location.reload();
  };

  return (
    <>
      {/* ── Status Bar Strip ── */}
      <div className="w-full bg-[#0b0f19] border-b border-[#1e2c40] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-30 select-none">
        <div className="flex items-center gap-2.5">
          {status.demoMode ? (
            <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-semibold shadow-sm">
              <Sparkles className="h-3 w-3 text-purple-400" />
              DEMO MODE ACTIVE
            </span>
          ) : status.connected ? (
            <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              PHYSICAL HARDWARE BRIDGE CONNECTED (PORT 8000)
            </span>
          ) : (
            <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[11px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              HARDWARE BRIDGE DISCONNECTED
            </span>
          )}

          <span className="text-slate-400 text-[11px] hidden sm:inline">
            {status.demoMode
              ? "Simulated Forensic Sandbox — Performing carving, wiping, and evidence verification with simulated devices."
              : status.connected
              ? "Live physical disk probing, MTP detection, and raw carving active."
              : "Online mode cannot probe local hardware without the Hardware Bridge."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status.demoMode ? (
            /* ── ONLY DEMO CONTROLS (No agent stuff) ── */
            <>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-[#1e2c40] text-slate-400 text-[11px] font-mono">
                Storage: SanDisk 64GB • Samsung T7 • Pixel 8
              </span>
              <button
                onClick={() => handleToggleDemo(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-[#1e2c40] text-slate-300 hover:text-white text-[11px] font-medium transition"
              >
                Exit Demo Mode
              </button>
            </>
          ) : (
            /* ── PHYSICAL HARDWARE CONTROLS ── */
            <>
              {/* Administrator Elevation Status Badge / Guide Link */}
              {status.connected && (
                isAdmin ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Admin Mode
                  </span>
                ) : (
                  <Link
                    to="/agent-guide"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-[11px] transition shadow-sm"
                    title="Administrator privileges are mandatory for raw physical sector access. Configure in Hardware Guide."
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    Admin Required (Guide)
                  </Link>
                )
              )}

              <button
                onClick={() => handleToggleDemo(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 font-semibold text-[11px] transition shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Demo Mode
              </button>

              <Link
                to="/agent-guide"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-[#1e2c40] text-slate-300 hover:text-white font-semibold text-[11px] transition"
              >
                <BookOpen className="h-3 w-3 text-cyan-400" />
                Setup Guide
              </Link>

              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-[11px] transition shadow-glow"
              >
                <Download className="h-3 w-3" />
                {status.connected ? "Bridge Info" : "Download Bridge"}
              </button>

              <button
                onClick={handleRecheck}
                disabled={checking}
                title="Recheck connection to localhost:8000"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-[#1e2c40] text-slate-400 hover:text-slate-200 transition"
              >
                <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Agent Download / Information Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl border border-[#1e2c40] bg-[#0d1424] p-6 shadow-2xl text-slate-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <MonitorSmartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">FORENSURE Hardware Bridge</h3>
                <p className="text-xs text-slate-400">Physical Storage Probing, Raw Sector Carving & Recovery</p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <p>
                Because web browsers operate inside a security sandbox, no website can directly read physical storage devices, raw disk sectors, or unallocated NTFS clusters.
              </p>
              <p>
                The <strong className="text-cyan-400">FORENSURE Bridge</strong> runs locally on your PC (port 8000) to execute low-level hardware probing, deep physical cluster scanning, and NTFS MFT recovery.
              </p>

              <div className="rounded-xl border border-[#1e2c40] bg-[#090e1a] p-4 space-y-2">
                <div className="flex items-center justify-between text-slate-400 font-mono">
                  <span>Current Status:</span>
                  <span className={status.connected ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {status.connected ? "● ACTIVE & CONNECTED" : "○ NOT RUNNING"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>Privilege Level:</span>
                  <span className={isAdmin ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {isAdmin ? "● ADMINISTRATOR (FULL RAW ACCESS)" : "○ STANDARD USER (UAC Recommended)"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>Local Port:</span>
                  <span className="text-slate-200">http://127.0.0.1:8000</span>
                </div>
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>Compatibility:</span>
                  <span className="text-slate-200">Windows 10 / 11 (64-bit)</span>
                </div>
              </div>

                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Quick Setup Options</h4>
                <div className="space-y-2 text-slate-300">
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px]">
                    <span className="font-bold text-emerald-400">Option 1 (Recommended — Silent Auto-Admin):</span>
                    <p className="text-slate-400 mt-0.5">
                      Right-click <code className="text-emerald-300 bg-black/40 px-1 rounded">SETUP-AUTO-ADMIN.bat</code> → <em>"Run as administrator"</em> once. The bridge runs silently with zero terminal clutter and zero UAC prompts forever!
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-[#1e2c40] text-[11px]">
                    <span className="font-bold text-cyan-400">Option 2 (Interactive Terminal):</span>
                    <p className="text-slate-400 mt-0.5">
                      Double-click <code className="text-cyan-300 bg-black/40 px-1 rounded">START-BRIDGE.bat</code> or <code className="text-cyan-300 bg-black/40 px-1 rounded">RUN-AS-ADMIN.bat</code>.
                    </p>
                  </div>
                </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-[#1e2c40]">
              <button
                onClick={() => {
                  handleToggleDemo(true);
                  setShowModal(false);
                }}
                className="px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> Continue in Demo Mode
              </button>

              <div className="flex items-center gap-2">
                <Link
                  to="/agent-guide"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition"
                >
                  Full Setup Guide →
                </Link>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Close
                </button>
                <a
                  href="https://github.com/yashdhanani09/FORENSURE/raw/main/frontend/public/FORENSURE-Bridge-Windows.zip"
                  download="FORENSURE-Bridge-Windows.zip"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-glow"
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
