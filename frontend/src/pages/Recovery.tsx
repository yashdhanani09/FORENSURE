import React, { useState, useEffect } from "react";
import { 
  RotateCcw, Search, Download, CheckCircle2, AlertTriangle, 
  FileText, Image as ImageIcon, Film, Archive, Code, File, HardDrive, 
  CheckSquare, Square, Shield, RefreshCw, FolderOpen, ArrowRight,
  ShieldCheck, Smartphone, Check, Copy, Cpu, Layers, Hash, FileCheck,
  Printer, X, KeyRound, ArrowUpDown, ChevronLeft, ChevronRight, ShieldAlert
} from "lucide-react";
import { deviceApi } from "../services/api";
import { agentConnection } from "../services/agentConnection";
import { recoveryApi, DeletedFileItem, RecoveredFileRecord, ForensicReportResponse, RestoredItem, RecoveryPrivileges } from "../services/recoveryApi";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Button } from "../components/ui/button";

export function Recovery() {
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [scanType, setScanType] = useState<"unified" | "auto" | "quick" | "deep" | "forensic_image">("unified");
  const [imagePath, setImagePath] = useState<string>("");
  const [showAdvancedImage, setShowAdvancedImage] = useState<boolean>(false);
  
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

  // Forensic Profiling, Hashes & Report State
  const [deviceProfile, setDeviceProfile] = useState<any>(null);
  const [acquisitionHash, setAcquisitionHash] = useState<string>("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<ForensicReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Newly Restored Files Download Popup State
  const [showRestoredModal, setShowRestoredModal] = useState(false);
  const [newlyRestoredItems, setNewlyRestoredItems] = useState<RestoredItem[]>([]);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Administrator Privileges & UAC Elevation State
  const [privileges, setPrivileges] = useState<RecoveryPrivileges | null>(null);
  const [elevating, setElevating] = useState(false);
  const [showElevationModal, setShowElevationModal] = useState(false);

  // Full List Sorting (Default: Recent to Old) & Pagination State
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "size_desc" | "name" | "confidence">("recent");
  const [pageSize, setPageSize] = useState<number>(0); // 0 means Show All Files
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    loadDevices();
    loadHistory();
    checkPrivileges();
  }, []);

  const checkPrivileges = async () => {
    try {
      const priv = await recoveryApi.getPrivileges();
      setPrivileges(priv);
    } catch (e) {
      console.warn("Could not check privilege status:", e);
      setPrivileges({
        is_admin: false,
        can_read_raw_disk: false,
        platform: "Windows",
        elevation_required: true,
        advisory: "Bridge not elevated. Grant Administrator privileges (UAC) to scan raw physical sectors on D:.",
      });
    }
  };

  const handleRequestElevation = async () => {
    setElevating(true);
    setShowElevationModal(true);
    try {
      const res = await recoveryApi.requestElevation();
      if (res.status === "ALREADY_ADMIN") {
        await checkPrivileges();
        setElevating(false);
      } else {
        // Poll for elevation status up to 15 times (22.5 seconds)
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts += 1;
          try {
            const currentPriv = await recoveryApi.getPrivileges();
            if (currentPriv.is_admin || currentPriv.can_read_raw_disk) {
              setPrivileges(currentPriv);
              clearInterval(interval);
              setElevating(false);
              loadDevices(true);
              return;
            }
          } catch {
            // Backend might be restarting elevated
          }
          if (attempts >= 15) {
            clearInterval(interval);
            setElevating(false);
            checkPrivileges();
          }
        }, 1500);
      }
    } catch (e: any) {
      console.warn("Elevation request error:", e);
      setElevating(false);
    }
  };

  const loadDevices = async (force = false) => {
    setLoadingDevices(true);
    try {
      const res = await deviceApi.list({ refresh: force });
      const list = res.devices || [];
      setDevices(list);
      // Auto-select "all" for whole machine recovery or maintain selection
      if (!selectedDeviceId) {
        setSelectedDeviceId("all");
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
    const effectiveScanType = showAdvancedImage && imagePath.trim() ? "forensic_image" : "auto";
    if (effectiveScanType !== "forensic_image" && !selectedDeviceId) return;
    if (effectiveScanType === "forensic_image" && !imagePath.trim()) {
      alert("Please specify a valid path to a forensic disk image (.dd, .raw, .img, .iso).");
      return;
    }
    setScanning(true);
    setDeletedFiles([]);
    setSelectedFileIds(new Set());
    setRestoredNotification(null);
    try {
      const res = await recoveryApi.scan(
        effectiveScanType === "forensic_image" ? "forensic_image" : selectedDeviceId,
        effectiveScanType,
        undefined,
        effectiveScanType === "forensic_image" ? imagePath.trim() : undefined
      );
      setDeletedFiles(res.files || []);
      setDeviceProfile(res.device_profile || null);
      setAcquisitionHash(res.acquisition_hash || "");
      if ((res.files || []).length === 0) {
        alert("Scan completed. No deleted or carved files detected on this target.");
      }
    } catch (e: any) {
      let errorMsg = e.message || "Unknown scan error";
      if (e.response?.data?.detail) {
        if (typeof e.response.data.detail === "string") {
          errorMsg = e.response.data.detail;
        } else if (Array.isArray(e.response.data.detail)) {
          errorMsg = e.response.data.detail
            .map((d: any) => (typeof d === "string" ? d : d.msg || JSON.stringify(d)))
            .join("; ");
        } else if (typeof e.response.data.detail === "object") {
          errorMsg = JSON.stringify(e.response.data.detail);
        }
      }
      alert(`Scan failed: ${errorMsg}`);
    } finally {
      setScanning(false);
    }
  };

  const handleOpenReport = async () => {
    const targetId = scanType === "forensic_image" ? "forensic_image" : (selectedDeviceId || "all");
    setLoadingReport(true);
    try {
      const rep = await recoveryApi.getReport(targetId);
      setReportData(rep);
      setShowReportModal(true);
    } catch (e: any) {
      alert(`Could not load forensic report: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoadingReport(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleRecoverFiles = async (fileIds: string[]) => {
    if (fileIds.length === 0) return;
    setRecovering(true);
    try {
      const res = await recoveryApi.restore(selectedDeviceId, fileIds);
      const successful = (res.restored_items || []).filter(r => r.status === "RECOVERED");
      setRestoredNotification(`Successfully restored ${successful.length} of ${fileIds.length} file(s) with SHA-256 integrity verification.`);
      
      // Open instant download modal with restored files
      setNewlyRestoredItems(res.restored_items || []);
      setShowRestoredModal(true);

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

  const downloadFile = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      // 1. Fetch raw binary blob from the verified backend API
      const blob = await recoveryApi.downloadFile(filename);

      // 2. Strict validation: Ensure response is actual file data and not an HTML fallback page
      if (blob.type && blob.type.includes("text/html")) {
        const text = await blob.text();
        if (text.includes("<!doctype html>") || text.includes("<html") || text.includes("<div id=\"root\">")) {
          throw new Error("Backend connection error: Received HTML fallback page instead of the recovered file.");
        }
      }

      // 3. Create blob URL and trigger direct browser machine download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (e: any) {
      console.warn("Direct blob download failed, attempting backend agent URL fallback:", e);
      try {
        const backendBase = agentConnection.getApiBaseUrl() || "http://127.0.0.1:8000";
        const directUrl = `${backendBase.replace(/\/$/, "")}/api/recovery/download/${encodeURIComponent(filename)}`;
        const link = document.createElement("a");
        link.href = directUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err: any) {
        alert(`Failed to download ${filename}: ${e.message || err.message}`);
      }
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadAllRestored = async () => {
    const successful = newlyRestoredItems.filter(r => r.status === "RECOVERED");
    for (let i = 0; i < successful.length; i++) {
      await downloadFile(successful[i].filename);
      await new Promise(res => setTimeout(res, 400));
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

  // Strict sorting: Default is Recent to Old (Newest deletion at top)
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === "recent") {
      const tA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const tB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      return tB - tA; // Recent to Old
    }
    if (sortBy === "oldest") {
      const tA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const tB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      return tA - tB; // Old to Recent
    }
    if (sortBy === "size_desc") {
      return (b.size_bytes || 0) - (a.size_bytes || 0);
    }
    if (sortBy === "name") {
      return a.filename.localeCompare(b.filename);
    }
    if (sortBy === "confidence") {
      return (b.confidence_score || 0) - (a.confidence_score || 0);
    }
    return 0;
  });

  const displayFiles = pageSize > 0 
    ? sortedFiles.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedFiles;

  const totalPages = pageSize > 0 ? Math.ceil(sortedFiles.length / pageSize) : 1;

  const toggleSelectAll = () => {
    if (selectedFileIds.size === displayFiles.length && displayFiles.length > 0) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(displayFiles.map(f => f.id)));
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

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const isMobileTarget = selectedDevice?.device_type === "MOBILE_DEVICE" || 
                         (selectedDevice?.device_path?.includes("WPD") ?? false) ||
                         (selectedDevice?.partitions?.some(p => p.filesystem === "MTP") ?? false);

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
            NTFS `$RECYCLE.BIN` parser, Android Scoped Storage carver, and cryptographic SHA-256 verified restoration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenReport}
            loading={loadingReport}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Forensic Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            Recovered Archive ({recoveryHistory.length})
          </Button>
          {/* Top-Bar Administrator / UAC Trigger Button */}
          {privileges?.is_admin ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin: Active</span>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleRequestElevation}
              loading={elevating}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold border-0 shadow-md shadow-amber-950/40"
            >
              <Shield className="w-3.5 h-3.5 mr-1" />
              {elevating ? "Requesting..." : "Run as Administrator (UAC)"}
            </Button>
          )}

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

      {/* Administrator / UAC Elevation Banner */}
      {!privileges?.is_admin && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-sm shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-200">
                  Standard User Mode — Raw Volume Access Blocked
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30">
                  UAC ELEVATION AVAILABLE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Windows kernel security blocks direct physical sector carving on drive <span className="text-amber-300 font-mono font-semibold">D:</span> when running as a standard user. Grant Administrator privileges to enable low-level NTFS MFT parsing for permanently deleted and emptied-recycle-bin files.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <Button
              variant="default"
              size="sm"
              onClick={handleRequestElevation}
              loading={elevating}
              className="w-full md:w-auto bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold border-0 shadow-md shadow-amber-950/50"
            >
              <Shield className="w-4 h-4 mr-1.5" />
              {elevating ? "Requesting Elevation..." : "Grant Administrator Access (UAC)"}
            </Button>
          </div>
        </div>
      )}

      {/* Privileges Active Badge when is_admin is true */}
      {privileges && privileges.is_admin && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3.5 px-5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">
              Kernel Administrator Access Active
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              — Direct physical sector carving and NTFS MFT deep scanning enabled on all drives.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ELEVATED
          </span>
        </div>
      )}

      {/* Control Panel: Device Selector & Unified Single Scan */}
      <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          {/* Target Drive Selector */}
          <div className="lg:col-span-5 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" /> Target Storage Source
            </label>
            {showAdvancedImage ? (
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
                <option value="all">
                  💻 Entire Machine &amp; All Volumes (C:\, D:\, All Recycle Bins)
                </option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.device_type === "MOBILE_DEVICE" ? "📱 " : ""}{d.vendor || "Storage"} {d.model || d.device_path} ({formatBytes(d.capacity_bytes || d.size_bytes || 0)}) {d.system_disk ? "— [SYSTEM OS]" : ""}{d.device_type === "MOBILE_DEVICE" ? " — [MTP PHONE]" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Integrated Scanning Subsystems Status */}
          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" /> Unified All-in-One Engine
              </span>
              <button
                type="button"
                onClick={() => setShowAdvancedImage(!showAdvancedImage)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-mono"
              >
                {showAdvancedImage ? "← Drive Mode" : "Disk Image Mode (.raw)"}
              </button>
            </label>
            <div className="bg-[#090d16] border border-[#1e2c40] rounded-xl p-2.5 grid grid-cols-2 gap-1.5 text-[10.5px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> NTFS &amp; FAT Metadata
              </div>
              <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Raw Sector Carver
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Text &amp; Docs (.txt, .json)
              </div>
              <div className="flex items-center gap-1.5 text-purple-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Slack &amp; Temp Buffers
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="lg:col-span-3">
            <Button
              onClick={handleStartScan}
              disabled={scanning || (!showAdvancedImage && !selectedDeviceId)}
              loading={scanning}
              variant="primary"
              className="w-full h-11 text-xs font-bold tracking-wide shadow-glow"
            >
              <Search className="w-4 h-4" /> {scanning ? "Analyzing Sectors..." : isMobileTarget ? "Scan Phone Storage" : "Run Unified Forensic Scan"}
            </Button>
          </div>
        </div>

        {/* Supported Formats Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1e2c40]/80 text-[11px]">
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-300">Supported Formats:</span>
            {["TXT", "JSON", "MD", "JPG", "PNG", "PDF", "DOCX", "XLSX", "ZIP", "MP4"].map((fmt) => (
              <span key={fmt} className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-mono text-[10px] font-bold">
                {fmt}
              </span>
            ))}
          </div>
          <span className="text-slate-400 font-sans">
            Filesystem Records • Raw Sector Carving • Text Heuristics • Structural Verification
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

        {/* Mobile Device Forensic Advisory Banner */}
        {isMobileTarget && (
          <div className="bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/20 border border-cyan-500/40 rounded-xl p-4 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-bold tracking-wide uppercase text-[11px]">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Connected Mobile Device Detected (MTP / Portable Device)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-semibold">
                Android Scoped Recovery Mode
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300 text-[11px] leading-relaxed pt-1">
              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> USB & Screen Requirements
                </div>
                <p className="text-slate-400 text-[10px]">
                  Keep the phone screen <strong className="text-slate-200">unlocked</strong> during scanning, and verify USB mode is set to <strong className="text-slate-200">"File Transfer / MTP"</strong> (not "Charging only").
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Active Recovery Scope
                </div>
                <p className="text-slate-400 text-[10px]">
                  Scans Android Scoped Storage Trash (<code className="text-cyan-300">.trashed</code> 30-day retention), Gallery / Google Photos (<code className="text-cyan-300">.tmfs</code>), and high-resolution thumbnail media caches.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Deep Erasure & MicroSD Carving
                </div>
                <p className="text-slate-400 text-[10px]">
                  Android internal storage enforces File-Based Encryption (FBE). If files were lost on an external <strong className="text-slate-200">MicroSD Card</strong>, plug the SD card directly into a PC card reader for 100% raw sector bitstream carving.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Universal Forensic Pipeline Visualizer (ISO/IEC 27037 Architecture) */}
      <div className="bg-[#0b101e]/90 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Universal Forensic Data Pipeline (ISO/IEC 27037)
              </h3>
              <p className="text-[11px] text-slate-400">
                Non-destructive write-blocking, SHA-256 bitstream hashing, and dual-track signature carving
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3 h-3" /> READ-ONLY / WRITE-BLOCKED
            </span>
            {deviceProfile?.category && (
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                {deviceProfile.category}
              </span>
            )}
          </div>
        </div>

        {/* 11-Step Architectural Pipeline Flow */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-[900px] gap-1.5 text-[10px] font-mono">
            {[
              { id: "1", label: "Select Media", active: true },
              { id: "2", label: "Device Detection", active: true },
              { id: "3", label: deviceProfile?.category || (isMobileTarget ? "Mobile Device" : "HDD / USB / SD"), active: true, highlight: true },
              { id: "4", label: "Read-Only Acquisition", active: true },
              { id: "5", label: "SHA-256 Hash", active: !!acquisitionHash, highlight: !!acquisitionHash },
              { id: "6", label: "Dual-Track Engine", active: scanning || deletedFiles.length > 0 },
              { id: "7", label: "File Carving", active: scanning || deletedFiles.length > 0 },
              { id: "8", label: "Reconstruction", active: deletedFiles.length > 0 },
              { id: "9", label: "Validation", active: deletedFiles.length > 0 },
              { id: "10", label: "Scoring", active: deletedFiles.length > 0 },
              { id: "11", label: "Forensic Report", active: deletedFiles.length > 0 },
            ].map((step, idx, arr) => (
              <React.Fragment key={step.id}>
                <div className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  step.highlight
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-glow"
                    : step.active
                    ? "bg-[#0e1726] border-[#1e2c40] text-slate-200"
                    : "bg-black/30 border-white/5 text-slate-600"
                }`}>
                  <span className={`w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-bold ${
                    step.active ? "bg-cyan-500/30 text-cyan-300" : "bg-slate-800 text-slate-500"
                  }`}>
                    {step.id}
                  </span>
                  <span>{step.label}</span>
                </div>
                {idx < arr.length - 1 && (
                  <ArrowRight className={`w-3 h-3 flex-shrink-0 ${step.active ? "text-cyan-500/70" : "text-slate-700"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Acquisition Bitstream Hash Live Card */}
        {acquisitionHash && (
          <div className="bg-[#080d19] border border-cyan-500/30 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <KeyRound className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                  Forensic Acquisition SHA-256 Bitstream Hash:
                </div>
                <div className="text-cyan-300 font-mono font-bold truncate text-[11px]" title={acquisitionHash}>
                  {acquisitionHash}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyHash(acquisitionHash)}
                className="h-7 text-[11px] border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedHash ? "Copied" : "Copy Hash"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenReport}
                className="h-7 text-[11px]"
              >
                <FileText className="w-3 h-3 text-cyan-400" /> View Formal Report
              </Button>
            </div>
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
                        <button
                          onClick={() => downloadFile(rec.filename)}
                          disabled={downloadingFile === rec.filename}
                          className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" /> {downloadingFile === rec.filename ? "Downloading..." : "Download"}
                        </button>
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

        {/* Results Info & Sequence Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-[#1e2c40]/60 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium">Sequence:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#090d16] border border-[#1e2c40] rounded-xl px-2.5 py-1 text-xs text-cyan-300 outline-none focus:border-cyan-500 font-sans cursor-pointer"
              >
                <option value="recent">⚡ Recent to Old (Newest Deletion First)</option>
                <option value="oldest">⏳ Oldest to Recent (Oldest First)</option>
                <option value="size_desc">📦 File Size (Largest First)</option>
                <option value="name">🔤 File Name (A to Z)</option>
                <option value="confidence">🎯 Evidence Quality Score</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="font-medium">Display:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#090d16] border border-[#1e2c40] rounded-xl px-2.5 py-1 text-xs text-white outline-none focus:border-cyan-500 font-sans cursor-pointer"
              >
                <option value={0}>♾️ All Files (Full Comprehensive List)</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={200}>200 per page</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span>
              Showing <strong className="text-white">{displayFiles.length}</strong> of <strong className="text-white">{filteredFiles.length}</strong> matching ({deletedFiles.length} total)
            </span>
            {selectedFileIds.size > 0 && (
              <span className="text-cyan-400 font-semibold">• {selectedFileIds.size} selected</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[#1e2c40]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] border-b border-[#1e2c40] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white flex items-center">
                    {selectedFileIds.size === displayFiles.length && displayFiles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th 
                  className="px-4 py-3 cursor-pointer hover:text-white transition select-none"
                  onClick={() => setSortBy(sortBy === "name" ? "recent" : "name")}
                  title="Click to sort by filename"
                >
                  <div className="flex items-center gap-1.5">
                    <span>File Name & Source</span>
                    {sortBy === "name" && <span className="text-cyan-400 font-bold">↑</span>}
                  </div>
                </th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Storage Location / Path</th>
                <th 
                  className="px-4 py-3 cursor-pointer hover:text-white transition select-none"
                  onClick={() => setSortBy(sortBy === "size_desc" ? "recent" : "size_desc")}
                  title="Click to sort by file size"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Size</span>
                    {sortBy === "size_desc" && <span className="text-cyan-400 font-bold">↓</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 cursor-pointer hover:text-cyan-300 transition select-none"
                  onClick={() => setSortBy(sortBy === "recent" ? "oldest" : "recent")}
                  title="Click to toggle Newest / Oldest sequence"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Timestamp</span>
                    {sortBy === "recent" && <span className="text-cyan-400 font-bold">↓ (Recent)</span>}
                    {sortBy === "oldest" && <span className="text-cyan-400 font-bold">↑ (Oldest)</span>}
                    {sortBy !== "recent" && sortBy !== "oldest" && <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 cursor-pointer hover:text-white transition select-none"
                  onClick={() => setSortBy(sortBy === "confidence" ? "recent" : "confidence")}
                  title="Click to sort by evidence quality"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Evidence Quality</span>
                    {sortBy === "confidence" && <span className="text-cyan-400 font-bold">↓</span>}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2c40]/60 font-mono">
              {displayFiles.map((file) => {
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
                              : file.recovery_method.startsWith("android_")
                              ? file.recovery_method.replace("android_", "Android ").replace(/_/g, " ")
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

              {displayFiles.length === 0 && (
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

        {/* Pagination Controls */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#1e2c40] text-xs">
            <div className="text-slate-400">
              Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong> ({sortedFiles.length} total files)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-8 px-3"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <span className="px-2 font-mono text-cyan-300">{currentPage} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="h-8 px-3"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Newly Restored Files Direct Download Modal Popup */}
      {showRestoredModal && newlyRestoredItems.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0b101d] border border-emerald-500/40 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e2c40] flex items-center justify-between bg-[#080d19]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-glow">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-emerald-400 uppercase">
                    FORENSIC RESTORATION SUCCESSFUL
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    Recovered File(s) Ready to Download
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cryptographic SHA-256 integrity verified. Download directly into your machine below.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRestoredModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Restored Items List */}
            <div className="p-6 overflow-y-auto space-y-3">
              {newlyRestoredItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-[#080d19] border border-[#1e2c40] hover:border-emerald-500/40 transition rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="font-semibold text-sm text-white truncate max-w-xs md:max-w-md" title={item.filename}>
                        {item.filename}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                        item.status === "RECOVERED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-3">
                      <span>Size: <strong className="text-slate-200">{formatBytes(item.size_bytes)}</strong></span>
                      {item.sha256 && (
                        <span className="flex items-center gap-1 truncate max-w-xs" title={item.sha256}>
                          SHA-256: <strong className="text-cyan-300 font-mono">{item.sha256.slice(0, 16)}...</strong>
                          <button
                            onClick={() => copyHash(item.sha256)}
                            className="text-slate-400 hover:text-white ml-1 p-0.5"
                            title="Copy full SHA-256 hash"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>

                  {item.status === "RECOVERED" && (
                    <Button
                      onClick={() => downloadFile(item.filename)}
                      disabled={downloadingFile === item.filename}
                      loading={downloadingFile === item.filename}
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex-shrink-0 shadow-lg shadow-emerald-950/50"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> {downloadingFile === item.filename ? "Downloading..." : "Download to Machine"}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e2c40] bg-[#080d19] flex items-center justify-between">
              <div className="text-xs text-slate-400">
                {newlyRestoredItems.filter(i => i.status === "RECOVERED").length} file(s) restored with integrity verification
              </div>
              <div className="flex items-center gap-3">
                {newlyRestoredItems.filter(i => i.status === "RECOVERED").length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAllRestored}
                    className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download All ({newlyRestoredItems.filter(i => i.status === "RECOVERED").length})
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowRestoredModal(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forensic Examination Report Modal */}
      {showReportModal && reportData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-cyan-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e2c40] flex items-center justify-between bg-[#080d19]">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase mb-1">
                  <FileText className="w-3.5 h-3.5" /> ISO/IEC 27037 FORENSIC EXAMINATION REPORT
                </div>
                <h2 className="text-lg font-bold text-white">
                  {reportData.case_name || "Digital Forensic Recovery Examination"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Report ID: <span className="text-cyan-300">{reportData.report_id}</span> • Case ID: <span className="text-slate-300">{reportData.case_id}</span> • Generated {formatDate(reportData.generated_at)}
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed font-sans">
              {/* Target Hardware Architecture Profile */}
              <div className="bg-[#080d19] border border-[#1e2c40] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" /> Target Storage Profile & Hardware Architecture
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">DEVICE CLASSIFICATION:</span>
                    <span className="text-cyan-300 font-bold">{reportData.device_profile?.category || "Standard Storage"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">INTERFACE BUS:</span>
                    <span className="text-slate-200">{reportData.device_profile?.bus_type || "Universal"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">FILE SYSTEM:</span>
                    <span className="text-slate-200">{reportData.device_profile?.filesystem || "FAT32/exFAT/NTFS"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">TRIM / WEAR-LEVELING:</span>
                    <span className="text-slate-200">{reportData.device_profile?.trim_status || "Standard"}</span>
                  </div>
                </div>
              </div>

              {/* Forensic Acquisition Integrity Hash */}
              <div className="bg-gradient-to-r from-cyan-950/30 to-blue-950/20 border border-cyan-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-400" /> Bitstream Acquisition Integrity (SHA-256)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold">
                    VERIFIED MATCH
                  </span>
                </div>
                <div className="font-mono text-cyan-200 text-xs break-all bg-black/40 p-2.5 rounded-lg border border-cyan-500/20 flex items-center justify-between gap-2">
                  <span>{reportData.acquisition_hash}</span>
                  <button
                    onClick={() => copyHash(reportData.acquisition_hash)}
                    className="text-slate-400 hover:text-white p-1"
                    title="Copy Hash"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-cyan-400" /> Forensic Analysis Narrative
                </h3>
                <div className="bg-[#080d19] border border-[#1e2c40] rounded-xl p-4 text-slate-300 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                  {reportData.executive_summary}
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#080d19] border border-[#1e2c40] p-3 rounded-xl text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Total Discovered</div>
                  <div className="text-xl font-bold text-cyan-400 font-mono mt-1">{reportData.total_discovered}</div>
                </div>
                <div className="bg-[#080d19] border border-[#1e2c40] p-3 rounded-xl text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Successfully Restored</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{reportData.total_recovered}</div>
                </div>
                <div className="bg-[#080d19] border border-[#1e2c40] p-3 rounded-xl text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Chain of Custody Events</div>
                  <div className="text-xl font-bold text-purple-400 font-mono mt-1">{(reportData.chain_of_custody || []).length}</div>
                </div>
                <div className="bg-[#080d19] border border-[#1e2c40] p-3 rounded-xl text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Legal Admissibility</div>
                  <div className="text-xs font-bold text-emerald-300 font-mono mt-2">ISO 27037 VALID</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e2c40] bg-[#080d19] flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" /> Print / Save PDF
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowReportModal(false)}
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Elevation Info Modal */}
      {showElevationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0d1424] p-6 shadow-2xl text-slate-200">
            <button
              onClick={() => setShowElevationModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition p-1"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Administrator Access (UAC)</h3>
                <p className="text-xs text-slate-400">Low-Level Physical Drive Read Access</p>
              </div>
            </div>
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                A Windows <strong>User Account Control (UAC)</strong> prompt has been requested.
              </p>
              <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl text-amber-200">
                👉 Please check your screen or taskbar and click <strong>"Yes"</strong> on the Windows confirmation dialog.
              </div>
              <p className="text-slate-400">
                Once approved, the engine will automatically activate physical sector and NTFS Master File Table ($MFT) carving on drive D:.
              </p>
              <p className="text-slate-400">
                Alternative: You can also right-click <code className="text-cyan-300 bg-black/40 px-1 rounded">START.bat</code> or <code className="text-cyan-300 bg-black/40 px-1 rounded">RUN-AS-ADMIN.bat</code> and select <em>"Run as administrator"</em>.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-[#1e2c40]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  checkPrivileges();
                  setShowElevationModal(false);
                }}
              >
                Close
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => checkPrivileges()}
                loading={elevating}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              >
                Check Status Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
