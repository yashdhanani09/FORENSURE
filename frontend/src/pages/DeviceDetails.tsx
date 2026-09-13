import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deviceApi } from "../services/api";
import type { UsbDeviceDetail, EvidenceRecord } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  HardDrive, Shield, DatabaseZap, Download, AlertTriangle, 
  FileSearch, ShieldAlert, RotateCcw, ArrowLeft, CheckCircle2,
  X, Cpu, Layers
} from "lucide-react";

export function DeviceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<UsbDeviceDetail | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // In-page modal for Case Creation
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseName, setCaseName] = useState("");
  const [caseDesc, setCaseDesc] = useState("");
  const [creatingCase, setCreatingCase] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try { 
      setDevice(await deviceApi.get(id)); 
      setError(null); 
    } catch (requestError) { 
      setError(requestError instanceof Error ? requestError.message : "Unable to load storage device details."); 
    } finally { 
      setLoading(false); 
    }
  };
  
  const loadEvidence = async () => {
    if (!id) return;
    try { 
      const res = await deviceApi.listEvidence(id);
      setEvidence(res.evidence_records || []);
    } catch (err) { 
      console.error("Failed to load evidence", err); 
    }
  };

  useEffect(() => { 
    void load(); 
    void loadEvidence();
  }, [id]);

  const handleCreateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device || !caseName.trim()) return;
    setCreatingCase(true);
    try {
      const newCase = await fetch('/api/forensics/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          case_name: caseName.trim(), 
          device_id: device.id, 
          description: caseDesc.trim() || "Created from device details view" 
        })
      }).then(r => r.json());
      
      if (newCase.detail) throw new Error(newCase.detail);
      setCaseModalOpen(false);
      navigate(`/forensics/case/${newCase.case_id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create forensic case.");
    } finally {
      setCreatingCase(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 max-w-6xl mx-auto flex flex-col justify-center items-center h-96 select-none">
        <div className="h-10 w-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono">Probing hardware specifications...</p>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="p-8 max-w-4xl mx-auto select-none">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Error Loading Storage Device</h2>
          <p className="text-xs text-rose-300 font-mono">{error || "Device disconnected or not found."}</p>
          <Button variant="outline" onClick={() => navigate('/devices')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Fleet Inventory
          </Button>
        </div>
      </div>
    );
  }

  const isSystem = device.system_disk;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2c40] pb-6">
        <div>
          <button
            onClick={() => navigate('/devices')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Fleet Inventory
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-3 rounded-xl border shrink-0 ${
              isSystem ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
              "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            }`}>
              <HardDrive className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white break-words">
                  {device.vendor ? `${device.vendor} ` : ""}{device.model}
                </h1>
                <span className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isSystem 
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                }`}>
                  {isSystem ? "PROTECTED SYSTEM DISK" : (device.device_type || "DATA STORAGE")}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1 break-all">{device.id} • {device.device_path}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/devices/${encodeURIComponent(device.id)}/report/pdf`)}
          >
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/devices/${encodeURIComponent(device.id)}/report/json`)}
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specs Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <Cpu className="h-4 w-4 text-cyan-400" /> Physical Hardware Attributes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Manufacturer / Vendor</span>
                <span className="text-white font-bold text-sm font-sans">{device.vendor || "Unknown"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Product Model</span>
                <span className="text-white font-bold text-sm font-sans">{device.model || "Unknown"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Serial Number</span>
                <span className="text-slate-200 break-all">{device.serial || "Not reported"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Total Capacity</span>
                <span className="text-cyan-400 font-bold text-sm font-sans">
                  {formatBytes(device.capacity_bytes || device.size_bytes || 0)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Physical Path</span>
                <span className="text-slate-300">{device.device_path}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px] block">Transport / Interface</span>
                <span className="text-white uppercase">{device.transport || device.device_type || "Direct"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Panel */}
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <Shield className="h-4 w-4 text-emerald-400" /> Operational Directives
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isSystem ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-400">
                  <AlertTriangle className="h-4 w-4" /> System Protection Active
                </div>
                <p className="text-[11px] leading-relaxed">
                  This storage device contains the active OS boot volume (C:). Write modifications, full-disk overwrites, and wiping are strictly prevented to protect system integrity.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="forensic" 
                  onClick={() => { setCaseName(`Case-${device.model}`); setCaseModalOpen(true); }}
                >
                  <FileSearch className="h-4 w-4" /> Start Forensic Case
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="signal" 
                  onClick={() => navigate('/recovery')}
                >
                  <RotateCcw className="h-4 w-4" /> Scan for Deleted Files
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="destructive" 
                  onClick={() => navigate('/sanitization')}
                >
                  <ShieldAlert className="h-4 w-4" /> Open Sanitization Suite
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logical Partitions Card */}
      <Card>
        <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
            <Layers className="h-4 w-4 text-cyan-400" /> Partition Topology & Filesystem Mounts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Partition Path</th>
                  <th className="p-4">Filesystem</th>
                  <th className="p-4">Capacity</th>
                  <th className="p-4">Mount Point</th>
                  <th className="p-4">Volume Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2c40]/60">
                {device.partitions && device.partitions.length > 0 ? (
                  device.partitions.map((p) => (
                    <tr key={p.device_path} className="hover:bg-white/[0.02] transition">
                      <td className="p-4 text-slate-200 font-bold">{p.device_path}</td>
                      <td className="p-4 uppercase text-cyan-400">{p.filesystem || "RAW"}</td>
                      <td className="p-4 text-slate-300 font-sans">{formatBytes(p.capacity_bytes)}</td>
                      <td className="p-4 text-slate-200">{p.mount_points?.[0] || "Not mounted"}</td>
                      <td className="p-4 text-slate-400">{p.label || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                      No logical partitions detected on this physical drive.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Log */}
      {evidence.length > 0 && (
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <DatabaseZap className="h-4 w-4 text-emerald-400" /> Cryptographic Evidence Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Target File</th>
                    <th className="p-4">SHA-256 Hash</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2c40]/60">
                  {evidence.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition">
                      <td className="p-4 text-slate-300 max-w-sm truncate">{e.path}</td>
                      <td className="p-4 text-emerald-400 break-all">{e.sha256 || "—"}</td>
                      <td className="p-4 text-slate-400 font-sans">{formatDate(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* In-Page Create Forensic Case Modal */}
      {caseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-[#0f172a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1e2c40] pb-3">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Create Forensic Case</h3>
              </div>
              <button 
                onClick={() => setCaseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Case Identifier / Name
                </label>
                <input
                  type="text"
                  required
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  placeholder="e.g. Case-USB-Investigation-01"
                  className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  value={caseDesc}
                  onChange={(e) => setCaseDesc(e.target.value)}
                  placeholder="Case notes, incident number, or examination notes..."
                  className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] leading-relaxed">
                Device target: <strong>{device.vendor} {device.model}</strong> ({device.device_path}). Acquisition will proceed in read-only mode.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setCaseModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1"
                  loading={creatingCase}
                >
                  Initialize Case
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
