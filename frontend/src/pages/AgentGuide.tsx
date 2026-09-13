import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { agentConnection, type AgentStatus } from "../services/agentConnection";
import { Button } from "../components/ui/button";
import { 
  MonitorSmartphone, Download, ShieldCheck, CheckCircle2, 
  AlertTriangle, RefreshCw, Sparkles, Terminal, HardDrive, 
  ExternalLink, ArrowRight, HelpCircle, Lock, ShieldAlert, 
  ChevronDown, ChevronUp, Radio
} from "lucide-react";

export function AgentGuide() {
  const [status, setStatus] = useState<AgentStatus>(agentConnection.getStatus());
  const [checking, setChecking] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [customPort, setCustomPort] = useState("8000");
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = agentConnection.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsub;
  }, []);

  const handleTestConnection = async () => {
    setChecking(true);
    await agentConnection.checkConnection();
    setChecking(false);
  };

  const handleToggleDemo = (active: boolean) => {
    agentConnection.setDemoMode(active);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8 select-none text-slate-100">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2c40] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase mb-1">
            <Radio className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
            HARDWARE INTEGRATION ARCHITECTURE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Local Hardware Agent Connection Guide
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Follow this step-by-step setup to bridge physical USB flash drives, non-system SSDs, and mobile storage devices to this cloud-accessible forensic workstation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTestConnection} 
            loading={checking}
          >
            <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} /> 
            Test Agent Ping
          </Button>
          <a
            href="/SecureData-Agent-Windows.zip"
            download="SecureData-Agent-Windows.zip"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-glow"
          >
            <Download className="h-3.5 w-3.5" /> Download Agent (.zip)
          </a>
        </div>
      </div>

      {/* ── Live Connection Diagnostic Card ── */}
      <div className={`rounded-2xl border p-5 backdrop-blur-sm transition-all duration-300 ${
        status.connected 
          ? "border-emerald-500/30 bg-emerald-950/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
          : status.demoMode 
          ? "border-amber-500/30 bg-amber-950/10"
          : "border-rose-500/30 bg-rose-950/10"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${
              status.connected 
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : status.demoMode 
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-rose-500/20 border-rose-500/40 text-rose-400"
            }`}>
              {status.connected ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : status.demoMode ? (
                <Sparkles className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">
                  {status.connected 
                    ? "LOCAL AGENT ACTIVE & COMMUNICATING" 
                    : status.demoMode 
                    ? "INTERACTIVE DEMO MODE ACTIVE" 
                    : "HARDWARE AGENT DISCONNECTED"}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                  status.connected 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : status.demoMode 
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}>
                  {status.connected ? "Online (Port 8000)" : status.demoMode ? "Simulation" : "Offline"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {status.connected 
                  ? "Real-time hardware probe is online. Physical drive detection, NTFS parsing, and NIST wiping are operational."
                  : status.demoMode 
                  ? "You are exploring simulated storage devices with high-confidence forensic evidence. No installation required."
                  : "Browser security prevents websites from querying raw disk sectors directly. Start the agent or try Demo Mode."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {status.connected ? (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => navigate('/devices')}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                Go to Live Inventory <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : status.demoMode ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleToggleDemo(false)}
              >
                Exit Demo Mode
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => handleToggleDemo(true)}
                className="border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-400" /> Enable Demo Mode
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Visual 4-Step Process ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-cyan-400" /> 4-Step Hardware Connection Workflow
          </h2>
          <p className="text-xs text-slate-400">
            Complete these straightforward steps to enable physical storage scanning on your Windows machine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Step 1 */}
          <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/80 backdrop-blur-sm p-6 relative overflow-hidden group hover:border-cyan-500/40 transition">
            <div className="flex items-start justify-between mb-4">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-black text-sm">
                01
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                12 MB • Standalone
              </span>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
              Download Pre-Compiled Agent
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Download the zero-install binary package. No Python, Node.js, or code repository is required. All drivers and dependencies are pre-bundled inside.
            </p>
            <div className="mt-5 pt-4 border-t border-[#1e2c40] flex items-center justify-between">
              <a
                href="/SecureData-Agent-Windows.zip"
                download="SecureData-Agent-Windows.zip"
                className="inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition"
              >
                <Download className="h-4 w-4" /> Download SecureData-Agent-Windows.zip
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/80 backdrop-blur-sm p-6 relative overflow-hidden group hover:border-cyan-500/40 transition">
            <div className="flex items-start justify-between mb-4">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-black text-sm">
                02
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                UAC Elevation Required
              </span>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
              Extract & Run as Administrator
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Extract the zip file, then double-click <strong className="text-white font-mono">SecureData-Agent.exe</strong>. Click <strong className="text-cyan-400">Yes</strong> when Windows asks for Administrator elevation to read hardware drive sectors.
            </p>
            <div className="mt-4 p-3 rounded-xl bg-[#090d16] border border-[#1e2c40] font-mono text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <Terminal className="h-3 w-3" /> Console Output:
              </div>
              <p className="text-slate-400">[+] Physical Disk & MTP Probe : ACTIVE</p>
              <p className="text-slate-400">[+] Local API Endpoint       : http://127.0.0.1:8000</p>
              <p className="text-emerald-400 font-semibold">[+] STATUS : LISTENING FOR WEB CLIENTS</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/80 backdrop-blur-sm p-6 relative overflow-hidden group hover:border-cyan-500/40 transition">
            <div className="flex items-start justify-between mb-4">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-black text-sm">
                03
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                Hot-Plug Supported
              </span>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
              Plug In Your Storage Hardware
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Connect any USB thumb drive, external HDD/SSD, SD card, or Android smartphone (MTP mode). The agent uses PowerShell <code className="text-cyan-300 bg-black/40 px-1 py-0.5 rounded">Get-Disk</code> to discover physical units in real time.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">USB 3.0 / 3.2</span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">NVMe Enclosures</span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">Android MTP</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">SD / MicroSD</span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-2xl border border-[#1e2c40] bg-[#0f172a]/80 backdrop-blur-sm p-6 relative overflow-hidden group hover:border-cyan-500/40 transition">
            <div className="flex items-start justify-between mb-4">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-black text-sm">
                04
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                PNA Auto-Handshake
              </span>
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
              Refresh Browser & Begin Forensics
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Return to this browser window. Chrome and Edge will automatically authorize the local Private Network connection. The top status turns green and your connected drives appear instantly.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1e2c40] flex items-center justify-between">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestConnection} 
                className="w-full text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${checking ? "animate-spin" : ""}`} /> 
                Check Connection Status Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Architecture Explainer ── */}
      <div className="rounded-2xl border border-[#1e2c40] bg-[#0b0f19] p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Zero Data Leakage — Local-First Security Architecture
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Unlike ordinary cloud apps that require uploading sensitive forensic drive images to third-party servers, <strong className="text-white">FORENSURE uses a split-plane model</strong>:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-[#090d16] border border-[#1e2c40]">
            <div className="text-cyan-400 font-bold mb-1">1. Cloud UI Plane</div>
            <p className="text-slate-400 text-[11px]">
              The React frontend is hosted on high-availability cloud infrastructure (Vercel) for seamless access from any judge laptop or mobile phone.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#090d16] border border-[#1e2c40]">
            <div className="text-emerald-400 font-bold mb-1">2. Local Execution Plane</div>
            <p className="text-slate-400 text-[11px]">
              The agent runs entirely on your local machine. All bitstream reading, carving calculations, and cryptographic wiping remain 100% on your local disk.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#090d16] border border-[#1e2c40]">
            <div className="text-amber-400 font-bold mb-1">3. OS Boot Protection</div>
            <p className="text-slate-400 text-[11px]">
              System boot disk (C:) is write-locked by policy. Sanitization cannot accidentally erase the host operating system.
            </p>
          </div>
        </div>
      </div>

      {/* ── Frequently Asked Questions ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-cyan-400" /> Frequently Asked Questions & Troubleshooting
        </h2>

        <div className="space-y-3">
          {[
            {
              q: "Why does the agent require Administrator privileges?",
              a: "Windows security prevents standard non-privileged processes from querying raw physical disk sectors (e.g. \\\\.\\PHYSICALDRIVE1) or invoking PowerShell's Get-Disk cmdlet. Administrator elevation is required for raw sector forensics and NIST sanitization.",
            },
            {
              q: "Can judges evaluate the software without downloading the agent?",
              a: "Yes! Simply click 'Enable Demo Mode' at the top of this page or on the dashboard. You will be able to test device analysis, deleted file carving, confidence scoring, and NIST wiping with realistic sample forensic storage.",
            },
            {
              q: "How does the cloud frontend communicate with the local agent?",
              a: "The cloud web application connects to http://127.0.0.1:8000 using Chrome and Edge's Private Network Access (PNA) standard. The local agent sets CORS headers and 'Access-Control-Allow-Private-Network: true' so requests are authorized seamlessly.",
            },
            {
              q: "What if port 8000 is already in use on my machine?",
              a: "By default the agent listens on 8000. If needed, you can launch the agent with a custom port or change the endpoint in the connection settings.",
            },
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="rounded-xl border border-[#1e2c40] bg-[#0f172a]/60 overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-white hover:text-cyan-300 transition"
              >
                <span>{item.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="h-4 w-4 text-cyan-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-[#1e2c40]/60 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
