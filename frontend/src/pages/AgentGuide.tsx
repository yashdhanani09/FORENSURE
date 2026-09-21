import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { agentConnection, type AgentStatus } from "../services/agentConnection";
import { recoveryApi, type RecoveryPrivileges } from "../services/recoveryApi";
import { deviceApi } from "../services/api";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatMountPoint } from "../utils/format";
import {
  Download, Terminal, HardDrive, RefreshCw, CheckCircle2,
  ArrowRight, Cpu, MonitorSmartphone, Plug, ShieldCheck,
  LayoutDashboard, Sparkles, ChevronLeft, ShieldAlert, Shield,
  Copy, Check, Smartphone, Activity, Info
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// STEP CONFIG — edit this array to customise the entire flow
// ─────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "download",
    number: "01",
    icon: Download,
    title: "Download FORENSURE Bridge",
    task: "Get the pre-compiled local hardware agent for Windows",
    detail:
      "The Bridge is a zero-install standalone binary (~29 MB). No Python, Node.js, or any runtime is required. Extract the zip and double-click START-FORENSURE.bat — it handles antivirus exclusion, admin setup, and launching the bridge all in one click.",
    badge: "29 MB • Standalone EXE",
    badgeColor: "cyan",
    command: null,
    actionLabel: "Download FORENSURE-Bridge-Windows.zip",
    actionHref:
      "https://github.com/yashdhanani09/FORENSURE/raw/main/frontend/public/FORENSURE-Bridge-Windows.zip",
    actionDownload: "FORENSURE-Bridge-Windows.zip",
    confirmLabel: "I've downloaded the zip file",
  },
  {
    id: "extract",
    number: "02",
    icon: ShieldCheck,
    title: "Extract & Launch — One Click",
    task: "Double-click START-FORENSURE.bat — it handles everything automatically",
    detail:
      "After extracting the zip, just double-click START-FORENSURE.bat. It automatically: adds Windows Defender exclusion (fixes virus alerts), registers the bridge to start with Windows (no UAC popups ever again), and launches the bridge — all in one go. No need to touch any other file.",
    badge: "ONE CLICK SETUP",
    badgeColor: "emerald",
    command: `[RECOMMENDED — One-Click Setup]:
    Double-click START-FORENSURE.bat
    -> Adds Windows Defender exclusion (no more virus alerts)
    -> Kills any old bridge process on port 8000
    -> Registers auto-start Windows Task with Highest Privileges
    -> Launches FORENSURE Bridge as Administrator
    -> Opens the web app in your browser
    (UAC will prompt once — click Yes)

[Advanced — Individual Scripts]:
    ADD-DEFENDER-EXCLUSION.bat  -> Whitelist folder in Defender only
    SETUP-AUTO-ADMIN.bat        -> Register auto-start task only
    RUN-AS-ADMIN.bat            -> Start bridge manually (visible terminal)
    STOP-BRIDGE.bat             -> Stop the running bridge`,
    actionLabel: null,
    confirmLabel: "Bridge is running as Administrator",
  },
  {
    id: "connect",
    number: "03",
    icon: Plug,
    title: "Plug In Your Storage Device",
    task: "Connect the physical hardware you want to inspect",
    detail:
      "Connect any USB thumb drive, external HDD/SSD, SD card reader, or Android phone in MTP mode. The agent uses PowerShell Get-Disk to discover and enumerate physical units in real-time. Hot-plug is fully supported.",
    badge: "Hot-Plug Supported",
    badgeColor: "emerald",
    command: null,
    chips: ["USB 3.0 / 3.2", "NVMe Enclosure", "Android MTP", "SD / MicroSD", "External HDD"],
    actionLabel: null,
    confirmLabel: "Device is connected and visible in Windows",
  },
  {
    id: "verify",
    number: "04",
    icon: RefreshCw,
    title: "Verify Bridge & Mandatory Administrator Mode",
    task: "Confirm bridge connection and verify kernel-level Administrator privileges",
    detail:
      "Click the button below to test the connection and verify that the bridge is elevated with Highest Administrator Privileges. Both connection and Administrator privileges must be active before proceeding to forensic scanning.",
    badge: "Verification Required",
    badgeColor: "cyan",
    command: null,
    actionLabel: "Verify Bridge & Privileges",
    confirmLabel: "System verified — all checks passed",
    isVerify: true,
  },
  {
    id: "complete",
    number: "05",
    icon: ShieldCheck,
    title: "All Systems Ready",
    task: "Physical hardware inspection and raw carving are fully operational",
    detail:
      "Your local bridge is online with verified Administrator privileges. You are now equipped to scan raw physical sectors, parse NTFS $MFT, and perform complete forensic recovery.",
    badge: "LIVE & ELEVATED",
    badgeColor: "emerald",
    command: null,
    isFinal: true,
  },
];

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const NODE_COLORS: Record<string, string> = {
  cyan: "border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.4)]",
  amber: "border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.4)]",
  emerald:
    "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.4)]",
  rose: "border-rose-500 bg-rose-500/20 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.4)]",
};

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

/** Animated SVG checkmark that strokes in */
function Checkmark({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline
        points="4,13 9,18 20,7"
        stroke="currentColor"
        strokeDasharray={24}
        strokeDashoffset={visible ? 0 : 24}
        style={{
          transition: visible ? "stroke-dashoffset 0.35s cubic-bezier(.4,0,.2,1)" : "none",
        }}
      />
    </svg>
  );
}

/** Left rail node */
function RailNode({
  step,
  index,
  active,
  completed,
  onClick,
}: {
  step: (typeof STEPS)[number];
  index: number;
  active: boolean;
  completed: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const baseNode =
    "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-black transition-all duration-300 cursor-pointer select-none";

  const nodeStyle = completed
    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.35)]"
    : active
    ? NODE_COLORS[step.badgeColor] || NODE_COLORS.cyan
    : "border-slate-700 bg-[#0b0f19] text-slate-600";

  const scale = active && !prefersReduced ? "scale-110" : "scale-100";

  return (
    <button
      onClick={onClick}
      aria-label={`Go to step ${index + 1}: ${step.title}`}
      className={`${baseNode} ${nodeStyle} ${scale} focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`}
      style={{ transform: active && !prefersReduced ? "scale(1.12)" : "scale(1)" }}
    >
      {completed ? (
        <span className="text-emerald-400">
          <Checkmark visible={completed} />
        </span>
      ) : (
        <Icon className="h-5 w-5" />
      )}
    </button>
  );
}

/** The connector line segment between two nodes */
function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="mx-auto my-1 w-0.5 flex-1 overflow-hidden rounded-full bg-slate-800" style={{ minHeight: 28 }}>
      <div
        className="w-full rounded-full bg-emerald-500 transition-all duration-500 ease-in-out"
        style={{ height: filled ? "100%" : "0%" }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────
export function AgentGuide() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(agentConnection.getStatus());
  const [activeIdx, setActiveIdx] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(Array(STEPS.length).fill(false));
  const [checking, setChecking] = useState(false);
  const [panelKey, setPanelKey] = useState(0); // force re-mount for animation
  const navigate = useNavigate();

  // Administrator Privileges & Elevation State (ONLY in Hardware Guide)
  const [privileges, setPrivileges] = useState<RecoveryPrivileges | null>(null);
  const [elevating, setElevating] = useState(false);
  const [elevationStatus, setElevationStatus] = useState<string | null>(null);
  const [manualCommand, setManualCommand] = useState<string>(
    'powershell -Command "Start-Process cmd -ArgumentList \'/k cd /d D:\\SIH && RUN-AS-ADMIN.bat\' -Verb RunAs"'
  );
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Live Physical Storage Devices State
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const fetchDrives = async () => {
    setLoadingDevices(true);
    try {
      const res = await deviceApi.list({ refresh: true });
      setDevices(res.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, [agentStatus.connected]);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const unsub = agentConnection.subscribe(setAgentStatus);
    return unsub;
  }, []);

  const checkPrivileges = async () => {
    if (!agentStatus.connected) {
      setPrivileges(null);
      return null;
    }
    try {
      const p = await recoveryApi.getPrivileges();
      setPrivileges(p);
      return p;
    } catch {
      setPrivileges(null);
      return null;
    }
  };

  useEffect(() => {
    if (agentStatus.connected) {
      checkPrivileges();
    } else {
      setPrivileges(null);
    }
  }, [agentStatus.connected]);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleElevate = async () => {
    setElevating(true);
    setElevationStatus("Requesting Administrator Privileges (UAC)...");
    try {
      const res = await recoveryApi.requestElevation();
      if (res.manual_command) {
        setManualCommand(res.manual_command);
      }
      if (res.status === "ALREADY_ADMIN") {
        setElevationStatus("Already running with Administrator privileges!");
        await checkPrivileges();
        setElevating(false);
      } else if (res.status === "AUTO_ELEVATED") {
        setElevationStatus("Silent Administrator elevation task triggered! Monitoring status...");
        pollForPrivileges();
      } else {
        setElevationStatus("UAC prompt launched! Please click 'Yes' on the Windows confirmation dialog.");
        pollForPrivileges();
      }
    } catch (e: any) {
      console.warn("Elevation failed:", e);
      setElevationStatus("Elevation request failed or canceled. Please right-click SETUP-AUTO-ADMIN.bat and select 'Run as administrator'.");
      setElevating(false);
    }
  };

  const pollForPrivileges = () => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const p = await recoveryApi.getPrivileges();
        if (p.is_admin) {
          setPrivileges(p);
          setElevationStatus("✓ Administrator privileges granted successfully! Kernel raw sector access is active.");
          clearInterval(interval);
          setElevating(false);
          return;
        }
      } catch {
        // Bridge restarting elevated
      }
      if (attempts >= 30) {
        clearInterval(interval);
        setElevating(false);
        checkPrivileges();
      }
    }, 1500);
  };

  // Auto-advance verify step when BOTH connection and Administrator mode are verified
  useEffect(() => {
    const verifyIdx = STEPS.findIndex((s) => s.isVerify);
    if (agentStatus.connected && privileges?.is_admin && activeIdx === verifyIdx && !completed[verifyIdx]) {
      const t = setTimeout(() => markComplete(verifyIdx), 800);
      return () => clearTimeout(t);
    }
  }, [agentStatus.connected, privileges?.is_admin, activeIdx]);

  function goTo(idx: number) {
    if (idx === activeIdx) return;
    setPanelKey((k) => k + 1);
    setActiveIdx(idx);
  }

  function markComplete(idx: number) {
    setCompleted((prev) => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    const nextIdx = idx + 1;
    if (nextIdx < STEPS.length) {
      setTimeout(() => {
        setPanelKey((k) => k + 1);
        setActiveIdx(nextIdx);
      }, prefersReduced ? 0 : 450);
    }
  }

  async function handleVerify() {
    setChecking(true);
    await agentConnection.checkConnection();
    await checkPrivileges();
    setChecking(false);
  }

  const allDone = completed.every(Boolean);
  const step = STEPS[activeIdx];

  // ── Mobile progress bar ──────────────────────────────────────
  const progressPct = Math.round((completed.filter(Boolean).length / STEPS.length) * 100);

  return (
    <div className="w-full max-w-[1850px] mx-auto min-h-screen bg-[#070b14] text-slate-100 px-6 sm:px-10 lg:px-14 xl:px-16 py-8 select-none font-sans page-enter">
      {/* ── Page title ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.22em] text-cyan-400 uppercase mb-1.5 font-mono">
            <MonitorSmartphone className="h-4 w-4" />
            Hardware Bridge Setup
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
            Physical Hardware Connection Guide
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-4xl">
            Follow each step to enable real-time sector-level forensics on your machine.
          </p>
        </div>

        {/* Demo mode shortcut */}
        <button
          onClick={() => { agentConnection.setDemoMode(true); navigate("/dashboard"); }}
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white text-xs sm:text-sm font-semibold transition"
        >
          <Sparkles className="h-4 w-4" /> Try Demo instead
        </button>
      </div>

      {/* ── Mobile horizontal progress bar ── */}
      <div className="flex md:hidden mb-6 flex-col gap-2">
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>Step {Math.min(activeIdx + 1, STEPS.length)} of {STEPS.length}</span>
          <span>{progressPct}% complete</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Mobile step pills */}
        <div className="flex gap-1.5 mt-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`shrink-0 px-3 py-1 rounded-lg text-[10px] font-mono font-bold border transition ${
                completed[i]
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : i === activeIdx
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-800/50 text-slate-500"
              }`}
            >
              {s.number}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main layout: Full-Screen 12-Column Workstation Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

        {/* ── LEFT WORKSTATION: Stepper Rail + Active Step Detail Panel (7 cols) ── */}
        <div className="lg:col-span-7 flex gap-6 md:gap-8 items-start">
          {/* Vertical step rail (desktop only) */}
          <div className="hidden md:flex flex-col items-center w-12 shrink-0 pt-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <RailNode
                  step={s}
                  index={i}
                  active={i === activeIdx}
                  completed={completed[i]}
                  onClick={() => goTo(i)}
                />
                {i < STEPS.length - 1 && <Connector filled={completed[i]} />}
              </React.Fragment>
            ))}
          </div>

          {/* Active Step Card */}
          <div className="flex-1 min-w-0">
            <div
              key={panelKey}
              className="rounded-3xl border border-[#1e2c40] bg-[#0b1120]/95 backdrop-blur-md p-6 sm:p-8 lg:p-10 space-y-7 shadow-2xl"
              style={{
                animation: prefersReduced
                  ? "none"
                  : "panelIn 0.32s cubic-bezier(.4,0,.2,1) both",
              }}
            >
              {/* Step badge + number */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-5xl font-black text-slate-800 leading-none select-none">
                    {step.number}
                  </span>
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider border ${
                        BADGE_COLORS[step.badgeColor] || BADGE_COLORS.cyan
                      }`}
                    >
                      {step.badge}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-slate-500">
                  STEP {activeIdx + 1} OF {STEPS.length}
                </span>
              </div>

              {/* Title & task */}
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                  {step.title}
                </h2>
                <p className="text-sm sm:text-base font-bold text-cyan-400">{step.task}</p>
              </div>

              {/* Detail paragraph */}
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">{step.detail}</p>

              {/* Download action button (Step 1) */}
              {step.actionHref && !step.isVerify && (
                <div className="pt-2">
                  <a
                    href={step.actionHref}
                    download={step.actionDownload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-base transition shadow-xl shadow-cyan-950/60"
                  >
                    <Download className="h-5 w-5" />
                    {step.actionLabel}
                  </a>
                  <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-400">
                    <span>✓ SHA-256 Verified Binary</span>
                    <span>✓ Standalone EXE</span>
                    <span>✓ No Runtimes Required</span>
                  </div>
                </div>
              )}

              {/* Terminal block (for extract step) */}
              {step.command && (
                <div className="rounded-2xl bg-[#020508] border border-[#1e2c40] p-5 font-mono text-xs space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-emerald-400 mb-3 text-xs">
                    <Terminal className="h-4 w-4" />
                    <span className="font-bold tracking-wider">CONSOLE EXECUTION COMMANDS</span>
                    <span className="ml-auto flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                    </span>
                  </div>
                  {step.command.split("\n").map((line, i) => (
                    <p
                      key={i}
                      className={
                        line.includes("LISTENING") || line.includes("Silent")
                          ? "text-emerald-400 font-bold"
                          : line.includes("Interactive")
                          ? "text-cyan-300 font-bold"
                          : "text-slate-400"
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
              )}

              {/* Step 2: One-Click Setup */}
              {step.id === "extract" && (
                <div className="space-y-4">

                  {/* Hero: START-FORENSURE.bat */}
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5" />
                      <span>ONE-CLICK SETUP — START-FORENSURE.bat</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      After extracting the zip, just <strong className="text-white">double-click</strong>{" "}
                      <code className="text-emerald-300 bg-black/50 px-2 py-0.5 rounded font-mono font-bold">START-FORENSURE.bat</code>.
                      Windows will ask for UAC once — click <strong className="text-white">Yes</strong>. That's it.
                    </p>
                    <div className="p-3.5 bg-black/60 border border-emerald-500/20 rounded-xl text-xs font-mono text-emerald-300/90 space-y-1.5">
                      <div>✓ Adds Windows Defender exclusion (fixes virus alerts)</div>
                      <div>✓ Stops any old bridge process on port 8000</div>
                      <div>✓ Registers Windows Task — auto-starts on every login</div>
                      <div>✓ Launches FORENSURE Bridge as Administrator</div>
                      <div>✓ Opens the web app in your browser</div>
                    </div>
                  </div>

                  {/* Live bridge status */}
                  <div className="rounded-2xl border border-[#1e2c40] bg-[#090e1a] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-3.5 w-3.5 rounded-full ${
                            privileges?.is_admin
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                              : agentStatus.connected
                              ? "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                              : "bg-slate-600"
                          }`}
                        />
                        <span className="text-sm font-bold text-white">
                          {privileges?.is_admin
                            ? "Administrator Mode: Active & Verified"
                            : agentStatus.connected
                            ? "Bridge Running as Standard User — Elevation Required"
                            : "Bridge Not Running — Run START-FORENSURE.bat"}
                        </span>
                      </div>
                      {privileges?.is_admin && (
                        <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                          ELEVATED
                        </span>
                      )}
                    </div>

                    {privileges?.is_admin ? (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs sm:text-sm text-emerald-300 flex items-start gap-2.5">
                        <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                        <span>Kernel-level physical sector access is active. Raw drive reading and NTFS MFT deep carving are fully unlocked.</span>
                      </div>
                    ) : agentStatus.connected ? (
                      <div className="space-y-3">
                        <p className="text-xs sm:text-sm text-slate-300">
                          The bridge is running but not elevated. Click below to grant Administrator privileges:
                        </p>
                        <button
                          onClick={handleElevate}
                          disabled={elevating}
                          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition shadow-lg flex items-center gap-2"
                        >
                          <Shield className="w-5 h-5" />
                          {elevating ? "Requesting Elevation..." : "Run as Administrator (UAC)"}
                        </button>
                        {elevationStatus && (
                          <p className="text-xs text-amber-300/90 font-mono bg-amber-950/40 p-3 rounded-xl border border-amber-500/30">
                            {elevationStatus}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-400">
                        Bridge not detected on http://127.0.0.1:8000. Double-click{" "}
                        <code className="text-emerald-300 font-mono">START-FORENSURE.bat</code> to start it.
                      </p>
                    )}
                  </div>

                  {/* Advanced alternatives (collapsed look) */}
                  <div className="rounded-2xl border border-[#1e2c40] bg-[#090e1a] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs">
                      <Terminal className="w-4 h-4" />
                      <span>Advanced — Individual Scripts</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      {[
                        ["ADD-DEFENDER-EXCLUSION.bat", "Whitelist in Defender only"],
                        ["SETUP-AUTO-ADMIN.bat", "Register auto-start task only"],
                        ["RUN-AS-ADMIN.bat", "Start bridge (visible terminal)"],
                        ["STOP-BRIDGE.bat", "Stop the running bridge"],
                      ].map(([file, desc]) => (
                        <div key={file} className="p-2.5 rounded-xl bg-black/40 border border-[#1e2c40]">
                          <div className="text-cyan-300 font-bold">{file}</div>
                          <div className="text-slate-500 mt-0.5">{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manual PowerShell fallback */}
                  <div className="space-y-2">
                    <span className="text-slate-400 text-xs font-semibold">Manual Alternative (PowerShell):</span>
                    <div className="p-3 bg-black/60 border border-[#1e2c40] rounded-xl font-mono text-xs text-cyan-300 flex items-center justify-between gap-2">
                      <span className="truncate">{manualCommand}</span>
                      <button
                        onClick={() => copyCommand(manualCommand)}
                        className="text-slate-400 hover:text-white p-1.5 shrink-0 rounded-lg hover:bg-white/5"
                        title="Copy Command"
                      >
                        {copiedCmd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}


              {/* Device chips (for connect step) */}
              {step.chips && (
                <div className="flex flex-wrap gap-2.5 pt-2">
                  {step.chips.map((chip) => (
                    <span
                      key={chip}
                      className="px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold bg-[#070b14] border border-[#1e2c40] text-cyan-300 shadow-sm"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {/* Step 4: Verification card */}
              {step.isVerify && (
                <div className="space-y-4">
                  <div
                    className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-500 ${
                      agentStatus.connected
                        ? privileges?.is_admin
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-amber-500/40 bg-amber-500/10"
                        : "border-slate-700 bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`h-4 w-4 rounded-full flex-shrink-0 transition-colors duration-500 ${
                          agentStatus.connected
                            ? privileges?.is_admin
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                              : "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                            : "bg-slate-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-extrabold text-white">
                          {agentStatus.connected
                            ? privileges?.is_admin
                              ? "Bridge Connected & Administrator Mode Active"
                              : "Bridge Connected — Standard User Mode (Elevation Required)"
                            : "Bridge Not Detected"}
                        </p>
                        <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                          {agentStatus.connected
                            ? privileges?.is_admin
                              ? "http://127.0.0.1:8000 — Kernel raw sector access confirmed"
                              : "http://127.0.0.1:8000 — Administrator elevation is mandatory for raw disk carving"
                            : "http://127.0.0.1:8000 — no response"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleVerify}
                      disabled={checking}
                      className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm transition"
                    >
                      <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
                      {checking ? "Checking…" : "Verify Now"}
                    </button>
                  </div>

                  {agentStatus.connected && !privileges?.is_admin && (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
                        <ShieldAlert className="w-5 h-5" />
                        <span>Action Required: Grant Administrator Privileges</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Although the bridge is communicating with the browser, it is running as a standard user. Windows restricts scanning physical drive <code className="text-amber-300 font-mono">D:</code> to Administrator accounts.
                      </p>
                      <button
                        onClick={handleElevate}
                        disabled={elevating}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        {elevating ? "Requesting Elevation..." : "Run as Administrator (UAC)"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Final / completion state */}
              {step.isFinal && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 flex flex-col items-center text-center gap-5">
                  <div className="h-20 w-20 rounded-full border-2 border-emerald-500 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.35)]">
                    <ShieldCheck className="h-10 w-10" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">You're All Set!</p>
                    <p className="text-sm sm:text-base text-slate-400 mt-1 max-w-md">
                      FORENSURE Bridge is live with Administrator privileges. Physical storage devices and raw volume sectors are fully accessible for forensic carving.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    <button
                      onClick={() => navigate("/recovery")}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm transition shadow-lg shadow-cyan-950/50"
                    >
                      <HardDrive className="h-4 w-4" /> Go to Recovery
                    </button>
                    <button
                      onClick={() => navigate("/dashboard")}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-sm transition"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* Nav: back + mark complete */}
              {!step.isFinal && (
                <div className="flex items-center justify-between pt-6 border-t border-[#1e2c40]">
                  <button
                    onClick={() => activeIdx > 0 && goTo(activeIdx - 1)}
                    disabled={activeIdx === 0}
                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous Step
                  </button>

                  <button
                    onClick={() => {
                      if (step.id === "extract" && agentStatus.connected && !privileges?.is_admin) {
                        handleElevate();
                        return;
                      }
                      markComplete(activeIdx);
                    }}
                    disabled={completed[activeIdx]}
                    className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-sm transition ${
                      completed[activeIdx]
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default"
                        : "bg-[#070b14] border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400 shadow-md shadow-cyan-950/30"
                    }`}
                  >
                    {completed[activeIdx] ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Done
                      </>
                    ) : (
                      <>
                        {step.confirmLabel} <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Completed steps summary (below panel) */}
            {completed.some(Boolean) && !allDone && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {STEPS.slice(0, -1).map((s, i) =>
                  completed[i] ? (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-mono font-bold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {s.title}
                    </span>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT TELEMETRY CONSOLE: Live Hardware & Bridge Monitor (5 cols) ── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bridge Daemon Status Card */}
          <div className="rounded-3xl border border-[#1e2c40] bg-[#0b1120]/95 backdrop-blur-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-extrabold text-white">Bridge Telemetry</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                agentStatus.connected
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}>
                <span className={`w-2 h-2 rounded-full ${agentStatus.connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                {agentStatus.connected ? "DAEMON ONLINE" : "NOT CONNECTED"}
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-[#070b14] border border-[#1e2c40] flex items-center justify-between">
                <span className="text-slate-400 font-sans">Endpoint:</span>
                <span className="text-cyan-300 font-bold">http://127.0.0.1:8000</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#070b14] border border-[#1e2c40] flex items-center justify-between">
                <span className="text-slate-400 font-sans">Operation Mode:</span>
                <span className="text-white font-bold">{agentConnection.isDemoMode() ? "Demo Simulation" : "Direct Hardware"}</span>
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={checking}
              className="w-full h-11 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking Bridge Connection..." : "Test Bridge Ping"}
            </button>
          </div>

          {/* Windows Kernel Privilege & UAC Elevation Card */}
          <div className="rounded-3xl border border-[#1e2c40] bg-[#0b1120]/95 backdrop-blur-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-extrabold text-white">Kernel UAC Privileges</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                privileges?.is_admin
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : agentStatus.connected
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}>
                {privileges?.is_admin ? "ELEVATED" : agentStatus.connected ? "RESTRICTED" : "OFFLINE"}
              </span>
            </div>

            {privileges?.is_admin ? (
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-xs">
                <div className="font-bold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Full Kernel Privileges Active
                </div>
                <p className="text-slate-300 leading-relaxed font-sans">
                  Direct physical access to <code className="text-emerald-300">\\.\PhysicalDriveX</code> and NTFS Master File Table deep parsing are fully authorized by Windows.
                </p>
              </div>
            ) : agentStatus.connected ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" /> Administrator Elevation Required
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Standard user accounts cannot inspect raw physical sectors on drive <code className="text-amber-300">D:</code>.
                  </p>
                </div>
                <button
                  onClick={handleElevate}
                  disabled={elevating}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition shadow-lg"
                >
                  <Shield className="w-4 h-4" />
                  {elevating ? "Requesting Elevation..." : "Run as Administrator (UAC)"}
                </button>
                {elevationStatus && (
                  <p className="text-xs text-amber-300/90 font-mono bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30">
                    {elevationStatus}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Connect the FORENSURE Bridge to verify Windows Administrator status and enable physical drive access.
              </p>
            )}
          </div>

          {/* Real-time Physical Storage & Connected Drives */}
          <div className="rounded-3xl border border-[#1e2c40] bg-[#0b1120]/95 backdrop-blur-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#182338]">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-extrabold text-white">Live Physical Drives</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">
                  {devices.length} Detected
                </span>
                <button
                  onClick={fetchDrives}
                  disabled={loadingDevices}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                  title="Refresh Connected Drives"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDevices ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {devices.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#070b14] border border-[#1e2c40] text-center space-y-2">
                <Plug className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400 font-sans">
                  No external storage units detected yet. Hot-plug any USB flash drive, external SSD, or phone to inspect live.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {devices.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl bg-[#070b14] border border-[#1e2c40] flex items-center justify-between text-xs transition hover:border-cyan-500/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {d.device_type === "MOBILE_DEVICE" ? (
                        <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : (
                        <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate text-xs">
                          {d.vendor || "Storage"} {d.model || d.device_path}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate" title={d.mount_point || d.device_path}>
                          {formatBytes(d.capacity_bytes || d.size_bytes || 0)} • {formatMountPoint(d.mount_point) || d.device_path}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                      d.system_disk 
                        ? "bg-slate-800 text-slate-300 border border-slate-700" 
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {d.system_disk ? "SYSTEM OS" : "SCANNABLE"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TROUBLESHOOTING: Virus Alert & Storage Not Showing ── */}
          <div className="rounded-3xl border border-amber-500/30 bg-[#0b1120]/95 backdrop-blur-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 pb-3 border-b border-amber-500/20">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-extrabold text-white">Troubleshooting</h3>
              <span className="ml-auto px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">READ IF ISSUES</span>
            </div>

            {/* Issue 1: AV False Positive */}
            <div className="space-y-2.5 text-xs">
              <div className="font-extrabold text-amber-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                Windows Defender / Antivirus Is Blocking the Bridge
              </div>
              <p className="text-slate-300 leading-relaxed font-sans ml-7">
                <strong className="text-white">Why it happens:</strong> FORENSURE Bridge reads raw disk sectors, opens{" "}
                <code className="text-amber-300 bg-black/40 px-1 rounded">\\.\ PHYSICALDRIVE</code> handles, and runs PowerShell — the same behaviour antivirus heuristics flag as malware (e.g.{" "}
                <code className="text-amber-300 bg-black/40 px-1 rounded">Trojan:Win32/Wacatac.B!ml</code>). The bridge is safe and open-source.
              </p>
              <div className="ml-7 rounded-xl bg-[#0d1525] border border-amber-500/20 p-4 space-y-2 text-[11px]">
                <p className="text-amber-300 font-bold font-mono">How to whitelist in Windows Defender:</p>
                <ol className="space-y-1.5 text-slate-300 font-sans list-decimal list-inside">
                  <li>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-white font-mono text-[10px]">Win + S</kbd> → type <strong>Windows Security</strong> → open it</li>
                  <li>Click <strong>Virus &amp; threat protection</strong></li>
                  <li>Click <strong>Manage settings</strong> under "Virus &amp; threat protection settings"</li>
                  <li>Scroll to <strong>Exclusions</strong> → click <strong>Add or remove exclusions</strong></li>
                  <li>Click <strong>Add an exclusion → Folder</strong></li>
                  <li>Select the extracted <code className="text-amber-200 font-mono">FORENSURE-Bridge-Windows</code> folder</li>
                  <li>Click <strong>Select Folder</strong> — then restart the bridge.</li>
                </ol>
              </div>
              <p className="text-slate-400 font-sans text-[11px] ml-7">
                If the EXE was already quarantined: Windows Security → <strong className="text-white">Protection history</strong> → find the item → click <strong className="text-white">Restore</strong>, then add the exclusion above.
              </p>
            </div>

            <div className="border-t border-[#1e2c40]" />

            {/* Issue 2: Storage Not Showing */}
            <div className="space-y-2.5 text-xs">
              <div className="font-extrabold text-amber-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                Storage Devices Not Showing Up
              </div>
              <ul className="ml-7 space-y-1.5 text-slate-300 font-sans">
                {[
                  ["AV blocked the bridge", "The bridge is terminated silently before it can list devices. Do fix #1 first."],
                  ["Not running as Administrator", "PowerShell's Get-Disk requires elevated rights. Without Admin, the device list is empty."],
                  ["Bridge not started", "Open the unzipped folder → right-click RUN-AS-ADMIN.bat → \"Run as administrator\". Wait 5 s, then refresh."],
                  ["Drive has no drive letter", "Open Disk Management (Win+X) — if the drive shows but has no letter, assign one, then refresh."],
                  ["USB port / cable issue", "Try a different USB 3.0 port (blue port) and a different cable."],
                ].map(([title, desc]) => (
                  <li key={title} className="flex gap-2 items-start text-[11px]">
                    <span className="text-amber-400 mt-0.5 shrink-0 font-bold">→</span>
                    <span><strong className="text-white">{title}:</strong> {desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-[#1e2c40]" />

            {/* Issue 3: Fresh Machine Checklist */}
            <div className="space-y-2 text-xs">
              <div className="font-extrabold text-amber-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                Setting Up on Another / Lab Machine
              </div>
              <p className="text-slate-300 font-sans ml-7 text-[11px]">Each machine needs its own exclusion. Share this with the other user:</p>
              <div className="ml-7 rounded-xl bg-[#0d1525] border border-[#1e2c40] p-3.5 font-mono text-[10px] text-slate-300 space-y-1">
                <p className="text-emerald-400 font-bold mb-1.5">FORENSURE Bridge — Fresh Machine Checklist</p>
                <p>☐ 1. Unzip to a permanent folder (e.g. C:\FORENSURE\)</p>
                <p>☐ 2. Add that folder to Windows Defender exclusions</p>
                <p>☐ 3. Right-click SETUP-AUTO-ADMIN.bat → "Run as administrator"</p>
                <p>☐ 4. Open FORENSURE web app → Hardware Bridge tab → "Verify Now"</p>
                <p>☐ 5. Status must show: <span className="text-emerald-400">DAEMON ONLINE</span> + <span className="text-emerald-400">ELEVATED</span></p>
              </div>
            </div>
          </div>

          {/* Quick FAQ / Safety Standards Card */}
          <div className="rounded-3xl border border-[#1e2c40] bg-[#0b1120]/95 backdrop-blur-md p-6 space-y-3 shadow-2xl text-xs">
            <div className="flex items-center gap-2 text-cyan-400 font-bold pb-2 border-b border-[#182338]">
              <Info className="w-4 h-4" />
              <span>Forensic Integrity Standards</span>
            </div>
            <div className="space-y-2.5 text-slate-300 leading-relaxed font-sans">
              <div>
                <strong className="text-white block">ISO/IEC 27037 Write-Blocking:</strong>
                FORENSURE opens physical drives with read-only flags (<code className="text-cyan-300">GENERIC_READ</code>). No original drive bytes or timestamps are modified.
              </div>
              <div>
                <strong className="text-white block">Hot-Plug Support:</strong>
                Plugging in a USB drive automatically notifies the bridge. Click the refresh button anytime to rescan hardware.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe for panel slide-in */}
      <style>{`
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="panelIn"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
