import React, { useState, useEffect } from "react";
import { forensicApi, ForensicCase } from "../services/forensicApi";
import { deviceApi } from "../services/api";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  FileSearch, HardDrive, Shield, Trash2, ArrowRight, 
  Plus, AlertTriangle, CheckCircle2, Clock, X, RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Forensics() {
  const [cases, setCases] = useState<ForensicCase[]>([]);
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Modal State for Case Creation
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTargetDeviceId, setSelectedTargetDeviceId] = useState("");
  const [caseNameInput, setCaseNameInput] = useState("");
  const [caseDescInput, setCaseDescInput] = useState("");
  const [creating, setCreating] = useState(false);

  // Modal State for Case Deletion
  const [deleteModalCase, setDeleteModalCase] = useState<ForensicCase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, devicesRes] = await Promise.all([
        forensicApi.listCases(),
        deviceApi.list()
      ]);
      setCases(casesRes || []);
      setDevices(devicesRes.devices || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load forensic environment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = (deviceId: string) => {
    setSelectedTargetDeviceId(deviceId);
    const target = devices.find(d => d.id === deviceId);
    setCaseNameInput(`Case-${target?.model || "Investigation"}-${Date.now().toString().slice(-4)}`);
    setCaseDescInput("");
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNameInput.trim() || !selectedTargetDeviceId) return;
    setCreating(true);
    try {
      const newCase = await forensicApi.createCase(
        caseNameInput.trim(),
        selectedTargetDeviceId,
        caseDescInput.trim() || "Forensic case initialized from hub"
      );
      setCreateModalOpen(false);
      navigate(`/forensics/case/${newCase.case_id}`);
    } catch (err: any) {
      alert(err.message || "Failed to initialize forensic case.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalCase) return;
    setDeleting(true);
    try {
      await forensicApi.deleteCase(deleteModalCase.case_id);
      setCases(cases.filter(c => c.case_id !== deleteModalCase.case_id));
      setDeleteModalCase(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete forensic case.");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "ANALYZED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "ACQUIRING":
      case "ANALYZING":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse";
      case "FAILED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 select-none page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2c40] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-blue-400 uppercase mb-1">
            <FileSearch className="h-3.5 w-3.5" /> FORENSIC OPERATIONS CENTER
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Digital Forensics & Chain-of-Custody
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Read-only bitstream disk imaging, raw block carving, metadata recovery, and evidence logging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono font-semibold">
            <Shield className="h-3.5 w-3.5 text-blue-400" />
            READ-ONLY ENFORCED
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-mono text-rose-300">
          Forensics Subsystem Error: {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Discovered Evidence Sources */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-cyan-400" /> Connected Evidence Sources
            </h2>
            <span className="text-[11px] font-mono text-slate-400">{devices.length} Detected</span>
          </div>

          {devices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1e2c40] bg-[#0f172a]/50 p-12 text-center">
              <HardDrive className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No Storage Sources Detected</p>
              <p className="text-xs text-slate-500 mt-1">Attach a physical drive or portable storage device.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((d) => {
                const isSystem = d.system_disk;
                return (
                  <div
                    key={d.id}
                    className={`rounded-2xl border bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl transition-all duration-200 overflow-hidden ${
                      isSystem 
                        ? "border-rose-500/30 bg-gradient-to-r from-[#0f172a] to-rose-950/10" 
                        : "border-[#1e2c40] hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-xl border shrink-0 ${
                          isSystem ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
                          "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                        }`}>
                          <HardDrive className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-white truncate" title={`${d.vendor ? `${d.vendor} ` : ""}${d.model || ""}`}>
                            {d.vendor ? `${d.vendor} ` : ""}{d.model}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate" title={d.device_path}>
                            {d.device_path} • {formatBytes(d.capacity_bytes || d.size_bytes || 0)}
                          </p>
                        </div>
                      </div>

                      <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${
                        isSystem 
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}>
                        {isSystem ? "SYSTEM OS" : (d.device_type || "STORAGE")}
                      </span>
                    </div>

                    <div className="pt-2">
                      {isSystem ? (
                        <div className="w-full py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-center text-xs font-semibold">
                          Protected System Disk
                        </div>
                      ) : (
                        <Button 
                          variant="forensic" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleOpenCreateModal(d.id)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Initialize Forensic Case
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active & Past Cases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-blue-400" /> Active Forensic Cases
            </h2>
            <span className="text-[11px] font-mono text-slate-400">{cases.length} Total Cases</span>
          </div>

          {cases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1e2c40] bg-[#0f172a]/50 p-12 text-center">
              <FileSearch className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No Forensic Cases Created</p>
              <p className="text-xs text-slate-500 mt-1">Select an evidence source on the left to start an investigation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <div
                  key={c.case_id}
                  onClick={() => navigate(`/forensics/case/${c.case_id}`)}
                  className="group rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm p-5 shadow-xl hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] cursor-pointer transition-all duration-200 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors truncate" title={c.case_name}>
                          {c.case_name}
                        </h4>
                        <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${getStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-1 truncate" title={`ID: ${c.case_id}`}>
                        ID: {c.case_id} {c.device_id ? `• Device: ${c.device_id}` : ""}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModalCase(c);
                      }}
                      title="Delete Case"
                      className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {c.description && (
                    <p className="text-xs text-slate-400 line-clamp-1 mb-3 font-sans">
                      {c.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-[#1e2c40]/70 text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(c.created_at)}
                    </span>
                    <span className="text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Open Case <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-Page Modal for Case Creation */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/40 bg-[#0f172a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1e2c40] pb-3">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Initialize Forensic Case</h3>
              </div>
              <button 
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Case Identifier / Name
                </label>
                <input
                  type="text"
                  required
                  value={caseNameInput}
                  onChange={(e) => setCaseNameInput(e.target.value)}
                  placeholder="e.g. Case-USB-Investigation"
                  className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Investigation Description
                </label>
                <textarea
                  rows={3}
                  value={caseDescInput}
                  onChange={(e) => setCaseDescInput(e.target.value)}
                  placeholder="Reason for examination, incident reference, or evidence custody notes..."
                  className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] leading-relaxed">
                Device source: <strong className="text-white font-mono">{selectedTargetDeviceId}</strong>. Bitstream image acquisition will be mounted strictly in write-blocked read-only mode.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="forensic" 
                  className="flex-1"
                  loading={creating}
                >
                  Create Case
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-Page Modal for Case Deletion */}
      {deleteModalCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0f172a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete Case</h3>
                <p className="text-xs text-rose-300">Irreversible evidence deletion</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete case <strong className="text-white font-mono">{deleteModalCase.case_name}</strong> ({deleteModalCase.case_id}) and all associated bitstream acquisition logs?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setDeleteModalCase(null)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                className="flex-1"
                loading={deleting}
                onClick={handleDeleteConfirm}
              >
                Delete Case
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
