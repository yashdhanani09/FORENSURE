import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deviceApi } from "../services/api";
import { forensicApi } from "../services/forensicApi";
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
      const newCase = await forensicApi.createCase(
        caseName.trim(), 
        device.id, 
        caseDesc.trim() || "Created from device details view"
      );
      
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
    <div className="w-full max-w-[1850px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 py-8 space-y-8 select-none page-enter">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#182035] pb-6">
        <div>
          <button
            onClick={() => navigate('/devices')}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Fleet Inventory
          </button>
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`p-3.5 rounded-xl border shrink-0 ${
              isSystem ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
              "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            }`}>
              <HardDrive className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl lg:text-3xl font-black text-white break-words">
                  {device.vendor ? `${device.vendor} ` : ""}{device.model}
                </h1>
                <span className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                  isSystem 
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                }`}>
                  {isSystem ? "PROTECTED SYSTEM DISK" : (device.device_type || "DATA STORAGE")}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-mono text-slate-300 mt-1 break-all">{device.id} • {device.device_path}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="default"
            className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl"
            onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/devices/${encodeURIComponent(device.id)}/report/pdf`)}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export PDF
          </Button>
          <Button 
            variant="outline" 
            size="default"
            className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl"
            onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/devices/${encodeURIComponent(device.id)}/report/json`)}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export JSON
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specs Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
              <Cpu className="h-5 w-5 text-cyan-400" /> Physical Hardware Attributes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-sm font-mono">
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-xs block font-semibold">Manufacturer / Vendor</span>
                <span className="text-white font-bold text-base font-sans">{device.vendor || "Unknown"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-xs block font-semibold">Product Model</span>
                <span className="text-white font-bold text-base font-sans">{device.model || "Unknown"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-xs block font-semibold">Serial Number</span>
                <span className="text-slate-200 break-all text-sm">{device.serial || "Not reported"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-xs block font-semibold">Total Capacity</span>
                <span className="text-cyan-400 font-bold text-base sm:text-lg font-sans">
                  {formatBytes(device.capacity_bytes || device.size_bytes || 0)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-xs block font-semibold">Physical Path</span>
                <span className="text-slate-300 text-sm">{device.device_path}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-xs block font-semibold">Transport / Interface</span>
                <span className="text-white uppercase font-bold text-sm">{device.transport || device.device_type || "Direct"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Panel */}
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
              <Shield className="h-5 w-5 text-emerald-400" /> Operational Directives
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isSystem ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
                  <AlertTriangle className="h-4 w-4" /> System Protection Active
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  This storage device contains the active OS boot volume (C:). Write modifications, full-disk overwrites, and wiping are strictly prevented to protect system integrity.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  className="w-full justify-start h-11 text-sm font-bold rounded-xl" 
                  variant="forensic" 
                  onClick={() => { setCaseName(`Case-${device.model}`); setCaseModalOpen(true); }}
                >
                  <FileSearch className="h-4.5 w-4.5 mr-2" /> Start Forensic Case
                </Button>

                <Button 
                  className="w-full justify-start h-11 text-sm font-bold rounded-xl" 
                  variant="signal" 
                  onClick={() => navigate('/recovery')}
                >
                  <RotateCcw className="h-4.5 w-4.5 mr-2" /> Scan for Deleted Files
                </Button>

                <Button 
                  className="w-full justify-start h-11 text-sm font-bold rounded-xl" 
                  variant="destructive" 
                  onClick={() => navigate('/sanitization')}
                >
                  <ShieldAlert className="h-4.5 w-4.5 mr-2" /> Open Sanitization Suite
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logical Partitions Card */}
      <Card>
        <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
            <Layers className="h-5 w-5 text-cyan-400" /> Partition Topology & Filesystem Mounts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono">
              <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-300 uppercase tracking-wider text-xs font-extrabold">
                <tr>
                  <th className="px-6 py-4.5">Partition Path</th>
                  <th className="px-6 py-4.5">Filesystem</th>
                  <th className="px-6 py-4.5">Capacity</th>
                  <th className="px-6 py-4.5">Mount Point</th>
                  <th className="px-6 py-4.5">Volume Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2c40]/60">
                {device.partitions && device.partitions.length > 0 ? (
                  device.partitions.map((p) => (
                    <tr key={p.device_path} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4.5 text-slate-200 font-bold">{p.device_path}</td>
                      <td className="px-6 py-4.5 uppercase text-cyan-400 font-bold">{p.filesystem || "RAW"}</td>
                      <td className="px-6 py-4.5 text-slate-100 font-sans font-bold">{formatBytes(p.capacity_bytes)}</td>
                      <td className="px-6 py-4.5 text-slate-200">{p.mount_points?.[0] || "Not mounted"}</td>
                      <td className="px-6 py-4.5 text-slate-400">{p.label || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-sans text-sm">
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
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
              <DatabaseZap className="h-5 w-5 text-emerald-400" /> Cryptographic Evidence Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-300 uppercase tracking-wider text-xs font-extrabold">
                  <tr>
                    <th className="px-6 py-4.5">Target File</th>
                    <th className="px-6 py-4.5">SHA-256 Hash</th>
                    <th className="px-6 py-4.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2c40]/60">
                  {evidence.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4.5 text-slate-200 max-w-sm truncate font-sans font-medium">{e.path}</td>
                      <td className="px-6 py-4.5 text-emerald-400 break-all">{e.sha256 || "—"}</td>
                      <td className="px-6 py-4.5 text-slate-300 font-sans">{formatDate(e.created_at)}</td>
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
