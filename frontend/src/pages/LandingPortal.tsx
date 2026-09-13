import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HalideParticleCanvas, type FormationType } from '../components/HalideParticleCanvas';
import { agentConnection, type AgentStatus } from '../services/agentConnection';
import { 
  ShieldCheck, HardDrive, Sparkles, ArrowRight, 
  Cpu, RotateCcw, ShieldAlert, CheckCircle2, 
  Terminal, Radio, Layers
} from 'lucide-react';

export function LandingPortal() {
  const [formation, setFormation] = useState<FormationType>('anemone');
  const [showHUD, setShowHUD] = useState(false);
  const [status, setStatus] = useState<AgentStatus>(agentConnection.getStatus());
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = agentConnection.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsub;
  }, []);

  const handleLaunchPhysical = () => {
    agentConnection.setDemoMode(false);
    navigate('/agent-guide');
  };

  const handleLaunchDemo = () => {
    agentConnection.setDemoMode(true);
    navigate('/dashboard');
  };

  return (
    <div className="relative w-full min-h-screen bg-[#060a12] text-slate-100 overflow-x-hidden font-sans select-none flex flex-col justify-between">
      {/* ── Background GPU Particle Bloom ── */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <HalideParticleCanvas formation={formation} showHUD={showHUD} />
      </div>

      {/* ── Ambient Gradient Vignette ── */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-radial-vignette opacity-80" />

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-[0.25em] text-white">FORENSURE</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[9px] font-mono tracking-[0.22em] text-cyan-400 font-bold">
              VERIFY. SANITIZE. RECOVER.
            </p>
          </div>
        </div>

        {/* Formation Morph Switcher */}
        <div className="flex items-center gap-2 bg-[#090e1a]/85 backdrop-blur-md border border-[#1e2c40] rounded-2xl p-1.5 shadow-xl text-xs font-mono">
          {(['anemone', 'braid', 'disc', 'globe'] as FormationType[]).map((formName) => (
            <button
              key={formName}
              onClick={() => setFormation(formName)}
              className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition-all duration-200 ${
                formation === formName
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {formName}
            </button>
          ))}
          <button
            onClick={() => setShowHUD(!showHUD)}
            title="Toggle GPU Diagnostic HUD"
            className={`p-1.5 rounded-xl border transition ${
              showHUD 
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main Hero Section ── */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex-1 flex flex-col justify-center items-center text-center space-y-8">
        {/* Hero Eyebrow */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md text-cyan-300 text-xs font-mono font-bold tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          ENTERPRISE DIGITAL STORAGE FORENSICS & SANITIZATION ENGINE
        </div>

        {/* Big Brand & Tagline */}
        <div className="space-y-3 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-none">
            <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              FORENSURE
            </span>
          </h1>
          <p className="text-lg sm:text-xl font-mono font-extrabold tracking-[0.3em] bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent uppercase">
            VERIFY. SANITIZE. RECOVER.
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed font-sans mt-2">
            Direct physical bitstream acquisition, multi-format raw file carving (JPG, PNG, PDF, DOCX, XLSX, ZIP, MP4) with validation scoring, and cryptographic sanitization adhering to NIST SP 800-88 & DoD 5220.22-M.
          </p>
        </div>

        {/* ── 2 Main Action Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl text-left pt-2">
          {/* Card 1: Physical Hardware Inspection */}
          <div 
            onClick={handleLaunchPhysical}
            className="group relative rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#0e172a]/95 via-[#0b1222]/90 to-[#070d18]/95 p-8 hover:border-cyan-400 hover:shadow-[0_0_35px_rgba(6,182,212,0.25)] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <HardDrive className="h-6 w-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 uppercase tracking-wider">
                  Physical Hardware Inspection
                </span>
              </div>

              <h2 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                Real-Time Hardware Bridge
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </h2>

              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                Probe and analyze physical storage drives connected directly to this machine. Uses low-level PowerShell kernel calls to inspect USB thumb drives, external SSDs, partitions, and Android MTP devices.
              </p>

              <div className="mt-4 p-3 rounded-xl bg-black/40 border border-[#1e2c40] font-mono text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Terminal className="h-3 w-3" /> Step-by-Step Onboarding Included
                </div>
                <p className="text-slate-400 text-[10px]">
                  Guided setup: Download bridge binary → Run as Admin → Hot-plug device → Begin live analysis.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1e2c40]/80 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 font-mono">
                {status.connected ? '● Bridge Detected Online' : '○ Standalone 12 MB Binary'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 group-hover:text-cyan-300">
                Setup Hardware Link →
              </span>
            </div>
          </div>

          {/* Card 2: Demo Mode */}
          <div 
            onClick={handleLaunchDemo}
            className="group relative rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#120f26]/95 via-[#0d0c1e]/90 to-[#070d18]/95 p-8 hover:border-purple-400 hover:shadow-[0_0_35px_rgba(168,85,247,0.25)] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 uppercase tracking-wider">
                  Zero Installation Sandbox
                </span>
              </div>

              <h2 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors flex items-center gap-2">
                Demo Mode
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </h2>

              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                Perform every forensic tool just like real time right inside your browser with zero installation. Pre-loaded with realistic forensic drives, carved documents, and cryptographic verification logs.
              </p>

              <div className="mt-4 p-3 rounded-xl bg-black/40 border border-[#1e2c40] font-mono text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <CheckCircle2 className="h-3 w-3" /> Real-Time Tool Simulation
                </div>
                <p className="text-slate-400 text-[10px]">
                  Perform carving, search unallocated space, run NIST SP 800-88 sanitization, and generate audit reports.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1e2c40]/80 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 font-mono">
                No Downloads Required
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 group-hover:text-purple-300">
                Enter Demo Mode →
              </span>
            </div>
          </div>
        </div>

        {/* ── 3 Core Pillars Pill ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl text-left pt-2 font-mono text-xs">
          <div className="p-4 rounded-2xl bg-[#090d16]/80 border border-[#1e2c40] backdrop-blur-sm">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
              <ShieldCheck className="h-4 w-4" /> VERIFY
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Read-only bitstream disk imaging, live physical drive telemetry, and SHA-256 chain-of-custody event logging.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#090d16]/80 border border-[#1e2c40] backdrop-blur-sm">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
              <ShieldAlert className="h-4 w-4" /> SANITIZE
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Permanent cryptographic block erasure adhering to NIST SP 800-88 Clear and DoD 5220.22-M with tamper-evident PDF certificates.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#090d16]/80 border border-[#1e2c40] backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
              <RotateCcw className="h-4 w-4" /> RECOVER
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Deep raw-data carving for JPEG, PNG, PDF, DOCX, XLSX, ZIP, and MP4 from unallocated clusters with AI confidence scoring.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer / Status Pill ── */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-mono border-t border-[#1e2c40]/60">
        <div className="flex items-center gap-2">
          {status.connected ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              PHYSICAL HARDWARE ENGINE ONLINE (PORT 8000)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              PHYSICAL HARDWARE ENGINE STANDBY
            </span>
          )}
        </div>
        <div>
          FORENSURE v2.4 Enterprise Forensics Platform
        </div>
      </footer>
    </div>
  );
}
