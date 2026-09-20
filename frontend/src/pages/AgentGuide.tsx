import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { agentConnection, type AgentStatus } from "../services/agentConnection";
import { recoveryApi, type RecoveryPrivileges } from "../services/recoveryApi";
import {
  Download, Terminal, HardDrive, RefreshCw, CheckCircle2,
  ArrowRight, Cpu, MonitorSmartphone, Plug, ShieldCheck,
  LayoutDashboard, Sparkles, ChevronLeft, ShieldAlert, Shield,
  Copy, Check
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
      "The Bridge is a zero-install standalone binary (~29 MB). No Python, Node.js, or any runtime is required. Everything is pre-bundled — just download the zip and you're ready for the next step.",
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
    title: "Extract & Run as Administrator (Mandatory)",
    task: "Administrator privileges are strictly mandatory to access physical drives and raw sectors",
    detail:
      "Windows NT kernel security blocks standard user accounts from reading raw drive volumes (such as \\\\.\\D:). To scan raw sectors, parse NTFS Master File Tables ($MFT), and recover permanently deleted or emptied Recycle Bin files, FORENSURE Bridge MUST run with Administrator privileges.",
    badge: "MANDATORY REQUIREMENT",
    badgeColor: "rose",
    command: `[*] Mode 1 (Silent Auto-Admin - Recommended):
    Right-click SETUP-AUTO-ADMIN.bat -> "Run as administrator"
    -> Configures Windows Task Scheduler with Highest Privileges.
    -> Runs silently in background forever (Zero UAC Popups, Zero Terminal Windows).

[*] Mode 2 (Interactive Terminal):
    Right-click RUN-AS-ADMIN.bat -> "Run as administrator"

[*] To Update an existing running bridge:
    Right-click UPDATE-BRIDGE.bat -> "Run as administrator" (restarts bridge with latest fixes)`,
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
    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-black transition-all duration-300 cursor-pointer select-none";

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
        <Icon className="h-4 w-4" />
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-4 md:p-8 lg:p-12 select-none font-sans page-enter">
      {/* ── Page title ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.22em] text-cyan-400 uppercase mb-1">
            <MonitorSmartphone className="h-3.5 w-3.5" />
            Hardware Bridge Setup
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
            Physical Hardware Connection Guide
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Follow each step to enable real-time sector-level forensics on your machine.
          </p>
        </div>

        {/* Demo mode shortcut */}
        <button
          onClick={() => { agentConnection.setDemoMode(true); navigate("/dashboard"); }}
          className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 text-xs font-semibold transition"
        >
          <Sparkles className="h-3.5 w-3.5" /> Try Demo instead
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

      {/* ── Main layout: rail + panel ── */}
      <div className="flex gap-8 lg:gap-12">

        {/* ── LEFT: Vertical step rail (desktop only) ── */}
        <div className="hidden md:flex flex-col items-center w-14 shrink-0 pt-1">
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

        {/* ── RIGHT: Detail panel ── */}
        <div className="flex-1 min-w-0">
          {/* Panel — key changes force re-animation */}
          <div
            key={panelKey}
            className="rounded-2xl border border-[#1e2c40] bg-[#0b1120]/90 backdrop-blur-sm p-6 md:p-8 space-y-6"
            style={{
              animation: prefersReduced
                ? "none"
                : "panelIn 0.32s cubic-bezier(.4,0,.2,1) both",
            }}
          >
            {/* Step badge + number */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-4xl font-black text-slate-800 leading-none select-none">
                {step.number}
              </span>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider border ${
                    BADGE_COLORS[step.badgeColor] || BADGE_COLORS.cyan
                  }`}
                >
                  {step.badge}
                </span>
              </div>
            </div>

            {/* Title & task */}
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {step.title}
              </h2>
              <p className="text-sm font-semibold text-cyan-400">{step.task}</p>
            </div>

            {/* Detail paragraph */}
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">{step.detail}</p>

            {/* Terminal block (for extract step) */}
            {step.command && (
              <div className="rounded-xl bg-[#020508] border border-[#1e2c40] p-4 font-mono text-xs space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 mb-3 text-[11px]">
                  <Terminal className="h-3.5 w-3.5" />
                  <span className="font-bold tracking-wider">CONSOLE OUTPUT</span>
                  <span className="ml-auto flex gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                  </span>
                </div>
                {step.command.split("\n").map((line, i) => (
                  <p
                    key={i}
                    className={
                      line.includes("LISTENING")
                        ? "text-emerald-400 font-bold"
                        : "text-slate-400"
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* Step 2: Extract & Run as Administrator (Mandatory Interactive Section) */}
            {step.id === "extract" && (
              <div className="space-y-4">
                {/* Mandatory Requirement Banner */}
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>MANDATORY REQUIREMENT: Administrator Privileges</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Windows NT kernel security restricts direct physical disk access and NTFS Master File Table ($MFT) carving on drive <span className="text-rose-300 font-mono font-semibold">D:</span> to elevated Administrator accounts. Running without Administrator rights prevents detecting permanently deleted and emptied Recycle Bin files.
                  </p>
                </div>

                {/* Live Status & The ONLY Interactive "Run as Administrator" Button */}
                <div className="rounded-xl border border-[#1e2c40] bg-[#090e1a] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          privileges?.is_admin
                            ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                            : agentStatus.connected
                            ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                            : "bg-slate-600"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {privileges?.is_admin
                          ? "Administrator Mode: Active & Verified"
                          : agentStatus.connected
                          ? "Bridge Running as Standard User — Elevation Required"
                          : "Bridge Not Running"}
                      </span>
                    </div>
                    {privileges?.is_admin && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                        ELEVATED
                      </span>
                    )}
                  </div>

                  {privileges?.is_admin ? (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                      <span>Kernel-level physical sector access is active. Raw drive reading and NTFS MFT deep carving are fully unlocked.</span>
                    </div>
                  ) : agentStatus.connected ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300">
                        The bridge is currently running with standard user rights. Click the button below to grant Administrator privileges via Windows UAC:
                      </p>
                      <button
                        onClick={handleElevate}
                        disabled={elevating}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition shadow-lg flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        {elevating ? "Requesting Elevation..." : "Run as Administrator (UAC)"}
                      </button>
                      {elevationStatus && (
                        <p className="text-xs text-amber-300/90 font-mono bg-amber-950/40 p-2 rounded border border-amber-500/30">
                          {elevationStatus}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      The bridge is not detected yet on http://127.0.0.1:8000. Follow one of the launch options below to start with Administrator rights.
                    </p>
                  )}
                </div>

                {/* Option 1: Silent Auto-Admin Card */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>OPTION 1 (Recommended): 100% Silent Background Operation</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Right-click <code className="text-emerald-300 bg-black/50 px-1.5 py-0.5 rounded font-mono font-bold">SETUP-AUTO-ADMIN.bat</code> and select <strong>"Run as administrator"</strong>.
                  </p>
                  <div className="p-3 bg-black/60 border border-emerald-500/20 rounded-lg text-xs font-mono text-emerald-300/90 space-y-1">
                    <div>✓ Registers Windows Scheduled Task with Highest Privileges</div>
                    <div>✓ Zero terminal clutter — runs hidden in the background</div>
                    <div>✓ Zero future UAC prompts — permanently elevated</div>
                    <div>✓ Stop anytime with <code className="text-slate-300">STOP-BRIDGE.bat</code></div>
                  </div>
                </div>

                {/* Option 2: Interactive Terminal Card */}
                <div className="rounded-xl border border-[#1e2c40] bg-[#090e1a] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                    <Terminal className="w-4 h-4" />
                    <span>OPTION 2: Interactive Console Window</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Right-click <code className="text-cyan-300 bg-black/50 px-1.5 py-0.5 rounded font-mono">RUN-AS-ADMIN.bat</code> and select <strong>"Run as administrator"</strong>.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    A visible command prompt window will remain open displaying live low-level I/O logs.
                  </p>
                </div>

                {/* Manual Alternative */}
                <div className="space-y-1.5">
                  <span className="text-slate-400 text-xs font-semibold">Manual Alternative (PowerShell):</span>
                  <div className="p-2.5 bg-black/60 border border-[#1e2c40] rounded-lg font-mono text-xs text-cyan-300 flex items-center justify-between gap-2">
                    <span className="truncate">{manualCommand}</span>
                    <button
                      onClick={() => copyCommand(manualCommand)}
                      className="text-slate-400 hover:text-white p-1 shrink-0"
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
              <div className="flex flex-wrap gap-2">
                {step.chips.map((chip) => (
                  <span
                    key={chip}
                    className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-[#0f172a] border border-[#1e2c40] text-slate-300"
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
                  className={`rounded-xl border p-4 flex items-center gap-4 transition-all duration-500 ${
                    agentStatus.connected
                      ? privileges?.is_admin
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-amber-500/40 bg-amber-500/5"
                      : "border-slate-700 bg-slate-800/30"
                  }`}
                >
                  <div
                    className={`h-3.5 w-3.5 rounded-full flex-shrink-0 transition-colors duration-500 ${
                      agentStatus.connected
                        ? privileges?.is_admin
                          ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                          : "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                        : "bg-slate-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">
                      {agentStatus.connected
                        ? privileges?.is_admin
                          ? "Bridge Connected & Administrator Mode Active"
                          : "Bridge Connected — Standard User Mode (Elevation Required)"
                        : "Bridge Not Detected"}
                    </p>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      {agentStatus.connected
                        ? privileges?.is_admin
                          ? "http://127.0.0.1:8000 — Kernel raw sector access confirmed"
                          : "http://127.0.0.1:8000 — Administrator elevation is mandatory for raw disk carving"
                        : "http://127.0.0.1:8000 — no response"}
                    </p>
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={checking}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold text-xs transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
                    {checking ? "Checking…" : "Verify Now"}
                  </button>
                </div>

                {agentStatus.connected && !privileges?.is_admin && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Action Required: Grant Administrator Privileges</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Although the bridge is communicating with the browser, it is running as a standard user. Windows restricts scanning physical drive <code className="text-amber-300 font-mono">D:</code> to Administrator accounts.
                    </p>
                    <button
                      onClick={handleElevate}
                      disabled={elevating}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition shadow-lg flex items-center gap-2"
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
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full border-2 border-emerald-500 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white">You're all set!</p>
                  <p className="text-sm text-slate-400 mt-1">
                    FORENSURE Bridge is live with Administrator privileges. Physical storage devices and raw volume sectors are fully accessible for forensic carving.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                  <button
                    onClick={() => navigate("/recovery")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition"
                  >
                    <HardDrive className="h-4 w-4" /> Data Recovery
                  </button>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-sm transition"
                  >
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Download action button */}
            {step.actionHref && !step.isVerify && (
              <a
                href={step.actionHref}
                download={step.actionDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition shadow-[0_0_20px_rgba(6,182,212,0.25)]"
              >
                <Download className="h-4 w-4" />
                {step.actionLabel}
              </a>
            )}

            {/* Nav: back + mark complete */}
            {!step.isFinal && (
              <div className="flex items-center justify-between pt-4 border-t border-[#1e2c40]">
                <button
                  onClick={() => activeIdx > 0 && goTo(activeIdx - 1)}
                  disabled={activeIdx === 0}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
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
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition ${
                    completed[activeIdx]
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default"
                      : "bg-[#0f172a] border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400"
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
            <div className="mt-4 flex flex-wrap gap-2">
              {STEPS.slice(0, -1).map((s, i) =>
                completed[i] ? (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[11px] font-mono font-semibold"
                  >
                    <CheckCircle2 className="h-3 w-3" /> {s.title}
                  </span>
                ) : null
              )}
            </div>
          )}
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
