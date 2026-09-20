import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HalideParticleCanvas, type FormationType } from '../components/HalideParticleCanvas';
import { agentConnection, type AgentStatus } from '../services/agentConnection';
import {
  ShieldCheck, HardDrive, Sparkles, ArrowRight,
  Cpu, RotateCcw, ShieldAlert, CheckCircle2,
  Terminal, Radio, DatabaseZap,
} from 'lucide-react';

const FORMATIONS: FormationType[] = ['anemone', 'braid', 'disc', 'globe'];
const FORMATION_LABELS: Record<FormationType, string> = {
  anemone: 'Anemone Field',
  braid:   'Quantum Braid',
  disc:    'Vortex Disc',
  globe:   'Data Globe',
};

export function LandingPortal() {
  const [formationIdx, setFormationIdx] = useState(0);
  const [morphLabel, setMorphLabel] = useState(false); // triggers label flash
  const [status, setStatus] = useState<AgentStatus>(agentConnection.getStatus());
  const navigate = useNavigate();
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = agentConnection.subscribe((s) => setStatus(s));
    return unsub;
  }, []);

  // Auto-cycle formation every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFormationIdx(prev => {
        const next = (prev + 1) % FORMATIONS.length;
        // Flash label
        setMorphLabel(true);
        if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
        labelTimerRef.current = setTimeout(() => setMorphLabel(false), 1800);
        return next;
      });
    }, 3000);
    return () => {
      clearInterval(interval);
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    };
  }, []);

  const formation = FORMATIONS[formationIdx];

  const handleLaunchPhysical = () => {
    agentConnection.setDemoMode(false);
    navigate('/agent-guide');
  };

  const handleLaunchDemo = () => {
    agentConnection.setDemoMode(true);
    navigate('/dashboard');
  };

  return (
    <div className="relative w-full min-h-screen bg-[#060a12] text-slate-100 overflow-x-hidden font-sans select-none flex flex-col">

      {/* ── Background Particle Canvas ── */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <HalideParticleCanvas formation={formation} />
      </div>

      {/* ── Ambient vignette ── */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,#060a12_80%)] opacity-90" />

      {/* ── Subtle scanline grid overlay for motion feel ── */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(6,182,212,0.5) 30px, rgba(6,182,212,0.5) 31px)',
        }}
      />

      {/* ── Top Bar ── */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 to-violet-500/15 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <DatabaseZap className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#060a12] animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#060a12]" />
          </div>
          <div>
            <div className="text-sm font-black tracking-[0.25em] text-white">FORENSURE</div>
            <div className="text-[8.5px] font-mono tracking-[0.2em] text-cyan-400/80 font-bold">VERIFY · SANITIZE · RECOVER</div>
          </div>
        </div>

        {/* Auto-morphing shape name indicator */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border bg-[#090e1a]/80 backdrop-blur-md transition-all duration-500 ${
            morphLabel
              ? 'border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] opacity-100 scale-100'
              : 'border-[#182035] opacity-60 scale-95'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
            {FORMATION_LABELS[formation]}
          </span>
        </div>

        {/* Right status */}
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono font-semibold ${
            status.connected
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-[#182035] bg-[#090e1a]/70 text-slate-500'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {status.connected ? 'BRIDGE ONLINE' : 'BRIDGE STANDBY'}
          </span>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">

        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/8 backdrop-blur-md text-cyan-300 text-xs font-mono font-bold tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.12)] mb-8">
          <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          ENTERPRISE DIGITAL STORAGE FORENSICS & SANITIZATION ENGINE
        </div>

        {/* Brand title */}
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-4">
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            FORENSURE
          </span>
        </h1>

        <p className="text-xl sm:text-2xl font-mono font-extrabold tracking-[0.25em] bg-gradient-to-r from-cyan-400 via-teal-300 to-violet-400 bg-clip-text text-transparent uppercase mb-4">
          VERIFY. SANITIZE. RECOVER.
        </p>

        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed mb-12">
          Direct physical bitstream acquisition · multi-format raw file carving (JPG, PNG, PDF, DOCX, ZIP, MP4) with AI confidence scoring · cryptographic sanitization adhering to NIST SP 800-88 & DoD 5220.22-M
        </p>

        {/* ── 2 Main Launch Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-4xl text-left mb-10">

          {/* Card 1: Physical Hardware */}
          <div
            onClick={handleLaunchPhysical}
            className="group relative rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-[#0e172a]/90 to-[#070d18]/90 backdrop-blur-sm p-7 hover:border-cyan-400/60 hover:shadow-[0_0_40px_rgba(6,182,212,0.2)] transition-all duration-400 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/8 rounded-full blur-3xl group-hover:bg-cyan-500/15 transition-all pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-cyan-500/[0.03] to-transparent pointer-events-none" />

            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 group-hover:shadow-[0_0_16px_rgba(6,182,212,0.3)] transition-all">
                <HardDrive className="h-6 w-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 uppercase tracking-widest">
                Physical Hardware
              </span>
            </div>

            <h2 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2 mb-2">
              Real-Time Hardware Bridge
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1.5 transition-all" />
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Probe and analyze physical storage drives connected directly to this machine. Uses low-level kernel calls to inspect USB drives, external SSDs, partitions, and Android MTP devices.
            </p>

            <div className="p-3 rounded-xl bg-black/30 border border-[#182035] font-mono text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Terminal className="h-3 w-3" /> Step-by-Step Onboarding Included
              </div>
              <p className="text-slate-500 text-[10px]">Download bridge → Run as Admin → Plug device → Begin live analysis</p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">
                {status.connected ? '● Bridge Detected Online' : '○ Standalone 12 MB Binary'}
              </span>
              <span className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1">
                Setup Hardware Link →
              </span>
            </div>
          </div>

          {/* Card 2: Demo Mode */}
          <div
            onClick={handleLaunchDemo}
            className="group relative rounded-3xl border border-violet-500/25 bg-gradient-to-b from-[#120f26]/90 to-[#070d18]/90 backdrop-blur-sm p-7 hover:border-violet-400/60 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-all duration-400 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/8 rounded-full blur-3xl group-hover:bg-violet-500/15 transition-all pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-violet-500/[0.03] to-transparent pointer-events-none" />

            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center group-hover:scale-110 group-hover:shadow-[0_0_16px_rgba(139,92,246,0.3)] transition-all">
                <Sparkles className="h-6 w-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold bg-violet-500/12 border border-violet-500/25 text-violet-300 uppercase tracking-widest">
                Zero Installation
              </span>
            </div>

            <h2 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors flex items-center gap-2 mb-2">
              Demo Mode
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-1.5 transition-all" />
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Run every forensic tool right inside your browser with zero installation. Pre-loaded with realistic forensic drives, carved documents, and cryptographic verification logs.
            </p>

            <div className="p-3 rounded-xl bg-black/30 border border-[#182035] font-mono text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-violet-400 font-bold">
                <CheckCircle2 className="h-3 w-3" /> Real-Time Tool Simulation
              </div>
              <p className="text-slate-500 text-[10px]">Carving · NIST sanitization · unallocated space search · audit reports</p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#182035]/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">No Downloads Required</span>
              <span className="text-xs font-bold text-violet-400 group-hover:text-violet-300 flex items-center gap-1">
                Enter Demo Mode →
              </span>
            </div>
          </div>
        </div>

        {/* ── 3 Core Pillars ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl text-left font-mono text-xs">
          <div className="p-4 rounded-2xl bg-[#090d16]/60 border border-[#182035] backdrop-blur-sm hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-2">
              <ShieldCheck className="h-4 w-4" /> VERIFY
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Read-only bitstream imaging, live physical drive telemetry, and SHA-256 chain-of-custody logging.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#090d16]/60 border border-[#182035] backdrop-blur-sm hover:border-rose-500/30 transition-colors">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <ShieldAlert className="h-4 w-4" /> SANITIZE
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Cryptographic block erasure per NIST SP 800-88 Clear & DoD 5220.22-M with tamper-evident PDF certificates.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#090d16]/60 border border-[#182035] backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <RotateCcw className="h-4 w-4" /> RECOVER
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Deep raw-data carving for JPEG, PNG, PDF, DOCX, XLSX, ZIP, MP4 from unallocated clusters with AI confidence scoring.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-t border-[#182035]/50 text-[10px] font-mono text-slate-600">
        <span className="flex items-center gap-2">
          {status.connected ? (
            <span className="text-emerald-500 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PHYSICAL ENGINE ONLINE · PORT 8000
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              PHYSICAL ENGINE STANDBY
            </span>
          )}
        </span>
        <span>FORENSURE v2.4 Enterprise Forensics Platform</span>
      </footer>
    </div>
  );
}
