import React, { useState, useEffect } from "react";
import { 
  RotateCcw, Search, Download, CheckCircle2, AlertTriangle, 
  FileText, Image as ImageIcon, Film, Archive, Code, File, HardDrive, 
  CheckSquare, Square, Shield, RefreshCw, FolderOpen, ArrowRight,
  ShieldCheck, Smartphone, Check
} from "lucide-react";
import { deviceApi } from "../services/api";
import { recoveryApi, DeletedFileItem, RecoveredFileRecord } from "../services/recoveryApi";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Button } from "../components/ui/button";

export function Recovery() {
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [scanType, setScanType] = useState<"quick" | "deep" | "forensic_image">("quick");
  const [imagePath, setImagePath] = useState<string>("");
  
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const [deletedFiles, setDeletedFiles] = useState<DeletedFileItem[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const [recoveryHistory, setRecoveryHistory] = useState<RecoveredFileRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [restoredNotification, setRestoredNotification] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
    loadHistory();
  }, []);

  const loadDevices = async (force = false) => {
    setLoadingDevices(true);
    try {
      const res = await deviceApi.list({ refresh: force });
      const list = res.devices || [];
      setDevices(list);
      // Auto-select first non-system or accessible data volume/drive
      const defaultDev = list.find(d => !d.system_disk) || list[0];
      if (defaultDev) {
        setSelectedDeviceId(defaultDev.id);
      }
    } catch (e: any) {
      console.error("Failed to load devices", e);
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadHistory = async () => {
    try {
      const history = await recoveryApi.getHistory();
      setRecoveryHistory(history || []);
    } catch (e) {
      console.error("Failed to load recovery history", e);
    }
  };

  const handleStartScan = async () => {
    if (scanType !== "forensic_image" && !selectedDeviceId) return;
    if (scanType === "forensic_image" && !imagePath.trim()) {
      alert("Please specify a valid path to a forensic disk image (.dd, .raw, .img, .iso).");
      return;
    }
    setScanning(true);
    setDeletedFiles([]);
    setSelectedFileIds(new Set());
    setRestoredNotification(null);
    try {
      const res = await recoveryApi.scan(
        scanType === "forensic_image" ? "forensic_image" : selectedDeviceId,
        scanType,
        undefined,
        scanType === "forensic_image" ? imagePath.trim() : undefined
      );
      setDeletedFiles(res.files || []);
      if ((res.files || []).length === 0) {
        alert("Scan completed. No deleted or carved files detected on this target.");
      }
    } catch (e: any) {
      alert(`Scan failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const toggleSelectFile = (id: string) => {
    const next = new Set(selectedFileIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedFileIds(next);
  };

  const handleRecoverFiles = async (fileIds: string[]) => {
    if (fileIds.length === 0) return;
    setRecovering(true);
    try {
      const res = await recoveryApi.restore(selectedDeviceId, fileIds);
      const successful = (res.restored_items || []).filter(r => r.status === "RECOVERED");
      setRestoredNotification(`Successfully restored ${successful.length} of ${fileIds.length} file(s) with SHA-256 integrity verification.`);
      
      // Refresh history
      loadHistory();
      
      // Remove recovered files from selected set
      const next = new Set(selectedFileIds);
      fileIds.forEach(id => next.delete(id));
      setSelectedFileIds(next);
    } catch (e: any) {
      alert(`Recovery failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setRecovering(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Document": return <FileText className="w-4 h-4 text-cyan-400" />;
      case "Image": return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case "Media": return <Film className="w-4 h-4 text-purple-400" />;
      case "Archive": return <Archive className="w-4 h-4 text-amber-400" />;
      case "Code": return <Code className="w-4 h-4 text-pink-400" />;
      default: return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredFiles = deletedFiles.filter(f => {
    const matchesSearch = f.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.original_path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "All" || f.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1e2c40] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase mb-1">
            <RotateCcw className="h-3.5 w-3.5" /> FORENSIC RECOVERY ENGINE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Deleted File Recovery & Carver
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            NTFS `$RECYCLE.BIN` parser, cluster remnant carver, and cryptographic SHA-256 verified restoration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            Recovered Archive ({recoveryHistory.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDevices(true)}
            loading={loadingDevices}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Control Panel: Device Selector & Scan Mode */}
      <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Drive Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" /> Target Storage Source
            </label>
            {scanType === "forensic_image" ? (
              <input
                type="text"
                value={imagePath}
                onChange={(e) => setImagePath(e.target.value)}
                placeholder="e.g. C:\cases\disk.raw or D:\image.dd"
                className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl px-4 py-2.5 text-slate-100 text-xs focus:border-cyan-500 outline-none font-mono placeholder:text-slate-600"
              />
            ) : (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl px-4 py-2.5 text-slate-100 text-xs focus:border-cyan-500 outline-none font-mono"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.vendor || "Storage"} {d.model || d.device_path} ({formatBytes(d.capacity_bytes || d.size_bytes || 0)}) {d.system_disk ? "— [SYSTEM OS]" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scan Technique */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" /> Scan Algorithm
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScanType("quick")}
                className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition ${
                  scanType === "quick" 
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-glow" 
                    : "bg-[#090d16] border-[#1e2c40] text-slate-400 hover:text-white"
                }`}
              >
                NTFS Metadata
              </button>
              <button
                type="button"
                onClick={() => setScanType("deep")}
                className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition ${
                  scanType === "deep" 
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-glow" 
                    : "bg-[#090d16] border-[#1e2c40] text-slate-400 hover:text-white"
                }`}
              >
                Raw Carver
              </button>
              <button
                type="button"
                onClick={() => setScanType("forensic_image")}
                className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition ${
                  scanType === "forensic_image" 
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-glow" 
                    : "bg-[#090d16] border-[#1e2c40] text-slate-400 hover:text-white"
                }`}
              >
                Disk Image (.raw)
              </button>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex items-end">
            <Button
              onClick={handleStartScan}
              disabled={scanning || (scanType !== "forensic_image" && !selectedDeviceId)}
              loading={scanning}
              variant="primary"
              className="w-full h-10 shadow-glow"
            >
              <Search className="w-4 h-4" /> {scanning ? "Analyzing Sectors..." : "Scan & Carve Files"}
            </Button>
          </div>
        </div>

        {/* Supported Formats Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1e2c40]/80 text-[11px]">
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-300">Supported Carving Formats:</span>
            {["JPG", "PNG", "PDF", "DOCX", "XLSX", "ZIP", "MP4"].map((fmt) => (
              <span key={fmt} className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-mono text-[10px] font-bold">
                {fmt}
              </span>
            ))}
          </div>
          <span className="text-slate-400 font-sans">
            Digital Image Analysis • Fragment Reconstruction • File Validation
          </span>
        </div>

        {selectedDevice && scanType !== "forensic_image" && (
          <div className="pt-3 border-t border-[#1e2c40]/40 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono">
            <div><span className="text-slate-500">Path:</span> <span className="text-slate-200">{selectedDevice.device_path}</span></div>
            <div><span className="text-slate-500">Type:</span> <span className="text-cyan-400 font-semibold">{selectedDevice.device_type || "STORAGE"}</span></div>
            <div><span className="text-slate-500">Mount:</span> <span className="text-slate-200">{selectedDevice.mount_point || "Unmounted"}</span></div>
            <div><span className="text-slate-500">Status:</span> <span className="text-emerald-400 font-semibold">Active & Scannable</span></div>
          </div>
        )}
      </div>

      {/* Restored Toast Notification */}
      {restoredNotification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{restoredNotification}</span>
          </div>
          <button 
            onClick={() => setRestoredNotification(null)}
            className="text-xs font-bold text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Recovered Files History View (Toggleable) */}
      {showHistory && (
        <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" /> Recovered Evidence Archive ({recoveryHistory.length})
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowHistory(false)}
            >
              Close Archive
            </Button>
          </div>

          {recoveryHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-sans">No files have been recovered yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#1e2c40]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0b0f19] border-b border-[#1e2c40] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Recovery ID</th>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">SHA-256 Hash</th>
                    <th className="px-4 py-3">Recovered Timestamp</th>
                    <th className="px-4 py-3 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2c40]/60">
                  {recoveryHistory.map((rec) => (
                    <tr key={rec.recovery_id} className="hover:bg-white/[.02] transition">
                      <td className="px-4 py-3 text-cyan-400 font-bold">{rec.recovery_id}</td>
                      <td className="px-4 py-3 font-sans font-medium text-white">{rec.filename}</td>
                      <td className="px-4 py-3 font-sans text-slate-300">{formatBytes(rec.size_bytes)}</td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs" title={rec.sha256 || ""}>
                        {rec.sha256 ? `${rec.sha256.slice(0, 20)}...` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-sans">
                        {formatDate(rec.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <a
                          href={`/api/recovery/download/${encodeURIComponent(rec.filename)}`}
                          download
                          className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Table: Discovered Deleted Files */}
      <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-5 backdrop-blur-sm">
        {/* Filters & Batch Actions Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {["All", "Document", "Image", "Media", "Archive", "Code", "Other"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  categoryFilter === cat 
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow" 
                    : "border border-[#1e2c40] bg-[#090d16] text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by filename..."
                className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>

            <Button
              onClick={() => handleRecoverFiles(Array.from(selectedFileIds))}
              disabled={selectedFileIds.size === 0 || recovering}
              loading={recovering}
              variant="success"
              size="sm"
            >
              <Download className="w-3.5 h-3.5" /> Restore Selected ({selectedFileIds.size})
            </Button>
          </div>
        </div>

        {/* Results Info */}
        <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
          <span>Discovered <strong className="text-white">{filteredFiles.length}</strong> of <strong className="text-white">{deletedFiles.length}</strong> deleted record(s)</span>
          {selectedFileIds.size > 0 && (
            <span className="text-cyan-400 font-semibold">{selectedFileIds.size} file(s) selected for recovery</span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[#1e2c40]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] border-b border-[#1e2c40] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white flex items-center">
                    {selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">File Name & Source</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Storage Location / Path</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Evidence Quality</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2c40]/60 font-mono">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                return (
                  <tr 
                    key={file.id} 
                    className={`transition-colors ${isSelected ? "bg-cyan-500/[0.06]" : "hover:bg-white/[0.02]"}`}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelectFile(file.id)} className="text-slate-400 hover:text-white flex items-center">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="flex items-center gap-2.5">
                        {getCategoryIcon(file.category)}
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate max-w-xs" title={file.filename}>
                            {file.filename}
                          </div>
                          <div className="text-[10px] font-mono text-cyan-400/80 uppercase">
                            {file.recovery_method.startsWith("raw_carver")
                              ? `Raw Carver (${file.extension.toUpperCase()})`
                              : "NTFS Metadata"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 uppercase text-[11px]">{file.category}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-sm font-mono text-[11px]" title={file.original_path}>
                      {file.original_path}
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-sans">{formatBytes(file.size_bytes)}</td>
                    <td className="px-4 py-3 text-slate-400 font-sans text-[11px]">
                      {file.deleted_at ? formatDate(file.deleted_at) : "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            file.confidence === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" :
                            file.confidence === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" :
                            "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}>
                            {file.confidence_score !== undefined ? `${file.confidence_score}% ` : ""}{file.confidence}
                          </span>
                        </div>
                        {file.validation_details && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs" title={file.validation_details}>
                            {file.validation_details}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <Button
                        size="sm"
                        variant="signal"
                        onClick={() => handleRecoverFiles([file.id])}
                        disabled={recovering}
                      >
                        <Download className="w-3 h-3" /> Recover
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-500 font-sans">
                    {deletedFiles.length === 0 ? (
                      <div className="space-y-3">
                        <RotateCcw className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
                        <p className="text-sm font-semibold text-slate-400">No deleted files scanned yet</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Select a target drive or storage device above and click "Scan for Deleted Files" to begin forensic recovery.
                        </p>
                      </div>
                    ) : (
                      "No deleted files matched your filter criteria."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
